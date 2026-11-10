# TÀI LIỆU TOÀN DIỆN VỀ HỆ THỐNG KÝ SỐ SHOPEE VIDEO (PHONE SIGN & CREDIT SERVER)

> **Dự án:** Tool Upload Video Shopee MLS  
> **Phiên bản áp dụng:** Shopee Video App `v3.79.27` (Build `37927`)  
> **Thiết bị ký số thực nghiệm:** Samsung Galaxy A50 (`SM-A505F`, Android 11, API 30)  
> **Cập nhật ngày:** 17/08/2026

---

## 1. TỔNG QUAN VỀ CƠ CHẾ BẢO MẬT SHOPEE VIDEO V3.79+

Shopee áp dụng hệ thống bảo mật đa tầng (Shopee Anti-bot / SAP Challenge / Device Fingerprint) để chống spam và xác thực nguồn gốc ứng dụng thật:
1. **JNI Cryptographic Signatures (Dynamic Hash Headers):** 3-4 trường băm động (28 ký tự) được sinh bởi thư viện lõi native C++ (`libshopee.so` / `libsharkl.so`).
2. **Hardware Risk Token (`af-ac-enc-sz-token`):** Chuỗi mã hóa đồ sộ (>1.600 – 1.750 ký tự) chứa đầy đủ dấu vân tay phần cứng máy thật (CPU, GPU, IMEI/Android ID hash, cảm biến, hệ điều hành).
3. **Session Request Identifier (`x-sap-ri`):** Mã nhận diện phiên ký duy nhất cho từng request.
4. **Đồng bộ thông số Client (`client-info`):** Khớp chính xác giữa thông số khai báo trên Header HTTP và thông số phần cứng thực tế của máy ký.

---

## 2. KIẾN TRÚC & NGUYÊN LÝ HOẠT ĐỘNG CỦA PHONE SIGN (MÁY THẬT)

### 2.1. Cú pháp gọi Phone Sign Server (`Port 8080`)
* **Endpoint:** `http://127.0.0.1:8080`
* **Điểm cốt tử phát hiện:**
  * Nếu gọi dạng JSON Body `{ url, body }`: Server trên điện thoại chỉ chạy nhánh JNI đơn giản, sinh 3 headers hash thông thường mà **KHÔNG sinh Risk Token** ➡️ Bị Shopee chặn lỗi 418.
  * Khi gọi dạng **Query String Parameter**:
    ```http
    POST http://127.0.0.1:8080/?url={ENCODED_URL}&body={ENCODED_BODY}
    ```
    Điện thoại Samsung A50 sẽ kích hoạt hook `getRiskToken`, trả về đầy đủ **5 trường bảo mật**:
    * `x-sap-ri`: Request ID
    * 3 dynamic hash headers (ví dụ: `8c3ff912`, `54b6692f`, `c521fde3`)
    * **1 Risk Token dài ~1.700 ký tự** (chứa dấu vân tay Galaxy A50).

### 2.2. Cơ chế Tiêm `af-ac-enc-sz-token`
Trong Tool MLS, hàm `createPost` và `getExtra` tự động trích xuất chuỗi token dài (>100 ký tự) từ kết quả ký và gán trực tiếp vào Header:
```javascript
let _szToken = '';
for (const [k, v] of Object.entries(signedHeaders)) {
  if (k !== 'x-sap-ri' && typeof v === 'string' && v.length > 100) {
    _szToken = v;
    break;
  }
}

// Gắn vào Header gửi lên Shopee
headers: {
  'af-ac-enc-sz-token': _szToken,
  'client-info': 'device_id=bdd2c245273bf3df;device_model=SM-A505F;os=0;os_version=30;client_version=37927;network=1;platform=1;rn_version=6.97.5;api_source=na;cpu_model=;live_device_model=samsung+a50',
  ...signedHeaders
}
```

### 2.3. Đồng bộ thông số thiết bị Galaxy A50 chuẩn
* **Hệ điều hành:** Android 11 (`os_version=30`, `system_version=30`)
* **Thiết bị:** `Brand/samsung Model/SM-A505F OSVer/30 Manufacturer/samsung`
* **Live Model:** `samsung+a50`
* **App Version:** `37927` (`v3.79.27`)

---

## 3. CƠ CHẾ GIỮ KẾT NỐI ADB PORT FORWARD (KEEP-ALIVE)

Khi chạy đồng thời số lượng lớn luồng (hơn 100 luồng), kết nối ADB USB có thể bị hệ điều hành reset cổng forward. Hệ thống đã được tích hợp cơ chế tự động bảo vệ:
* **Cron Interval (10 giây):** Tự động gửi lệnh `adb forward tcp:8080 tcp:8080` định kỳ trong nền.
* **Bypass Proxy cục bộ:** Mọi truy vấn từ Tool MLS tới `127.0.0.1:8080`, `localhost`, `192.168.x.x` đều được bỏ qua Proxy để tránh lỗi `ECONNREFUSED` / `socket hang up`.

---

## 4. SO SÁNH TOÀN DIỆN: PHONE SIGN VS CREDIT SERVER

| Tiêu chí | Phone Sign (Samsung A50) | Credit Server (Cloud API) |
| :--- | :--- | :--- |
| **Chi phí** | **Miễn phí 100%**, không giới hạn số lượng bài | Tiêu hao credit theo từng video |
| **Nơi xử lý gửi bài** | Máy tính gửi trực tiếp gói tin qua **Proxy của từng luồng** | Gửi qua máy chủ Cloud trung gian của Credit Server |
| **Tốc độ ký** | Cực nhanh: ~50ms – 150ms/lần ký | Phụ thuộc độ trễ mạng tới Cloud Server (~500ms – 2s) |
| **Thị trường VN** | **Hoạt động hoàn hảo 100%**, vượt mọi rào cản 418 | Hoạt động tốt |
| **Thị trường PH / MY với Proxy VN** | Dễ bị 418 nếu IP lệch quốc gia gửi trực tiếp | **Vẫn chạy tốt** vì Cloud Server tự định tuyến IP riêng |
| **Yêu cầu phần cứng** | Cần 1 máy điện thoại Android cắm ADB | Không cần điện thoại |

---

## 5. HƯỚNG DẪN VẬN HÀNH TỐI ƯU CHIẾN LƯỢC

### 1. Luồng Việt Nam (VN):
* **Cấu hình:** Đặt `sign_mode = 'phone'`.
* **Hiệu quả:** Chạy cực nhanh, ổn định, không tốn bất kỳ credit nào.
* **Proxy:** Có thể dùng Proxy dân cư, Proxy xoay hoặc WiFi nội bộ.

### 2. Luồng Quốc Tế (Philippines - PH, Malaysia - MY, Thái Lan - TH...):
* **Lựa chọn A (Tiết kiệm với Phone Sign):** Gán đúng dải Proxy sạch của nước đó (Nick PH dùng Proxy PH, Nick MY dùng Proxy MY).
* **Lựa chọn B (Tiện lợi với Credit Server):** Nếu toàn bộ kho Proxy của bạn là IP Việt Nam, có thể sử dụng chế độ Credit Server để hệ thống tự động đăng bài cho các thị trường ngoại quốc.

---

## 6. DANH SÁCH BÀI ĐĂNG THỰC TẾ ĐÃ XÁC MINH TRÊN SHOPEE

* **Tài khoản VN (`@anhhng600`):**
  * `xgPrlfzgCQB8PFpfAAAAAA==` ➡️ [Xem video VN](https://sv.shopee.vn/share-video/xgPrlfzgCQB8PFpfAAAAAA==)
  * `i4Gv3_zgCQB8PFpfAAAAAA==` ➡️ [Xem video VN](https://sv.shopee.vn/share-video/i4Gv3_zgCQB8PFpfAAAAAA==)
  * `y4Jg8f3gCQB8PFpfAAAAAA==` ➡️ [Xem video VN](https://sv.shopee.vn/share-video/y4Jg8f3gCQB8PFpfAAAAAA==)
  * `eYFqev_gCQB8PFpfAAAAAA==` ➡️ [Xem video VN](https://sv.shopee.vn/share-video/eYFqev_gCQB8PFpfAAAAAA==)
* **Tài khoản PH:**
  * `01PH0106`: `tAGcrgHhCQDPdXZdAAAAAA==` ➡️ [Xem video PH](https://sv.shopee.ph/share-video/tAGcrgHhCQDPdXZdAAAAAA==)
  * `PH022`: `a4KZGwLhCQAnsRtcAAAAAA==` ➡️ [Xem video PH](https://sv.shopee.ph/share-video/a4KZGwLhCQAnsRtcAAAAAA==)
  * `PH0224`: `c0OJPgjhCQAVDshdAAAAAA==` ➡️ [Xem video PH](https://sv.shopee.ph/share-video/c0OJPgjhCQAVDshdAAAAAA==)
  * `01PH0154`: `u4MrbQjhCQAIeZJdAAAAAA==` ➡️ [Xem video PH](https://sv.shopee.ph/share-video/u4MrbQjhCQAIeZJdAAAAAA==)
