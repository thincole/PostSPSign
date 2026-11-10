/**
 * Diagnostic Mode — safe request/response telemetry for investigating HTTP 418.
 *
 * IMPORTANT:
 * - Disabled by default.
 * - Never writes Cookie, Authorization, access tokens, signatures, request bodies,
 *   or response bodies.
 * - Only records structural metadata and hashes of selected identifiers.
 *
 * Enable with:
 *   DIAGNOSTIC_MODE=true
 *
 * Output:
 *   diagnostics/diagnostic-YYYY-MM-DD.jsonl
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.DIAGNOSTIC_MODE || ""));
const OUT_DIR = path.resolve(process.env.DIAGNOSTIC_DIR || path.join(process.cwd(), "diagnostics"));

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function nowIso() {
  return new Date().toISOString();
}

function safeCookieInfo(cookie) {
  if (typeof cookie !== "string") {
    return { type: typeof cookie, length: 0, fields: [], spc_u_present: false, csrftoken_present: false };
  }

  const fields = [];
  const values = {};
  for (const part of cookie.split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!name) continue;
    fields.push(name);
    if (name === "SPC_U") values.spc_u = sha256(value);
    if (name === "csrftoken") values.csrftoken = true;
  }

  fields.sort();
  const spcPart = cookie.split(";").map(x => x.trim()).find(x => /^SPC_U=/i.test(x));
  const spcValue = spcPart ? spcPart.slice(spcPart.indexOf("=") + 1).trim() : "";

  return {
    type: "string",
    length: cookie.length,
    fields,
    spc_u_present: Boolean(values.spc_u),
    spc_u_hash: values.spc_u || null,
    spc_u_length: spcValue.length || 0,
    spc_u_numeric: spcValue ? /^\\d+$/.test(spcValue) : false,
    csrftoken_present: Boolean(values.csrftoken),
  };
}

function safeHeaders(headers) {
  if (!headers) return { names: [], selected: {} };

  let obj = {};
  try {
    if (typeof headers.toJSON === "function") obj = headers.toJSON();
    else obj = { ...headers };
  } catch (_) {}

  const names = Object.keys(obj).map(k => k.toLowerCase()).sort();
  const selectedNames = [
    "user-agent",
    "client-info",
    "x-sap-type",
    "x-csrftoken",
    "x-shopee-client-timezone",
    "language",
    "accept",
    "content-type",
    "host",
    "referer",
    "connection",
    "cache-control",
  ];

  const selected = {};
  for (const name of selectedNames) {
    const actual = Object.keys(obj).find(k => k.toLowerCase() === name);
    if (actual) {
      const value = obj[actual];
      // Never persist token-bearing header values.
      if (["cookie", "authorization", "x-csrftoken"].includes(name)) {
        selected[name] = name === "x-csrftoken" ? "present" : "redacted";
      } else if (typeof value === "string") {
        selected[name] = value.length > 300 ? value.slice(0, 300) + "…[truncated]" : value;
      } else {
        selected[name] = String(value);
      }
    }
  }

  return { names, selected };
}

function safeUrl(rawUrl) {
  try {
    let value = String(rawUrl || "");
    // Redact Telegram bot tokens and common credential-bearing URL segments.
    value = value.replace(/(https?:\/\/api\.telegram\.org\/bot)\d{5,}:[A-Za-z0-9_-]+/gi, "$1[REDACTED]");
    value = value.replace(/(bot)\d{5,}:[A-Za-z0-9_-]+/gi, "$1[REDACTED]");

    const u = new URL(value);
    const query_keys = [...u.searchParams.keys()].sort();
    return {
      origin: u.origin,
      host: u.host,
      path: u.pathname.replace(/\/bot\d{5,}:[A-Za-z0-9_-]+/gi, "/bot[REDACTED]"),
      query_keys,
    };
  } catch (_) {
    return { raw_shape: typeof rawUrl };
  }
}

function safeBodySummary(data) {
  if (data == null) return { type: "null" };
  if (Buffer.isBuffer(data)) return { type: "buffer", bytes: data.length };
  if (typeof data === "string") return { type: "string", chars: data.length };

  if (typeof data === "object") {
    const summary = { type: "object", keys: Object.keys(data).sort() };

    // Non-secret device/app/request metadata that is useful for A/B comparison.
    const selected = [
      "device_model", "model", "system_version", "sdk_version",
      "os_type", "os_version", "client_version", "app_version",
      "rn_version", "live_device_model", "language", "timezone",
    ];
    for (const k of selected) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        const v = data[k];
        summary[k] = typeof v === "string" && v.length > 300 ? v.slice(0, 300) + "…" : v;
      }
    }

    if (data.content && typeof data.content === "object") {
      summary.content_keys = Object.keys(data.content).sort();
      if (data.content.video && typeof data.content.video === "object") {
        summary.video_keys = Object.keys(data.content.video).sort();
      }
      if (Array.isArray(data.content.item_list)) {
        summary.product_count = data.content.item_list.length;
        summary.product_ids_present = data.content.item_list.map(x =>
          x && Object.prototype.hasOwnProperty.call(x, "item_id")
        ).filter(Boolean).length;
      }
    }
    return summary;
  }

  return { type: typeof data };
}

function responseSummary(response, stage = "") {
  const data = response && response.data;
  const out = {
    status: response && response.status,
    status_text: response && response.statusText,
  };

  if (data && typeof data === "object" && !Buffer.isBuffer(data)) {
    out.body_type = "object";
    out.body_keys = Object.keys(data).sort();

    // Safe diagnostic fields only. Never persist credential-bearing fields.
    for (const k of [
      "code", "msg", "message", "error", "error_msg", "success",
      "status", "status_code", "result", "reason"
    ]) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        const v = data[k];
        if (typeof v === "string") out[k] = v.slice(0, 500);
        else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
        else out[`${k}_type`] = typeof v;
      }
    }

    // Structural information only for extra_context / data.
    if (Object.prototype.hasOwnProperty.call(data, "extra_context")) {
      out.extra_context_present = data.extra_context != null;
      out.extra_context_type = typeof data.extra_context;
      if (data.extra_context && typeof data.extra_context === "object") {
        out.extra_context_keys = Object.keys(data.extra_context).sort();
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, "data")) {
      out.data_type = data.data === null ? "null" : typeof data.data;
      if (data.data && typeof data.data === "object" && !Buffer.isBuffer(data.data)) {
        out.data_keys = Object.keys(data.data).sort();
        if (Object.prototype.hasOwnProperty.call(data.data, "extra_context")) {
          out.data_extra_context_present = data.data.extra_context != null;
          if (data.data.extra_context && typeof data.data.extra_context === "object") {
            out.data_extra_context_keys = Object.keys(data.data.extra_context).sort();
          }
        }
      }
    }

    // Correlate post IDs without exposing them.
    if (Object.prototype.hasOwnProperty.call(data, "post_id")) {
      out.post_id_hash = sha256(data.post_id);
    }

    return out;
  }

  if (typeof data === "string") {
    out.body_type = "string";
    out.body_length = data.length;

    // Do not save the response body. Only detect a few diagnostic phrases.
    const lower = data.toLowerCase();
    if (lower.includes("no extra_context")) out.detected = "no_extra_context";
    else if (lower.includes("status=418")) out.detected = "status_418_text";
    else if (lower.includes("418")) out.detected = "contains_418";
  } else {
    out.body_type = typeof data;
  }

  return out;
}

function safeProxyFromConfig(cfg) {
  const candidates = [
    cfg && cfg.proxy,
    cfg && cfg._proxyConfig,
    cfg && cfg._proxy,
    cfg && cfg.httpsAgent && cfg.httpsAgent.proxy,
    cfg && cfg.httpAgent && cfg.httpAgent.proxy,
  ].filter(Boolean);

  if (!candidates.length) {
    return { configured: false, source: null };
  }

  const p = candidates[0];
  const protocol = String(p.protocol || p.scheme || p.type || "").replace(":", "").toLowerCase() || null;
  const host = p.host || p.hostname || (p.server && String(p.server).replace(/^https?:\/\//, "").split(":")[0]) || null;
  const port = p.port || null;

  return {
    configured: true,
    source: ["proxy", "_proxyConfig", "_proxy", "httpsAgent", "httpAgent"].find((k) => cfg && cfg[k]),
    protocol,
    host_hash: host ? sha256(host) : null,
    port: port || null,
    has_auth: Boolean(p.auth || p.username || p.password),
  };
}

function classifyProxyError(response) {
  if (!response) return null;
  if (response.status === 407) return "proxy_authentication_required";
  return null;
}

function proxySummary(proxy) {
  if (!proxy || typeof proxy !== "object") return { configured: false };
  return {
    configured: true,
    host_hash: proxy.host ? sha256(proxy.host) : null,
    port: proxy.port || null,
    has_auth: Boolean(proxy.auth),
  };
}

function writeRecord(record) {
  if (!ENABLED) return;
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const d = new Date();
    const file = path.join(
      OUT_DIR,
      `diagnostic-${d.toISOString().slice(0, 10)}.jsonl`
    );
    fs.appendFileSync(file, JSON.stringify({
      ts: nowIso(),
      ...record
    }) + "\n", "utf8");
  } catch (e) {
    console.warn("[DIAGNOSTIC] cannot write record:", e.message);
  }
}

function isCreditCreatePost(url) {
  try {
    const u = new URL(String(url || ""));
    return /creditmls2026video\.toolshopee\.vn/i.test(u.host) &&
           /\/api\/createpost/i.test(u.pathname);
  } catch (_) {
    return false;
  }
}


function safeJsonHash(value) {
  try {
    return sha256(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

function safeCookieFingerprint(cookie) {
  const str = typeof cookie === "string" ? cookie : "";
  const fields = [];
  const lengths = {};
  for (const part of str.split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!name) continue;
    fields.push(name);
    lengths[name] = value.length;
  }
  fields.sort();
  const lower = str.toLowerCase();
  return {
    present: Boolean(str),
    total_length: str.length,
    field_names: fields,
    field_count: fields.length,
    value_lengths: lengths,
    cookie_hash: str ? sha256(str) : null,
    spc_u_present: /(?:^|;\s*)SPC_U=/i.test(str),
    csrftoken_present: /(?:^|;\s*)csrftoken=/i.test(str),
    ac_cert_d_present: /(?:^|;\s*)AC_CERT_D=/i.test(str),
  };
}

function safePostPayloadFingerprint(data) {
  if (!data || typeof data !== "object") {
    return { type: typeof data, hash: safeJsonHash(data) };
  }

  const out = {
    type: "object",
    top_level_keys: Object.keys(data).sort(),
    top_level_hash: safeJsonHash(data),
  };

  for (const key of ["content", "app_info", "media_sdk_info", "allow_info"]) {
    const v = data[key];
    if (!v || typeof v !== "object") continue;
    out[key] = {
      keys: Object.keys(v).sort(),
      hash: safeJsonHash(v),
    };
  }

  const content = data.content;
  if (content && typeof content === "object") {
    if (Array.isArray(content.products)) {
      out.products = {
        count: content.products.length,
        item_ids_hash: safeJsonHash(
          content.products.map(x => x && x.item_id != null ? String(x.item_id) : null)
        ),
        shop_ids_hash: safeJsonHash(
          content.products.map(x => x && x.shop_id != null ? String(x.shop_id) : null)
        ),
      };
    }
    if (content.video && typeof content.video === "object") {
      out.video = {
        keys: Object.keys(content.video).sort(),
        hash: safeJsonHash(content.video),
        video_id_present: Boolean(content.video.video_id),
        video_url_present: Boolean(content.video.url),
        cover_present: Boolean(content.video.cover),
      };
    }
    out.caption = {
      present: typeof content.caption === "string" && content.caption.length > 0,
      length: typeof content.caption === "string" ? content.caption.length : 0,
    };
    out.from_source_shape = typeof content.from_source === "string"
      ? content.from_source
          .replace(/(creator_id=)[^&]+/i, "$1[REDACTED]")
          .replace(/(creator_id%3D)[^&]+/i, "$1[REDACTED]")
      : null;
  }

  if (data.app_info && typeof data.app_info === "object") {
    out.app_info_safe = {
      system_os: data.app_info.system_os || null,
      system_version: data.app_info.system_version || null,
      app_version: data.app_info.app_version || null,
      device_model_shape: data.app_info.device_model
        ? String(data.app_info.device_model).replace(/(Model\/)[^ ]+/i, "$1[REDACTED]")
        : null,
    };
  }

  return out;
}

function safeCreditRequestFingerprint(body) {
  const b = body && typeof body === "object" ? body : {};
  return {
    keys: Object.keys(b).sort(),
    url: safeUrl(b.url),
    cookie: safeCookieFingerprint(b.cookie),
    proxy: b.proxy ? {
      present: true,
      hash: sha256(String(b.proxy)),
      parts: String(b.proxy).split(":").length,
      has_auth: String(b.proxy).split(":").length >= 4,
    } : { present: false },
    data: safePostPayloadFingerprint(b.data),
  };
}

function classify(url) {
  const p = safeUrl(url);
  const s = p.path || "";
  const host = String(p.host || p.origin || "").toLowerCase();

  // Credit/extra_context service used by getExtra().
  if (host === "creditmls2026video.toolshopee.vn" &&
      /\/api\/createpost(?:\/)?$/i.test(s)) {
    return "credit_createPost";
  }

  if (/\/api\/v2\/biz\/post\/create/i.test(s) || /\/post\/create/i.test(s)) return "createPost";
  if (/\/api\/v2\/biz\/post\/precheck/i.test(s) || /\/post\/precheck/i.test(s)) return "precheck";
  if (/\/api\/v2\/post\/products/i.test(s)) return "postProducts";
  if (/\/api\/v2\/biz\/file\/image/i.test(s)) return "uploadImage";
  if (/\/uploadapi\/api\/v1\/vod\/(preupload|reportupload)/i.test(s)) return "vod";
  if (/generate_token/i.test(s)) return "videoToken";
  return "other";
}

function install() {
  if (!ENABLED) return false;

  let axios;
  try {
    axios = require("axios");
  } catch (e) {
    console.warn("[DIAGNOSTIC] axios not available:", e.message);
    return false;
  }

  const AxiosClass = axios.Axios;
  if (!AxiosClass || !AxiosClass.prototype || typeof AxiosClass.prototype.request !== "function") {
    console.warn("[DIAGNOSTIC] Unsupported axios version; no telemetry installed.");
    return false;
  }

  if (AxiosClass.prototype.__diagnosticModeInstalled) return true;

  const originalRequest = AxiosClass.prototype.request;
  AxiosClass.prototype.request = function diagnosticRequest(config) {
    const started = Date.now();
    const cfg = config || {};
    const url = cfg.url || "";
    const stage = classify(url);

    const cookie =
      (cfg.headers && (cfg.headers.cookie || cfg.headers.Cookie)) ||
      cfg.cookie ||
      "";

    const recordBase = {
      event: "http_request",
      stage,
      method: String(cfg.method || "get").toUpperCase(),
      url: safeUrl(url),
      account: safeCookieInfo(cookie),
      proxy: safeProxyFromConfig(cfg),
      timeout_ms: cfg.timeout || null,
      request_headers: safeHeaders(cfg.headers),
      body: safeBodySummary(cfg.data),
      // For /api/createpost the sensitive account context is inside the JSON body,
      // not in HTTP Cookie/Proxy headers. Record only structural fingerprints.
      credit_request_fingerprint: stage === "credit_createPost"
        ? safeCreditRequestFingerprint(cfg.data)
        : undefined,
    };

    writeRecord(recordBase);

    if (stage === "credit_createPost") {
      console.log(
        `[DIAGNOSTIC] credit_createPost request → ${recordBase.method} ${recordBase.url.path}`
      );
    }

    if (stage === "createPost") {
      console.log(
        `[DIAGNOSTIC] createPost → ${recordBase.method} ${recordBase.url.path} ` +
        `SPC_U=${recordBase.account.spc_u_hash || "none"} ` +
        `proxy=${recordBase.proxy.configured ? "yes" : "no"}`
      );
    }

    let result;
    try {
      result = originalRequest.apply(this, arguments);
    } catch (err) {
      writeRecord({
        event: "http_error",
        stage,
        method: recordBase.method,
        url: recordBase.url,
        account: recordBase.account,
        elapsed_ms: Date.now() - started,
        error_code: err && err.code,
        error_name: err && err.name,
      });
      throw err;
    }

    return Promise.resolve(result).then(
      response => {
        const status = response && response.status;
        if (stage === "createPost" || stage === "credit_createPost" || status >= 400) {
          const summary = responseSummary(response, stage);
          writeRecord({
            event: "http_response",
            stage,
            method: recordBase.method,
            url: recordBase.url,
            account: recordBase.account,
            elapsed_ms: Date.now() - started,
            response: summary,
            proxy_error: classifyProxyError(response),
            proxy: safeProxyFromConfig(cfg),
            response_headers: safeHeaders(response && response.headers),
          });

          if (stage === "credit_createPost") {
            console.log(
              `[DIAGNOSTIC] credit_createPost → HTTP ${status} ` +
              `code=${summary.code ?? "n/a"} ` +
              `msg=${summary.msg || summary.message || summary.detected || "n/a"}`
            );
          }

          if (status === 418 || summary.detected === "status_418_text" ||
              summary.detected === "no_extra_context") {
            console.warn(
              `[DIAGNOSTIC] auth/extra diagnostic | stage=${stage} ` +
              `HTTP=${status} SPC_U=${recordBase.account.spc_u_hash || "none"} ` +
              `elapsed=${Date.now() - started}ms`
            );
          }
        }
        return response;
      },
      err => {
        writeRecord({
          event: "http_error",
          stage,
          method: recordBase.method,
          url: recordBase.url,
          account: recordBase.account,
          elapsed_ms: Date.now() - started,
          error_code: err && err.code,
          error_name: err && err.name,
          response_status: err && err.response && err.response.status,
          response: err && err.response ? responseSummary(err.response) : null,
        });
        throw err;
      }
    );
  };

  AxiosClass.prototype.__diagnosticModeInstalled = true;
  console.log("[DIAGNOSTIC] Safe HTTP telemetry enabled (V4).");
  console.log(`[DIAGNOSTIC] Output directory: ${OUT_DIR}`);
  console.log("[DIAGNOSTIC] Secrets/cookies/tokens/signatures are redacted.");
  return true;
}

module.exports = { install, ENABLED, OUT_DIR };
