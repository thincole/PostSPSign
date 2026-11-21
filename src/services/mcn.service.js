const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const User = require('../models/user.model');

const COUNTRY_MCN_MAP = {
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

const MOBILE_WEBVIEW_UA =
  'Mozilla/5.0 (Linux; Android 13; TIGER 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 Shopee';

const MCN_GQL_QUERY = `query mcnOngoingPartnershipDetailAndPendingRequest {
  mcnOngoingPartnershipDetailAndPendingRequest {
    partnershipDetail {
      mcnId
      affiliateId
      partnershipId
      mcnFeeRatePercent
      startDateTimestamp
      endDateTimestamp
      isExpiredSoon
      cancellationStatus
      displayPartnershipLeftExpiredDays
    }
    mcnBasicInfo {
      mcnId
      mcnName
    }
  }
}`;

const CONCURRENCY = Math.max(1, parseInt(process.env.MCN_CHECK_CONCURRENCY || '10', 10) || 10);
const REQUEST_TIMEOUT_MS = 12000;

let batchJob = {
  jobId: 0,
  running: false,
  total: 0,
  done: 0,
  active: 0,
  expiringSoon: 0,
  none: 0,
  errors: 0,
  startedAt: null,
  finishedAt: null,
  results: []
};

function getCountryMeta(countryCode) {
  const key = String(countryCode || 'vn').trim().toLowerCase();
  return COUNTRY_MCN_MAP[key] || COUNTRY_MCN_MAP.vn;
}

function parseRawProxyToAgent(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  let scheme = 'http';
  let body = s;
  const schemeMatch = s.match(/^([a-z0-9]+):\/\/(.*)$/i);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase();
    body = schemeMatch[2];
  }

  let proxyUrl = '';
  if (body.includes('@')) {
    proxyUrl = `${scheme}://${body}`;
  } else {
    const parts = body.split(':');
    if (parts.length >= 4) {
      const host = parts[0];
      const port = parts[1];
      const user = parts[2];
      const pass = parts.slice(3).join(':');
      proxyUrl = `${scheme}://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
    } else if (parts.length >= 2) {
      proxyUrl = `${scheme}://${parts[0]}:${parts[1]}`;
    } else {
      return null;
    }
  }

  if (scheme.startsWith('socks')) {
    return new SocksProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
}

function getProxyCandidates(userRow) {
  const rawList = [];
  if (userRow.thread_proxy_host && userRow.thread_proxy_port) {
    const tRaw = userRow.thread_proxy_username
      ? `${userRow.thread_proxy_host}:${userRow.thread_proxy_port}:${userRow.thread_proxy_username}:${userRow.thread_proxy_password || ''}`
      : `${userRow.thread_proxy_host}:${userRow.thread_proxy_port}`;
    rawList.push(tRaw);
  }
  const uRaw = String(userRow.proxy || '').trim();
  if (uRaw && !rawList.includes(uRaw)) {
    rawList.push(uRaw);
  }
  const agents = rawList.map((raw) => ({ raw, agent: parseRawProxyToAgent(raw) })).filter((x) => x.agent);
  return agents.length > 0 ? agents : [{ raw: 'direct', agent: null }];
}

function computeDaysLeft(endTsSec) {
  if (!endTsSec || Number(endTsSec) <= 0) return null;
  return Math.floor((Number(endTsSec) * 1000 - Date.now()) / 86400000);
}

function isProxyTransportError(err, httpStatus) {
  if (httpStatus === 407 || httpStatus === 502 || httpStatus === 503) return true;
  if (!err) return false;
  const code = String(err?.code || err?.message || '').toUpperCase();
  return (
    code.includes('ETIMEDOUT') ||
    code.includes('ECONNRESET') ||
    code.includes('ECONNREFUSED') ||
    code.includes('EAI_AGAIN') ||
    code.includes('ENOTFOUND') ||
    code.includes('407') ||
    code.includes('PROXY') ||
    code.includes('TIMEOUT') ||
    code.includes('SOCKET HANG UP')
  );
}

async function fetchUserMcnInfo(userRow) {
  const checkedAt = Math.floor(Date.now() / 1000);
  const cookie = String(userRow.cookie || '').trim();
  if (!cookie) {
    return {
      id: userRow.id,
      username: userRow.username,
      mcn_end_at: userRow.mcn_end_at || null,
      mcn_days_left: userRow.mcn_end_at ? computeDaysLeft(userRow.mcn_end_at) : null,
      mcn_name: userRow.mcn_name || '',
      mcn_status: 'error',
      mcn_checked_at: checkedAt,
      error: 'Thiếu cookie'
    };
  }

  const { tld, appId } = getCountryMeta(userRow.country);
  const baseOrigin = `https://affiliate.shopee.${tld}`;
  const csrfCookie = (cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
  const candidates = getProxyCandidates(userRow);

  let lastErrMsg = 'Lỗi kết nối';

  for (let idx = 0; idx < candidates.length; idx++) {
    const { agent } = candidates[idx];
    const netCfg = {
      timeout: REQUEST_TIMEOUT_MS,
      proxy: false,
      validateStatus: () => true,
      ...(agent ? { httpAgent: agent, httpsAgent: agent } : {})
    };

    try {
      // Bước 1: lấy CSRF-token mới từ /api/v3/user/profile
      const profRes = await axios.get(`${baseOrigin}/api/v3/user/profile`, {
        ...netCfg,
        headers: {
          Cookie: cookie,
          'Affiliate-Program-Type': '1',
          'User-Agent': MOBILE_WEBVIEW_UA,
          'x-api-source': 'rn',
          'x-requested-with': appId
        }
      });

      if (isProxyTransportError(null, profRes.status) && idx < candidates.length - 1) {
        lastErrMsg = `HTTP ${profRes.status}`;
        continue;
      }

      const csrfToken = profRes.headers?.['csrf-token'] || csrfCookie;

      // Bước 2: gọi GraphQL mobile RN lấy chi tiết hợp đồng MCN đang chạy
      const gqlRes = await axios.post(
        `${baseOrigin}/api/v3/gql?q=mcnOngoingPartnershipDetailAndPendingRequest`,
        JSON.stringify({
          operationName: 'mcnOngoingPartnershipDetailAndPendingRequest',
          query: MCN_GQL_QUERY
        }),
        {
          ...netCfg,
          headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            Cookie: cookie,
            'User-Agent': MOBILE_WEBVIEW_UA,
            'X-CSRFToken': csrfCookie,
            'CSRF-token': csrfToken,
            'Affiliate-Program-Type': '1',
            'x-api-source': 'rn',
            'x-requested-with': appId
          }
        }
      );

      if (isProxyTransportError(null, gqlRes.status) && idx < candidates.length - 1) {
        lastErrMsg = `HTTP ${gqlRes.status}`;
        continue;
      }

      const payload = gqlRes.data;
      const ongoing = payload?.data?.mcnOngoingPartnershipDetailAndPendingRequest;

      if (gqlRes.status === 200 && ongoing && ongoing.partnershipDetail && Number(ongoing.partnershipDetail.endDateTimestamp) > 0) {
        const pd = ongoing.partnershipDetail;
        const endAt = Number(pd.endDateTimestamp);
        const daysLeft =
          pd.displayPartnershipLeftExpiredDays !== undefined && pd.displayPartnershipLeftExpiredDays !== null
            ? Number(pd.displayPartnershipLeftExpiredDays)
            : computeDaysLeft(endAt);
        const mcnName = ongoing.mcnBasicInfo?.mcnName || '';

        const info = {
          mcn_end_at: endAt,
          mcn_days_left: daysLeft,
          mcn_name: mcnName,
          mcn_status: 'active',
          mcn_checked_at: checkedAt
        };
        await User.updateMcnInfo(userRow.id, info);
        return { id: userRow.id, username: userRow.username, ...info };
      }

      if (gqlRes.status === 200 && payload?.data && !payload?.errors) {
        const info = {
          mcn_end_at: null,
          mcn_days_left: null,
          mcn_name: '',
          mcn_status: 'none',
          mcn_checked_at: checkedAt
        };
        await User.updateMcnInfo(userRow.id, info);
        return { id: userRow.id, username: userRow.username, ...info };
      }

      lastErrMsg =
        payload?.errors?.[0]?.message ||
        payload?.msg ||
        (payload?.error ? `Shopee ${payload.error}` : `HTTP ${gqlRes.status}`);
      break;
    } catch (err) {
      lastErrMsg = err.code || err.message || 'Lỗi kết nối';
      if (isProxyTransportError(err, null) && idx < candidates.length - 1) {
        continue;
      }
      break;
    }
  }

  // Giữ nguyên mcn_end_at cũ nếu trước đó đã từng kiểm tra hợp lệ
  const preserveEndAt = userRow.mcn_end_at && Number(userRow.mcn_end_at) > 0 ? Number(userRow.mcn_end_at) : null;
  const info = {
    mcn_end_at: preserveEndAt,
    mcn_days_left: preserveEndAt ? computeDaysLeft(preserveEndAt) : null,
    mcn_name: preserveEndAt ? (userRow.mcn_name || '') : '',
    mcn_status: preserveEndAt ? 'active' : 'error',
    mcn_checked_at: checkedAt
  };
  await User.updateMcnInfo(userRow.id, info).catch(() => {});
  return {
    id: userRow.id,
    username: userRow.username,
    ...info,
    error: lastErrMsg
  };
}

async function checkUserMcnById(userId) {
  await User.ensureMcnColumns();
  const rows = await User.getForMcnCheck([Number(userId)]);
  if (!rows || rows.length === 0) {
    throw new Error('Không tìm thấy tài khoản');
  }
  return await fetchUserMcnInfo(rows[0]);
}

function getBatchStatus(sinceIndex = 0) {
  const idx = Math.max(0, parseInt(sinceIndex, 10) || 0);
  return {
    jobId: batchJob.jobId,
    running: batchJob.running,
    total: batchJob.total,
    done: batchJob.done,
    active: batchJob.active,
    expiringSoon: batchJob.expiringSoon,
    none: batchJob.none,
    errors: batchJob.errors,
    startedAt: batchJob.startedAt,
    finishedAt: batchJob.finishedAt,
    nextIndex: batchJob.results.length,
    updates: batchJob.results.slice(idx)
  };
}

async function startBatchMcnCheck(userIds = []) {
  await User.ensureMcnColumns();
  if (batchJob.running) {
    return { alreadyRunning: true, ...getBatchStatus(0) };
  }

  const cleanIds = Array.isArray(userIds)
    ? userIds.map((v) => parseInt(v, 10)).filter((v) => !isNaN(v) && v > 0)
    : [];
  const rows = await User.getForMcnCheck(cleanIds);

  batchJob = {
    jobId: Date.now(),
    running: true,
    total: rows.length,
    done: 0,
    active: 0,
    expiringSoon: 0,
    none: 0,
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

  // Chạy pool song song trong background để tránh timeout HTTP khi quét hàng trăm tài khoản
  (async () => {
    let cursor = 0;
    const workerCount = Math.min(CONCURRENCY, rows.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const current = cursor++;
        if (current >= rows.length) break;
        const result = await fetchUserMcnInfo(rows[current]);
        batchJob.done++;
        if (result.error) {
          batchJob.errors++;
        } else if (result.mcn_status === 'active' && result.mcn_end_at) {
          batchJob.active++;
          const dLeft = computeDaysLeft(result.mcn_end_at);
          if (dLeft !== null && dLeft < 7) {
            batchJob.expiringSoon++;
          }
        } else {
          batchJob.none++;
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

module.exports = {
  checkUserMcnById,
  startBatchMcnCheck,
  getBatchStatus,
  computeDaysLeft
};
