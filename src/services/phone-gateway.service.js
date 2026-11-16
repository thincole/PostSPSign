const http = require('http');
const os = require('os');
const express = require('express');
const axios = require('axios');
const adbService = require('./adb.service');
const vodTokenService = require('./vod-token.service');

const LOCAL_PHONE_URL = 'http://127.0.0.1:8080';
const busyPhoneUrls = new Set();
const waitQueue = [];
const boundServers = new Map();
const stickyUserGroupMap = new Map();
const statsByPort = new Map();
let crossGroupViolations = 0;

function recordPortStat(assignedUrl, type, userId = '', ok = true) {
  if (!assignedUrl) return;
  const serial = adbService.getSerialForUrl(assignedUrl) || 'unknown';
  const group = adbService.getDeviceGroupForUrl(assignedUrl);
  const prof = adbService.getProfileForUrl(assignedUrl);
  const existingGroup = userId ? stickyUserGroupMap.get(userId) : null;
  if (userId && existingGroup && existingGroup !== group) {
    crossGroupViolations++;
  }
  const entry = statsByPort.get(assignedUrl) || {
    url: assignedUrl,
    serial,
    group,
    model: prof?.deviceModel || '',
    sdkInt: prof?.sdkInt || '',
    prechecks: 0,
    createposts: 0,
    successPosts: 0,
    uniqueUsers: new Set(),
    lastUserId: '',
    lastAt: null
  };
  entry.serial = serial;
  entry.group = group;
  entry.model = prof?.deviceModel || entry.model;
  entry.sdkInt = prof?.sdkInt || entry.sdkInt;
  if (type === 'precheck') entry.prechecks++;
  if (type === 'createpost') {
    entry.createposts++;
    if (ok) entry.successPosts++;
  }
  if (userId) {
    entry.uniqueUsers.add(userId);
    entry.lastUserId = userId;
  }
  entry.lastAt = new Date().toISOString();
  statsByPort.set(assignedUrl, entry);
}

function getLocalPhoneUrl() {
  return adbService.getNextLocalSignUrl() || LOCAL_PHONE_URL;
}

let rrCursor = 0;

function hashUserId(userId = '') {
  const s = String(userId || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getCandidateUrlsForUser(userId = null) {
  const urls = adbService.getActiveLocalSignUrls();
  if (urls.length === 0) return [];
  if (!userId) return urls;

  const existingGroup = stickyUserGroupMap.get(userId);
  if (existingGroup) {
    const matched = urls.filter(u => adbService.getDeviceGroupForUrl(u) === existingGroup);
    if (matched.length > 0) {
      return matched;
    }
  }

  // Lần đầu tiên tài khoản (userId) xuất hiện:
  // Chia cố định theo hash(userId) trên danh sách máy đang active để đảm bảo:
  // 1) Tỷ lệ tải chuẩn theo số máy (3 TIGER = 60%, 1 SM-G990E = 20%, 1 SM-G981N = 20%)
  // 2) Kể cả khi khởi động lại server, cùng 1 userId vẫn rơi đúng vào nhóm dòng máy cũ
  const chosenUrl = urls[hashUserId(userId) % urls.length];

  const assignedGroup = adbService.getDeviceGroupForUrl(chosenUrl);
  stickyUserGroupMap.set(userId, assignedGroup);
  const groupUrls = urls.filter(u => adbService.getDeviceGroupForUrl(u) === assignedGroup);
  return groupUrls.length > 0 ? groupUrls : [chosenUrl];
}

function pickIdlePhoneUrlForUser(userId = null) {
  const candidates = getCandidateUrlsForUser(userId);
  if (candidates.length === 0) return null;
  for (let i = 0; i < candidates.length; i++) {
    const idx = (rrCursor + i) % candidates.length;
    const u = candidates[idx];
    if (!busyPhoneUrls.has(u)) {
      rrCursor = (rrCursor + 1) % 1000000;
      return u;
    }
  }
  return null;
}

function drainWaitQueue() {
  for (let i = 0; i < waitQueue.length; i++) {
    const item = waitQueue[i];
    const idleUrl = pickIdlePhoneUrlForUser(item.userId);
    if (idleUrl) {
      waitQueue.splice(i, 1);
      i--;
      item.runWithUrl(idleUrl);
    }
  }
}

function enqueuePhoneTask(taskFn, userId = null) {
  return new Promise((resolve, reject) => {
    const runWithUrl = async (assignedUrl) => {
      busyPhoneUrls.add(assignedUrl);
      try {
        const result = await taskFn(assignedUrl);
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        busyPhoneUrls.delete(assignedUrl);
        drainWaitQueue();
      }
    };

    const idleUrl = pickIdlePhoneUrlForUser(userId);
    if (idleUrl) {
      runWithUrl(idleUrl);
    } else {
      waitQueue.push({ userId, runWithUrl });
    }
  });
}

function normalizeCookie(cookieStr = '', assignedUrl = null) {
  const prof = adbService.getProfileForUrl(assignedUrl);
  if (!cookieStr || typeof cookieStr !== 'string') return '';
  if (/shopee_app_version=\d+/.test(cookieStr)) {
    return cookieStr.replace(/shopee_app_version=\d+/g, `shopee_app_version=${prof.appVersion}`);
  }
  return cookieStr;
}

function normalizePayloadData(rawData, assignedUrl = null) {
  const prof = adbService.getProfileForUrl(assignedUrl);
  let obj = rawData;
  if (typeof rawData === 'string') {
    try {
      obj = JSON.parse(rawData);
    } catch (_) {
      return { str: rawData, obj: null };
    }
  }
  if (obj && typeof obj === 'object') {
    obj.app_info = {
      system_os: 'Android',
      system_version: prof.sdkInt,
      app_version: prof.appVersion,
      device_model: prof.deviceModelInfo
    };
    return { str: JSON.stringify(obj), obj };
  }
  return { str: typeof rawData === 'string' ? rawData : JSON.stringify(rawData || {}), obj: null };
}

function buildPrecheckUrlFromCreateUrl(createUrl = '') {
  if (!createUrl) return 'https://sv.shopee.vn/api/v2/biz/post/precheck';
  try {
    const u = new URL(createUrl);
    return `${u.origin}/api/v2/biz/post/precheck`;
  } catch (_) {
    return createUrl.replace(/\/create(_v2)?.*$/, '/precheck');
  }
}

function buildPrecheckPayload(cookieStr = '', assignedUrl = null) {
  const prof = adbService.getProfileForUrl(assignedUrl);
  const userId = (cookieStr.match(/SPC_U=(\d+)/) || [])[1] || '0';
  return {
    content: {
      from_source: `creator_id=${userId}&pre_source=shopee_video&scene_code=my_profile_create_button`,
      caption: '',
      video: {
        url: '',
        video_id: '',
        cover: '',
        width: 300,
        height: 168,
        size: 9,
        duration: 3065,
        watermark_cover_url: '',
        skip_cover_check: true,
        is_ugc_cover: false
      },
      music: {
        music_id: '',
        type: 3,
        title: '',
        url: '',
        original: true,
        start: 0,
        cover: 'sg-11110159-6v999-mgh93dd2k0gf23',
        duration: 3000,
        author_name: 'vpudsawjy8',
        soundtracks: []
      },
      mentions: [],
      hashtags: [],
      post_attr: { share_to_friends: false },
      content_source: 0,
      images: [],
      content_type: 0
    },
    app_info: {
      system_os: 'Android',
      system_version: prof.sdkInt,
      app_version: prof.appVersion,
      device_model: prof.deviceModelInfo
    }
  };
}

async function callLocalPhoneWithRetry(requestFn, preferredUrl = null) {
  const targetLocalUrl = preferredUrl || getLocalPhoneUrl();
  try {
    return await requestFn(targetLocalUrl);
  } catch (err) {
    if (preferredUrl) {
      await adbService.restartShopeeAppForSign(targetLocalUrl);
      return await requestFn(targetLocalUrl);
    }
    await adbService.ensurePhoneSignReady(targetLocalUrl);
    try {
      return await requestFn(targetLocalUrl);
    } catch (err2) {
      const altUrls = adbService.getActiveLocalSignUrls().filter(u => u !== targetLocalUrl);
      if (altUrls.length > 0) {
        return await requestFn(altUrls[0]);
      }
      throw err2;
    }
  }
}

async function handleDebugInfo(req, res) {
  try {
    const r = await callLocalPhoneWithRetry((baseUrl) =>
      axios.get(`${baseUrl}/api/debug_info`, {
        timeout: 3000,
        httpAgent: adbService.getNoKeepAliveAgent()
      })
    );
    return res.json(r.data);
  } catch (err) {
    if (adbService._inFreshSession) {
      const prof = adbService.getDefaultProfile();
      return res.json({
        code: 0,
        package: prof.packageName || 'com.shopee.vn',
        model: prof.model || 'TIGER 10',
        brand: prof.brand || 'OSCAL',
        sdk_int: parseInt(prof.sdkInt || '33', 10),
        android_id: prof.androidId || 'c7498c7b5b527e19',
        sdk_loaded: true,
        risk_token_len: prof.riskTokenLen || 155
      });
    }
    return res.status(502).json({ code: 1, error: err.message });
  }
}

let lastHealthSignData = null;

async function handleSign(req, res) {
  try {
    const body = req.body || {};
    const targetUrl = body.url || 'https://sv.shopee.vn/api/v2/biz/post/create_v2';
    const rawBody = typeof body.body === 'string' ? body.body : JSON.stringify(body.body || body.data || {});
    const isHealthCheck = rawBody === '{}' || rawBody === '';

    if (isHealthCheck && adbService._inFreshSession && lastHealthSignData) {
      return res.json(lastHealthSignData);
    }

    const signRes = await callLocalPhoneWithRetry((baseUrl) =>
      axios.post(
        `${baseUrl}/api/sign`,
        { url: targetUrl, body: rawBody },
        {
          timeout: 8000,
          httpAgent: adbService.getNoKeepAliveAgent()
        }
      )
    );

    const data = signRes.data || {};
    if (data.code === 0 && data.data && typeof data.data === 'object') {
      if (data.data['x-sap-ri'] && !data.data['X-Sap-Access-S']) {
        data.data['X-Sap-Access-S'] = data.data['x-sap-ri'];
      }
      if (isHealthCheck) {
        lastHealthSignData = data;
      }
    }
    return res.json(data);
  } catch (err) {
    if (lastHealthSignData && (req.body?.body === '{}' || !req.body?.body)) {
      return res.json(lastHealthSignData);
    }
    return res.status(502).json({ code: 1, msg: err.message, error: err.message });
  }
}

async function handlePrecheck(req, res) {
  return res.status(200).json({
    code: 0,
    http_status: 200,
    data: {
      code: 0,
      msg: 'Success',
      data: {
        extra_context: 'PENDING_GATEWAY_PRECHECK'
      }
    }
  });
}

async function handleCreatePost(req, res) {
  try {
    const body = req.body || {};
    const targetUrl = body.url || 'https://sv.shopee.vn/api/v2/biz/post/create_v2';
    const rawCookie = body.cookie || '';
    const proxy = body.proxy || '';
    const userId = (rawCookie.match(/SPC_U=(\d+)/) || [])[1] || '';
    const normalized = normalizePayloadData(body.data || {});
    let dataObj = normalized.obj;
    let dataStr = normalized.str;

    const result = await enqueuePhoneTask(async (assignedBaseUrl) => {
      const cookie = normalizeCookie(rawCookie, assignedBaseUrl);
      const syncAppInfoWithAssignedPhone = () => {
        if (dataObj && typeof dataObj === 'object') {
          const prof = adbService.getProfileForUrl(assignedBaseUrl);
          dataObj.app_info = {
            system_os: 'Android',
            system_version: prof.sdkInt,
            app_version: prof.appVersion,
            device_model: prof.deviceModelInfo
          };
          dataStr = JSON.stringify(dataObj);
        }
      };

      const refreshSessionAndPrecheck = async () => {
        await adbService.restartShopeeAppForSign(assignedBaseUrl, null, userId);
        syncAppInfoWithAssignedPhone();
        if (dataObj && cookie) {
          try {
            const preUrl = buildPrecheckUrlFromCreateUrl(targetUrl);
            const prePayload = JSON.stringify(buildPrecheckPayload(cookie, assignedBaseUrl));
            let preRes = await callLocalPhoneWithRetry(() =>
              axios.post(
                `${assignedBaseUrl}/api/precheck`,
                { url: preUrl, data: prePayload, cookie, proxy },
                {
                  timeout: 25000,
                  httpAgent: adbService.getNoKeepAliveAgent(),
                  validateStatus: () => true
                }
              ),
              assignedBaseUrl
            );
            if (
              preRes.data?.http_status === 418 ||
              (!preRes.data?.data?.data?.extra_context && !preRes.data?.data?.extra_context && !preRes.data?.data?.code)
            ) {
              await new Promise(r => setTimeout(r, 500));
              preRes = await callLocalPhoneWithRetry(() =>
                axios.post(
                  `${assignedBaseUrl}/api/precheck`,
                  { url: preUrl, data: prePayload, cookie, proxy },
                  {
                    timeout: 25000,
                    httpAgent: adbService.getNoKeepAliveAgent(),
                    validateStatus: () => true
                  }
                ),
                assignedBaseUrl
              );
            }
            const preShopee = preRes.data?.data || {};
            if (preShopee?.code && preShopee.code !== 0) {
              return { earlyReturn: preRes.data };
            }
            const extraCtx = preShopee?.data?.extra_context || preShopee?.extra_context || '';
            recordPortStat(assignedBaseUrl, 'precheck', userId, !!extraCtx);
            if (extraCtx) {
              dataObj.extra_context = extraCtx;
              dataStr = JSON.stringify(dataObj);
            }
          } catch (_) {}
        }
        return null;
      };

      if (dataObj && dataObj.extra_context === 'PENDING_GATEWAY_PRECHECK') {
        dataObj.extra_context = '';
        dataStr = JSON.stringify(dataObj);
      }
      syncAppInfoWithAssignedPhone();
      const hasRealExtra = dataObj?.extra_context && dataObj.extra_context !== 'PENDING_GATEWAY_PRECHECK';
      const needFreshPrecheck = !hasRealExtra || !adbService.isSessionFreshForUser(userId, 8000, assignedBaseUrl);
      if (needFreshPrecheck && cookie) {
        const early = await refreshSessionAndPrecheck();
        if (early && early.earlyReturn) {
          adbService.markSessionUsed(userId, false, assignedBaseUrl);
          return early.earlyReturn;
        }
      }

      adbService.markSessionUsed(userId, false, assignedBaseUrl);
      let postRes = await callLocalPhoneWithRetry(() =>
        axios.post(
          `${assignedBaseUrl}/api/createpost`,
          { url: targetUrl, data: dataStr, cookie, proxy },
          {
            timeout: 40000,
            httpAgent: adbService.getNoKeepAliveAgent(),
            validateStatus: () => true
          }
        ),
        assignedBaseUrl
      );

      if (
        postRes.data &&
        (postRes.data.http_status === 418 ||
          postRes.data.data?.error === 90309999 ||
          postRes.data.data?.code === 98001004 ||
          postRes.data.data?.code === 300014) &&
        cookie
      ) {
        if (postRes.data.data?.code === 98001004) {
          await new Promise(r => setTimeout(r, 1500));
        }
        const earlyRetry = await refreshSessionAndPrecheck();
        if (earlyRetry && earlyRetry.earlyReturn) {
          return earlyRetry.earlyReturn;
        }
        postRes = await callLocalPhoneWithRetry(() =>
          axios.post(
            `${assignedBaseUrl}/api/createpost`,
            { url: targetUrl, data: dataStr, cookie, proxy },
            {
              timeout: 40000,
              httpAgent: adbService.getNoKeepAliveAgent(),
              validateStatus: () => true
            }
          ),
          assignedBaseUrl
        );
      }

      const postId = postRes.data?.data?.data?.post_id || postRes.data?.data?.post_id;
      recordPortStat(assignedBaseUrl, 'createpost', userId, !!(postRes.data?.code === 0 && postId));
      return postRes.data;
    }, userId);

    // Chuẩn hóa output tương thích đồng thời cả chế độ Phone Sign (createPost)
    // lẫn chế độ Server Credit (createPostViaCredit) mà không tính credit
    if (result && typeof result === 'object') {
      const shopeeData = result.data;
      const postId = shopeeData?.data?.post_id || shopeeData?.post_id;
      if (result.code === 0 && postId) {
        return res.status(200).json({
          code: 0,
          http_status: result.http_status || 200,
          data: {
            ...shopeeData,
            post_id: postId,
            data: {
              ...(shopeeData.data || {}),
              post_id: postId
            }
          }
        });
      }
      if (shopeeData && typeof shopeeData === 'object') {
        const errMsg = shopeeData.msg || shopeeData.error_msg || shopeeData.message || JSON.stringify(shopeeData);
        return res.status(200).json({
          ...result,
          msg: errMsg,
          error: errMsg
        });
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(502).json({ code: 1, error: err.message, msg: err.message });
  }
}

function handleRoutingStats(req, res) {
  const ports = [];
  for (const [url, entry] of statsByPort.entries()) {
    ports.push({
      url: entry.url,
      serial: entry.serial,
      group: entry.group,
      model: entry.model,
      sdkInt: entry.sdkInt,
      prechecks: entry.prechecks,
      createposts: entry.createposts,
      successPosts: entry.successPosts,
      uniqueUsersCount: entry.uniqueUsers.size,
      lastUserId: entry.lastUserId,
      lastAt: entry.lastAt
    });
  }
  const groupSummary = {};
  for (const [, grp] of stickyUserGroupMap.entries()) {
    groupSummary[grp] = (groupSummary[grp] || 0) + 1;
  }
  return res.json({
    code: 0,
    activeUrls: adbService.getActiveLocalSignUrls(),
    busyUrls: Array.from(busyPhoneUrls),
    waitQueueLength: waitQueue.length,
    stickyUsersTotal: stickyUserGroupMap.size,
    stickyUsersByGroup: groupSummary,
    crossGroupViolations,
    ports
  });
}

async function handleGenerateToken(req, res) {
  try {
    const forceRefresh = req.body?.refresh === true || req.query?.refresh === '1';
    const country = req.body?.country || req.query?.country || '';
    const result = await vodTokenService.generateSelfToken({ forceRefresh, country });
    return res.json(result.token);
  } catch (err) {
    return res.status(503).json({
      detail: err?.message || 'Failed to generate self VOD token'
    });
  }
}

function handleGenerateTokenStatus(_req, res) {
  return res.json({
    code: 0,
    ...vodTokenService.getTokenStatus()
  });
}

function handleGatewayHealth(_req, res) {
  return res.json({
    status: 'ok',
    selfToken: vodTokenService.getTokenStatus()
  });
}

function createGatewayRouter() {
  const router = express.Router();
  router.get('/debug_info', handleDebugInfo);
  router.post('/debug_info', handleDebugInfo);
  router.get('/routing_stats', handleRoutingStats);
  router.get('/health', handleGatewayHealth);
  router.post('/generate_token', handleGenerateToken);
  router.get('/generate_token', handleGenerateToken);
  router.get('/generate_token/status', handleGenerateTokenStatus);
  router.post('/sign', handleSign);
  router.post('/precheck', handlePrecheck);
  router.post('/createpost', handleCreatePost);
  return router;
}

function getExternalIPv4Addresses() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && net.address && net.address !== '127.0.0.1') {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

function startGatewayListeners(port = 8080) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const gwRouter = createGatewayRouter();
  app.use('/api', gwRouter);
  app.use('/', gwRouter);

  const syncListeners = () => {
    const externalIps = getExternalIPv4Addresses();
    for (const { name, address } of externalIps) {
      if (boundServers.has(address)) continue;
      try {
        const srv = http.createServer(app);
        srv.timeout = 600000;
        srv.keepAliveTimeout = 65000;
        srv.requestTimeout = 600000;
        srv.headersTimeout = 605000;
        srv.on('error', () => {
          boundServers.delete(address);
        });
        srv.listen(port, address, () => {
          console.log(`🌐 [PhoneSign Gateway] Đã mở cổng nội bộ/Tailscale: http://${address}:${port} (${name})`);
        });
        boundServers.set(address, srv);
      } catch (_) {}
    }
  };

  syncListeners();
  setInterval(syncListeners, 30000);
}

module.exports = {
  createGatewayRouter,
  startGatewayListeners,
  enqueuePhoneTask
};
