# Phân tích & đục license - Tool Upload Local Video Shopee MLS V13.3 (SPsign)

Thư mục: `E:\Tool-Upload-Local-VideoShopee-MLS-V13.3 - SPsign`
VERSION trong tool: `26.0.14` (tên folder ghi V13.3 - tên folder không khớp version thật).

---

## 1. Kiến trúc

| Thành phần | Ghi chú |
|---|---|
| Runtime | Node.js (đóng gói kèm `node.exe`, không cần cài) |
| Web | Express 4 + EJS + Bootstrap, mở bằng `chrome --app` trên cổng `.env PORT` (6868) |
| DB | SQLite `database.sqlite` (~90 MB), WAL bật, có `src/database/connection.js` |
| Sign | Ký video qua phone gateway / credit API (`phone_sign_url`, `credit_url` trong bảng `config`) |
| Update | Tự cập nhật từ GitHub `thincole/PostSPSign` qua `update.bat` / `update_online.ps1` |
| Chống dịch ngược | Obfuscator.io: string-array + base64 + rotation IIFE + control-flow flatten |

### File bị obfuscate
`src/app.js`, `src/start.js`, `src/middleware/license.middleware.js`,
`src/services/license.service.js`, `src/services/license-patch.js`,
`src/services/handle-upload.service.js`, `src/routes/index.js`,
`src/routes/thread.routes.js`, `src/models/config.model.js`,
`src/workers/video-import.worker.js`

### File đọc được ngay
`updater.service.js`, `adb.service.js`, `cookie-recovery.service.js`,
`jobs/cron.js`, `user.routes.js`, `config.routes.js`, toàn bộ `views/`.

---

## 2. Luồng license (sau khi dịch ngược)

```
start.bat
  └─ node src/start.js
       ├─ dotenv.config()                    // .env
       ├─ require('./services/license.service')   // singleton
       ├─ patchLicenseService(singleton)     // license-patch.js
       └─ require('./app')

src/app.js
  ├─ kiểm tra LICENSE_KEY: phải bắt đầu "MLS-2025-", dài >= 15  → sai thì process.exit(1)
  ├─ await licenseService.initializeLicenseProtection(KEY)
  │     └─ validateLicense() → POST https://license.toolshopee.vn/{validate, v1/validate, api/validate}
  │          payload AES-256-GCM, key = PBKDF2(baseSecret|app.py|Python 3.13.0|Windows|fixed_salt_mls_2025)
  │          server trả { valid, fingerprint } - fingerprint phải khớp máy
  ├─ setInterval 30'  → periodicValidation()
  └─ setInterval 3'   → performIntegrityChecks()
        ├─ isDebuggerAttached()  (--inspect / --debug)
        ├─ isBeingMonitored()    (tasklist: procmon, wireshark, fiddler, burp, ida, x64dbg, ghidra…)
        └─ !isValidated → triggerAntiTamper() → "System maintenance required" → process.exit(1..10)
```

### Các cổng chặn
1. **Toàn bộ API**: `router.use(checkLicenseStatus)` trong `src/routes/index.js` → `403 {"error":"License not validated"}` nếu `isValidated === false`.
2. **Middleware global** trong `app.js`: request không phải static → nếu `!isValidated` thì 403 rồi `process.exit(1)` sau 1s.
3. **Nhóm route** `/threads`, `/users`, `/config` → `protectRoute`; `/videos`, import, toggle-status → `protectVideoOperations` (thêm check debugger + tool monitor).
4. **Anti-tamper định kỳ** 3 phút → tự kill tiến trình.
5. **Grace period**: nếu `periodicValidation()` lỗi → sau 2 phút `process.exit(1)`.

### Điểm yếu thiết kế (dùng để đục)
- Toàn bộ quyết định "hợp lệ" nằm ở **một** singleton: `src/services/license.service.js`.
- Object export là instance của class → thay file là xong, không cần sửa 9 file obfuscate còn lại.
- `.machine_id` đã có sẵn (patch fingerprint của chính tác giả) nên fingerprint ổn định: `f85924f3bee9a505a38543d359898323`.
- Không có kiểm tra hash chữ ký file (không có integrity self-check thật, chỉ có "Integrity check failed" là string chết).
- `video-import.worker.js` nhận `licenseKey` qua workerData nhưng **không dùng** → không có cổng thứ hai.

---

## 3. Bản đục

Thay `src/services/license.service.js` bằng bản viết lại (`crack/license.service.js`).

Giữ nguyên 100% bề mặt public:
`isValidated`, `lastValidation`, `validationInterval`, `licenseKey`,
`initializeLicenseProtection`, `validateLicense`, `validateWithEndpoint`,
`periodicValidation`, `performIntegrityChecks`, `isDebuggerAttached`,
`isBeingMonitored`, `triggerAntiTamper`, `clearSensitiveMemory`,
`deriveEncryptionKey`, `encryptPayload`, `decryptResponse`,
`generateHardwareFingerprint`, `generateValidationEndpoints`.

Thay đổi hành vi:
| Hàm | Bản gốc | Bản đục |
|---|---|---|
| `validateLicense` | gọi server, sai là throw | nhận local, luôn `true` |
| `periodicValidation` | gọi lại server | refresh timestamp, `true` |
| `performIntegrityChecks` | kill process | no-op |
| `triggerAntiTamper` | `process.exit(1..10)` | chỉ log khi debug |
| `isDebuggerAttached` | đọc `execArgv` | `false` |
| `isBeingMonitored` | chạy `tasklist`, dò 9 tool RE | `false` |
| `generateHardwareFingerprint` | hash phần cứng | đọc/ghi `.machine_id` (ổn định) |

Vẫn giữ nguyên `encryptPayload` / `decryptResponse` (AES-256-GCM, cùng layout `iv|aad|body|tag`)
để nếu cần bật lại kiểm tra online chỉ cần `MLS_ONLINE_CHECK=1` trong `.env` - lúc đó server
vẫn được gọi nhưng **fail cũng không chết app**.

Không sửa: `app.js`, `middleware/license.middleware.js`, `start.js`, `routes/*` - chúng chỉ
gọi đúng bề mặt trên nên chạy nguyên.

---

## 4. Kiểm chứng

```
node crack\verify.js
```
→ 12/12 PASS: init, isValidated, fingerprint ổn định, periodic, integrity no-op,
debugger/monitor false, `protectRoute`, `protectVideoOperations`, `checkLicenseStatus`,
AES round-trip.

Chạy thật (PORT tạm 16868):
```
/license-status  200  {"status":"valid","validated":true,"message":"License is active"}
/api/health      200  {"status":"healthy","license":{"validated":true,...}}
/api/license-info 200 {"validated":true,"status":"active"}
/api/threads     200  trả dữ liệu thật từ SQLite
/api/logs        200  trả dữ liệu thật từ SQLite
/                200  2.4 MB HTML
```

---

## 5. Sau khi update

`update_online.ps1` / `updater.service.js` ghi đè toàn bộ `src/**` (trừ `.env`, `.machine_id`,
DB, uploads, cookie_shopee, node_modules, .git). Nghĩa là **update sẽ trả lại file license gốc**.

Vì vậy giữ thư mục `crack/` (upstream không có folder này nên update không đụng tới), và sau mỗi
lần update chạy:

```
crack\reapply.bat
```

Nó backup bản hiện tại vào `crack\backup\` rồi copy đè.

Ngoài ra `update.bat` trong tool gọi `git`/tải zip - nếu muốn chặn hẳn update thì xoá
`update.bat` + đổi `repoName` trong `src/services/updater.service.js`.
