const cron = require('node-cron');
const db = require('../database/connection').getConnection();
const VideoTask = require('../models/video.model');
const { processLocalVideoUpload } = require('../services/handle-upload.service');
const Log = require('../models/log.model');
const Thread = require('../models/thread.model');
const Config = require('../models/config.model');
const adbService = require('../services/adb.service');
const cookieRecoveryService = require('../services/cookie-recovery.service');

// Helper tự động đổi sang Proxy sống mới khi phát hiện Proxy cũ chết hẳn
async function rotateThreadProxy(threadId, reason = '') {
  return new Promise((resolve) => {
    db.all("SELECT proxy FROM proxies ORDER BY RANDOM() LIMIT 5", [], (err, rows) => {
      if (err || !rows || rows.length === 0) return resolve(null);
      const chosen = rows[0].proxy;
      const parts = chosen.split(':');
      if (parts.length >= 2) {
        const host = parts[0].trim();
        const port = parseInt(parts[1].trim(), 10);
        const user = parts.length === 4 ? parts[2].trim() : null;
        const pass = parts.length === 4 ? parts[3].trim() : null;
        db.run(
          "UPDATE threads SET proxy_host = ?, proxy_port = ?, proxy_username = ?, proxy_password = ? WHERE id = ?",
          [host, port, user, pass, threadId],
          (uErr) => {
            if (!uErr) {
              console.log(`🔄 [Auto-Proxy] Luồng #${threadId} đã tự đổi sang proxy mới: ${host}:${port} (Lý do: ${reason})`);
            }
            resolve(chosen);
          }
        );
      } else {
        resolve(null);
      }
    });
  });
}

function parseProxyHelper(thread) {
  const parseScheme = (p) => {
    if (!p) return { scheme: 'http', rest: '' };
    for (const prefix of ['socks5h://', 'socks5://', 'socks4://', 'http://', 'https://']) {
      if (String(p).toLowerCase().startsWith(prefix)) {
        return { scheme: prefix.replace('://', ''), rest: String(p).slice(prefix.length) };
      }
    }
    return { scheme: 'http', rest: String(p) };
  };

  if (thread.proxy_host && thread.proxy_port) {
    const { scheme, rest } = parseScheme(thread.proxy_host);
    const pObj = { host: rest, port: thread.proxy_port, scheme };
    if (thread.proxy_username && thread.proxy_password) {
      pObj.auth = { username: thread.proxy_username, password: thread.proxy_password };
    }
    return pObj;
  }
  if (thread.user_proxy) {
    const { scheme, rest } = parseScheme(thread.user_proxy);
    const parts = rest.split(':');
    if (parts.length >= 2) {
      const pObj = { host: parts[0], port: parseInt(parts[1]), scheme };
      if (parts.length === 4) {
        pObj.auth = { username: parts[2], password: parts[3] };
      }
      return pObj;
    }
  }
  return null;
}

const initJobs = () => {
  // Bộ theo dõi các luồng đang thực thi song song
  const activeThreadIds = new Set();
  const consecutiveFailures = new Map(); // Theo dõi số lần lỗi liên tiếp của từng luồng
  let maxConcurrent = 50; // Giới hạn số luồng đang truyền file đồng thời để tránh nghẽn RAM/Disk & hàng đợi ký

  // Cập nhật giới hạn số luồng upload động theo số điện thoại ký & số luồng đang chạy
  const updateDynamicConcurrency = () => {
    db.get("SELECT COUNT(*) as count FROM threads WHERE status = 'inprogress'", [], (err, row) => {
      const phoneCount = Math.max(1, adbService.getSelectedCount());
      const inProgressCount = (!err && row && row.count) ? row.count : 0;
      // Mỗi điện thoại gánh mượt ~30-35 luồng đang truyền file song song (tối đa 120 luồng đồng thời/máy)
      const byPhone = phoneCount * 35;
      maxConcurrent = Math.min(120, Math.max(35, byPhone, Math.min(inProgressCount, 60)));
    });
  };

  updateDynamicConcurrency();
  setInterval(updateDynamicConcurrency, 30000); // Tự động đồng bộ mỗi 30s khi bạn thêm/bớt Proxy

  // Tự động kiểm tra và giữ kết nối ADB Port Forward + đánh thức Shopee App cho chế độ Phone Sign
  const { startGatewayListeners } = require('../services/phone-gateway.service');
  startGatewayListeners(8080);

  const keepPhoneSignAlive = async () => {
    try {
      const settings = await Config.getCreditSettings();
      if (settings && settings.sign_mode === 'phone') {
        await adbService.getDevicesWithStatus();
      }
    } catch (_) {}
  };
  keepPhoneSignAlive();
  setInterval(keepPhoneSignAlive, 20000);

  // Lặp kiểm tra và kích hoạt upload mỗi 1 giây, giãn cách xuất phát 200ms/luồng
  setInterval(async () => {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const availableSlots = maxConcurrent - activeThreadIds.size;
      if (availableSlots <= 0) return;

      // Lấy danh sách các luồng đang chạy theo thứ tự next_run_at tăng dần
      const threads = await new Promise((resolve, reject) => {
        db.all(
          `SELECT threads.*, users.cookie, users.username, users.proxy AS user_proxy
           FROM threads
           INNER JOIN users ON threads.user_id = users.id
           WHERE threads.status = 'inprogress'
           ORDER BY COALESCE(threads.next_run_at, 0) ASC, threads.id ASC`,
          [],
          (err, rows) => err ? reject(err) : resolve(rows || [])
        );
      });

      // Lọc các luồng đã đến giờ chạy và chưa có trong hàng đợi đang upload
      const runnableThreads = threads.filter(
        t => (t.next_run_at || 0) <= nowSec && !activeThreadIds.has(t.id)
      );
      if (runnableThreads.length === 0) return;

      // Lấy số lượng luồng vừa phải mỗi giây (tối đa 8 luồng/giây) để rải đều tải (Conveyor-Belt Pacing)
      // Tránh việc 250-500 luồng cùng dồn cục vào bước ký createpost ở cùng 1 giây
      const maxLaunchPerTick = Math.min(availableSlots, Math.max(6, adbService.getSelectedCount() * 6));
      const toRun = runnableThreads.slice(0, maxLaunchPerTick);

      toRun.forEach((t, idx) => {
        activeThreadIds.add(t.id);

        // Chạy bất đồng bộ từng luồng độc lập, cách nhau 150ms mỗi luồng
        (async () => {
          try {
            if (idx > 0) {
              await new Promise(r => setTimeout(r, idx * 150));
            }
            // Kiểm tra giới hạn số lượng video của luồng
            if (t.count_video_upload > 0 && t.videos_uploaded >= t.count_video_upload) {
              await new Promise((res, rej) =>
                db.run("UPDATE threads SET status = 'done' WHERE id = ?", [t.id], err => err ? rej(err) : res())
              );
              return;
            }

            // Kiểm tra lại trạng thái luồng trong DB
            const threadCheck = await new Promise((res, rej) =>
              db.get("SELECT status FROM threads WHERE id = ?", [t.id], (err, row) => err ? rej(err) : res(row))
            );
            if (!threadCheck || threadCheck.status !== 'inprogress') return;

            // Lấy task pending tiếp theo của tài khoản
            const task = await VideoTask.getNextPendingForUser(t.user_id);
            if (!task) {
              await new Promise((res, rej) =>
                db.run("UPDATE threads SET status = 'done' WHERE id = ?", [t.id], err => err ? rej(err) : res())
              );
              return;
            }

            // Nếu file video không còn trên ổ cứng (do đã được đăng & tự xóa ở đợt trước), tự động bỏ qua task trùng này
            const fs = require('fs');
            if (!task.video_path || !fs.existsSync(task.video_path)) {
              await new Promise((res) =>
                db.run("DELETE FROM video_tasks WHERE id = ?", [task.id], () => res())
              );
              await new Promise((res) =>
                db.run(
                  "UPDATE threads SET count_video_upload = MAX(videos_uploaded, count_video_upload - 1), next_run_at = ? WHERE id = ?",
                  [Math.floor(Date.now() / 1000) + 1, t.id],
                  () => res()
                )
              );
              return;
            }

            // Đánh dấu task đang upload
            await VideoTask.updateStatus(task.id, 'uploading');

            // Phân tích proxy (Cố định theo đúng cấu hình của luồng/tài khoản)
            const proxyObj = parseProxyHelper(t);

            try {
              // Xử lý upload video trực tiếp
              const result = await processLocalVideoUpload(task.video_path, {
                cookie: t.cookie,
                proxy: proxyObj,
                caption: task.caption,
                products: task.products,
                country: t.country || 'vn'
              });

              // Reset bộ đếm lỗi của luồng khi post thành công
              consecutiveFailures.delete(t.id);

              // Xóa lỗi cũ của luồng
              await new Promise((res, rej) =>
                db.run("UPDATE threads SET error = NULL WHERE id = ?", [t.id], err => err ? rej(err) : res())
              );

              // Cập nhật kết quả thành công
              const minDelay = t.delay_min || 60;
              const maxDelay = t.delay_max || 180;
              const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
              const nextRunTime = Math.floor(Date.now() / 1000) + randomDelay;

              await Promise.all([
                VideoTask.updateStatus(task.id, 'completed', {
                  post_id: result.postId,
                  video_link: result.videoLink
                }),
                Log.create({
                  username: t.username,
                  status: 'success',
                  post_id: result.postId,
                  extra_info: JSON.stringify({ video: task.video_filename, link: result.videoLink })
                }),
                new Promise((res, rej) => {
                  db.run(
                    "UPDATE threads SET videos_uploaded = videos_uploaded + 1, next_run_at = ? WHERE id = ?",
                    [nextRunTime, t.id],
                    (err) => {
                      if (err) return rej(err);
                      if (t.count_video_upload > 0 && (t.videos_uploaded + 1) >= t.count_video_upload) {
                        db.run("UPDATE threads SET status = 'done' WHERE id = ?", [t.id], (err2) => {
                          if (err2) return rej(err2);
                          res();
                        });
                      } else {
                        res();
                      }
                    }
                  );
                })
              ]);
            } catch (uploadErr) {
              let errMsg = uploadErr?.error || uploadErr?.message || 'Unknown error';
              if (typeof errMsg === 'string') {
                if (errMsg.includes('<!DOCTYPE') || errMsg.includes('<html')) {
                  errMsg = 'Credit API server không phản hồi — kiểm tra kết nối';
                }
                errMsg = errMsg.substring(0, 200);
              }

              // KIỂM TRA LỖI COOKIE HẾT HẠN -> TỰ ĐỘNG KHÔI PHỤC QUA LỚP 1 (SILENT REFRESH) & LỚP 3 (GEMLOGIN)
              if (cookieRecoveryService.isCookieDeadError(errMsg)) {
                console.log(`🔑 [Auto-Cookie] Phát hiện luồng #${t.id} (${t.username}) lỗi Cookie (${errMsg}) -> Đang tự động khôi phục...`);
                const recoveryRes = await cookieRecoveryService.recoverThreadCookie(t.id, {
                  forceGemLogin: false,
                  autoStart: true
                });
                if (recoveryRes && recoveryRes.success) {
                  consecutiveFailures.delete(t.id);
                  const retrySoon = Math.floor(Date.now() / 1000) + 4;
                  await Promise.all([
                    VideoTask.updateStatus(task.id, 'pending', { error: null }),
                    Log.create({
                      username: t.username,
                      status: 'error',
                      error: `[Tự Khôi Phục Cookie - ${recoveryRes.method}] Đã làm mới Cookie & tự thử lại (${errMsg})`,
                      failed_function: uploadErr?.failedFunction || 'uploadShopeeVideo'
                    }),
                    new Promise((res, rej) =>
                      db.run("UPDATE threads SET error = NULL, status = 'inprogress', next_run_at = ? WHERE id = ?", [retrySoon, t.id], err => err ? rej(err) : res())
                    )
                  ]);
                  return;
                }
              }

              // Đếm số lần lỗi liên tiếp của luồng này
              const fails = (consecutiveFailures.get(t.id) || 0) + 1;
              consecutiveFailures.set(t.id, fails);

              // TỰ ĐỘNG ĐỔI PROXY KHI PHÁT HIỆN PROXY ĐÃ CHẾT THỰC SỰ:
              // 1. Lỗi 407 (Proxy hết hạn gói / sai pass)
              // 2. Lỗi ECONNREFUSED (Server proxy sập kết nối)
              // 3. Hoặc luồng này bị lỗi proxy liên tiếp >= 3 lần (không đổi proxy nếu là lỗi Cookie hoặc Captcha 418)
              const isCookieErr = cookieRecoveryService.isCookieDeadError(errMsg);
              const isCaptchaErr = String(errMsg).includes('418');
              const isDailyLimitErr = String(errMsg).includes('400002') || String(errMsg).toLowerCase().includes('daily upload limit');
              if (isDailyLimitErr) {
                errMsg = 'Đã đạt giới hạn đăng trong ngày (Daily Limit 400002) — Đã tự động giữ nguyên video chờ cho ngày tiếp theo';
                consecutiveFailures.delete(t.id);
                await Promise.all([
                  VideoTask.updateStatus(task.id, 'pending', { error: null }),
                  Log.create({
                    username: t.username,
                    status: 'error',
                    error: errMsg,
                    failed_function: uploadErr?.failedFunction || 'createPost'
                  }),
                  new Promise((res, rej) =>
                    db.run("UPDATE threads SET error = ?, status = 'stop' WHERE id = ?", [errMsg, t.id], err => err ? rej(err) : res())
                  )
                ]);
                return;
              }
              if (isCaptchaErr) {
                errMsg = 'Dính Captcha 418 (Phiên đăng nhập cũ) — Mở GemLogin đăng nhập lại Shopee rồi bấm 🔑 Lấy Cookie';
                await Promise.all([
                  VideoTask.updateStatus(task.id, 'pending', { error: null }),
                  Log.create({
                    username: t.username,
                    status: 'error',
                    error: errMsg,
                    failed_function: uploadErr?.failedFunction || 'createPost'
                  }),
                  new Promise((res, rej) =>
                    db.run("UPDATE threads SET error = ?, status = 'paused' WHERE id = ?", [errMsg, t.id], err => err ? rej(err) : res())
                  )
                ]);
                return;
              }
              const isPermOrBannedErr =
                String(errMsg).includes('8300050') ||
                String(errMsg).includes('ERROR_PERMS') ||
                String(errMsg).includes('98000074') ||
                String(errMsg).includes('ErrorIllegalUserState');
              if (isPermOrBannedErr) {
                errMsg = String(errMsg).includes('98000074')
                  ? 'Lỗi 98000074 (ErrorIllegalUserState): Tài khoản Shopee đang bị hạn chế/khóa trạng thái — Đã tạm dừng & giữ nguyên video chờ'
                  : 'Lỗi 8300050 (ERROR_PERMS): Tài khoản mất quyền đăng Video hoặc Cookie hết hạn — Đã tạm dừng & giữ nguyên video chờ';
                consecutiveFailures.delete(t.id);
                await Promise.all([
                  VideoTask.updateStatus(task.id, 'pending', { error: null }),
                  Log.create({
                    username: t.username,
                    status: 'error',
                    error: errMsg,
                    failed_function: uploadErr?.failedFunction || 'createPost'
                  }),
                  new Promise((res, rej) =>
                    db.run("UPDATE threads SET error = ?, status = 'paused' WHERE id = ?", [errMsg, t.id], err => err ? rej(err) : res())
                  )
                ]);
                return;
              }
              const isHardProxyDead =
                errMsg.includes('407') ||
                errMsg.includes('ECONNREFUSED') ||
                errMsg.includes('ECONNRESET') ||
                errMsg.toLowerCase().includes('connection reset') ||
                errMsg.includes('ETIMEDOUT');
              let autoChanged = false;

              if (!isCookieErr && !isCaptchaErr && isHardProxyDead && fails >= 2) {
                await rotateThreadProxy(t.id, `${errMsg} (phát hiện chết liên tiếp ${fails} lần)`);
                consecutiveFailures.delete(t.id);
                autoChanged = true;
              } else if (!isCookieErr && !isCaptchaErr && fails >= 3) {
                await rotateThreadProxy(t.id, `Lỗi liên tiếp ${fails} lần: ${errMsg}`);
                consecutiveFailures.delete(t.id);
                autoChanged = true;
              }

              const isTransientRetryableTask =
                isHardProxyDead ||
                errMsg.includes('socket hang up') ||
                errMsg.includes('HTTP 502') ||
                errMsg.includes('Empty token response') ||
                errMsg.includes('300014') ||
                errMsg.includes('98001004') ||
                errMsg.includes('Timeout');

              const delayAfterError = autoChanged ? 8 : 20;
              const nextRetryTime = Math.floor(Date.now() / 1000) + delayAfterError;

              await Promise.all([
                isTransientRetryableTask
                  ? VideoTask.updateStatus(task.id, 'pending', { error: null })
                  : VideoTask.updateStatus(task.id, 'failed', { error: errMsg }),
                Log.create({
                  username: t.username,
                  status: 'error',
                  error: autoChanged ? `[Tự Đổi Proxy Do Chết] ${errMsg}` : errMsg,
                  failed_function: uploadErr?.failedFunction || 'uploadShopeeVideo'
                }),
                new Promise((res, rej) =>
                  db.run("UPDATE threads SET error = ?, next_run_at = ? WHERE id = ?", [errMsg, nextRetryTime, t.id], err => err ? rej(err) : res())
                )
              ]);
            }
          } catch (thErr) {
            console.error(`[cron] Luồng #${t.id} gặp lỗi:`, thErr);
          } finally {
            activeThreadIds.delete(t.id);
          }
        })();
      });
    } catch (jobErr) {
      console.error('[cron] Job error:', jobErr);
    }
  }, 1000);

  // Tự động reset tất cả luồng theo lịch cấu hình
  cron.schedule('* * * * *', async () => {
    try {
      const resetTime = await Config.getRunningTimeAgain();
      const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      if (currentTime === resetTime) {
        await Thread.resetAllToInprogressThreads();
        console.log('[cron] All threads reset to inprogress');
      }
    } catch (e) {
      console.error('[cron] Error restarting threads:', e);
    }
  });
};

module.exports = { initJobs };