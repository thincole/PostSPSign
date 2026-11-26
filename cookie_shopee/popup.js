const countryInfo = {
  'shopee.vn': { flag: '🇻🇳', name: 'Vietnam', code: 'VN', lang: 'vi' },
  'shopee.com.my': { flag: '🇲🇾', name: 'Malaysia', code: 'MY', lang: 'en' },
  'shopee.ph': { flag: '🇵🇭', name: 'Philippines', code: 'PH', lang: 'en' },
  'shopee.tw': { flag: '🇹🇼', name: 'Taiwan', code: 'TW', lang: 'zh-Hant' },
  'shopee.co.th': { flag: '🇹🇭', name: 'Thailand', code: 'TH', lang: 'th' },
  'shopee.sg': { flag: '🇸🇬', name: 'Singapore', code: 'SG', lang: 'en' },
  'shopee.co.id': { flag: '🇮🇩', name: 'Indonesia', code: 'ID', lang: 'id' }
};

const MLS_SERVER_URL = 'http://127.0.0.1:6868';

// Thông số chuẩn theo máy ký số OSCAL TIGER 10 (Android 13 / SDK 33 - Shopee App v3.64.48 / 36448)
const TIGER10_APP_VERSION = '36448';
const TIGER10_RN_BUNDLE_VERSION = '6081003';
const TIGER10_RN_VERSION = '1763129064';

function parseCookieStringToMap(cookieStr, targetMap) {
  if (!cookieStr || typeof cookieStr !== 'string') return;
  const parts = cookieStr.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    if (name && val !== undefined) {
      targetMap.set(name, val);
    }
  }
}

function buildFinalCookieString({
  apiCookiesList = [],
  headerCookieStr = '',
  docCookieBefore = '',
  docCookieAfter = '',
  csrfToken = '',
  shopeeInfo = null
}) {
  const excludedNames = new Set([
    'csrftoken',
    'shopee_app_version',
    'SPC_RNBV',
    'shopee_rn_bundle_version',
    'shopee_rn_version'
  ]);

  const cookieMap = new Map();

  // 1. Nguồn document.cookie trong trang
  parseCookieStringToMap(docCookieBefore, cookieMap);
  parseCookieStringToMap(docCookieAfter, cookieMap);

  // 2. Nguồn Header Cookie bắt trực tiếp từ webRequest
  parseCookieStringToMap(headerCookieStr, cookieMap);

  // 3. Nguồn chrome.cookies.getAll
  for (const c of apiCookiesList) {
    if (!c || !c.name) continue;
    cookieMap.set(c.name, c.value);
  }

  const finalCsrf = csrfToken || cookieMap.get('csrftoken') || '';

  for (const ex of excludedNames) {
    cookieMap.delete(ex);
  }

  const hasLanguage = cookieMap.has('language');
  const filteredPairs = [];
  for (const [name, value] of cookieMap.entries()) {
    filteredPairs.push(`${name}=${value}`);
  }

  const prefixParts = [];
  if (finalCsrf) {
    prefixParts.push(`csrftoken=${finalCsrf}`);
  }
  if (filteredPairs.length > 0) {
    prefixParts.push(filteredPairs.join('; '));
  }

  const defaultLang = (shopeeInfo && shopeeInfo.lang) ? shopeeInfo.lang : 'vi';
  if (!hasLanguage) {
    prefixParts.push(`language=${defaultLang}`);
  }

  prefixParts.push(`SPC_RNBV=${TIGER10_RN_BUNDLE_VERSION}`);
  prefixParts.push(`shopee_app_version=${TIGER10_APP_VERSION}`);
  prefixParts.push(`shopee_rn_bundle_version=${TIGER10_RN_BUNDLE_VERSION}`);
  prefixParts.push(`shopee_rn_version=${TIGER10_RN_VERSION}`);

  return prefixParts.join('; ');
}

function getShopeeInfo(url) {
  if (!url) return null;
  for (const domain in countryInfo) {
    if (url.includes(domain)) {
      return { domain, ...countryInfo[domain] };
    }
  }
  return null;
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return diffSec + ' giây trước';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + ' phút trước';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + ' giờ trước';
  return Math.floor(diffSec / 86400) + ' ngày trước';
}

function updateCountryInfo(info) {
  const flagEl = document.getElementById('countryFlag');
  const nameEl = document.getElementById('countryName');
  if (info) {
    flagEl.textContent = info.flag;
    nameEl.textContent = `${info.name} (${info.domain})`;
  } else {
    flagEl.textContent = '🌍';
    nameEl.textContent = 'Không phải trang Shopee';
  }
}

function updateStatus(elementId, text, isSuccess = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.className = 'status ' + (isSuccess ? 'success' : 'error');
}

function getAllBrowserCookiesForTab(activeTab, domain) {
  return new Promise(resolve => {
    const merged = [];
    const storeId = activeTab.cookieStoreId;

    const queryByUrl = storeId ? { url: activeTab.url, storeId } : { url: activeTab.url };
    const queryByDomain = storeId ? { domain, storeId } : { domain };

    chrome.cookies.getAll(queryByUrl, list1 => {
      if (Array.isArray(list1)) merged.push(...list1);
      chrome.cookies.getAll(queryByDomain, list2 => {
        if (Array.isArray(list2)) merged.push(...list2);
        if (storeId) {
          chrome.cookies.getAll({ domain }, list3 => {
            if (Array.isArray(list3)) merged.push(...list3);
            resolve(merged);
          });
        } else {
          resolve(merged);
        }
      });
    });
  });
}

async function loadMlsThreadsDropdown(selectedThreadId = null, keepStatus = false) {
  const selectEl = document.getElementById('mlsThreadSelect');
  if (!selectEl) return;
  try {
    const res = await fetch(`${MLS_SERVER_URL}/api/threads/cookie-targets`);
    const data = await res.json();
    if (data && Array.isArray(data.targets)) {
      selectEl.innerHTML = '<option value="">-- Tự động khớp theo SPC_U / Tên Profile GemLogin --</option>';
      for (const t of data.targets) {
        const opt = document.createElement('option');
        opt.value = t.id;
        const flag = t.isDeadCookie ? '🔴 [LỖI COOKIE] ' : (t.status === 'inprogress' ? '🟢 ' : '⏸️ ');
        opt.textContent = `${flag}#${t.id} - ${t.username} (${(t.country || 'vn').toUpperCase()})`;
        if (selectedThreadId && Number(t.id) === Number(selectedThreadId)) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      }
      if (!keepStatus) {
        updateStatus('mlsSyncStatus', '⏸️ Thủ công — tự bấm nút để đẩy', true);
      }
    }
  } catch (_) {
    updateStatus('mlsSyncStatus', '⚠️ Tool MLS (6868) chưa bật', false);
  }
}

async function syncWithMlsBackend({ cookie, domain, country, threadId = null, autoStart = true, manual = true }) {
  try {
    const res = await fetch(`${MLS_SERVER_URL}/api/threads/cookie-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie,
        domain,
        country,
        threadId: threadId || undefined,
        autoStart,
        manual: Boolean(manual)
      })
    });
    const data = await res.json();

    // Nếu Backend lấy được bộ Cookie đầy đủ từ GemLogin CDP/SQLite (có SPC_ST, SPC_F, SPC_U), cập nhật ngay vào ô Cookie!
    if (data && data.cookie) {
      document.getElementById('cookieOutput').value = data.cookie;
      const hasSession = /SPC_ST=|SPC_EC=/.test(data.cookie);
      updateStatus(
        'cookieStatus',
        hasSession
          ? `✅ Đủ ${data.keyCount || ''} keys Cookie (TIGER 10 v36448)`
          : '⚠️ Thiếu SPC_ST (Hãy kiểm tra đăng nhập Shopee)',
        hasSession
      );
    }

    if (data && data.success && data.matchedThread) {
      updateStatus(
        'mlsSyncStatus',
        `✅ Đã nạp vào: ${data.matchedThread.username} (#${data.matchedThread.id})`,
        true
      );
      await loadMlsThreadsDropdown(data.matchedThread.id, true);
    } else {
      updateStatus(
        'mlsSyncStatus',
        data?.profileName
          ? `ℹ️ Profile ${data.profileName}: Chọn luồng bên dưới để nạp`
          : 'ℹ️ Chọn luồng bên dưới rồi bấm Đẩy vào Tool MLS',
        false
      );
      await loadMlsThreadsDropdown(null, true);
    }
    return data;
  } catch (err) {
    updateStatus('mlsSyncStatus', '⚠️ Không kết nối được 127.0.0.1:6868', false);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const powerBtn = document.getElementById('powerToggle');
  let currentShopeeInfo = null;

  function renderPowerState(mode) {
    const isOn = mode && mode !== 'off';
    powerBtn.textContent = isOn ? '🟢 ĐANG BẬT (TIGER 10 - 36448)' : '🔴 ĐANG TẮT';
  }

  chrome.runtime.sendMessage({ action: 'getUA' }, function (res) {
    renderPowerState(res && res.mode);
  });

  powerBtn.addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'toggleUA' }, function (res) {
      renderPowerState(res && res.mode);
    });
  });

  loadMlsThreadsDropdown();

  chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
    const activeTab = tabs[0];
    const shopeeInfo = getShopeeInfo(activeTab ? activeTab.url : '');
    currentShopeeInfo = shopeeInfo;
    updateCountryInfo(shopeeInfo);

    if (shopeeInfo) {
      const apiCookiesList = await getAllBrowserCookiesForTab(activeTab, shopeeInfo.domain);

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          func: extractCsrfData
        },
        function (results) {
          let csrfToken = '';
          let docCookieBefore = '';

          if (results && results[0] && results[0].result) {
            const data = results[0].result;
            docCookieBefore = data.documentCookie || '';
            csrfToken =
              data.csrfFromCookie ||
              data.csrfFromMeta ||
              data.csrfFromInput ||
              data.csrfFromWindow ||
              '';
          }

          const apiUrl = `https://${shopeeInfo.domain}/api/v4/homepage/campaign_modules`;
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              func: fetchWithCreds,
              args: [apiUrl]
            },
            function (apiResults) {
              let docCookieAfter = '';
              if (apiResults && apiResults[0] && apiResults[0].result) {
                const apiData = apiResults[0].result;
                docCookieAfter = apiData.documentCookieAfterAPI || '';
                if (!csrfToken && docCookieAfter) {
                  const match = docCookieAfter.match(/csrftoken=([^;]+)/);
                  if (match) csrfToken = match[1];
                }
              }

              chrome.runtime.sendMessage(
                { action: 'getCookie', tabId: activeTab.id, domain: shopeeInfo.domain },
                async function (bgRes) {
                  const headerCookieStr = (bgRes && bgRes.cookie) ? bgRes.cookie : '';

                  const localCookie = buildFinalCookieString({
                    apiCookiesList,
                    headerCookieStr,
                    docCookieBefore,
                    docCookieAfter,
                    csrfToken,
                    shopeeInfo
                  });

                  document.getElementById('cookieOutput').value = localCookie;
                  const hasSession = /SPC_ST=|SPC_EC=/.test(localCookie);
                  updateStatus(
                    'cookieStatus',
                    hasSession
                      ? '✅ Cookie đầy đủ đã sẵn sàng (TIGER 10 v36448)'
                      : '⚠️ Thiếu SPC_ST (Hãy kiểm tra đăng nhập Shopee)',
                    hasSession
                  );

                  // Không tự động đồng bộ với Tool MLS — chỉ đẩy khi người dùng tự ấn nút
                  chrome.storage.local.set({
                    [`cookie_${shopeeInfo.code}`]: localCookie,
                    [`lastUpdated_${shopeeInfo.code}`]: Date.now()
                  });
                  document.getElementById('cookieLastUpdated').textContent = 'Vừa cập nhật';
                }
              );
            }
          );
        }
      );
    } else {
      updateStatus('cookieStatus', 'Vui lòng mở trang Shopee', false);
    }
  });

  document.getElementById('copyCookie').addEventListener('click', function () {
    const cookieText = document.getElementById('cookieOutput').value;
    if (cookieText) {
      navigator.clipboard.writeText(cookieText).then(() => {
        const btn = document.getElementById('copyCookie');
        const oldText = btn.textContent;
        btn.textContent = '✅ Đã Copy Cookie!';
        setTimeout(() => {
          btn.textContent = oldText;
        }, 2000);
      });
    }
  });

  document.getElementById('pushToMlsBtn').addEventListener('click', async function () {
    const cookieText = document.getElementById('cookieOutput').value;
    const selectedThreadId = document.getElementById('mlsThreadSelect').value;
    const btn = document.getElementById('pushToMlsBtn');
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Đang đẩy vào Tool MLS...';

    const res = await syncWithMlsBackend({
      cookie: cookieText,
      domain: currentShopeeInfo ? currentShopeeInfo.domain : 'shopee.ph',
      country: currentShopeeInfo ? currentShopeeInfo.code.toLowerCase() : '',
      threadId: selectedThreadId || null,
      autoStart: true
    });

    btn.disabled = false;
    if (res && res.success) {
      btn.textContent = `✅ Đã nạp vào ${res.matchedThread.username} & Chạy lại!`;
    } else {
      btn.textContent = '⚠️ Hãy chọn 1 luồng trong danh sách!';
    }
    setTimeout(() => {
      btn.textContent = oldText;
    }, 2500);
  });
});
