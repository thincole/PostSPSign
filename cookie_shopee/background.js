importScripts('inject.js');

let latestCookie = '';
const tabCookies = {};
const domainCookies = {};
const lastAutoSyncByDomain = {};

const MLS_SERVER_URL = 'http://127.0.0.1:6868';

const shopeeDomains = [
  'shopee.vn',
  'shopee.com.my',
  'shopee.ph',
  'shopee.tw',
  'shopee.co.th',
  'shopee.sg',
  'shopee.co.id'
];

// Cấu hình User-Agent chuẩn theo máy ký số OSCAL TIGER 10 (Android 13 / SDK 33 - Shopee 36448)
const UA_PRESETS = {
  android_tiger10: 'Mozilla/5.0 (Linux; Android 13; TIGER 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'
};

const DEFAULT_UA_KEY = 'android_tiger10';
const UA_RULE_ID = 1001;

async function applyUA(mode) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [UA_RULE_ID]
  });

  if (mode === 'off' || !UA_PRESETS[mode]) {
    await chrome.storage.local.set({ uaMode: 'off' });
    return { mode: 'off' };
  }

  const uaValue = UA_PRESETS[mode];

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: UA_RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            {
              header: 'user-agent',
              operation: 'set',
              value: uaValue
            }
          ]
        },
        condition: {
          requestDomains: shopeeDomains,
          resourceTypes: [
            'main_frame',
            'sub_frame',
            'xmlhttprequest',
            'script',
            'image',
            'stylesheet',
            'font',
            'media',
            'ping',
            'websocket',
            'other'
          ]
        }
      }
    ]
  });

  await chrome.storage.local.set({
    uaMode: mode,
    uaValue: uaValue
  });

  return {
    mode: mode,
    ua: uaValue
  };
}

chrome.runtime.onInstalled.addListener(() => {
  applyUA(DEFAULT_UA_KEY);
});

chrome.runtime.onStartup.addListener(async () => {
  const { uaMode } = await chrome.storage.local.get(['uaMode']);
  if (uaMode === 'off') {
    await applyUA('off');
  } else {
    await applyUA(DEFAULT_UA_KEY);
  }
});

// Đã tắt tự động đồng bộ ngầm về Tool MLS — chỉ đồng bộ khi người dùng tự ấn nút trong popup.

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || !isShopeeUrl(tab.url)) {
    return;
  }

  if (changeInfo.status === 'loading') {
    chrome.storage.local.get(['uaMode', 'uaValue'], ({ uaMode, uaValue }) => {
      if (!uaMode || uaMode === 'off' || !uaValue) return;

      chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: true },
        world: 'MAIN',
        func: overrideNavigator,
        args: [uaValue]
      }).catch(() => {});
    });
  }
});

function isShopeeUrl(url) {
  return shopeeDomains.some(domain => url.includes(domain));
}

function getDomainFromUrl(url) {
  for (const domain of shopeeDomains) {
    if (url.includes(domain)) return domain;
  }
  return null;
}

const webRequestFilter = {
  urls: [
    '*://shopee.vn/*',
    '*://*.shopee.vn/*',
    '*://shopee.com.my/*',
    '*://*.shopee.com.my/*',
    '*://shopee.ph/*',
    '*://*.shopee.ph/*',
    '*://shopee.tw/*',
    '*://*.shopee.tw/*',
    '*://shopee.co.th/*',
    '*://*.shopee.co.th/*',
    '*://shopee.sg/*',
    '*://*.shopee.sg/*',
    '*://shopee.co.id/*',
    '*://*.shopee.co.id/*'
  ]
};

// Quan trọng: Phải có 'extraHeaders' trong Manifest V3 để đọc được header Cookie (bao gồm HttpOnly & Multi-Session/Container)
chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    if (!isShopeeUrl(details.url) || !details.requestHeaders) return;

    const cookieHeader = details.requestHeaders.find(
      h => h.name && h.name.toLowerCase() === 'cookie'
    );
    if (cookieHeader && cookieHeader.value) {
      const domain = getDomainFromUrl(details.url);
      latestCookie = cookieHeader.value;
      if (details.tabId && details.tabId > 0) {
        tabCookies[details.tabId] = cookieHeader.value;
      }
      if (domain) {
        domainCookies[domain] = cookieHeader.value;
      }
      chrome.storage.local.set({
        latestCookie: latestCookie,
        lastDomain: domain,
        lastUpdated: Date.now(),
        ...(domain ? { [`rawHeaderCookie_${domain}`]: cookieHeader.value } : {}),
        ...(details.tabId > 0 ? { [`tabCookie_${details.tabId}`]: cookieHeader.value } : {})
      });
    }
  },
  webRequestFilter,
  ['requestHeaders', 'extraHeaders']
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookie') {
    const tabKey = request.tabId ? `tabCookie_${request.tabId}` : null;
    const domainKey = request.domain ? `rawHeaderCookie_${request.domain}` : null;
    const keysToGet = ['latestCookie', 'lastDomain', 'lastUpdated', 'lastMlsSync'];
    if (tabKey) keysToGet.push(tabKey);
    if (domainKey) keysToGet.push(domainKey);

    chrome.storage.local.get(keysToGet, function (res) {
      const bestCookie =
        (request.tabId && (tabCookies[request.tabId] || res[tabKey])) ||
        (request.domain && (domainCookies[request.domain] || res[domainKey])) ||
        res.latestCookie ||
        latestCookie ||
        '';
      sendResponse({
        cookie: bestCookie,
        domain: res.lastDomain,
        lastUpdated: res.lastUpdated,
        lastMlsSync: res.lastMlsSync || null
      });
    });
    return true;
  }

  if (request.action === 'setUA') {
    applyUA(request.mode || DEFAULT_UA_KEY).then(sendResponse);
    return true;
  }

  if (request.action === 'toggleUA') {
    chrome.storage.local.get(['uaMode'], ({ uaMode }) => {
      const isOff = !uaMode || uaMode === 'off';
      applyUA(isOff ? DEFAULT_UA_KEY : 'off').then(sendResponse);
    });
    return true;
  }

  if (request.action === 'getUA') {
    chrome.storage.local.get(['uaMode', 'uaValue'], function (res) {
      sendResponse({
        mode: res.uaMode || DEFAULT_UA_KEY,
        ua: res.uaValue || UA_PRESETS[DEFAULT_UA_KEY]
      });
    });
    return true;
  }
});
