const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const db = require('../database/connection').getConnection();
const { getCountry, buildUrls } = require('../utils/country');

const GEMLOGIN_API_BASE = process.env.GEMLOGIN_API_URL || 'http://127.0.0.1:1010';

const TIGER10_SPECS = {
  appVersion: '36448',
  rnbv: '6081003',
  rnVersion: '1763129064',
  mobileUa: 'Mozilla/5.0 (Linux; Android 13; TIGER 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  appUa: 'Android app Shopee appver=36448 app_type=1'
};

const COUNTRY_DEFAULT_LANG = {
  vn: 'vi',
  ph: 'en',
  id: 'id',
  th: 'th',
  my: 'en',
  sg: 'en',
  br: 'pt-BR',
  tw: 'zh-Hant'
};

function getShopeeDomainByCountry(countryCode = 'vn') {
  const c = getCountry(countryCode);
  return `shopee.${c.tld}`;
}

function parseCookieToMap(cookieStr = '') {
  const map = new Map();
  if (!cookieStr || typeof cookieStr !== 'string') return map;
  const parts = cookieStr.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (!key) continue;
    map.set(key, val);
  }
  return map;
}

function serializeCookieMap(cookieMap, countryCode = 'vn') {
  const cCode = (countryCode || 'vn').toLowerCase();
  const defaultLang = COUNTRY_DEFAULT_LANG[cCode] || 'en';

  // Luôn chuẩn hóa language theo đúng quốc gia của tài khoản (VD: PH -> en, VN -> vi)
  cookieMap.set('language', defaultLang);
  cookieMap.set('SPC_RNBV', TIGER10_SPECS.rnbv);
  cookieMap.set('shopee_app_version', TIGER10_SPECS.appVersion);
  cookieMap.set('shopee_rn_bundle_version', TIGER10_SPECS.rnbv);
  cookieMap.set('shopee_rn_version', TIGER10_SPECS.rnVersion);

  const pairs = [];
  for (const [k, v] of cookieMap.entries()) {
    if (k && v !== undefined && v !== null && String(v) !== '') {
      pairs.push(`${k}=${v}`);
    }
  }
  return pairs.join('; ');
}

function extractCookieIdentifiers(cookieInput) {
  const map = cookieInput instanceof Map ? cookieInput : parseCookieToMap(cookieInput);
  const rawSpcU = map.get('SPC_U') || '';
  const rawSpcEc = map.get('SPC_EC') || '';
  const rawSpcSt = map.get('SPC_ST') || '';
  return {
    spc_u: rawSpcU !== '-' ? rawSpcU : '',
    spc_f: map.get('SPC_F') || '',
    csrftoken: map.get('csrftoken') || '',
    hasSpcSt: Boolean(rawSpcSt && rawSpcSt !== '-'),
    hasSpcEc: Boolean(rawSpcEc && rawSpcEc !== '-'),
    hasRefreshToken: Boolean(map.get('SPC_R_T_ID') || map.get('SPC_T_ID')),
    keyCount: map.size
  };
}

function isCookieDeadError(errMsg = '') {
  if (!errMsg) return false;
  const lower = String(errMsg).toLowerCase();
  // Lỗi 418 trên Shopee (error=90309999) là dính Captcha kéo hình (shopee.ph/verify/captcha),
  // không phải lỗi hết hạn Cookie thông thường mà Lớp 1 (GET user/detail) có thể tự làm mới.
  if (lower.includes('418')) return false;
  if (lower.includes('400002') || lower.includes('daily upload limit')) return false;
  if (
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('connection reset') ||
    lower.includes('socket hang up') ||
    lower.includes('timeout') ||
    lower.includes('http 502')
  ) {
    return false;
  }
  return (
    lower.includes('cookie expired') ||
    lower.includes('cookie hết hạn') ||
    lower.includes('cookie không hợp lệ') ||
    lower.includes('getuploadinfo failed: cookie') ||
    lower.includes('xác thực thất bại') ||
    lower.includes('authentication failed') ||
    lower.includes('not logged in') ||
    lower.includes('error_not_logged_in') ||
    lower.includes('err_code=9') ||
    lower.includes('status code 401') ||
    lower.includes('status code 403') ||
    lower.includes('http 403') ||
    lower.includes('403 forbidden')
  );
}

function buildAxiosProxyConfig(proxyObj) {
  if (!proxyObj || !proxyObj.host || !proxyObj.port) return {};
  const scheme = (proxyObj.scheme || 'http').toLowerCase();
  const authPart =
    proxyObj.auth && proxyObj.auth.username
      ? `${encodeURIComponent(proxyObj.auth.username)}:${encodeURIComponent(proxyObj.auth.password || '')}@`
      : '';
  const proxyUrl = `${scheme}://${authPart}${proxyObj.host}:${proxyObj.port}`;
  const agent = scheme.startsWith('socks')
    ? new SocksProxyAgent(proxyUrl)
    : new HttpsProxyAgent(proxyUrl);
  return {
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false
  };
}

function mergeSetCookieHeaders(cookieMap, setCookieHeaders) {
  const updatedKeys = [];
  if (!setCookieHeaders) return updatedKeys;
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

  for (const raw of list) {
    if (!raw || typeof raw !== 'string') continue;
    const firstPart = raw.split(';')[0].trim();
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = firstPart.substring(0, eqIdx).trim();
    const val = firstPart.substring(eqIdx + 1).trim();
    const lowerRaw = raw.toLowerCase();
    // Bỏ qua các lệnh xóa cookie hoặc gán rỗng '-' từ server
    if (
      !val ||
      val === '-' ||
      val === '""' ||
      val === "''" ||
      val.toLowerCase() === 'deleted' ||
      lowerRaw.includes('max-age=0') ||
      lowerRaw.includes('expires=thu, 01 jan 1970')
    ) {
      continue;
    }
    if (cookieMap.get(key) !== val) {
      updatedKeys.push(key);
    }
    cookieMap.set(key, val);
  }
  return updatedKeys;
}

/**
 * LỚP 1: Silent Cookie Auto-Refresh & Verify trực tiếp qua Shopee Video API (TIGER 10 - 36448)
 */
async function silentRefreshCookie(cookieStr, countryCode = 'vn', proxyObj = null) {
  const cookieMap = parseCookieToMap(cookieStr);
  if (cookieMap.size === 0) {
    return { success: false, cookie: cookieStr, reason: 'Cookie rỗng' };
  }

  const country = getCountry(countryCode);
  const urls = buildUrls(country.code);
  const proxyConfig = buildAxiosProxyConfig(proxyObj);
  const allUpdatedKeys = new Set();

  const callUserDetail = async (useProxy) => {
    const currentCookie = serializeCookieMap(cookieMap, country.code);
    return axios.get(urls.USER_DETAIL, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'Cookie': currentCookie,
        'Host': urls.SV_HOST,
        'User-Agent': TIGER10_SPECS.appUa,
        'Connection': 'Keep-Alive'
      },
      timeout: 12000,
      validateStatus: () => true,
      ...(useProxy ? proxyConfig : {})
    });
  };

  try {
    let accRes;
    try {
      accRes = await callUserDetail(true);
    } catch (_) {
      // Nếu proxy của luồng đang lỗi kết nối, thử kiểm tra trực tiếp không qua proxy để tránh báo sai trạng thái Cookie
      accRes = await callUserDetail(false);
    }

    const keys = mergeSetCookieHeaders(cookieMap, accRes.headers?.['set-cookie']);
    keys.forEach(k => allUpdatedKeys.add(k));

    const accData = accRes.data?.data;
    const realUserId = accData?.shopee_user_id || accData?.user_id || accData?.userid || accData?.live_info?.user_id;
    const isValid = accRes.data?.code === 0 && Boolean(realUserId);

    if (isValid) {
      if (realUserId && (!cookieMap.get('SPC_U') || cookieMap.get('SPC_U') === '-')) {
        cookieMap.set('SPC_U', String(realUserId));
      }
      return {
        success: true,
        cookie: serializeCookieMap(cookieMap, country.code),
        userId: realUserId,
        username: accData.shopee_user_name || accData.video_user_name || accData.user_name || accData.username || '',
        updatedKeys: Array.from(allUpdatedKeys),
        reason: 'Cookie sống & hợp lệ (TIGER 10 - 36448)'
      };
    }

    return {
      success: false,
      cookie: serializeCookieMap(cookieMap, country.code),
      updatedKeys: Array.from(allUpdatedKeys),
      reason: `Phiên đăng nhập hết hạn (code=${accRes.data?.code ?? accRes.status})`
    };
  } catch (err) {
    return {
      success: false,
      cookie: serializeCookieMap(cookieMap, country.code),
      updatedKeys: Array.from(allUpdatedKeys),
      reason: `Lỗi kết nối khi kiểm tra Cookie: ${err.message}`
    };
  }
}

/**
 * Đọc danh sách tất cả Profiles từ GemLogin Local API (http://127.0.0.1:1010)
 */
async function listGemLoginProfiles() {
  try {
    const res = await axios.get(`${GEMLOGIN_API_BASE}/api/profiles?page=1&per_page=2000`, {
      timeout: 5000
    });
    if (res.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }
  } catch (_) {}
  return [];
}

/**
 * Đọc trực tiếp file SQLite Cookies của GemLogin Profile (<profile_path>/Cookies hoặc Default/Network/Cookies)
 */
function readGemLoginProfileSqliteCookies(profilePath, targetDomain = '') {
  return new Promise((resolve) => {
    if (!profilePath) return resolve([]);
    const normalizedPath = profilePath.replace(/\//g, path.sep);
    const candidates = [
      path.join(normalizedPath, 'Cookies'),
      path.join(normalizedPath, 'Default', 'Network', 'Cookies')
    ];
    const existingDbPath = candidates.find(p => fs.existsSync(p));
    if (!existingDbPath) return resolve([]);

    const cookieDb = new sqlite3.Database(existingDbPath, (err) => {
      if (err) return resolve([]);
      cookieDb.all(
        'SELECT host_key, name, value, encrypted_value, path, last_access_utc FROM cookies WHERE host_key LIKE "%shopee%" ORDER BY last_access_utc ASC',
        [],
        (qErr, rows) => {
          cookieDb.close();
          if (qErr || !rows) return resolve([]);
          const parsed = rows.map(r => {
            let val = r.value || '';
            if (!val && r.encrypted_value && Buffer.isBuffer(r.encrypted_value)) {
              const utf8 = r.encrypted_value.toString('utf8');
              // GemLogin lưu plaintext UTF-8 trong cột encrypted_value (không có prefix v10/v11 DPAPI)
              if (utf8 && !utf8.startsWith('v10') && !utf8.startsWith('v11') && !/[\x00-\x08\x0E-\x1F]/.test(utf8)) {
                val = utf8;
              }
            }
            return {
              domain: r.host_key || '',
              name: r.name || '',
              value: val
            };
          }).filter(c => c.name && c.value);

          if (!targetDomain) return resolve(parsed);
          const cleanTarget = targetDomain.replace(/^\./, '').toLowerCase();
          const filtered = parsed.filter(c => {
            const d = c.domain.replace(/^\./, '').toLowerCase();
            return d === cleanTarget || d.endsWith('.' + cleanTarget);
          });
          resolve(filtered);
        }
      );
    });
  });
}

/**
 * Ghép danh sách cookie objects [{domain, name, value}] thành Map ưu tiên domain chính (shopee.<tld> / .shopee.<tld>)
 */
function buildCookieMapFromCookieObjects(cookieObjs, targetDomain, baseCookieMap = null) {
  const map = baseCookieMap ? new Map(baseCookieMap) : new Map();
  const cleanTarget = (targetDomain || '').replace(/^\./, '').toLowerCase();

  // Phân loại: cookies của subdomain (seller., affiliate.) nạp trước, cookies của root domain (.shopee.ph, shopee.ph) nạp sau để ưu tiên
  const subDomainCookies = [];
  const rootDomainCookies = [];

  for (const c of cookieObjs || []) {
    if (!c || !c.name || !c.value) continue;
    const d = (c.domain || '').replace(/^\./, '').toLowerCase();
    if (!cleanTarget || d === cleanTarget) {
      rootDomainCookies.push(c);
    } else if (d.endsWith('.' + cleanTarget)) {
      subDomainCookies.push(c);
    }
  }

  for (const c of subDomainCookies) {
    if (!map.has(c.name) && c.value !== '-') {
      map.set(c.name, c.value);
    }
  }
  for (const c of rootDomainCookies) {
    if (c.value === '-' && map.get(c.name) && map.get(c.name) !== '-') {
      continue;
    }
    map.set(c.name, c.value);
  }
  return map;
}

/**
 * Tìm các tiến trình Chrome của GemLogin đang mở (lấy profileId và remoteDebuggingPort)
 */
function getRunningGemLoginBrowsers() {
  return new Promise((resolve) => {
    const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*--remote-debugging-port=*' -and $_.CommandLine -like '*profiles*' } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"`;
    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout || !stdout.trim()) return resolve([]);
      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const results = [];
        const seenPorts = new Set();
        for (const item of list) {
          const line = item?.CommandLine || '';
          const portMatch = line.match(/--remote-debugging-port=(\d+)/);
          const profileMatch = line.match(/profiles[\\\/](\d+)/i);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            const profileId = profileMatch ? parseInt(profileMatch[1], 10) : null;
            if (!seenPorts.has(port)) {
              seenPorts.add(port);
              results.push({ port, profileId, address: `127.0.0.1:${port}` });
            }
          }
        }
        resolve(results);
      } catch (_) {
        resolve([]);
      }
    });
  });
}

/**
 * Lấy toàn bộ Cookies thông qua Chrome DevTools Protocol (Storage.getCookies) từ cổng remote_debugging_address
 */
async function getCookiesViaCDP(debuggingAddress, options = {}) {
  const { navigateDomain = null, waitMs = 4500 } = options;
  try {
    const verRes = await axios.get(`http://${debuggingAddress}/json/version`, { timeout: 4000 });
    const wsUrl = verRes.data?.webSocketDebuggerUrl;
    if (!wsUrl) return [];

    const WS = typeof WebSocket !== 'undefined' ? WebSocket : require('ws');

    return await new Promise((resolve) => {
      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch (_) {}
        resolve(val);
      };

      const timer = setTimeout(() => finish([]), (navigateDomain ? waitMs : 0) + 8000);
      const ws = new WS(wsUrl);

      ws.onerror = () => {
        clearTimeout(timer);
        finish([]);
      };

      ws.onopen = () => {
        if (navigateDomain) {
          // Mở tab Shopee để trình duyệt tự làm mới SPC_ST nếu cần
          ws.send(JSON.stringify({
            id: 10,
            method: 'Target.createTarget',
            params: { url: `https://${navigateDomain}/?is_from_login=true` }
          }));
          setTimeout(() => {
            ws.send(JSON.stringify({ id: 1, method: 'Storage.getCookies' }));
          }, waitMs);
        } else {
          ws.send(JSON.stringify({ id: 1, method: 'Storage.getCookies' }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString());
          if (msg.id === 1 && msg.result && Array.isArray(msg.result.cookies)) {
            clearTimeout(timer);
            finish(msg.result.cookies);
          }
        } catch (_) {}
      };
    });
  } catch (_) {
    return [];
  }
}

/**
 * Tự động làm giàu (enrich) cookie từ GemLogin (CDP hoặc SQLite) nếu extension gửi lên thiếu HttpOnly cookies (SPC_ST, SPC_F, SPC_U)
 */
async function enrichCookieFromGemLogin(partialCookieStr, countryCode = 'vn', hintUsername = '') {
  const baseMap = parseCookieToMap(partialCookieStr);
  const ids = extractCookieIdentifiers(baseMap);
  const targetDomain = getShopeeDomainByCountry(countryCode);

  let matchedProfileId = null;
  let matchedProfileName = '';
  let cdpCookies = [];

  // 1. Quét các trình duyệt GemLogin đang mở qua CDP
  const runningBrowsers = await getRunningGemLoginBrowsers();
  const profiles = await listGemLoginProfiles();
  const profileById = new Map(profiles.map(p => [Number(p.id), p]));

  for (const rb of runningBrowsers) {
    const pInfo = profileById.get(Number(rb.profileId));
    const allCookies = await getCookiesViaCDP(rb.address);
    const domainCookies = allCookies.filter(c => {
      const d = (c.domain || '').replace(/^\./, '').toLowerCase();
      return d === targetDomain || d.endsWith('.' + targetDomain);
    });
    if (domainCookies.length === 0) continue;

    const candidateMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain);
    const isMatch =
      (hintUsername && pInfo && pInfo.name.trim().toLowerCase() === hintUsername.trim().toLowerCase()) ||
      (ids.csrftoken && candidateMap.get('csrftoken') === ids.csrftoken) ||
      (ids.spc_f && candidateMap.get('SPC_F') === ids.spc_f) ||
      (ids.spc_u && candidateMap.get('SPC_U') === ids.spc_u) ||
      runningBrowsers.length === 1;

    if (isMatch) {
      matchedProfileId = rb.profileId;
      matchedProfileName = pInfo ? pInfo.name.trim() : '';
      cdpCookies = domainCookies;
      break;
    }
  }

  if (cdpCookies.length > 0) {
    const mergedMap = buildCookieMapFromCookieObjects(cdpCookies, targetDomain, baseMap);
    return {
      cookie: serializeCookieMap(mergedMap, countryCode),
      profileId: matchedProfileId,
      profileName: matchedProfileName,
      source: 'gemlogin-cdp'
    };
  }

  // 2. Nếu không tìm thấy qua CDP đang chạy, kiểm tra file SQLite Cookies của profile khớp tên hoặc khớp csrftoken/SPC_F
  if (hintUsername) {
    const pMatch = profiles.find(p => (p.name || '').trim().toLowerCase() === hintUsername.trim().toLowerCase());
    if (pMatch) {
      const sqlCookies = await readGemLoginProfileSqliteCookies(pMatch.profile_path, targetDomain);
      if (sqlCookies.length > 0) {
        const mergedMap = buildCookieMapFromCookieObjects(sqlCookies, targetDomain, baseMap);
        return {
          cookie: serializeCookieMap(mergedMap, countryCode),
          profileId: pMatch.id,
          profileName: pMatch.name.trim(),
          source: 'gemlogin-sqlite'
        };
      }
    }
  }

  return {
    cookie: serializeCookieMap(baseMap, countryCode),
    profileId: null,
    profileName: '',
    source: 'extension'
  };
}

/**
 * Tìm tất cả các luồng kèm thông tin định danh Cookie (SPC_U, SPC_F, username)
 */
function getAllThreadsWithUsers() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT threads.*, users.cookie, users.username, users.proxy AS user_proxy
       FROM threads
       INNER JOIN users ON threads.user_id = users.id
       ORDER BY threads.id DESC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
}

/**
 * Cập nhật Cookie mới cho User + Xóa lỗi luồng + Cho chạy lại luồng ngay
 */
async function applyRecoveredCookieToThread(thread, newCookie, autoStart = true) {
  const nowSec = Math.floor(Date.now() / 1000);
  await new Promise((res, rej) => {
    db.run(
      'UPDATE users SET cookie = ? WHERE id = ?',
      [newCookie, thread.user_id],
      (err) => (err ? rej(err) : res())
    );
  });

  if (autoStart) {
    // Nếu user có các video failed và không còn pending, tự động chuyển failed -> pending để chạy tiếp
    await new Promise((res) => {
      db.get(
        "SELECT COUNT(*) AS cnt FROM video_tasks WHERE user_id = ? AND status = 'pending'",
        [thread.user_id],
        (err, row) => {
          if (!err && (!row || row.cnt === 0)) {
            db.run(
              "UPDATE video_tasks SET status = 'pending', error = NULL WHERE user_id = ? AND status = 'failed'",
              [thread.user_id],
              () => res()
            );
          } else {
            res();
          }
        }
      );
    });

    await new Promise((res, rej) => {
      db.run(
        "UPDATE threads SET error = NULL, status = 'inprogress', next_run_at = ? WHERE id = ?",
        [nowSec + 2, thread.id],
        (err) => (err ? rej(err) : res())
      );
    });
  } else {
    await new Promise((res, rej) => {
      db.run(
        'UPDATE threads SET error = NULL WHERE id = ?',
        [thread.id],
        (err) => (err ? rej(err) : res())
      );
    });
  }
}

/**
 * LỚP 2: Đồng bộ Cookie từ Chrome Extension (cookie_shopee) về Tool MLS
 */
async function syncCookieFromExtension({ cookie, domain, country, threadId, username, autoStart = true }) {
  let detectedCountry = (country || '').toLowerCase();
  if (!detectedCountry && domain) {
    const d = domain.toLowerCase();
    if (d.includes('shopee.ph')) detectedCountry = 'ph';
    else if (d.includes('shopee.co.id')) detectedCountry = 'id';
    else if (d.includes('shopee.co.th')) detectedCountry = 'th';
    else if (d.includes('shopee.com.my')) detectedCountry = 'my';
    else if (d.includes('shopee.sg')) detectedCountry = 'sg';
    else if (d.includes('shopee.com.br')) detectedCountry = 'br';
    else if (d.includes('shopee.tw')) detectedCountry = 'tw';
    else detectedCountry = 'vn';
  }
  if (!detectedCountry) detectedCountry = 'vn';

  // Tự động làm giàu cookie từ GemLogin CDP/SQLite nếu extension bị trình duyệt ẩn HttpOnly cookies
  const enriched = await enrichCookieFromGemLogin(cookie, detectedCountry, username);
  const fullCookieStr = enriched.cookie;
  const ids = extractCookieIdentifiers(fullCookieStr);
  const effectiveUsername = (username || enriched.profileName || '').trim();

  const threads = await getAllThreadsWithUsers();
  let matchedThread = null;
  let matchBy = '';

  // 1. Khớp theo threadId chỉ định trực tiếp
  if (threadId) {
    matchedThread = threads.find(t => Number(t.id) === Number(threadId));
    if (matchedThread) matchBy = 'threadId';
  }

  // 2. Khớp theo SPC_U (Shopee User ID - chính xác tuyệt đối 100%)
  if (!matchedThread && ids.spc_u) {
    matchedThread = threads.find(t => {
      const tIds = extractCookieIdentifiers(t.cookie);
      return tIds.spc_u && tIds.spc_u === ids.spc_u;
    });
    if (matchedThread) matchBy = `SPC_U (${ids.spc_u})`;
  }

  // 3. Khớp theo SPC_F (Device Fingerprint ID)
  if (!matchedThread && ids.spc_f) {
    matchedThread = threads.find(t => {
      const tIds = extractCookieIdentifiers(t.cookie);
      return tIds.spc_f && tIds.spc_f === ids.spc_f;
    });
    if (matchedThread) matchBy = `SPC_F`;
  }

  // 4. Khớp theo Username / Tên Profile GemLogin (VD: PH3009, S29)
  if (!matchedThread && effectiveUsername) {
    matchedThread = threads.find(
      t => (t.username || '').trim().toLowerCase() === effectiveUsername.toLowerCase()
    );
    if (matchedThread) matchBy = `Username (${effectiveUsername})`;
  }

  if (matchedThread) {
    const finalCookie = serializeCookieMap(parseCookieToMap(fullCookieStr), matchedThread.country || detectedCountry);
    await applyRecoveredCookieToThread(matchedThread, finalCookie, autoStart);
    console.log(`✅ [Cookie-Sync] Đã đồng bộ Cookie (${ids.keyCount} keys, nguồn: ${enriched.source}) cho luồng #${matchedThread.id} (${matchedThread.username}) qua ${matchBy}`);
    return {
      success: true,
      cookie: finalCookie,
      keyCount: ids.keyCount,
      hasSpcSt: ids.hasSpcSt,
      source: enriched.source,
      matchBy,
      matchedThread: {
        id: matchedThread.id,
        user_id: matchedThread.user_id,
        username: matchedThread.username,
        country: matchedThread.country,
        status: autoStart ? 'inprogress' : matchedThread.status
      }
    };
  }

  // Ngay cả khi chưa khớp luồng nào trong DB, vẫn trả về chuỗi Cookie đầy đủ (đã lấy từ CDP/SQLite) cho Popup hiển thị!
  return {
    success: false,
    cookie: fullCookieStr,
    keyCount: ids.keyCount,
    hasSpcSt: ids.hasSpcSt,
    source: enriched.source,
    profileName: effectiveUsername,
    error: 'Đã lấy đủ Cookie nhưng chưa tìm thấy luồng khớp tự động. Hãy chọn luồng trong danh sách bên dưới.'
  };
}

/**
 * Tìm Profile GemLogin tương ứng với một Luồng (theo tên username hoặc theo SPC_U / SPC_F trong SQLite)
 */
async function findGemLoginProfileForThread(thread, profilesList = null) {
  const profiles = profilesList || (await listGemLoginProfiles());
  if (!profiles || profiles.length === 0) return null;

  const threadUsername = (thread.username || '').trim().toLowerCase();
  const threadIds = extractCookieIdentifiers(thread.cookie);
  const targetDomain = getShopeeDomainByCountry(thread.country || 'vn');

  // 1. Ưu tiên khớp chính xác theo tên Profile === Username (VD: PH3009 === PH3009)
  if (threadUsername) {
    const exactMatch = profiles.find(p => (p.name || '').trim().toLowerCase() === threadUsername);
    if (exactMatch) return exactMatch;
  }

  // 2. Quét các file SQLite Cookies sẵn có trên ổ cứng để tìm SPC_U hoặc SPC_F trùng khớp
  if (threadIds.spc_u || threadIds.spc_f) {
    for (const p of profiles) {
      const sqlCookies = await readGemLoginProfileSqliteCookies(p.profile_path, targetDomain);
      if (sqlCookies.length === 0) continue;
      const cMap = buildCookieMapFromCookieObjects(sqlCookies, targetDomain);
      if (
        (threadIds.spc_u && cMap.get('SPC_U') === threadIds.spc_u) ||
        (threadIds.spc_f && cMap.get('SPC_F') === threadIds.spc_f)
      ) {
        return p;
      }
    }
  }

  // 3. Khớp gần đúng theo tên (chứa username)
  if (threadUsername && threadUsername.length >= 3) {
    const partialMatch = profiles.find(p => (p.name || '').trim().toLowerCase().includes(threadUsername));
    if (partialMatch) return partialMatch;
  }

  return null;
}

// Hàng đợi tuần tự cho việc bật trình duyệt GemLogin (tránh bật 20 Chrome cùng lúc gây tràn RAM)
let _gemloginBrowserQueue = Promise.resolve();
function enqueueGemLoginBrowserTask(taskFn) {
  const next = _gemloginBrowserQueue.then(() => taskFn()).catch((err) => ({
    success: false,
    error: err?.message || 'Lỗi hàng đợi GemLogin'
  }));
  _gemloginBrowserQueue = next.then(() => {}, () => {});
  return next;
}

const _activeInteractiveWatchers = new Map();

/**
 * Điều hướng tab trống (chrome://newtab/) của trình duyệt vừa mở tới trang Shopee để người dùng thao tác ngay
 */
async function navigateBlankTabToShopee(debuggingAddress, targetDomain) {
  try {
    const listRes = await axios.get(`http://${debuggingAddress}/json/list`, { timeout: 3000 });
    const pages = (listRes.data || []).filter(t => t.type === 'page');
    const hasShopeeTab = pages.some(t => String(t.url || '').includes(targetDomain));
    if (hasShopeeTab) return;

    const blankTab = pages.find(t => !t.url || t.url.startsWith('chrome://') || t.url === 'about:blank') || pages[0];
    if (!blankTab || !blankTab.webSocketDebuggerUrl) return;

    const WS = getWebSocketConstructor();
    if (!WS) return;

    await new Promise((resolve) => {
      const ws = new WS(blankTab.webSocketDebuggerUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch (_) {}
        resolve();
      }, 3000);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Page.navigate',
          params: { url: `https://${targetDomain}` }
        }));
        setTimeout(() => {
          clearTimeout(timer);
          try { ws.close(); } catch (_) {}
          resolve();
        }, 400);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  } catch (_) {}
}

/**
 * Theo dõi ngầm trình duyệt GemLogin đang mở cho người dùng tương tác bằng tay:
 * - Cứ mỗi 2.5s đọc tĩnh Storage.getCookies để lưu bản Cookie hợp lệ mới nhất vào bộ nhớ tạm.
 * - Ngay khi người dùng đóng cửa sổ trình duyệt GemLogin, tự động lưu Cookie mới nhất vào DB và cho chạy lại luồng!
 */
function startInteractiveGemLoginWatcher({ profile, debuggingAddress, targetDomain, countryCode, thread, userId, username, autoStart = true }) {
  const profId = Number(profile.id);
  if (_activeInteractiveWatchers.has(profId)) {
    clearInterval(_activeInteractiveWatchers.get(profId).timer);
    _activeInteractiveWatchers.delete(profId);
  }

  const state = {
    latestCookie: null,
    busy: false,
    timer: null
  };

  state.timer = setInterval(async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      await axios.get(`http://${debuggingAddress}/json/version`, { timeout: 1500 });
      // Trình duyệt vẫn đang mở -> đọc tĩnh Storage.getCookies
      const cdpCookies = await getCookiesViaCDP(debuggingAddress);
      const domainCookies = cdpCookies.filter(c => {
        const d = (c.domain || '').replace(/^\./, '').toLowerCase();
        return d === targetDomain || d.endsWith('.' + targetDomain);
      });
      if (domainCookies.length > 0) {
        const mergedMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain);
        if (mergedMap.get('SPC_ST') && mergedMap.get('SPC_U') && mergedMap.get('SPC_U') !== '-') {
          state.latestCookie = serializeCookieMap(mergedMap, countryCode);
        }
      }
    } catch (_) {
      // Trình duyệt đã được người dùng đóng lại -> tự động lưu Cookie mới nhất thu được
      clearInterval(state.timer);
      _activeInteractiveWatchers.delete(profId);
      if (state.latestCookie) {
        try {
          if (thread && thread.id) {
            await applyRecoveredCookieToThread(thread, state.latestCookie, autoStart);
          } else if (userId) {
            await new Promise((res, rej) =>
              db.run('UPDATE users SET cookie = ? WHERE id = ?', [state.latestCookie, userId], err => (err ? rej(err) : res()))
            );
          }
          console.log(`✅ [GemLogin Interactive] Người dùng đã đóng profile #${profile.id} (${profile.name}) -> Tự động lưu Cookie mới cho ${username}!`);
        } catch (saveErr) {
          console.error('[GemLogin Interactive] Lỗi lưu Cookie khi đóng trình duyệt:', saveErr.message);
        }
      }
    } finally {
      state.busy = false;
    }
  }, 2500);

  _activeInteractiveWatchers.set(profId, state);
}

/**
 * Chế độ tương tác bằng tay khi bấm nút "🔑" (Chìa khóa):
 * - Bấm lần 1 (khi trình duyệt chưa mở): Bật đúng GemLogin Profile lên màn hình, mở trang Shopee và giữ nguyên để người dùng thao tác bằng tay.
 * - Bấm lần 2 (khi trình duyệt đang mở): Lấy Cookie mới nhất từ trình duyệt, lưu vào DB, đóng trình duyệt và cho chạy lại luồng.
 */
async function openOrHarvestGemLoginInteractive({ profile, targetDomain, countryCode, thread = null, userId = null, username = '', autoStart = true }) {
  const profId = Number(profile.id);
  const runningBefore = await getRunningGemLoginBrowsers();
  const alreadyOpen = runningBefore.find(b => Number(b.profileId) === profId);

  // TRƯỜNG HỢP 1: Profile chưa mở -> Bật GemLogin Profile lên để người dùng thao tác bằng tay
  if (!alreadyOpen) {
    try {
      // Tạm dừng luồng trong lúc người dùng đang thao tác trên trình duyệt để tránh xung đột request
      if (thread && thread.id) {
        await new Promise((res) =>
          db.run("UPDATE threads SET status = 'paused' WHERE id = ?", [thread.id], () => res())
        );
      }

      console.log(`🖐️ [GemLogin Interactive] Đang bật profile #${profile.id} (${profile.name}) cho người dùng thao tác bằng tay...`);
      const startRes = await axios.get(`${GEMLOGIN_API_BASE}/api/profiles/start/${profile.id}`, { timeout: 30000 });
      const debuggingAddress = startRes.data?.data?.remote_debugging_address;

      if (!debuggingAddress) {
        return {
          success: false,
          threadId: thread ? thread.id : null,
          userId,
          username,
          error: `Không thể khởi động Profile GemLogin #${profile.id} (${profile.name})`
        };
      }

      await navigateBlankTabToShopee(debuggingAddress, targetDomain);
      startInteractiveGemLoginWatcher({
        profile,
        debuggingAddress,
        targetDomain,
        countryCode,
        thread,
        userId: userId || (thread ? thread.user_id : null),
        username,
        autoStart
      });

      return {
        success: true,
        openedOnly: true,
        layer: '3B-Interactive',
        method: `GemLogin Interactive (#${profile.id} - ${profile.name})`,
        profileId: profile.id,
        profileName: profile.name,
        threadId: thread ? thread.id : null,
        userId: userId || (thread ? thread.user_id : null),
        username,
        message: `Đã bật Profile GemLogin #${profile.id} (${profile.name})! Hãy thao tác bằng tay trên trình duyệt, sau đó bấm lại nút 🔑 (hoặc đóng trình duyệt) để lưu Cookie.`
      };
    } catch (err) {
      return {
        success: false,
        threadId: thread ? thread.id : null,
        userId,
        username,
        error: `Lỗi bật GemLogin #${profile.id}: ${err.message}`
      };
    }
  }

  // TRƯỜNG HỢP 2: Profile đang mở sẵn -> Người dùng bấm 🔑 lần 2 sau khi thao tác xong -> Thu hoạch Cookie & đóng trình duyệt
  if (_activeInteractiveWatchers.has(profId)) {
    clearInterval(_activeInteractiveWatchers.get(profId).timer);
    _activeInteractiveWatchers.delete(profId);
  }

  try {
    const cdpCookies = await getCookiesViaCDP(alreadyOpen.address);
    const domainCookies = cdpCookies.filter(c => {
      const d = (c.domain || '').replace(/^\./, '').toLowerCase();
      return d === targetDomain || d.endsWith('.' + targetDomain);
    });
    const mergedMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain);
    const finalCookie = serializeCookieMap(mergedMap, countryCode);
    const finalIds = extractCookieIdentifiers(finalCookie);

    if (!finalIds.spc_u || (!finalIds.hasSpcSt && !finalIds.hasSpcEc)) {
      return {
        success: false,
        threadId: thread ? thread.id : null,
        userId,
        username,
        error: `Trình duyệt GemLogin #${profile.id} (${profile.name}) chưa đăng nhập Shopee (SPC_U=-). Hãy đăng nhập trên trình duyệt đang mở rồi bấm lại 🔑!`
      };
    }

    if (thread && thread.id) {
      await applyRecoveredCookieToThread(thread, finalCookie, autoStart);
    } else if (userId) {
      await new Promise((res, rej) =>
        db.run('UPDATE users SET cookie = ? WHERE id = ?', [finalCookie, userId], err => (err ? rej(err) : res()))
      );
    }

    try {
      await axios.get(`${GEMLOGIN_API_BASE}/api/profiles/close/${profile.id}`, { timeout: 10000 });
    } catch (_) {}

    return {
      success: true,
      openedOnly: false,
      layer: '3B-Interactive',
      method: `GemLogin (#${profile.id} - ${profile.name})`,
      profileId: profile.id,
      profileName: profile.name,
      threadId: thread ? thread.id : null,
      userId: userId || (thread ? thread.user_id : null),
      username,
      keyCount: finalIds.keyCount,
      cookie: finalCookie,
      message: `[${username}] Đã lưu Cookie mới (${finalIds.keyCount} keys) từ GemLogin #${profile.id} & tự chạy lại!`
    };
  } catch (err) {
    return {
      success: false,
      threadId: thread ? thread.id : null,
      userId,
      username,
      error: `Lỗi đọc Cookie từ GemLogin #${profile.id}: ${err.message}`
    };
  }
}

/**
 * LỚP 3: Khôi phục Cookie cho 1 luồng kết hợp cả Lớp 1 (Silent HTTP Refresh) + Lớp 3A (GemLogin SQLite) + Lớp 3B (GemLogin Browser CDP)
 */
async function recoverThreadCookie(threadId, options = {}) {
  const { forceGemLogin = false, interactive = false, autoStart = true } = options;
  const threads = await getAllThreadsWithUsers();
  const thread = threads.find(t => Number(t.id) === Number(threadId));
  if (!thread) {
    return { success: false, error: `Không tìm thấy luồng #${threadId}` };
  }

  const targetDomain = getShopeeDomainByCountry(thread.country || 'vn');

  if (interactive) {
    const profile = await findGemLoginProfileForThread(thread);
    if (!profile) {
      return {
        success: false,
        threadId: thread.id,
        username: thread.username,
        error: `Không tìm thấy Profile GemLogin nào khớp với tài khoản "${thread.username}"`
      };
    }
    return openOrHarvestGemLoginInteractive({
      profile,
      targetDomain,
      countryCode: thread.country || 'vn',
      thread,
      userId: thread.user_id,
      username: thread.username,
      autoStart
    });
  }
  const proxyObj = thread.proxy_host && thread.proxy_port
    ? {
        host: thread.proxy_host,
        port: thread.proxy_port,
        scheme: 'http',
        auth: thread.proxy_username ? { username: thread.proxy_username, password: thread.proxy_password || '' } : null
      }
    : null;

  // BƯỚC 1 (Lớp 1): Thử Silent HTTP Refresh trước (nếu không ép buộc mở GemLogin)
  if (!forceGemLogin && thread.cookie) {
    const l1 = await silentRefreshCookie(thread.cookie, thread.country, proxyObj);
    if (l1.success) {
      await applyRecoveredCookieToThread(thread, l1.cookie, autoStart);
      console.log(`⚡ [Lớp 1 - Silent Refresh] Khôi phục Cookie thành công cho luồng #${thread.id} (${thread.username})`);
      return {
        success: true,
        layer: 1,
        method: 'Lớp 1 (Silent HTTP Refresh)',
        threadId: thread.id,
        username: thread.username,
        cookie: l1.cookie
      };
    }
  }

  // BƯỚC 2 (Lớp 3): Tìm Profile trong GemLogin
  const profile = await findGemLoginProfileForThread(thread);
  if (!profile) {
    return {
      success: false,
      threadId: thread.id,
      username: thread.username,
      error: `Không tìm thấy Profile GemLogin nào khớp với tài khoản "${thread.username}"`
    };
  }

  // BƯỚC 2A (Lớp 3A): Thử đọc trực tiếp từ SQLite của GemLogin Profile (không cần bật Chrome nếu cookie trong SQLite còn sống)
  if (!forceGemLogin) {
    const sqlCookies = await readGemLoginProfileSqliteCookies(profile.profile_path, targetDomain);
    if (sqlCookies.length > 0) {
      const sqlMap = buildCookieMapFromCookieObjects(sqlCookies, targetDomain, parseCookieToMap(thread.cookie));
      if (sqlMap.get('SPC_ST') && sqlMap.get('SPC_F')) {
        const candidateCookie = serializeCookieMap(sqlMap, thread.country);
        const checkSql = await silentRefreshCookie(candidateCookie, thread.country, proxyObj);
        if (checkSql.success) {
          await applyRecoveredCookieToThread(thread, checkSql.cookie, autoStart);
          console.log(`⚡ [Lớp 3A - GemLogin SQLite] Lấy Cookie trực tiếp từ ổ cứng GemLogin (#${profile.id} ${profile.name}) cho luồng #${thread.id}`);
          return {
            success: true,
            layer: '3A',
            method: `GemLogin SQLite (#${profile.id} - ${profile.name})`,
            threadId: thread.id,
            username: thread.username,
            cookie: checkSql.cookie
          };
        }
      }
    }
  }

  // BƯỚC 2B (Lớp 3B): Mở Profile GemLogin qua API http://127.0.0.1:1010/api/profiles/start/:id -> Lấy Cookie qua CDP -> Đóng Profile
  return enqueueGemLoginBrowserTask(async () => {
    const runningBefore = await getRunningGemLoginBrowsers();
    const alreadyOpen = runningBefore.find(b => Number(b.profileId) === Number(profile.id));
    let debuggingAddress = alreadyOpen ? alreadyOpen.address : null;
    let startedByUs = false;

    try {
      if (!debuggingAddress) {
        console.log(`🚀 [Lớp 3B - GemLogin API] Đang mở profile #${profile.id} (${profile.name}) để lấy lại Cookie...`);
        const startRes = await axios.get(`${GEMLOGIN_API_BASE}/api/profiles/start/${profile.id}`, {
          timeout: 30000
        });
        debuggingAddress = startRes.data?.data?.remote_debugging_address;
        startedByUs = true;
      }

      if (!debuggingAddress) {
        return {
          success: false,
          threadId: thread.id,
          username: thread.username,
          error: `GemLogin không trả về remote_debugging_address cho profile #${profile.id} (${profile.name})`
        };
      }

      // Đọc trực tiếp từ bộ nhớ trình duyệt qua CDP Storage.getCookies (không mở tab mới nếu đã có đủ SPC_ST & SPC_U để tránh kích hoạt Captcha)
      let cdpCookies = await getCookiesViaCDP(debuggingAddress);
      let domainCookies = cdpCookies.filter(c => {
        const d = (c.domain || '').replace(/^\./, '').toLowerCase();
        return d === targetDomain || d.endsWith('.' + targetDomain);
      });
      let mergedMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain);

      if (!mergedMap.get('SPC_ST') || !mergedMap.get('SPC_U') || mergedMap.get('SPC_U') === '-') {
        if (!alreadyOpen) {
          console.log(`🔄 [Lớp 3B - GemLogin CDP] Đang làm mới phiên Shopee (${targetDomain}) trên profile #${profile.id}...`);
          cdpCookies = await getCookiesViaCDP(debuggingAddress, {
            navigateDomain: targetDomain,
            waitMs: 5000
          });
          domainCookies = cdpCookies.filter(c => {
            const d = (c.domain || '').replace(/^\./, '').toLowerCase();
            return d === targetDomain || d.endsWith('.' + targetDomain);
          });
          mergedMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain, mergedMap);
        }
      }

      const finalCookie = serializeCookieMap(mergedMap, thread.country);
      const finalIds = extractCookieIdentifiers(finalCookie);

      if (!finalIds.spc_u || (!finalIds.hasSpcSt && !finalIds.hasSpcEc)) {
        return {
          success: false,
          threadId: thread.id,
          username: thread.username,
          error: `Profile GemLogin #${profile.id} (${profile.name}) đã bị văng đăng nhập Shopee (SPC_U=-). Vui lòng mở GemLogin đăng nhập lại!`
        };
      }

      await applyRecoveredCookieToThread(thread, finalCookie, autoStart);
      console.log(`✅ [Lớp 3B - GemLogin CDP] Đã khôi phục Cookie (${finalIds.keyCount} keys) từ GemLogin #${profile.id} (${profile.name}) cho luồng #${thread.id}`);

      return {
        success: true,
        layer: '3B',
        method: `GemLogin Auto-Browser (#${profile.id} - ${profile.name})`,
        threadId: thread.id,
        username: thread.username,
        keyCount: finalIds.keyCount,
        cookie: finalCookie
      };
    } catch (err) {
      return {
        success: false,
        threadId: thread.id,
        username: thread.username,
        error: `Lỗi kết nối GemLogin API: ${err.message}`
      };
    } finally {
      // Tự động đóng trình duyệt GemLogin nếu do Tool MLS mở ra
      if (startedByUs) {
        try {
          await axios.get(`${GEMLOGIN_API_BASE}/api/profiles/close/${profile.id}`, { timeout: 10000 });
          console.log(`🔒 [Lớp 3B - GemLogin API] Đã tự động đóng profile #${profile.id} (${profile.name})`);
        } catch (_) {}
      }
    }
  });
}

/**
 * Khôi phục hàng loạt cho tất cả các luồng đang bị lỗi Cookie (hoặc danh sách threadIds được chọn)
 */
async function recoverAllDeadCookies(options = {}) {
  const { threadIds = [], forceGemLogin = false } = options;
  const threads = await getAllThreadsWithUsers();

  let targets = [];
  if (Array.isArray(threadIds) && threadIds.length > 0) {
    const idSet = new Set(threadIds.map(id => Number(id)));
    targets = threads.filter(t => idSet.has(Number(t.id)));
  } else {
    targets = threads.filter(t => isCookieDeadError(t.error) || !t.cookie || !t.cookie.includes('SPC_ST='));
  }

  if (targets.length === 0) {
    return {
      success: true,
      total: 0,
      recovered: 0,
      failed: 0,
      results: [],
      message: 'Không có luồng nào bị lỗi Cookie cần khôi phục.'
    };
  }

  const results = [];
  let recovered = 0;
  let failed = 0;

  for (const t of targets) {
    const res = await recoverThreadCookie(t.id, { forceGemLogin, autoStart: true });
    results.push(res);
    if (res.success) recovered++;
    else failed++;
  }

  return {
    success: true,
    total: targets.length,
    recovered,
    failed,
    results,
    message: `Đã khôi phục thành công ${recovered}/${targets.length} luồng${failed > 0 ? ` (${failed} luồng cần kiểm tra lại)` : ''}!`
  };
}

/**
 * Khôi phục Cookie cho 1 tài khoản trong bảng users (kể cả khi tài khoản đã có luồng hoặc chưa tạo luồng)
 */
async function recoverUserCookie(userId, options = {}) {
  const { forceGemLogin = false, interactive = false, autoStart = true } = options;

  // Kiểm tra nếu user này đã có luồng trong bảng threads thì gọi luôn recoverThreadCookie để đồng bộ cả 2 bảng
  const existingThread = await new Promise((resolve) => {
    db.get('SELECT id FROM threads WHERE user_id = ?', [userId], (err, row) => resolve(err ? null : row));
  });
  if (existingThread && existingThread.id) {
    return recoverThreadCookie(existingThread.id, { forceGemLogin, interactive, autoStart });
  }

  // Trường hợp user chưa tạo luồng: lấy trực tiếp từ bảng users
  const user = await new Promise((resolve) => {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => resolve(err ? null : row));
  });
  if (!user) {
    return { success: false, error: `Không tìm thấy người dùng #${userId}` };
  }

  const userCountry = (user.country || 'vn').toLowerCase();
  const targetDomain = getShopeeDomainByCountry(userCountry);

  if (interactive) {
    const profile = await findGemLoginProfileForThread({
      username: user.username,
      cookie: user.cookie || '',
      country: userCountry
    });
    if (!profile) {
      return {
        success: false,
        userId: user.id,
        username: user.username,
        error: `Không tìm thấy Profile GemLogin nào khớp với tài khoản "${user.username}"`
      };
    }
    return openOrHarvestGemLoginInteractive({
      profile,
      targetDomain,
      countryCode: userCountry,
      thread: null,
      userId: user.id,
      username: user.username,
      autoStart
    });
  }
  let proxyObj = null;
  if (user.proxy) {
    const parts = String(user.proxy).replace(/^https?:\/\//i, '').split(':');
    if (parts.length >= 2) {
      proxyObj = {
        host: parts[0],
        port: parseInt(parts[1], 10),
        scheme: 'http',
        auth: parts.length >= 4 ? { username: parts[2], password: parts[3] } : null
      };
    }
  }

  // Lớp 1: Silent HTTP Refresh
  if (!forceGemLogin && user.cookie) {
    const l1 = await silentRefreshCookie(user.cookie, userCountry, proxyObj);
    if (l1.success) {
      await new Promise((res, rej) =>
        db.run('UPDATE users SET cookie = ? WHERE id = ?', [l1.cookie, user.id], err => (err ? rej(err) : res()))
      );
      return {
        success: true,
        layer: 1,
        method: 'Lớp 1 (Silent HTTP Refresh)',
        userId: user.id,
        username: user.username,
        cookie: l1.cookie
      };
    }
  }

  // Lớp 3: Tìm Profile trong GemLogin
  const profile = await findGemLoginProfileForThread({
    username: user.username,
    cookie: user.cookie || '',
    country: userCountry
  });

  if (!profile) {
    return {
      success: false,
      userId: user.id,
      username: user.username,
      error: `Không tìm thấy Profile GemLogin nào khớp với tài khoản "${user.username}"`
    };
  }

  // Lớp 3A: Đọc SQLite GemLogin
  if (!forceGemLogin) {
    const sqlCookies = await readGemLoginProfileSqliteCookies(profile.profile_path, targetDomain);
    if (sqlCookies.length > 0) {
      const sqlMap = buildCookieMapFromCookieObjects(sqlCookies, targetDomain, parseCookieToMap(user.cookie));
      if (sqlMap.get('SPC_ST') && sqlMap.get('SPC_F')) {
        const candidateCookie = serializeCookieMap(sqlMap, userCountry);
        const checkSql = await silentRefreshCookie(candidateCookie, userCountry, proxyObj);
        if (checkSql.success) {
          await new Promise((res, rej) =>
            db.run('UPDATE users SET cookie = ? WHERE id = ?', [checkSql.cookie, user.id], err => (err ? rej(err) : res()))
          );
          return {
            success: true,
            layer: '3A',
            method: `GemLogin SQLite (#${profile.id} - ${profile.name})`,
            userId: user.id,
            username: user.username,
            cookie: checkSql.cookie
          };
        }
      }
    }
  }

  // Lớp 3B: Mở trình duyệt GemLogin -> CDP Storage.getCookies -> Đóng trình duyệt
  return enqueueGemLoginBrowserTask(async () => {
    const runningBefore = await getRunningGemLoginBrowsers();
    const alreadyOpen = runningBefore.find(b => Number(b.profileId) === Number(profile.id));
    let debuggingAddress = alreadyOpen ? alreadyOpen.address : null;
    let startedByUs = false;

    try {
      if (!debuggingAddress) {
        const startRes = await axios.get(`${GEMLOGIN_API_BASE}/api/profiles/start/${profile.id}`, { timeout: 30000 });
        debuggingAddress = startRes.data?.data?.remote_debugging_address;
        startedByUs = true;
      }

      if (!debuggingAddress) {
        return {
          success: false,
          userId: user.id,
          username: user.username,
          error: `GemLogin không trả về remote_debugging_address cho profile #${profile.id} (${profile.name})`
        };
      }

      let cdpCookies = await getCookiesViaCDP(debuggingAddress);
      let domainCookies = cdpCookies.filter(c => {
        const d = (c.domain || '').replace(/^\./, '').toLowerCase();
        return d === targetDomain || d.endsWith('.' + targetDomain);
      });
      let mergedMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain);

      if (!mergedMap.get('SPC_ST') || !mergedMap.get('SPC_U') || mergedMap.get('SPC_U') === '-') {
        if (!alreadyOpen) {
          cdpCookies = await getCookiesViaCDP(debuggingAddress, { navigateDomain: targetDomain, waitMs: 5000 });
          domainCookies = cdpCookies.filter(c => {
            const d = (c.domain || '').replace(/^\./, '').toLowerCase();
            return d === targetDomain || d.endsWith('.' + targetDomain);
          });
          mergedMap = buildCookieMapFromCookieObjects(domainCookies, targetDomain, mergedMap);
        }
      }

      const finalCookie = serializeCookieMap(mergedMap, userCountry);
      const finalIds = extractCookieIdentifiers(finalCookie);

      if (!finalIds.spc_u || (!finalIds.hasSpcSt && !finalIds.hasSpcEc)) {
        return {
          success: false,
          userId: user.id,
          username: user.username,
          error: `Profile GemLogin #${profile.id} (${profile.name}) đã bị văng đăng nhập Shopee (SPC_U=-). Vui lòng mở GemLogin đăng nhập lại!`
        };
      }

      await new Promise((res, rej) =>
        db.run('UPDATE users SET cookie = ? WHERE id = ?', [finalCookie, user.id], err => (err ? rej(err) : res()))
      );

      return {
        success: true,
        layer: '3B',
        method: `GemLogin Auto-Browser (#${profile.id} - ${profile.name})`,
        userId: user.id,
        username: user.username,
        keyCount: finalIds.keyCount,
        cookie: finalCookie
      };
    } catch (err) {
      return {
        success: false,
        userId: user.id,
        username: user.username,
        error: `Lỗi kết nối GemLogin API: ${err.message}`
      };
    } finally {
      if (startedByUs) {
        try {
          await axios.get(`${GEMLOGIN_API_BASE}/api/profiles/close/${profile.id}`, { timeout: 10000 });
        } catch (_) {}
      }
    }
  });
}

/**
 * Khôi phục Cookie hàng loạt cho danh sách người dùng ở tab Quản Lý Người Dùng
 */
async function recoverBatchUsersCookies(options = {}) {
  const { userIds = [], forceGemLogin = false } = options;

  const allUsers = await new Promise((resolve, reject) => {
    db.all(
      `SELECT users.*, threads.error AS thread_error
       FROM users
       LEFT JOIN threads ON threads.user_id = users.id
       ORDER BY users.id DESC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });

  let targets = [];
  if (Array.isArray(userIds) && userIds.length > 0) {
    const idSet = new Set(userIds.map(id => Number(id)));
    targets = allUsers.filter(u => idSet.has(Number(u.id)));
  } else {
    targets = allUsers.filter(u => isCookieDeadError(u.thread_error) || !u.cookie || !u.cookie.includes('SPC_ST='));
    if (targets.length === 0) {
      targets = allUsers;
    }
  }

  if (targets.length === 0) {
    return {
      success: true,
      total: 0,
      recovered: 0,
      failed: 0,
      results: [],
      message: 'Không có người dùng nào cần lấy lại Cookie.'
    };
  }

  const results = [];
  let recovered = 0;
  let failed = 0;

  for (const u of targets) {
    const res = await recoverUserCookie(u.id, { forceGemLogin, autoStart: true });
    results.push(res);
    if (res.success) recovered++;
    else failed++;
  }

  return {
    success: true,
    total: targets.length,
    recovered,
    failed,
    results,
    message: `Đã lấy lại Cookie thành công cho ${recovered}/${targets.length} tài khoản${failed > 0 ? ` (${failed} tài khoản lỗi)` : ''}!`
  };
}

/**
 * Tự động cài đặt & đồng bộ Extension cookie_shopee vào thư mục Global Extensions của GemLogin
 * (C:\Users\<user>\.gemlogin\extensions\cookie_shopee + extension.json)
 * để TẤT CẢ 100% các Profile GemLogin (cũ & mới) đều tự động nạp sẵn Extension khi mở!
 */
function ensureGemLoginGlobalExtensionInstalled() {
  try {
    const userHome = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\thinc';
    const gemExtRoot = path.join(userHome, '.gemlogin', 'extensions');
    const extJsonPath = path.join(gemExtRoot, 'extension.json');
    const srcExtDir = path.resolve(__dirname, '../../cookie_shopee');
    const destExtDir = path.join(gemExtRoot, 'cookie_shopee');

    if (!fs.existsSync(gemExtRoot) || !fs.existsSync(srcExtDir)) return false;

    fs.cpSync(srcExtDir, destExtDir, { recursive: true, force: true });

    let extList = [];
    if (fs.existsSync(extJsonPath)) {
      try {
        extList = JSON.parse(fs.readFileSync(extJsonPath, 'utf8')) || [];
      } catch (_) {
        extList = [];
      }
    }

    const iconPath = path.join(srcExtDir, 'icons', 'icon48.png');
    const iconB64 = fs.existsSync(iconPath)
      ? 'data:image/png;base64,' + fs.readFileSync(iconPath).toString('base64')
      : '';

    const normalizedDestPath = `${userHome}\\.gemlogin/extensions/cookie_shopee`;
    const filtered = extList.filter(
      x => x && x.id !== 'eblcdhecfebdnclnndkgaidgnggeefmp' && x.id !== 'jgdjcbnaodblmdfapldbhpkldnjcfpmf' && !String(x.path || '').includes('cookie_shopee')
    );
    filtered.push({
      id: 'eblcdhecfebdnclnndkgaidgnggeefmp',
      icon: iconB64,
      name: 'Shopee Cookie - Multi Country (TIGER 10)',
      path: normalizedDestPath,
      description: 'Get & Auto-Sync cookies from Shopee URLs (TIGER 10 - 36448)',
      disabled: true,
      deletable: true
    });

    fs.writeFileSync(extJsonPath, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error('[GemLogin-Ext] Lỗi đồng bộ global extension:', err.message);
    return false;
  }
}

// Tự động đồng bộ Extension vào Global GemLogin ngay khi khởi động
ensureGemLoginGlobalExtensionInstalled();

module.exports = {
  TIGER10_SPECS,
  parseCookieToMap,
  serializeCookieMap,
  extractCookieIdentifiers,
  isCookieDeadError,
  silentRefreshCookie,
  syncCookieFromExtension,
  recoverThreadCookie,
  recoverAllDeadCookies,
  recoverUserCookie,
  recoverBatchUsersCookies,
  getAllThreadsWithUsers,
  ensureGemLoginGlobalExtensionInstalled
};
