const http = require('http');
const os = require('os');
const express = require('express');
const axios = require('axios');
const adbService = require('./adb.service');

const LOCAL_PHONE_URL = 'http://127.0.0.1:8080';
const busyPhoneUrls = new Set();
const waitQueue = [];
const boundServers = new Map();

function getLocalPhoneUrl() {
  return adbService.getNextLocalSignUrl() || LOCAL_PHONE_URL;
}

let rrCursor = 0;

function pickIdlePhoneUrl() {
  const urls = adbService.getActiveLocalSignUrls();
  if (urls.length === 0) return null;
  for (let i = 0; i < urls.length; i++) {
    const idx = (rrCursor + i) % urls.length;
    const u = urls[idx];
    if (!busyPhoneUrls.has(u)) {
      rrCursor = (idx + 1) % urls.length;
      return u;
    }
  }
  return null;
}

function drainWaitQueue() {
  while (waitQueue.length > 0) {
    const idleUrl = pickIdlePhoneUrl();
    if (!idleUrl) break;
    const nextRun = waitQueue.shift();
    nextRun(idleUrl);
  }
}

function enqueuePhoneTask(taskFn) {
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

    const idleUrl = pickIdlePhoneUrl();
    if (idleUrl) {
      runWithUrl(idleUrl);
    } else {
      waitQueue.push(runWithUrl);
    }
  });
}

function normalizeCookie(cookieStr = '') {
  const prof = adbService.getDefaultProfile();
  if (!cookieStr || typeof cookieStr !== 'string') return '';
  if (/shopee_app_version=\d+/.test(cookieStr)) {
    return cookieStr.replace(/shopee_app_version=\d+/g, `shopee_app_version=${prof.appVersion}`);
  }
  return cookieStr;
}

function normalizePayloadData(rawData) {
  const prof = adbService.getDefaultProfile();
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

function buildPrecheckPayload(cookieStr = '') {
  const prof = adbService.getDefaultProfile();
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
    await adbService.ensurePhoneSignReady(targetLocalUrl);
    return await requestFn(preferredUrl || getLocalPhoneUrl());
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
    const cookie = normalizeCookie(body.cookie || '');
    const proxy = body.proxy || '';
    const userId = (cookie.match(/SPC_U=(\d+)/) || [])[1] || '';
    const normalized = normalizePayloadData(body.data || {});
    let dataObj = normalized.obj;
    let dataStr = normalized.str;

    const result = await enqueuePhoneTask(async (assignedBaseUrl) => {
      const refreshSessionAndPrecheck = async () => {
        await adbService.restartShopeeAppForSign(assignedBaseUrl, null, userId);
        if (dataObj && cookie) {
          try {
            const preUrl = buildPrecheckUrlFromCreateUrl(targetUrl);
            const prePayload = JSON.stringify(buildPrecheckPayload(cookie));
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
            if (preRes.data?.http_status === 418) {
              await new Promise(r => setTimeout(r, 400));
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
            if (extraCtx) {
              dataObj.extra_context = extraCtx;
              dataStr = JSON.stringify(dataObj);
            }
          } catch (_) {}
        }
        return null;
      };

      const hasRealExtra = dataObj?.extra_context && dataObj.extra_context !== 'PENDING_GATEWAY_PRECHECK';
      const needFreshPrecheck = !hasRealExtra || !adbService.isSessionFreshForUser(userId, 8000);
      if (needFreshPrecheck && cookie) {
        const early = await refreshSessionAndPrecheck();
        if (early && early.earlyReturn) {
          adbService.markSessionUsed(userId, false);
          return early.earlyReturn;
        }
      }

      adbService.markSessionUsed(userId, false);
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
          postRes.data.data?.code === 98001004) &&
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

      return postRes.data;
    });

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

function createGatewayRouter() {
  const router = express.Router();
  router.get('/debug_info', handleDebugInfo);
  router.post('/debug_info', handleDebugInfo);
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
