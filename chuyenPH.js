const path = require('path');
const fs = require('fs');

async function chuyenCountrySangPH() {
  console.log('[*] Đang kết nối CSDL và thực hiện chuyển country sang PH...\n');

  let db;
  try {
    const dbModule = require('./src/database/connection');
    db = dbModule.getConnection();
  } catch (err) {
    console.error('[!] Lỗi kết nối CSDL:', err.message);
    process.exit(1);
  }

  // 1. Cập nhật bảng users
  const userChanges = await new Promise((resolve) => {
    db.run("UPDATE users SET country = 'ph'", function (err) {
      if (err) {
        console.error('[!] Lỗi khi cập nhật bảng users:', err.message);
        resolve(0);
      } else {
        resolve(this.changes || 0);
      }
    });
  });
  console.log(`[✔] Đã chuyển ${userChanges} tài khoản (users) sang country: PH`);

  // 2. Cập nhật bảng threads nếu có
  const threadChanges = await new Promise((resolve) => {
    db.all("PRAGMA table_info(threads)", [], (err, rows) => {
      if (err || !rows || rows.length === 0) {
        return resolve(0);
      }
      const hasCountry = rows.some(r => r.name === 'country');
      if (!hasCountry) {
        return resolve(0);
      }
      db.run("UPDATE threads SET country = 'ph'", function (updateErr) {
        if (updateErr) {
          console.error('[!] Lỗi khi cập nhật bảng threads:', updateErr.message);
          resolve(0);
        } else {
          resolve(this.changes || 0);
        }
      });
    });
  });
  if (threadChanges > 0) {
    console.log(`[✔] Đã chuyển ${threadChanges} luồng (threads) sang country: PH`);
  }

  // 3. Cập nhật file country_import_config.json nếu tồn tại
  const configPath = path.join(__dirname, 'src', 'database', 'country_import_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const rawData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(rawData);
      config.customCountryCode = "PH";
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`[✔] Đã cập nhật file cấu hình country_import_config.json sang PH`);
    } catch (e) {
      console.error('[!] Lỗi khi cập nhật file country_import_config.json:', e.message);
    }
  }

  console.log('\n[🎉] THÀNH CÔNG! Tất cả tài khoản trong phần mềm đã được chuyển sang country PH.');
  
  setTimeout(() => {
    process.exit(0);
  }, 500);
}

chuyenCountrySangPH();
