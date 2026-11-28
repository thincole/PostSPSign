const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const db = require('../database/connection').getConnection();

const COUNTRY_CART_MAP = {
  vn: { tld: 'vn', appId: 'com.shopee.vn' },
  ph: { tld: 'ph', appId: 'com.shopee.ph' },
  id: { tld: 'co.id', appId: 'com.shopee.id' },
  th: { tld: 'co.th', appId: 'com.shopee.th' },
  my: { tld: 'com.my', appId: 'com.shopee.my' },
  sg: { tld: 'sg', appId: 'com.shopee.sg' },
  br: { tld: 'com.br', appId: 'com.shopee.br' },
  tw: { tld: 'tw', appId: 'com.shopee.tw' },
  mx: { tld: 'com.mx', appId: 'com.shopee.mx' },
  ar: { tld: 'com.ar', appId: 'com.shopee.ar' }
};

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; TIGER 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 Shopee';

const CONCURRENCY = Math.max(1, parseInt(process.env.CART_CHECK_CONCURRENCY || '16', 10) || 16);
const REQUEST_TIMEOUT_MS = 9000;

let batchJob = {
  jobId: 0,
  running: false,
  country: 'all',
  total: 0,
  done: 0,
  unlocked: 0,
  locked: 0,
  deadCookie: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
  results: []
};

function getCountryMeta(countryCode) {
  const key = String(countryCode || 'vn').trim().toLowerCase();
  return COUNTRY_CART_MAP[key] || COUNTRY_CART_MAP.vn;
}

function makeAgent(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let scheme = 'http';
  let body = s;
  const sm = s.match(/^([a-z0-9]+):\/\/(.*)$/i);
  if (sm) {
    scheme = sm[1].toLowerCase();
    body = sm[2];
  }
  let url = '';
  if (body.includes('@')) {
    url = `${scheme}://${body}`;
  } else {
    const p = body.split(':');
    if (p.length >= 4) {
      url = `${scheme}://${encodeURIComponent(p[2])}:${encodeURIComponent(p.slice(3).join(':'))}@${p[0]}:${p[1]}`;
    } else if (p.length >= 2) {
      url = `${scheme}://${p[0]}:${p[1]}`;
    } else {
      return null;
    }
  }
  return scheme.startsWith('socks') ? new SocksProxyAgent(url) : new HttpsProxyAgent(url);
}

function classifyCartStatus(r) {
  if (r.error) return 'NET_ERR';
  if (r.accErr === 19 || r.detCode === 100000 || r.affCode === 30002) return 'DEAD_COOKIE';

  if (
    r.can_post === true &&
    r.state === 0 &&
    r.video_post_state === 0 &&
    r.sg_account_state === 1 &&
    Array.isArray(r.rights_list) &&
    r.rights_list.includes(4)
  ) {
    if (r.affCode !== 0 || !r.affId) return 'NO_AFFILIATE';
    if (r.frozen_reason) return 'AFF_FROZEN';
    return 'OK';
  }

  if (r.can_post === false) {
    if (r.state === 1 && r.video_post_state > 0) return 'LOCKED_FULL_VPOST';
    if (r.state === 1 || r.sg_account_state === 3) return 'LOCKED_VIDEO_RIGHTS';
    if (r.video_post_state > 0) return 'LOCKED_VPOST_ONLY';
    return 'LOCKED_OTHER';
  }

  if (!Array.isArray(r.rights_list) || !r.rights_list.includes(4)) return 'NO_LINK_RIGHT';
  return 'OTHER';
}

function getCategoryLabel(cat, r = {}) {
  switch (cat) {
    case 'OK':
      return 'Đã mở lại giỏ (Đăng video gắn link OK)';
    case 'LOCKED_VIDEO_RIGHTS':
      return 'Vẫn khóa giỏ / quyền video (state=1 / sg=3)';
    case 'LOCKED_FULL_VPOST':
      return 'Khóa toàn bộ đăng video & giỏ';
    case 'LOCKED_VPOST_ONLY':
      return 'Vẫn khóa quyền đăng video';
    case 'NO_LINK_RIGHT':
      return 'Chưa mở quyền gắn giỏ hàng (thiếu quyền #4)';
    case 'NO_AFFILIATE':
      return 'Mở video nhưng chưa kích hoạt Affiliate';
    case 'AFF_FROZEN':
      return `Affiliate bị đóng băng${r.frozen_reason ? ': ' + r.frozen_reason : ''}`;
    case 'DEAD_COOKIE':
      return 'Cookie hết hạn / mất đăng nhập';
    case 'NO_COOKIE':
      return 'Thiếu cookie';
    case 'NET_ERR':
      return `Lỗi mạng / proxy${r.error ? ' (' + r.error + ')' : ''}`;
    case 'LOCKED_OTHER':
      return 'Vẫn đang bị hạn chế đăng video';
    default:
      return 'Trạng thái chưa rõ';
  }
}

function queryDbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function checkSingleUserCart(u, fallbackProxies = [], idx = 0) {
  const cookie = String(u.cookie || '').trim();
  const country = String(u.country || 'vn').trim().toLowerCase();
  if (!cookie) {
    return {
      id: u.id,
      username: u.username,
      country,
      is_active: u.is_active,
      category: 'NO_COOKIE',
      label: getCategoryLabel('NO_COOKIE'),
      canActivate: false,
      detail: 'Không có cookie'
    };
  }

  const { tld, appId } = getCountryMeta(country);
  const userDetailUrl = `https://sv.shopee.${tld}/api/v2/user/detail`;
  const affProfileUrl = `https://affiliate.shopee.${tld}/api/v3/user/profile`;
  const accInfoUrl = `https://shopee.${tld}/api/v4/account/basic/get_account_info`;
  const referer = `https://shopee.${tld}/`;

  const proxyList = [];
  if (u.thread_proxy) proxyList.push(u.thread_proxy);
  if (u.proxy && !proxyList.includes(u.proxy)) proxyList.push(u.proxy);
  if (fallbackProxies.length > 0) {
    const p1 = fallbackProxies[idx % fallbackProxies.length];
    const p2 = fallbackProxies[(idx + 23) % fallbackProxies.length];
    const p3 = fallbackProxies[(idx + 47) % fallbackProxies.length];
    for (const p of [p1, p2, p3]) {
      if (p && !proxyList.includes(p)) proxyList.push(p);
    }
  }
  proxyList.push('');

  let lastErr = '';
  for (let pi = 0; pi < proxyList.length; pi++) {
    const pRaw = proxyList[pi];
    const agent = makeAgent(pRaw);
    const cfg = {
      timeout: REQUEST_TIMEOUT_MS,
      proxy: false,
      validateStatus: () => true,
      ...(agent ? { httpAgent: agent, httpsAgent: agent } : {})
    };

    try {
      const [detR, affR, accR] = await Promise.all([
        axios.get(userDetailUrl, {
          ...cfg,
          headers: { Cookie: cookie, 'User-Agent': MOBILE_UA, Referer: referer }
        }),
        axios.get(affProfileUrl, {
          ...cfg,
          headers: {
            Cookie: cookie,
            'Affiliate-Program-Type': '1',
            'User-Agent': MOBILE_UA,
            'x-api-source': 'rn',
            'x-requested-with': appId
          }
        }),
        axios.get(accInfoUrl, {
          ...cfg,
          headers: { Cookie: cookie, 'User-Agent': MOBILE_UA, Referer: referer }
        })
      ]);

      const badHttp = [407, 429, 502, 503, 504];
      if (badHttp.includes(detR.status) || badHttp.includes(affR.status) || badHttp.includes(accR.status)) {
        lastErr = `HTTP ${detR.status}/${affR.status}/${accR.status}`;
        continue;
      }

      if (
        !detR.data || typeof detR.data !== 'object' ||
        !accR.data || typeof accR.data !== 'object'
      ) {
        lastErr = `Phản hồi non-JSON (${detR.status}/${affR.status}/${accR.status})`;
        continue;
      }

      const d = detR.data?.data || {};
      const a = affR.data?.data || {};
      const ac = accR.data || {};

      const raw = {
        accErr: ac.error,
        detCode: detR.data?.code ?? detR.data?.error ?? null,
        can_post: d.can_post,
        state: d.state,
        video_post_state: d.video_post_state,
        sg_account_state: d.sg_account_state,
        rights_list: d.rights_list,
        affCode: affR.data?.code ?? affR.data?.error ?? null,
        affId: a.affiliate_id || null,
        frozen_reason: a.frozen_reason || ''
      };

      const category = classifyCartStatus(raw);
      const rightsStr = Array.isArray(raw.rights_list) ? `[${raw.rights_list.join(',')}]` : '-';
      const detail =
        category === 'DEAD_COOKIE'
          ? `accErr=${raw.accErr ?? '-'}, detCode=${raw.detCode ?? '-'}, affCode=${raw.affCode ?? '-'}`
          : `can_post=${raw.can_post}, state=${raw.state ?? '-'}, vpost=${raw.video_post_state ?? '-'}, sg=${raw.sg_account_state ?? '-'}, rights=${rightsStr}, aff=${raw.affId ? 'OK' : 'none'}`;

      return {
        id: u.id,
        username: u.username,
        country,
        is_active: u.is_active,
        category,
        label: getCategoryLabel(category, raw),
        canActivate: category === 'OK',
        ownProxyFailed: pi > 0 && Boolean(u.thread_proxy || u.proxy),
        shopeeName: ac.data?.username || d.shopee_user_name || '',
        detail
      };
    } catch (err) {
      lastErr = err?.code || err?.message || 'Lỗi mạng';
      continue;
    }
  }

  return {
    id: u.id,
    username: u.username,
    country,
    is_active: u.is_active,
    category: 'NET_ERR',
    label: getCategoryLabel('NET_ERR', { error: lastErr }),
    canActivate: false,
    error: lastErr,
    detail: lastErr || 'Không kết nối được'
  };
}

function getBatchStatus(sinceIndex = 0) {
  const idx = Math.max(0, parseInt(sinceIndex, 10) || 0);
  return {
    jobId: batchJob.jobId,
    running: batchJob.running,
    country: batchJob.country,
    total: batchJob.total,
    done: batchJob.done,
    unlocked: batchJob.unlocked,
    locked: batchJob.locked,
    deadCookie: batchJob.deadCookie,
    errors: batchJob.errors,
    startedAt: batchJob.startedAt,
    finishedAt: batchJob.finishedAt,
    nextIndex: batchJob.results.length,
    updates: batchJob.results.slice(idx)
  };
}

async function startInactiveCartCheck({ country = 'all', userIds = [] } = {}) {
  if (batchJob.running) {
    return { alreadyRunning: true, ...getBatchStatus(0) };
  }

  const normalizedCountry = String(country || 'all').trim().toLowerCase();
  const cleanIds = Array.isArray(userIds)
    ? userIds.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v) && v > 0)
    : [];

  const whereParts = ['COALESCE(u.is_active, 1) = 0'];
  const params = [];
  if (normalizedCountry && normalizedCountry !== 'all') {
    whereParts.push("LOWER(COALESCE(NULLIF(u.country, ''), 'vn')) = ?");
    params.push(normalizedCountry);
  }
  if (cleanIds.length > 0) {
    whereParts.push(`u.id IN (${cleanIds.map(() => '?').join(',')})`);
    params.push(...cleanIds);
  }

  const rows = await queryDbAll(
    `SELECT u.id, u.username, u.cookie, u.proxy, u.country, u.is_active,
            MAX(CASE WHEN t.proxy_host IS NOT NULL AND t.proxy_port IS NOT NULL
                 THEN t.proxy_host || ':' || t.proxy_port || COALESCE(':' || t.proxy_username || ':' || t.proxy_password, '')
                 ELSE NULL END) AS thread_proxy
     FROM users u
     LEFT JOIN threads t ON t.user_id = u.id
     WHERE ${whereParts.join(' AND ')}
     GROUP BY u.id
     ORDER BY u.id ASC`,
    params
  );

  const proxyRows = await queryDbAll(
    `SELECT proxy FROM proxies WHERE proxy IS NOT NULL AND TRIM(proxy) != '' LIMIT 100`
  );
  const fallbackProxies = proxyRows.map((p) => p.proxy);

  batchJob = {
    jobId: Date.now(),
    running: true,
    country: normalizedCountry,
    total: rows.length,
    done: 0,
    unlocked: 0,
    locked: 0,
    deadCookie: 0,
    errors: 0,
    startedAt: Date.now(),
    finishedAt: null,
    results: []
  };

  if (rows.length === 0) {
    batchJob.running = false;
    batchJob.finishedAt = Date.now();
    return { alreadyRunning: false, ...getBatchStatus(0) };
  }

  (async () => {
    let cursor = 0;
    const workerCount = Math.min(CONCURRENCY, rows.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const current = cursor++;
        if (current >= rows.length) break;
        const result = await checkSingleUserCart(rows[current], fallbackProxies, current);
        batchJob.done++;
        if (result.category === 'OK') {
          batchJob.unlocked++;
        } else if (result.category === 'DEAD_COOKIE' || result.category === 'NO_COOKIE') {
          batchJob.deadCookie++;
        } else if (result.category === 'NET_ERR') {
          batchJob.errors++;
        } else {
          batchJob.locked++;
        }
        batchJob.results.push(result);
      }
    });

    try {
      await Promise.all(workers);
    } finally {
      batchJob.running = false;
      batchJob.finishedAt = Date.now();
    }
  })();

  return { alreadyRunning: false, ...getBatchStatus(0) };
}

async function activateUsersBatch(userIds = []) {
  const cleanIds = Array.isArray(userIds)
    ? [...new Set(userIds.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v) && v > 0))]
    : [];
  if (cleanIds.length === 0) {
    return { updated: 0, userIds: [] };
  }
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE users SET is_active = 1 WHERE id IN (${cleanIds.map(() => '?').join(',')})`,
      cleanIds,
      (err) => (err ? reject(err) : resolve())
    );
  });
  // Đồng bộ cờ is_active trong kết quả batchJob hiện tại để UI giữ đúng trạng thái
  const idSet = new Set(cleanIds);
  for (const r of batchJob.results) {
    if (idSet.has(Number(r.id))) {
      r.is_active = 1;
      r.activated = true;
    }
  }
  return { updated: cleanIds.length, userIds: cleanIds };
}

module.exports = {
  startInactiveCartCheck,
  getBatchStatus,
  activateUsersBatch,
  checkSingleUserCart,
  classifyCartStatus
};
