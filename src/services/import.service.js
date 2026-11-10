const path = require("path");
const fs = require("fs");
const axios = require("axios");
const VideoTask = require("../models/video.model");
const User = require("../models/user.model");
const Thread = require("../models/thread.model");
const { parseExcel, validateRows } = require("../utils/excel-parser");

const CONFIG_PATH = path.join(__dirname, "../database/country_import_config.json");

async function downloadExcelFromDrive(url) {
  if (!url || typeof url !== "string") {
    throw new Error("Link Google Drive không hợp lệ hoặc để trống");
  }
  let downloadUrl = "";
  const spreadsheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (spreadsheetMatch) {
    downloadUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetMatch[1] + "/export?format=xlsx";
  }
  if (!downloadUrl) {
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileMatch[1];
    }
  }
  if (!downloadUrl) {
    const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (ucMatch) {
      downloadUrl = "https://drive.google.com/uc?export=download&id=" + ucMatch[1];
    }
  }
  if (!downloadUrl) {
    throw new Error("Link Google Drive không hợp lệ");
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Extract unique file/sheet ID for caching
  const sheetIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
  const cacheKey = sheetIdMatch ? sheetIdMatch[1] : null;
  if (cacheKey) {
    const cachePath = path.join(uploadsDir, `drive_cache_${cacheKey}.xlsx`);
    if (fs.existsSync(cachePath)) {
      try {
        const stats = fs.statSync(cachePath);
        const ageMs = Date.now() - stats.mtimeMs;
        // If downloaded within 3 minutes (180,000ms), reuse cache instantly!
        if (ageMs < 180000 && stats.size > 1000) {
          console.log(`⚡ [Google Sheet Cache] Dùng bản đệm cache (${Math.round(ageMs/1000)}s cũ):`, cachePath);
          return cachePath;
        }
      } catch(e) {}
    }
  }

  let response = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await axios({
        method: "GET",
        url: downloadUrl,
        responseType: "arraybuffer",
        timeout: 30000,
        maxRedirects: 5,
        proxy: false,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (response && response.data) break;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  if (!response || !response.data) {
    throw new Error(lastErr ? lastErr.message : "Không thể tải file từ Google Drive");
  }

  const destPath = cacheKey 
    ? path.join(uploadsDir, `drive_cache_${cacheKey}.xlsx`)
    : path.join(uploadsDir, "drive_excel_" + Date.now() + ".xlsx");
  fs.writeFileSync(destPath, Buffer.from(response.data));

  return destPath;
}

function saveImportConfig(config) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.error("Lỗi khi lưu cấu hình import:", err);
  }
}

function getImportConfigs() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch (e) {}
  }
  // Return default values if config doesn't exist yet
  return {
    countries: {
      vn: { videoFolder: "", driveLink: "", sheetName: "VN", maxVideosPerAccount: "80" },
      ph: { videoFolder: "", driveLink: "", sheetName: "PH", maxVideosPerAccount: "50" },
      id: { videoFolder: "", driveLink: "", sheetName: "ID", maxVideosPerAccount: "50" }
    },
    general: {
      delayMin: "186",
      delayMax: "245",
      autoStart: true,
      deleteOnSuccess: true
    }
  };
}

async function executeImport({ videoFolder, driveLink, delayMin, delayMax, country, autoStart, maxVideosPerAccount, excelPath = null, sheetName = null }) {
  if (!videoFolder) throw new Error("Chưa nhập đường dẫn folder video");

  let targetCountry = (country || 'vn').trim().toLowerCase();
  if (targetCountry === 'phss') targetCountry = 'ph';

  let localExcelPath = excelPath;
  if (!localExcelPath && driveLink) {
    localExcelPath = await downloadExcelFromDrive(driveLink);
  }

  if (!localExcelPath) {
    throw new Error("Chưa chọn file Excel hoặc nhập link Drive");
  }

  try {
    const { rows, colMap, error } = parseExcel(localExcelPath, sheetName);
    if (error) {
      throw new Error(error);
    }
    if (rows.length === 0) {
      throw new Error("Excel không có dữ liệu hợp lệ");
    }

    let allUsers = await User.getAll();
    let activeUsers = allUsers.filter(u => u.is_active !== 0 && u.is_active !== '0');
    const existingUserMap = new Map(activeUsers.map(u => [u.username.toLowerCase(), u]));

    const missingUsernames = new Set();
    for (const r of rows) {
      if (r.account && String(r.account).trim()) {
        const rawAcc = String(r.account).trim();
        const lowerAcc = rawAcc.toLowerCase();

        if (!existingUserMap.has(lowerAcc)) {
          // Only add missing user if it doesn't exist in allUsers at all
          const existsInAll = allUsers.some(u => u.username.toLowerCase() === lowerAcc);
          if (!existsInAll) {
            missingUsernames.add(rawAcc);
          }
        }
      }
    }

    if (missingUsernames.size > 0) {
      const dbConn = require("../database/connection").getConnection();
      await new Promise((resolve) => {
        dbConn.serialize(() => {
          dbConn.run("BEGIN TRANSACTION");
          const stmt = dbConn.prepare("INSERT INTO users (username, cookie, proxy, country, is_active) VALUES (?, '', '', ?, 1)");
          for (const uname of missingUsernames) {
            stmt.run(uname, targetCountry);
          }
          stmt.finalize();
          dbConn.run("COMMIT", () => resolve());
        });
      });
      allUsers = await User.getAll();
      activeUsers = allUsers.filter(u => u.is_active !== 0 && u.is_active !== '0');
    }

    const validated = validateRows(rows, videoFolder, activeUsers);

    // Chống nạp trùng: Loại bỏ các video đã có sẵn trong hàng đợi (pending / uploading) hoặc đã post xong (completed)
    if (validated.valid.length > 0) {
      const dbConnDedup = require("../database/connection").getConnection();
      const existingTasks = await new Promise((resolve) => {
        dbConnDedup.all(
          "SELECT user_id, LOWER(video_filename) as fn, LOWER(video_path) as vp FROM video_tasks WHERE status IN ('pending', 'uploading', 'completed')",
          [],
          (err, taskRows) => resolve(taskRows || [])
        );
      });
      const existingTaskSet = new Set();
      for (const et of existingTasks) {
        if (et.fn) existingTaskSet.add(`${et.user_id}:${et.fn}`);
        if (et.vp) existingTaskSet.add(`path:${et.vp}`);
      }
      validated.valid = validated.valid.filter(task => {
        const keyUserFn = `${task.user_id}:${String(task.video_filename || '').toLowerCase()}`;
        const keyPath = `path:${String(task.video_path || '').toLowerCase()}`;
        if (existingTaskSet.has(keyUserFn) || existingTaskSet.has(keyPath)) {
          return false;
        }
        existingTaskSet.add(keyUserFn);
        existingTaskSet.add(keyPath);
        return true;
      });
    }

    // Apply per-account video limit
    const limit = parseInt(maxVideosPerAccount) || 0;
    if (limit > 0 && validated.valid.length > 0) {
      const userCounts = new Map();
      const filteredValid = [];
      for (const task of validated.valid) {
        const uId = task.user_id;
        const currentCount = userCounts.get(uId) || 0;
        if (currentCount < limit) {
          filteredValid.push(task);
          userCounts.set(uId, currentCount + 1);
        }
      }
      validated.valid = filteredValid;
    }

    let importedCount = 0;
    if (validated.valid.length > 0) {
      importedCount = await VideoTask.importTasks(validated.valid);
    }

    const threadResults = [];
    if (importedCount > 0) {
      const userTaskCounts = new Map();
      for (const task of validated.valid) {
        userTaskCounts.set(task.user_id, (userTaskCounts.get(task.user_id) || 0) + 1);
      }

      const existingThreads = await Thread.getAll();
      const existingUserIds = new Set(existingThreads.map(t => t.user_id));

      const delayMinVal = Math.max(10, parseInt(delayMin) || 60);
      const delayMaxVal = Math.max(delayMinVal, parseInt(delayMax) || 180);

      const dbConn = require("../database/connection").getConnection();
      const dbProxies = await new Promise((resolve) => {
        dbConn.all("SELECT proxy FROM proxies", [], (err, rows) => {
          const list = (rows ? rows.map(r => r.proxy).filter(Boolean) : [])
            .filter(p => {
              const h = p.split(':')[0].trim();
              return h && (h.includes('.') || h === 'localhost');
            });
          resolve(list);
        });
      });
      let proxyIndex = 0;
      let autoStartIndex = 0;
      const nowSec = Math.floor(Date.now() / 1000);

      await new Promise((resolve, reject) => {
        dbConn.serialize(() => {
          dbConn.run("BEGIN TRANSACTION", (err) => {
            if (err) return reject(err);
          });

          for (const [userId, taskCount] of userTaskCounts) {
            if (existingUserIds.has(userId)) {
              const thread = existingThreads.find(t => t.user_id === userId);
              if (thread) {
                dbConn.run(
                  "UPDATE threads SET count_video_upload = count_video_upload + ?, country = ? WHERE id = ?",
                  [taskCount, targetCountry, thread.id]
                );
                // If thread has no proxy set, assign one from dbProxies
                if (!thread.proxy_host && dbProxies.length > 0) {
                  const assignedProxy = dbProxies[proxyIndex % dbProxies.length];
                  proxyIndex++;
                  const parts = assignedProxy.split(":");
                  if (parts.length >= 2) {
                    const pHost = parts[0].trim();
                    const pPort = parseInt(parts[1].trim(), 10);
                    const pUser = parts.length === 4 ? parts[2].trim() : null;
                    const pPass = parts.length === 4 ? parts[3].trim() : null;
                    dbConn.run(
                      "UPDATE threads SET proxy_host = ?, proxy_port = ?, proxy_username = ?, proxy_password = ? WHERE id = ?",
                      [pHost, pPort, pUser, pPass, thread.id]
                    );
                  }
                }
                if (autoStart) {
                  const staggeredRunAt = nowSec + Math.floor(autoStartIndex++ * 0.2);
                  dbConn.run(
                    "UPDATE threads SET status = 'inprogress', next_run_at = ? WHERE id = ?",
                    [staggeredRunAt, thread.id]
                  );
                }
              }
              threadResults.push({ userId, taskCount, status: "exists" });
            } else {
              let proxyHost = null, proxyPort = null, proxyUser = null, proxyPass = null;
              let selectedProxy = null;

              if (dbProxies.length > 0) {
                selectedProxy = dbProxies[proxyIndex % dbProxies.length];
                proxyIndex++;
              } else {
                const user = users.find(u => u.id === userId);
                if (user && user.proxy) selectedProxy = user.proxy;
              }

              if (selectedProxy) {
                const parts = selectedProxy.split(":");
                if (parts.length >= 2) {
                  proxyHost = parts[0].trim();
                  proxyPort = parseInt(parts[1].trim(), 10);
                  if (parts.length === 4) {
                    proxyUser = parts[2].trim();
                    proxyPass = parts[3].trim();
                  }
                }
              }

              const initialStatus = autoStart ? "inprogress" : "paused";
              const initialNextRunAt = autoStart ? (nowSec + Math.floor(autoStartIndex++ * 0.2)) : 0;
              dbConn.run(
                `INSERT INTO threads (user_id, delay_min, delay_max, proxy_host, proxy_port, proxy_username, proxy_password, status, count_video_upload, caption, upload_mode, auto_fill_products, country, next_run_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', 0, ?, ?)`,
                [userId, delayMinVal, delayMaxVal, proxyHost, proxyPort, proxyUser, proxyPass, initialStatus, taskCount, taskCount + " video từ Excel", targetCountry, initialNextRunAt]
              );
              threadResults.push({ userId, taskCount, status: "created" });
            }
          }

          dbConn.run("COMMIT", (commitErr) => {
            if (commitErr) {
              dbConn.run("ROLLBACK");
              return reject(commitErr);
            }
            resolve();
          });
        });
      });
    }

    try {
      fs.unlinkSync(localExcelPath);
    } catch (e) {}

    const withProducts = validated.valid.filter(t => t.product_links.length > 0).length;
    const withoutProducts = validated.valid.filter(t => t.product_links.length === 0).length;

    if (importedCount === 0) {
      let errMsg = "Không nạp được video/task nào.";
      if (validated.summary?.errors?.video_not_found > 0) {
        errMsg += ` ${validated.summary.errors.video_not_found} video không tìm thấy trong folder.`;
      }
      if (validated.summary?.errors?.account_not_found > 0) {
        errMsg += ` ${validated.summary.errors.account_not_found} account không có trong hệ thống.`;
      }
      if (validated.invalid && validated.invalid.length > 0 && validated.invalid[0].error) {
        errMsg += ` Ví dụ lỗi: ${validated.invalid[0].error}`;
      }
      return {
        success: false,
        message: errMsg,
        imported: 0,
        summary: validated.summary,
        invalid: validated.invalid.map(inv => ({
          row: inv.index,
          account: inv.account,
          video: inv.video_file,
          error: inv.error
        }))
      };
    }

    return {
      success: true,
      imported: importedCount,
      withProducts,
      withoutProducts,
      colMap,
      threadsCreated: threadResults.filter(r => r.status === "created").length,
      threadsExisted: threadResults.filter(r => r.status === "exists").length,
      autoStarted: autoStart,
      summary: validated.summary,
      invalid: validated.invalid.map(inv => ({
        row: inv.index,
        account: inv.account,
        video: inv.video_file,
        error: inv.error
      }))
    };

  } catch (err) {
    try {
      fs.unlinkSync(localExcelPath);
    } catch (e) {}
    throw err;
  }
}

module.exports = {
  executeImport,
  getImportConfigs,
  saveImportConfig,
  downloadExcelFromDrive
};
