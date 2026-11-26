function overrideNavigator(ua) {
  var isIOS = /iPhone|iPad/.test(ua);
  var defineGetter = function (prop, val) {
    try {
      Object.defineProperty(navigator, prop, {
        get: function () {
          return val;
        },
        configurable: true
      });
    } catch (e) {}
  };

  defineGetter('userAgent', ua);
  defineGetter('appVersion', ua.replace('Mozilla/', ''));
  defineGetter('platform', isIOS ? (/(iPad)/.test(ua) ? 'iPad' : 'iPhone') : 'Linux armv8l');
  defineGetter('maxTouchPoints', 5);
  defineGetter('vendor', isIOS ? 'Apple Computer, Inc.' : 'Google Inc.');
}

function extractCsrfData() {
  var csrfFromCookie = '';
  var match = document.cookie.match(/csrftoken=([^;]+)/);
  if (match) csrfFromCookie = match[1];

  var metaEl = document.querySelector('meta[name="csrf-token"]');
  var csrfFromMeta = metaEl ? metaEl.getAttribute('content') : '';

  var inputEl = document.querySelector('input[name="csrfmiddlewaretoken"]');
  var csrfFromInput = inputEl ? inputEl.value : '';

  var csrfFromWindow = window.csrftoken || window.csrf_token || '';

  return {
    documentCookie: document.cookie,
    csrfFromCookie: csrfFromCookie,
    csrfFromMeta: csrfFromMeta,
    csrfFromInput: csrfFromInput,
    csrfFromWindow: csrfFromWindow
  };
}

async function fetchWithCreds(url) {
  try {
    var response = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });
    return {
      status: response.status,
      documentCookieAfterAPI: document.cookie
    };
  } catch (err) {
    return {
      error: err.message,
      documentCookieAfterAPI: document.cookie
    };
  }
}
