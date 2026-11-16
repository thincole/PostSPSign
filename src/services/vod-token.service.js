const crypto = require('crypto');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const dbConn = require('../database/connection');
const { buildUrls } = require('../utils/country');
const adbService = require('./adb.service');

let _SocksProxyAgent = null;
try {
  _SocksProxyAgent = require('socks-proxy-agent').SocksProxyAgent;
} catch (_) {}

const DEFAULT_VOD_BIZ = 124;
const VOD_AES_IV = Buffer.from('1234567887654321', 'utf8');
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const FALLBACK_CACHE_TTL_MS = 45 * 60 * 1000;

let _tokenCache = {
  token: '',
  deadlineMs: 0,
  updatedAt: 0,
  source: '',
  uploadUrl: ''
};
let _inFlightRefresh = null;

/**
 * Tạo AES-128 key từ mã biz theo thuật toán Shopee MMS (`shopee_vod_00124`).
 */
function buildVodAesKey(biz = DEFAULT_VOD_BIZ) {
  const bizNum = Number.isFinite(Number(biz)) && Number(biz) > 0 ? Number(biz) : DEFAULT_VOD_BIZ;
  return Buffer.from('shopee_vod_' + String(bizNum).padStart(5, '0'), 'utf8');
}

/**
 * Giải mã token `wscloud` mã hóa AES-128-CBC từ phản hồi `vod/preupload` của Shopee.
 * Trả về chuỗi `AK:Sign:Policy` dùng trực tiếp với Wangsu CDN (`up-ws-*.vod.susercontent.com/file/upload`).
 */
function decryptShopeeVodToken(encToken, biz = DEFAULT_VOD_BIZ) {
  if (!encToken || typeof encToken !== 'string') return '';
  const trimmed = encToken.trim();
  if (!trimmed) return '';
  if (trimmed.includes(':') && trimmed.split(':').length >= 3) {
    return trimmed;
  }

  try {
    const key = buildVodAesKey(biz);
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, VOD_AES_IV);
    const plain = Buffer.concat([
      decipher.update(Buffer.from(trimmed, 'base64')),
      decipher.final()
    ]).toString('utf8').trim();
    return (plain.includes(':') && plain.split(':').length >= 3) ? plain : '';
  } catch (_) {
    return '';
  }
}

/**
 * Đọc `deadline` (ms) từ phần PutPolicy Base64 trong token Wangsu (`AK:Sign:PolicyB64`).
 */
function parseWcsPolicyDeadlineMs(token) {
  if (!token || typeof token !== 'string') return 0;
  const parts = token.split(':');
  if (parts.length < 3 || !parts[2]) return 0;
  try {
    const jsonStr = Buffer.from(parts[2], 'base64').toString('utf8');
    const policy = JSON.parse(jsonStr);
    const rawDeadline = Number(policy?.deadline || 0);
    if (!Number.isFinite(rawDeadline) || rawDeadline <= 0) return 0;
    // Chuẩn hóa nếu deadline tính theo giây
    return rawDeadline < 1e12 ? rawDeadline * 1000 : rawDeadline;
  } catch (_) {
    return 0;
  }
}

/**
 * Cập nhật bộ nhớ đệm token dùng chung nếu token mới còn hạn dài hơn cache hiện tại.
 */
function warmTokenCache(token, source = 'preupload-local', uploadUrl = '') {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (!trimmed.includes(':') || trimmed.split(':').length < 3) return false;

  const deadlineMs = parseWcsPolicyDeadlineMs(trimmed) || (Date.now() + FALLBACK_CACHE_TTL_MS);
  if (deadlineMs <= Date.now() + 60000) return false;

  if (!_tokenCache.token || deadlineMs >= _tokenCache.deadlineMs) {
    _tokenCache = {
      token: trimmed,
      deadlineMs,
      updatedAt: Date.now(),
      source,
      uploadUrl: uploadUrl || _tokenCache.uploadUrl
    };
  }
  return true;
}

/**
 * Lấy token còn hiệu lực trong cache RAM (để làm nguồn dự phòng nhanh).
 */
function getCachedValidToken(minRemainMs = TOKEN_REFRESH_BUFFER_MS) {
  if (!_tokenCache.token) return null;
  if (_tokenCache.deadlineMs && _tokenCache.deadlineMs - Date.now() < minRemainMs) {
    return null;
  }
  return { ..._tokenCache };
}

/**
 * Tách và giải mã token `wscloud` (cùng `uploadUrl` theo vùng) trực tiếp từ object `vod/preupload`.
 */
function extractWsCloudFromUploadInfo(uploadInfo) {
  const data = uploadInfo?.data;
  const services = Array.isArray(data?.services) ? data.services : [];
  const ws = services.find(s => s && s.serviceid === 'wscloud');
  if (!ws || !ws.token) return null;

  const token = decryptShopeeVodToken(ws.token, data?.biz || DEFAULT_VOD_BIZ);
  if (!token) return null;

  const deadlineMs = parseWcsPolicyDeadlineMs(token);
  if (deadlineMs && deadlineMs <= Date.now() + 60000) {
    return null;
  }

  const uploadUrl = ws.uploaddomain
    ? String(ws.uploaddomain).replace(/\/+$/, '') + '/file/upload'
    : '';
  warmTokenCache(token, 'preupload-local-decrypt', uploadUrl);
  return { token, uploadUrl, deadlineMs };
}

function buildProxyAgentFromRow(row) {
  let proxyUrl = '';
  if (row?.proxy_host && row?.proxy_port) {
    const auth = (row.proxy_username && row.proxy_password)
      ? `${row.proxy_username}:${row.proxy_password}@`
      : '';
    proxyUrl = `http://${auth}${row.proxy_host}:${row.proxy_port}`;
  } else if (row?.user_proxy && typeof row.user_proxy === 'string') {
    const raw = row.user_proxy.trim();
    const schemeMatch = raw.match(/^(https?|socks5h?|socks4):\/\/(.+)$/i);
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : 'http';
    const body = schemeMatch ? schemeMatch[2] : raw;
    const parts = body.split(':');
    if (parts.length >= 2) {
      const auth = parts.length >= 4 ? `${parts[2]}:${parts[3]}@` : '';
      proxyUrl = `${scheme === 'socks5h' ? 'socks5' : scheme}://${auth}${parts[0]}:${parts[1]}`;
    }
  }
  if (!proxyUrl) return undefined;
  if (proxyUrl.startsWith('socks')) {
    return _SocksProxyAgent ? new _SocksProxyAgent(proxyUrl) : undefined;
  }
  return new HttpsProxyAgent(proxyUrl);
}

async function queryCandidateUsers(limit = 6) {
  const db = dbConn.getConnection ? dbConn.getConnection() : null;
  if (!db) return [];
  return await new Promise((resolve) => {
    db.all(
      `SELECT u.id, u.cookie, COALESCE(NULLIF(t.country, ''), NULLIF(u.country, ''), 'vn') AS country,
              t.proxy_host, t.proxy_port, t.proxy_username, t.proxy_password, u.proxy AS user_proxy
       FROM users u
       LEFT JOIN threads t ON t.user_id = u.id
       WHERE u.cookie IS NOT NULL AND TRIM(u.cookie) != '' AND COALESCE(u.is_active, 1) = 1
       GROUP BY u.id
       ORDER BY CASE t.status WHEN 'inprogress' THEN 0 WHEN 'stop' THEN 1 WHEN 'done' THEN 2 ELSE 3 END, RANDOM()
       LIMIT ?`,
      [limit],
      (err, rows) => resolve(err ? [] : (rows || []))
    );
  });
}

async function fetchPreuploadWithUser(row, forceCountry = '') {
  const country = String(forceCountry || row?.country || 'vn').toLowerCase();
  const urls = buildUrls(country);
  const devProf = await adbService.getPhoneDeviceProfile();
  const payload = {
    biz: DEFAULT_VOD_BIZ,
    ver: 3,
    reportdata: {
      sdkversion: '1.0',
      appversion: devProf.appVersion,
      ostype: '0',
      osversion: devProf.sdkInt,
      token_type: 0,
      reporttime: Date.now()
    },
    mediatype: 1
  };
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    cookie: row.cookie,
    'user-agent': devProf.userAgent
  };

  const proxyAgent = buildProxyAgentFromRow(row);
  const attempts = proxyAgent ? [proxyAgent, undefined] : [undefined];
  for (const agent of attempts) {
    try {
      const res = await axios.post(urls.PREUPLOAD, payload, {
        headers,
        timeout: 12000,
        httpAgent: agent,
        httpsAgent: agent,
        validateStatus: () => true
      });
      if (res.status >= 200 && res.status < 300 && res.data?.data) {
        const extracted = extractWsCloudFromUploadInfo(res.data);
        if (extracted?.token) {
          return { ...extracted, country };
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Tự cấp phát Wangsu upload token từ cache ấm hoặc bằng cách gọi `vod/preupload` của Shopee
 * bằng chính tài khoản trong DB và giải mã AES nội bộ (hoàn toàn không gọi bên thứ 3).
 */
async function generateSelfToken(options = {}) {
  const { forceRefresh = false, country = '' } = options || {};
  if (!forceRefresh) {
    const cached = getCachedValidToken();
    if (cached) {
      return {
        token: cached.token,
        uploadUrl: cached.uploadUrl,
        deadlineMs: cached.deadlineMs,
        source: 'self-cache'
      };
    }
  }

  if (_inFlightRefresh) {
    return await _inFlightRefresh;
  }

  _inFlightRefresh = (async () => {
    const candidates = await queryCandidateUsers(6);
    for (const row of candidates) {
      const result = await fetchPreuploadWithUser(row, country);
      if (result?.token) {
        return {
          token: result.token,
          uploadUrl: result.uploadUrl,
          deadlineMs: result.deadlineMs,
          country: result.country,
          source: 'self-preupload-decrypt'
        };
      }
    }
    throw new Error('Không tìm được tài khoản Shopee hợp lệ trong DB để tự cấp VOD token');
  })().finally(() => {
    _inFlightRefresh = null;
  });

  return await _inFlightRefresh;
}

function getTokenStatus() {
  const cached = getCachedValidToken(0);
  const remainSec = cached && cached.deadlineMs
    ? Math.max(0, Math.floor((cached.deadlineMs - Date.now()) / 1000))
    : 0;
  return {
    hasCachedToken: Boolean(cached?.token),
    source: cached?.source || null,
    remainSec,
    deadlineAt: cached?.deadlineMs ? new Date(cached.deadlineMs).toISOString() : null,
    updatedAt: cached?.updatedAt ? new Date(cached.updatedAt).toISOString() : null
  };
}

module.exports = {
  buildVodAesKey,
  decryptShopeeVodToken,
  parseWcsPolicyDeadlineMs,
  extractWsCloudFromUploadInfo,
  warmTokenCache,
  getCachedValidToken,
  generateSelfToken,
  getTokenStatus
};
