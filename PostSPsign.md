# Tài Liệu Kỹ Thuật Toàn Diện: Hệ Thống Upload Video Shopee & Ký Số Nội Bộ (SPsign - TIGER 10)

Tài liệu này lưu trữ toàn bộ kiến trúc, thông số thiết bị, quy trình hoạt động, thuật toán điều phối 1000 luồng và các đoạn code cốt lõi của hệ thống **Tool Upload Local Video Shopee MLS V13.3 - SPsign**.

---

## 1. Kiến Trúc Tổng Thể Hệ Thống

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   MÁY CHỦ TRUNG TÂM (CENTRAL HOST)                         │
│  • IP Tailscale: 100.79.170.67   | IP LAN: 192.168.1.247                   │
│  • Web UI Tool : http://127.0.0.1:6868                                     │
│  • Phone Sign Gateway: lắng nghe cổng 8080 trên IP Tailscale & LAN         │
│    (http://100.79.170.67:8080 | Secret Key: ThinAPTM)                      │
│  • ADB Bridge  : 127.0.0.1:8080 ──(USB ADB Forward)──► Điện thoại TIGER 10 │
└───────────────▲───────────────────────────────────────────┬────────────────┘
                │                                           │
   Gọi ký số qua Tailscale                     USB ADB (tcp:8080 -> tcp:8080)
   http://100.79.170.67:8080                                │
   Header: X-API-Key: ThinAPTM                              ▼
                │                             ┌──────────────────────────────┐
┌───────────────┴───────────────┐             │   ĐIỆN THOẠI KÝ SỐ ROOT      │
│  CÁC MÁY TRẠM (WORKSTATIONS)  │             │  • Model : OSCAL TIGER 10    │
│  • Chạy Tool Upload độc lập   │             │  • Serial: TIGER10VN0000332  │
│  • Cấu hình Phone Sign:       │             │  • OS    : Android 13 (33)   │
│    URL: http://100.79.170.67:8080           │  • App   : com.shopee.vn     │
│    Key: ThinAPTM              │             │  • Ver   : 3.64.48 (36448)   │
└───────────────────────────────┘             └──────────────────────────────┘
```

### Nguyên lý phân tách cổng `8080` trên Máy Chủ Trung Tâm:
- **`127.0.0.1:8080` (Loopback):** Dành riêng cho `adb.exe` thực hiện `adb -s TIGER10VN0000332 forward tcp:8080 tcp:8080` nối thẳng vào server ký số bên trong điện thoại.
- **`100.79.170.67:8080` (Tailscale) & `192.168.1.247:8080` (LAN):** Do `phone-gateway.service.js` của Node.js lắng nghe để tiếp nhận yêu cầu ký số từ tất cả các máy trạm trong mạng nội bộ/Tailscale, kiểm tra `Secret Key` (`ThinAPTM`), rồi chuyển tiếp vào `127.0.0.1:8080`.
- **Chống tự lặp (Anti-Self-Loop):** Khi ngay trên máy chủ trung tâm cũng cấu hình `URL Phone Sign = http://100.79.170.67:8080`, hàm `_isSelfHost()` trong `adb.service.js` tự động nhận diện IP của chính máy chủ và định tuyến thẳng về `http://127.0.0.1:8080`, tránh vòng lặp vô tận.

---

## 2. Thông Số Chuẩn Của Điện Thoại Ký Số (`OSCAL TIGER 10`)

Mọi gói tin gửi lên Shopee (từ bước lấy Cookie, ký số `SAP`, lấy `Extra` cho đến bước `createPost`) đều được đồng bộ theo hồ sơ phần cứng thực tế của máy **OSCAL TIGER 10**:

| Thuộc tính | Giá trị chuẩn |
| :--- | :--- |
| **Serial ADB** | `TIGER10VN0000332` |
| **Brand / Manufacturer** | `OSCAL` |
| **Device Model** | `TIGER 10` |
| **Android Version / SDK** | Android 13 / SDK `33` |
| **Android ID (`device_id`)** | `71b3dce4491d44b7` |
| **Package Name** | `com.shopee.vn` |
| **App Version Code** | `36448` |
| **App Version Name** | `3.64.48` |
| **RN Version** | `6.97.5` |
| **RN Bundle (`SPC_RNBV`)** | `6081003` |
| **`device_model` (trong `app_info`)** | `Brand/OSCAL Model/TIGER 10 OSVer/33 Manufacturer/OSCAL` |
| **`live_device_model`** | `oscal+tiger+10` |
| **`client-info` Header** | `device_id=71b3dce4491d44b7;device_model=TIGER 10;os=0;os_version=33;client_version=36448;network=1;platform=1;rn_version=6.97.5;api_source=na;cpu_model=;live_device_model=oscal+tiger+10` |
| **`User-Agent` (OkHttp)** | `okhttp/3.12.4 app_type=1 platform=native_android os_ver=33 appver=36448` |
| **`User-Agent` (Cronet)** | `okhttp/3.12.4 app_type=1 platform=native_android os_ver=33 appver=36448 Cronet/102.0.5005.61` |

---

## 3. Quy Trình & Thuật Toán Lấy Cookie (`cookie_shopee` Extension)

### 3.1. Cơ chế hoạt động
1. **Giả lập thiết bị TIGER 10 ở tầng Mạng (`declarativeNetRequest`):**
   - Extension gắn rule ID `1001` ghi đè header `User-Agent` trên mọi request tới tên miền Shopee (`shopee.vn`, `shopee.ph`, `shopee.com.my`, `shopee.tw`, `shopee.co.th`, `shopee.sg`, `shopee.co.id`) thành:
     ```
     Mozilla/5.0 (Linux; Android 13; TIGER 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36
     ```
2. **Giả lập thiết bị ở tầng JavaScript (`overrideNavigator` trong `inject.js`):**
   - Tiêm trực tiếp vào `world: 'MAIN'` (mọi frame) khi tab đang `loading` để ghi đè:
     - `navigator.userAgent` & `navigator.appVersion`
     - `navigator.platform = 'Linux armv8l'`
     - `navigator.maxTouchPoints = 5`
     - `navigator.vendor = 'Google Inc.'`
3. **Thuật toán trích xuất `csrftoken` & gộp Cookie đa nguồn (`popup.js` + `background.js`):**
   - **Nguồn 1 (`webRequest.onBeforeSendHeaders` kèm cờ `'extraHeaders'`):** Bắt trực tiếp header `Cookie` thật gửi lên server Shopee theo đúng `tabId` (chứa đầy đủ cả cookie `HttpOnly` như `SPC_ST`, `SPC_EC`, `SPC_F`, `SPC_U` lẫn cookie của các tiện ích chia phiên/Container như SessionBox `PH3009`).
   - **Nguồn 2 (`document.cookie` trong Tab):** Đọc trực tiếp từ DOM của tab đang mở (`extractCsrfData` & `fetchWithCreds`).
   - **Nguồn 3 (`chrome.cookies.getAll` kèm `storeId: activeTab.cookieStoreId`):** Đọc toàn bộ cookie theo cả `url` và `domain` trên đúng `cookieStoreId` của tab.
   - **Loại bỏ trùng lặp & gắn hậu tố chuẩn TIGER 10 (`36448`):**
     ```
     csrftoken=<token>; ...; language=<vi|en>; SPC_RNBV=6081003; shopee_app_version=36448; shopee_rn_bundle_version=6081003; shopee_rn_version=1763129064
     ```

### 3.2. Code chuẩn xây dựng Cookie trong `cookie_shopee/popup.js`
```javascript
const TIGER10_APP_VERSION = '36448';
const TIGER10_RN_BUNDLE_VERSION = '6081003';
const TIGER10_RN_VERSION = '1763129064';

function buildFinalCookieString(rawCookiesList, csrfToken, shopeeInfo) {
  const excludedNames = new Set([
    'csrftoken',
    'shopee_app_version',
    'SPC_RNBV',
    'shopee_rn_bundle_version',
    'shopee_rn_version'
  ]);

  let hasLanguage = false;
  const filteredPairs = [];

  for (const c of rawCookiesList) {
    if (!c || !c.name) continue;
    if (excludedNames.has(c.name)) continue;
    if (c.name === 'language') hasLanguage = true;
    filteredPairs.push(`${c.name}=${c.value}`);
  }

  let cookieStr = filteredPairs.join('; ');
  if (csrfToken) {
    cookieStr = `csrftoken=${csrfToken}; ` + cookieStr;
  }

  const defaultLang = (shopeeInfo && shopeeInfo.lang) ? shopeeInfo.lang : 'vi';
  const langPart = hasLanguage ? '' : `; language=${defaultLang}`;

  cookieStr += `${langPart}; SPC_RNBV=${TIGER10_RN_BUNDLE_VERSION}; shopee_app_version=${TIGER10_APP_VERSION}; shopee_rn_bundle_version=${TIGER10_RN_BUNDLE_VERSION}; shopee_rn_version=${TIGER10_RN_VERSION}`;
  return cookieStr;
}
```

---

## 4. Quy Trình & Thuật Toán Ký Số (Phone Sign & Self-Healing ADB)

### 4.1. Các Endpoint trên Điện Thoại Ký Số (`127.0.0.1:8080`)
Agent chạy ngầm trong tiến trình App Shopee trên máy `OSCAL TIGER 10` cung cấp HTTP Server nội bộ ở cổng `8080`:
1. **`GET /api/debug_info`**:
   - Trả về trạng thái nạp SDK bảo mật của Shopee:
     ```json
     {
       "status": "ok",
       "sdk_loaded": true,
       "package": "com.shopee.vn",
       "model": "TIGER 10",
       "brand": "OSCAL",
       "sdk_int": 33,
       "android_id": "71b3dce4491d44b7"
     }
     ```
2. **`POST /api/sign`**:
   - Đầu vào: `{ "url": "<Shopee API URL>", "body": "<JSON string>" }`
   - Đầu ra: Bộ chữ ký bảo mật Shopee Anti-Bot (SAP):
     - `x-sap-ri`: Chuỗi định danh request (52 ký tự hex + tham số).
     - `x-sap-sec`: Chữ ký mã hóa bảo mật của payload.
     - `af-ac-enc-dat`: Dữ liệu fingerprint thiết bị.
     - `af-ac-enc-sz-token`: Token chống gian lận thiết bị.
3. **`POST /api/post_from_app`**:
   - Thực thi trực tiếp HTTP POST từ bên trong tiến trình App Shopee của điện thoại.

### 4.2. Thuật toán Tự Phục Hồi Kết Nối ADB (`ensurePhoneSignReady` trong `src/services/adb.service.js`)
Để đảm bảo điện thoại hoạt động liên tục 24/7 mà không bị treo socket hay văng app:
1. **HTTP No-KeepAlive (`Connection: close`):**
   - NanoHTTPD trên Android có giới hạn thread pool nhỏ. Nếu Node.js giữ kết nối `keep-alive`, các socket cũ sẽ chiếm hết slot gây lỗi `socket hang up`. Do đó mọi request tới `127.0.0.1:8080` đều dùng `new http.Agent({ keepAlive: false })`.
2. **Single-Flight Mutex (`_ensurePromise`):**
   - Khi chạy 1000 luồng, nếu kết nối ADB bị gián đoạn, chỉ **1 luồng duy nhất** thực hiện quy trình khôi phục ADB (`forwardPort` + mở lại app Shopee), 999 luồng còn lại chờ chung trên cùng `_ensurePromise`, tránh làm treo `adb.exe`.
3. **Quy trình 3 bước khôi phục tự động:**
   - **Bước 1:** Gọi thử `GET http://127.0.0.1:8080/api/debug_info` (timeout 2.5s). Nếu `sdk_loaded === true`, trả về ngay lập tức (~26ms).
   - **Bước 2:** Nếu lỗi kết nối, tự động quét thiết bị USB (`TIGER10VN0000332`) và chạy lại `adb -s TIGER10VN0000332 forward tcp:8080 tcp:8080`.
   - **Bước 3:** Nếu app Shopee trên điện thoại bị tắt (`ECONNREFUSED` hoặc `sdk_loaded: false`), tự động đánh thức màn hình và mở lại `com.shopee.vn`:
     ```bash
     adb -s TIGER10VN0000332 shell input keyevent 224
     adb -s TIGER10VN0000332 shell monkey -p com.shopee.vn -c android.intent.category.LAUNCHER 1
     ```
     Sau đó đợi tối đa 6 lần (mỗi lần 1.5s) cho tới khi `sdk_loaded === true`.

---

## 5. Quy Trình Upload Video Shopee Hoàn Chỉnh (`src/services/handle-upload.service.js`)

Mỗi luồng upload video thực hiện tuần tự 6 bước:

```
[1. Chuẩn bị File & Tách Cover]
       │
       ▼
[2. Upload Ảnh Bìa (uploadCoverToShopee)]
       │
       ▼
[3. Xin cấp Token Upload Video (getUploadInfo)]
       │
       ▼
[4. Đẩy File Video lên WCS Server (uploadShopeeVideo)]
       │
       ▼
[5. Báo cáo Upload & Ký số lấy Extra (reportUpload + getExtra)]
       │
       ▼
[6. Ký số & Đăng bài kèm Giỏ hàng (createPost)]
```

### Chi tiết từng bước:
1. **Bước 1 — Xác thực Video & Trích xuất Cover:**
   - Kiểm tra dung lượng file video, đọc `width`, `height`, `duration` qua FFprobe/FFmpeg và trích xuất khung hình đầu tiên làm ảnh bìa `.jpg`.
2. **Bước 2 — Upload Ảnh Bìa (`uploadCoverToShopee`):**
   - Upload ảnh bìa lên máy chủ media của Shopee để nhận mã `cover_id` / URL ảnh bìa.
3. **Bước 3 — Lấy Thông Tin Upload (`getUploadInfo`):**
   - Gửi yêu cầu khởi tạo phiên upload video với `User-Agent: okhttp/3.12.4 app_type=1 platform=native_android os_ver=33 appver=36448`, nhận về `vid` (Video ID), `upload_url`, và `token`.
4. **Bước 4 — Upload File Video (`uploadShopeeVideo`):**
   - Đẩy binary stream của video lên WCS Server với header `User-Agent: WCS-Android-SDK-1.6.8`.
5. **Bước 5 — Báo cáo Upload (`reportUpload`) & Lấy Extra (`getExtra`):**
   - Báo cáo thông số video (`size`, `duration`, `width`, `height`) đã đẩy lên thành công.
   - Gửi payload chứa `app_info` chuẩn **TIGER 10** qua Phone Sign (`/api/sign`) để ký chữ ký bảo mật (`x-sap-ri`, `x-sap-sec`, `af-ac-enc-dat`, `af-ac-enc-sz-token`), rồi gọi API Shopee lấy dữ liệu cấu hình đăng bài (`getExtra`).
6. **Bước 6 — Tạo Bài Đăng Video (`createPost`):**
   - Đóng gói payload bài đăng:
     ```json
     {
       "content": {
         "caption": "...",
         "video": { "video_id": "...", "cover": "...", "width": 720, "height": 1280, "duration": 15000 },
         "products": [
           { "item_id": 123456, "shop_id": 654321, "source_tab": 3 }
         ]
       },
       "app_info": {
         "system_os": "Android",
         "system_version": "33",
         "app_version": "36448",
         "device_model": "Brand/OSCAL Model/TIGER 10 OSVer/33 Manufacturer/OSCAL"
       }
     }
     ```
   - Gửi URL `/api/v1/homepage/post/` và JSON payload qua **Phone Sign** (`/api/sign`) để lấy bộ chữ ký SAP.
   - Gửi request POST trực tiếp tới Shopee qua Proxy của luồng kèm đầy đủ bộ Header đã ký (`x-sap-ri`, `x-sap-sec`, `af-ac-enc-dat`, `af-ac-enc-sz-token`, `client-info`, `X-CSRFToken`, `User-Agent`).
   - Nhận về `post_id` và xuất đường dẫn video hoàn chỉnh (`https://sv.shopee.<domain>/share-video/...`).

---

## 6. Thuật Toán Điều Phối 1000 Luồng Chạy Ổn Định (Staggered Start `200ms`)

### 6.1. Bài toán
- Khi bấm **"Chạy tất cả"** hoặc **"Chạy đã chọn"** với **1000 luồng**, nếu cả 1000 luồng cùng khởi chạy tại `t = 0`:
  - 1000 tiến trình FFmpeg và HTTP request sẽ bùng nổ cùng lúc làm nghẽn CPU/RAM.
  - 1000 yêu cầu ký số dồn dập vào cổng `8080` của điện thoại trong cùng 1 mili-giây sẽ làm tràn hàng đợi socket ADB.
- Do thời gian phản hồi thực tế của Phone Sign trên máy **TIGER 10** chỉ mất **~26ms - 31ms/request**, khoảng cách tối ưu giữa các luồng là **`200ms` (`0.2s` / luồng)**, tương đương **5 luồng khởi chạy mỗi giây** (1000 luồng được phân phối mượt mà trong đúng **200 giây ≈ 3 phút 20 giây**).

### 6.2. Công thức Toán học & Cơ chế 2 Tầng
1. **Tầng Database (`src/models/thread.model.js` & `src/services/import.service.js`):**
   - Khi kích hoạt hàng loạt $N$ luồng ($i = 0, 1, \dots, N-1$), mỗi luồng thứ $i$ được gán mốc thời gian chạy dự kiến `next_run_at` (tính theo giây Unix):
     $$\text{next\_run\_at}_i = \text{nowSec} + \lfloor i \times 0.2 \rfloor$$
   - Như vậy cứ mỗi **1 giây**, có đúng **5 luồng** đủ điều kiện `next_run_at <= nowSec`.
2. **Tầng Bộ lập lịch Cron (`src/jobs/cron.js`):**
   - Vòng lặp Cron quét mỗi `1000ms` (`1 giây`), lấy danh sách các luồng đến hạn theo thứ tự `ORDER BY COALESCE(threads.next_run_at, 0) ASC, threads.id ASC`.
   - Trong mỗi nhóm 5 luồng của giây hiện tại, Cron không tung cả 5 luồng cùng lúc ở `0ms`, mà rải đều từng luồng cách nhau **`200ms`** (`0ms`, `200ms`, `400ms`, `600ms`, `800ms`):
     $$\text{delayMs}_{\text{idx}} = \text{idx} \times 200\text{ (ms)}$$

### 6.3. Code cốt lõi điều phối Staggered Start

#### Trong `src/models/thread.model.js`:
```javascript
// Kích hoạt tất cả luồng cách nhau 0.2s (200ms = 5 luồng/giây)
static async resetAllToInprogressThreads(staggerSeconds = 0.2) {
  const rows = await db.allAsync(
    `SELECT id FROM threads WHERE status != 'inprogress' ORDER BY id ASC`
  );
  if (!rows || rows.length === 0) return { changes: 0 };

  const nowSec = Math.floor(Date.now() / 1000);
  await db.runAsync('BEGIN TRANSACTION');
  try {
    for (let i = 0; i < rows.length; i++) {
      const nextRunAt = nowSec + Math.floor(i * staggerSeconds);
      await db.runAsync(
        `UPDATE threads SET status = 'inprogress', next_run_at = ? WHERE id = ?`,
        [nextRunAt, rows[i].id]
      );
    }
    await db.runAsync('COMMIT');
    return { changes: rows.length };
  } catch (err) {
    await db.runAsync('ROLLBACK');
    throw err;
  }
}
```

#### Trong `src/jobs/cron.js`:
```javascript
const STAGGER_MS = 200; // 200ms/luồng = 5 luồng/giây

inProgressThreads.forEach((thread, idx) => {
  if (runningThreads.has(thread.id)) return;
  runningThreads.add(thread.id);

  const delayMs = idx * STAGGER_MS;
  setTimeout(async () => {
    try {
      const freshThread = await Thread.getById(thread.id);
      if (!freshThread || freshThread.status !== 'inprogress') return;
      await processThreadVideos(freshThread);
    } catch (err) {
      console.error(`Error in thread ${thread.id}:`, err);
    } finally {
      runningThreads.delete(thread.id);
    }
  }, delayMs);
});
```

---

## 7. Cấu Hình Mạng Nội Bộ / Tailscale & Mở Cổng Firewall

### 7.1. Thông số mặc định Phone Sign
- **URL Phone Sign:** `http://100.79.170.67:8080`
- **Secret Key:** `ThinAPTM`

### 7.2. Lệnh mở cổng `8080` trên Windows Firewall (Máy Chủ Trung Tâm)
Chạy file [`Mo_Port_8080.bat`](file:///e:/Tool-Upload-Local-VideoShopee-MLS-V13.3%20-%20SPsign/Mo_Port_8080.bat) (tự động xin quyền Administrator) hoặc chạy trực tiếp trong PowerShell (Admin):
```powershell
New-NetFirewallRule -DisplayName "PhoneSign Tailscale 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### 7.3. Kiểm tra nhanh trạng thái Phone Sign từ Máy Trạm
Từ trình duyệt hoặc PowerShell của bất kỳ máy trạm nào trong mạng Tailscale, có thể kiểm tra kết nối tới điện thoại ký số bằng lệnh:
```powershell
Invoke-RestMethod -Uri "http://100.79.170.67:8080/api/debug_info" -Headers @{ "X-API-Key" = "ThinAPTM" }
```
Kết quả trả về `status: "ok"`, `sdk_loaded: true`, `model: "TIGER 10"` là hệ thống sẵn sàng 100%.

---

## 8. Hệ Thống Khôi Phục Cookie Tự Động 3 Lớp (Lớp 1 + Lớp 2 + Lớp 3)

File trung tâm xử lý: [`src/services/cookie-recovery.service.js`](file:///e:/Tool-Upload-Local-VideoShopee-MLS-V13.3%20-%20SPsign/src/services/cookie-recovery.service.js)

### 8.1. Lớp 1 — Silent Cookie Auto-Refresh (Tự Làm Mới Ngầm Không Cần Mở Trình Duyệt)
- Khi một luồng gặp lỗi Cookie (`Cookie expired`, `Cookie hết hạn`, `401`, `403`, `getUploadInfo failed: Cookie`), trước khi đánh dấu lỗi luồng, [`src/jobs/cron.js`](file:///e:/Tool-Upload-Local-VideoShopee-MLS-V13.3%20-%20SPsign/src/jobs/cron.js) tự động gọi `silentRefreshCookie(cookieStr, country, proxyObj)`.
- Gửi request nhẹ đến `https://shopee.<tld>/?is_from_login=true` và `ACCOUNT_INFO_URL` qua Proxy của luồng với bộ Header **OSCAL TIGER 10 (`36448`)**.
- Bắt toàn bộ header `Set-Cookie` trả về từ Shopee để gia hạn `SPC_ST`, `SPC_SI`, `SPC_SEC_SI`, `csrftoken` dựa trên các Refresh Token (`SPC_EC`, `SPC_R_T_ID`, `SPC_R_T_IV`, `SPC_T_ID`, `SPC_T_IV`).
- Nếu phiên hợp lệ (`userid` trả về thành công), tự động lưu Cookie mới vào SQLite (`users.cookie`), xóa lỗi luồng và cho chạy lại ngay sau 4 giây.

### 8.2. Lớp 2 — Đồng Bộ Tự Động & 1-Click Từ Extension `cookie_shopee` Về Tool MLS (`127.0.0.1:6868`)
- Khi mở bất kỳ Profile GemLogin nào hoặc bấm vào icon Extension [`cookie_shopee`](file:///e:/Tool-Upload-Local-VideoShopee-MLS-V13.3%20-%20SPsign/cookie_shopee/popup.js):
  - `background.js` và `popup.js` tự động gọi `POST http://127.0.0.1:6868/api/threads/cookie-sync`.
  - Backend tự động kết nối vào cổng `--remote-debugging-port` (CDP `Storage.getCookies`) hoặc file SQLite `<profile_path>/Cookies` của GemLogin để lấy **100% các khóa HttpOnly** (`SPC_ST`, `SPC_F`, `SPC_U`, `SPC_R_T_ID`, `SPC_T_ID`, `SPC_SI`, `SPC_SEC_SI`) kể cả khi trình duyệt GemLogin ẩn HttpOnly khỏi `chrome.cookies`.
  - Tự động nhận diện và khớp chính xác với luồng trong Tool MLS theo thứ tự ưu tiên:
    1. `threadId` được chọn thủ công trong Dropdown.
    2. `SPC_U` (Shopee User ID — chính xác tuyệt đối 100%).
    3. `SPC_F` (Device Fingerprint ID).
    4. `Username` trùng với tên Profile GemLogin (ví dụ: `PH3009`, `PH3001`, `S29`).
  - Tự động cập nhật `users.cookie`, xóa lỗi (`error = NULL`), chuyển `status = 'inprogress'` và trả lại chuỗi Cookie đầy đủ (3000+ ký tự) hiển thị ngay trên Popup Extension.

### 8.3. Lớp 3 — Tích Hợp Trực Tiếp GemLogin Local API (`127.0.0.1:1010`) + SQLite & CDP
- **Lớp 3A (Đọc Trực Tiếp SQLite Ổ Cứng):** Đọc file `<profile_path>/Cookies` của GemLogin (nơi cột `encrypted_value` được lưu dạng UTF-8 plaintext), lọc đúng domain quốc gia (`shopee.ph`, `shopee.vn`, ...) và kiểm tra phiên trong <50ms mà không cần mở trình duyệt.
- **Lớp 3B (Tự Động Mở Profile GemLogin -> Lấy Cookie Qua CDP -> Tự Đóng Profile):**
  - Xếp hàng tuần tự (`enqueueGemLoginBrowserTask`, mở từng Profile một để không tốn RAM).
  - Gọi `GET http://127.0.0.1:1010/api/profiles/start/:id` để nhận `remote_debugging_address`.
  - Kết nối WebSocket tới Chrome DevTools Protocol (`Storage.getCookies`) để trích xuất toàn bộ Cookie. Nếu `SPC_ST` đã hết hạn, tự động điều hướng tab vào `https://shopee.<tld>/?is_from_login=true` trong 5 giây để Shopee cấp lại `SPC_ST` mới rồi thu hồi Cookie.
  - Tự động đóng Profile qua `GET http://127.0.0.1:1010/api/profiles/close/:id`, lưu Cookie vào DB và kích hoạt luồng chạy tiếp.
- **Nút Bấm Trên Giao Diện Web (`Quản Lý Luồng`):**
  - Nút **`🔑 Lấy Cookie Lỗi (GemLogin)`** trên thanh công cụ: Tự động quét và khôi phục toàn bộ các luồng bị lỗi Cookie (hoặc các luồng đang được tích chọn).
  - Nút **`🔑`** ở cột **Cookie** của từng dòng luồng: Khôi phục tức thì Cookie cho riêng luồng đó chỉ với 1 cú click.
