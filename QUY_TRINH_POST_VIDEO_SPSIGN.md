# Quy Trình Post Video Shopee Qua SPSign (SPSign-v2 & Phone Gateway)

Tài liệu này mô tả chi tiết kiến trúc và toàn bộ luồng hoạt động (End-to-End) khi phần mềm **Shopee Video Upload Manager (`V13.3 - SPsign`)** đăng video từ máy tính (PC) lên Shopee Video thông qua hệ thống ký số điện thoại thật (**SPSign-v2 / LSPosed**).

---

## 1. Tổng Quan Kiến Trúc Hệ Thống

Hệ thống gồm **3 tầng chính** phối hợp với nhau:

1. **Tầng PC Uploader (`handle-upload.service.js`)**:
   - Đọc file video `.mp4` từ ổ cứng, trích xuất ảnh bìa (Cover), upload file vật lý lên Shopee Cloud CDN, lấy thông tin sản phẩm gắn giỏ hàng (`item_id`, `shop_id`), và đóng gói Payload bài đăng.
2. **Tầng Điều Phối & Cân Bằng Tải (`phone-gateway.service.js` + `adb.service.js`)**:
   - Quản lý danh sách nhiều điện thoại Android kết nối qua USB ADB (`localhost:8080`, `8081`, `8082`, `8083`...).
   - Chia tải **Round-Robin + Hàng đợi (`enqueuePhoneTask`)** đảm bảo mỗi thời điểm 1 điện thoại xử lý 1 phiên đăng bài độc lập, tự động đồng bộ thông số phần cứng (`app_info`) theo đúng chiếc điện thoại được chọn.
3. **Tầng Điện Thoại Ký Số (`SPSign-v2` chạy trong `com.shopee.vn`)**:
   - Điện thoại Android đã Root (Magisk + Zygisk + LSPosed + Shamiko).
   - Module Xposed **`com.example.spsign` (`SPSign-v2`)** inject trực tiếp vào tiến trình của App Shopee (`com.shopee.vn`), mở một HTTP Server nội bộ tại cổng `8080` trên điện thoại (được map về cổng `8080..8089` trên PC qua `adb forward`).
   - Module gọi trực tiếp hàm Native C++ (`libshpssdk.so`) của Shopee để sinh bộ chữ ký bảo mật (`x-sap-ri`, `af-ac-enc-sz-token`, `x-sap-sec`,...) và thực thi request trực tiếp qua OkHttp stack của điện thoại (đi kèm Proxy của từng tài khoản).

```mermaid
flowchart LR
    subgraph PC ["Máy Tính (Node.js Server :6868)"]
        U["handle-upload.service.js<br/>(Upload Video/Cover & Gom Sản Phẩm)"]
        G["phone-gateway.service.js<br/>(Gateway :8088 & Queue Điều Phối)"]
        A["adb.service.js<br/>(ADB Forward & Quản Lý Session)"]
    end

    subgraph Phones ["Dàn Điện Thoại Android (Root + LSPosed)"]
        P1["Phone #1 (tcp:8080)<br/>com.shopee.vn + SPSign-v2"]
        P2["Phone #2 (tcp:8081)<br/>com.shopee.vn + SPSign-v2"]
        P3["Phone #3 (tcp:8082)<br/>com.shopee.vn + SPSign-v2"]
        P4["Phone #4 (tcp:8083)<br/>com.shopee.vn + SPSign-v2"]
    end

    subgraph Shopee ["Hệ Thống Máy Chủ Shopee"]
        CDN["Shopee Media Cloud CDN<br/>(Upload Video & Ảnh Bìa)"]
        API["Shopee Video API<br/>(/precheck & /create_v2)"]
    end

    U -->|"1. Upload MP4 & Cover (qua Proxy)"| CDN
    U -->|"2. Gọi /api/precheck & /api/createpost"| G
    G <-->|"Quản lý trạng thái & Restart App"| A
    G -->|"3. Chia tải Round-Robin qua ADB Forward"| P1 & P2 & P3 & P4
    P1 & P2 & P3 & P4 -->|"4. Ký Native SDK + Gửi qua Proxy tài khoản"| API
```

---

## 2. Quy Trình Chi Tiết 7 Bước Khi Đăng 1 Video

Khi một luồng (Thread) bắt đầu xử lý một video trong hàng đợi (`processLocalVideoUpload`), quy trình diễn ra tuần tự qua **7 bước** sau:

### Bước 1: Kiểm tra & Chuẩn bị Dữ liệu Đầu Vào
- Kiểm tra file video `.mp4` tồn tại trên ổ đĩa (ví dụ `F:\Video AI\PH\Veo3go\xxx.mp4`).
- Kiểm tra thời lượng, dung lượng, độ phân giải (`width`, `height`, `duration`).
- Trích xuất khung hình đầu tiên làm ảnh bìa (Cover `.jpg`).
- Chuẩn hóa Cookie của tài khoản (đảm bảo có `SPC_EC`, `SPC_U`, `SPC_F`, `SPC_ST`, `shopee_app_version=...`) và cấu hình **HTTP Proxy** riêng của luồng đó (`host:port:user:pass`).

---

### Bước 2: Upload Ảnh Bìa (Cover) lên Shopee Cloud (`uploadCoverToShopee`)
- PC gửi ảnh bìa `.jpg` thông qua Proxy của tài khoản lên dịch vụ lưu trữ ảnh của Shopee.
- Nhận về mã định danh ảnh bìa (`cover_url` / image hash, ví dụ: `sg-11110159-...`).

---

### Bước 3: Upload File Video `.mp4` lên Shopee Cloud CDN (`uploadShopeeVideo`)
Quá trình đưa file video vật lý lên hạ tầng lưu trữ của Shopee gồm 3 bước nhỏ:
1. **`getUploadInfo`**: Xin cấp phát phiên upload (`vid`, `upload_url`, `token`) từ Shopee Video Upload API.
2. **Upload Binary / Chunk**: Đẩy dữ liệu file `.mp4` từ ổ cứng lên máy chủ lưu trữ đám mây (Vod/S3/Shopee CDN) thông qua Proxy của tài khoản.
3. **`reportUpload`**: Báo cáo hoàn tất quá trình tải file vật lý để Shopee xác nhận `video_id` và `video_url` hợp lệ.

> **Lưu ý:** Từ Bước 1 đến Bước 3 chỉ là tải file media lên kho lưu trữ tạm của Shopee, chưa tạo bài viết hiển thị trên kênh và chưa cần gọi điện thoại SPSign.

---

### Bước 4: Xử Lý Link Sản Phẩm & Gắn Giỏ Hàng (Affiliate / Product Tags)
- Từ danh sách link sản phẩm trong file Excel/Google Sheet (tối đa 6 sản phẩm/video):
  - Trích xuất `shop_id` và `item_id` từ URL sản phẩm.
  - Truy vấn thông tin chi tiết sản phẩm (`product-crawler.service.js`) để lấy tên sản phẩm, giá, ảnh thumbnail và trạng thái hợp lệ để đóng gói vào mảng `item_card_infos` / `product_tags`.
- Kết hợp nội dung **Caption + Hashtag** và cờ **AIGC** (nếu bật).

---

### Bước 5: Điều Phối Điện Thoại Trong Pool (`enqueuePhoneTask`)
Khi PC gọi hàm tạo bài đăng (`createPost`), yêu cầu được chuyển vào **`phone-gateway.service.js`**:
1. **Chọn máy rảnh (`pickIdlePhoneUrl`)**:
   - Hệ thống quét danh sách các cổng ADB đang kích hoạt (`http://127.0.0.1:8080`, `8081`, `8082`, `8083`).
   - Chọn máy đang rảnh theo thuật toán **Round-Robin** (xoay vòng đều giữa các máy). Nếu cả 4 máy đều đang bận ký cho luồng khác, yêu cầu sẽ nằm trong hàng đợi (`waitQueue`) chờ máy vừa xong việc tiếp nhận ngay.
2. **Đồng bộ thông số thiết bị (`syncAppInfoWithAssignedPhone`)**:
   - Mỗi chiếc điện thoại có cấu hình khác nhau (ví dụ `TIGER 10` chạy Android 13 SDK `33`, còn `Samsung SM-G990E` chạy Android 14 SDK `34`).
   - Gateway tự động lấy hồ sơ thật của chiếc điện thoại được phân công (`adbService.getProfileForUrl(assignedBaseUrl)`) và ghi đè vào trường `app_info` trong JSON gửi lên Shopee:
     ```json
     "app_info": {
       "system_os": "Android",
       "system_version": "34",
       "app_version": "37119",
       "device_model": "SM-G990E_34"
     }
     ```
   - Việc đồng bộ này giúp chữ ký sinh ra từ `libshpssdk.so` trên máy nào thì khớp 100% với `app_info` và `client-info` của máy đó, tránh lỗi lệch vân tay thiết bị (`HTTP 418` / `90309999`).

---

### Bước 6: Làm Mới Phiên Shopee SDK & Gọi `/api/precheck` Trên Điện Thoại
Trước khi tạo bài đăng chính thức, Shopee bắt buộc phải gọi API **`/api/v2/biz/post/precheck`** để lấy chuỗi xác thực ngữ cảnh **`extra_context`**:

1. **Làm mới phiên chống Anti-Bot (`restartShopeeAppForSign`)**:
   - Nếu chiếc điện thoại được chọn vừa ký cho một tài khoản (`SPC_U`) khác hoặc phiên đã quá hạn, `adb.service.js` sẽ chạy lệnh Root ngầm trên điện thoại để nạp lại bộ dữ liệu SDK chuẩn (`sp_phone_backup` -> `/data/data/com.shopee.vn/`) và khởi động lại tiến trình `com.shopee.vn` ở chế độ nền (Headless) chỉ trong ~2–3 giây.
2. **Thực thi `/api/precheck` qua `SPSign-v2`**:
   - Gateway gửi lệnh `POST http://127.0.0.1:<port>/api/precheck` kèm `url`, `data`, `cookie`, `proxy` xuống điện thoại.
   - Bên trong điện thoại, module `SPSign-v2` gọi Native SDK của Shopee để ký chuỗi URL + Body của `precheck`, sau đó gửi request đi qua **Proxy của tài khoản** tới `https://sv.shopee.<country>/api/v2/biz/post/precheck`.
   - Shopee trả về chuỗi **`extra_context`** (token xác nhận phiên đăng bài hợp lệ). Gateway tự động nhét `extra_context` này vào Payload chính của bài đăng.

---

### Bước 7: Ký Số & Tạo Bài Đăng Chính Thức (`/api/createpost` -> `create_v2`)
Ngay sau khi có `extra_context` từ bước Precheck:

1. **Gửi lệnh xuống điện thoại**:
   - Gateway gọi `POST http://127.0.0.1:<port>/api/createpost` trên cùng chiếc điện thoại vừa thực hiện `precheck`.
   - Payload bao gồm:
     - `url`: `https://sv.shopee.<quốc_gia>/api/v2/biz/post/create_v2` (ví dụ `sv.shopee.vn`, `sv.shopee.ph`, `sv.shopee.my`, `sv.shopee.co.id`).
     - `data`: Chuỗi JSON chứa `video` (`video_id`, `url`, `cover`, `duration`,...), `caption`, `hashtags`, `item_card_infos` (sản phẩm gắn giỏ), `extra_context`, `app_info`.
     - `cookie`: Cookie tài khoản Shopee.
     - `proxy`: Proxy riêng của tài khoản (`http://user:pass@host:port`).
2. **Xử lý bên trong `SPSign-v2` (trên điện thoại Android)**:
   - Module Xposed `com.example.spsign` nhận request tại cổng `8080`.
   - Gọi hàm Native trong thư viện bảo mật của Shopee (`libshpssdk.so`) để tính toán bộ Header chống giả mạo theo đúng thời gian thực và nội dung Body:
     - `x-sap-ri` (Request Identifier + chữ ký)
     - `X-Sap-Access-S` / `x-sap-sec` (Security Token)
     - `af-ac-enc-sz-token` (Anti-Fraud Device Risk Token dài ~155-159 ký tự)
     - `client-info`, `User-Agent: okhttp/3.12.4 app_type=1`, `X-CSRFToken`
   - Điện thoại gửi trực tiếp HTTP POST tới máy chủ Shopee thông qua **Proxy của tài khoản**.
3. **Nhận kết quả & Trả về PC**:
   - Nếu thành công (`code === 0`), Shopee trả về **`post_id`** (ví dụ: `post_id: "123456789"`).
   - Hệ thống tạo link video hoàn chỉnh (`https://sv.shopee.<domain>/share-video/<post_id>`), lưu vào lịch sử Database, tăng bộ đếm `videos_uploaded` của luồng và chuyển sang thời gian nghỉ (`delay_min` – `delay_max`) trước khi đăng video tiếp theo.

---

## 3. Sơ Đồ Tuần Tự (Sequence Diagram) Của Bước 6 & 7

```mermaid
sequenceDiagram
    autonumber
    participant UL as handle-upload.service.js
    participant GW as phone-gateway.service.js
    participant ADB as adb.service.js
    participant PH as Điện Thoại (SPSign-v2 :8080)
    participant SP as Máy Chủ Shopee (sv.shopee.*)

    UL->>GW: POST /api/createpost (url, data, cookie, proxy)
    GW->>GW: enqueuePhoneTask() -> Chọn máy rảnh (8080..8083)
    GW->>ADB: Lấy Profile phần cứng máy được chọn (SDK, Model)
    GW->>ADB: restartShopeeAppForSign() (Làm mới phiên cho User SPC_U)
    ADB->>PH: Khôi phục SDK state & mở ngầm com.shopee.vn
    PH-->>ADB: SDK Ready (sdk_loaded: true, risk_token_len: 159)
    GW->>PH: POST /api/precheck (url, precheckPayload, cookie, proxy)
    PH->>PH: Ký Native (libshpssdk.so) -> x-sap-ri, af-ac-enc-sz-token
    PH->>SP: POST /api/v2/biz/post/precheck (qua Proxy tài khoản)
    SP-->>PH: 200 OK (extra_context)
    PH-->>GW: Trả về extra_context
    GW->>GW: Gắn extra_context + app_info vào dataStr
    GW->>PH: POST /api/createpost (url, dataStr, cookie, proxy)
    PH->>PH: Ký Native (libshpssdk.so) cho payload create_v2
    PH->>SP: POST /api/v2/biz/post/create_v2 (qua Proxy tài khoản)
    SP-->>PH: 200 OK (code: 0, post_id)
    PH-->>GW: Trả về kết quả đăng bài
    GW-->>UL: { code: 0, data: { post_id: "..." } }
```

---

## 4. Cơ Chế Tự Phục Hồi & Xử Lý Lỗi Tự Động

Hệ thống được tích hợp sẵn các lớp bảo vệ tự động trong quá trình đăng bài qua SPSign:

| Tình huống / Mã lỗi | Nguyên nhân | Cơ chế tự động xử lý |
| :--- | :--- | :--- |
| **`HTTP 418` / `90309999` / `98001004` / `300014`** | Phiên SDK hết hạn, thiếu `extra_context` hoặc Shopee yêu cầu làm mới phiên chống bot | `phone-gateway.service.js` tự động chạy lại `restartShopeeAppForSign()`, lấy lại `precheck` (`extra_context` mới) và gửi lại `/api/createpost` ngay lập tức. |
| **Một điện thoại bị ngắt kết nối hoặc treo App** | Cáp USB lỏng hoặc tiến trình `com.shopee.vn` bị tắt | `callLocalPhoneWithRetry()` tự động gọi `ensurePhoneSignReady()` để bật lại App + đặt lại `adb forward`, hoặc chuyển tiếp sang điện thoại khác đang hoạt động trong Pool. |
| **Lỗi Cookie hết hạn (`HTTP 403` / `Cookie expired`)** | Cookie tài khoản bị văng hoặc hết hạn phiên đăng nhập | Kích hoạt `cookie-recovery.service.js` (Lớp 1: Silent Refresh qua `SPC_EC` -> Lớp 2: Đồng bộ từ Extension -> Lớp 3: Tự động mở GemLogin lấy lại Cookie mới). |
| **Nhiều luồng cùng chạy đồng thời** | Nhiều tài khoản đến giờ đăng video cùng lúc | Hàng đợi `enqueuePhoneTask()` phân phối tuần tự vào 4 điện thoại (`8080`, `8081`, `8082`, `8083`) giúp chạy song song tối đa 4 luồng ký cùng lúc mà không xung đột Session giữa các tài khoản. |

---

## 5. Các File Mã Nguồn Liên Quan Trong Dự Án

- [`src/services/handle-upload.service.js`](src/services/handle-upload.service.js): Luồng chính xử lý upload file video/cover, gắn sản phẩm và gọi API tạo bài viết.
- [`src/services/phone-gateway.service.js`](src/services/phone-gateway.service.js): Cổng điều phối trung tâm (`:8088` / nội bộ), quản lý hàng đợi chia tải đa điện thoại, đồng bộ `app_info`, tự động ghép nối `precheck` + `createpost`.
- [`src/services/adb.service.js`](src/services/adb.service.js): Quản lý kết nối ADB (`5038`/`5037`), tự động `adb forward`, kiểm tra sức khỏe `/api/debug_info` và làm mới phiên Shopee (`restartShopeeAppForSign`).
- [`src/routes/config.routes.js`](src/routes/config.routes.js): Các API giao diện Cài đặt cho phép quét, chọn kích hoạt nhiều điện thoại và kiểm tra tốc độ ký số (`Test Phone Sign`).
