const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const adbService = require('./adb.service');
const vodTokenService = require('./vod-token.service');

const LOCAL_PHONE_URL = 'http://127.0.0.1:8080';
const STICKY_ROUTING_PATH = process.env.GATEWAY_STICKY_ROUTING_PATH || path.join(__dirname, '../database/sticky_routing.json');
const busyPhoneUrls = new Set();
const waitQueue = [];
const boundServers = new Map();
const stickyUserGroupMap = new Map();
const stickyUserMap = new Map(); // userId -> { serial, backupSerial, group, updatedAt }
const statsByPort = new Map();
let crossGroupViolations = 0;
let droppedZombieCount = 0;
let droppedTimeoutCount = 0;
let fastFailed418Count = 0;
let serveTickCounter = 0;
const clientLastServedTick = new Map();
const clientServedCounts = new Map();
const recent418ByUser = new Map(); // userId -> { count, lastAt }
const recentFailures = [];
const MAX_RECENT_FAILURES = 50;

function recordRecentFailure(info) {
  recentFailures.push({ ts: new Date().toISOString(), ...info });
  if (recentFailures.length > MAX_RECENT_FAILURES) {
    recentFailures.splice(0, recentFailures.length - MAX_RECENT_FAILURES);
  }
}
const MAX_QUEUE_WAIT_MS = parseInt(process.env.GATEWAY_MAX_QUEUE_WAIT_MS || '180000', 10) || 180000;
const MAX_QUEUE_TOTAL = parseInt(process.env.GATEWAY_MAX_QUEUE_TOTAL || '300', 10) || 300;
const SAMSUNG_SLOT_WEIGHT = Math.max(1, parseInt(process.env.GATEWAY_SAMSUNG_WEIGHT || '2', 10) || 2);
const NOTE8_SLOT_WEIGHT = Math.max(1, parseInt(process.env.GATEWAY_NOTE8_WEIGHT || '1', 10) || 1);
const TIGER_SLOT_WEIGHT = Math.max(1, parseInt(process.env.GATEWAY_TIGER_WEIGHT || '1', 10) || 1);
const PRIMARY_GRACE_MS = Math.max(0, parseInt(process.env.GATEWAY_PRIMARY_GRACE_MS || '3000', 10) || 3000);
const STRICT_NO_BORROW = process.env.GATEWAY_STRICT_NO_BORROW === '1';
const GROUP_OFFLINE_BORROW_MS = Math.max(0, parseInt(process.env.GATEWAY_GROUP_OFFLINE_BORROW_MS || '15000', 10) || 15000);
const groupOfflineSince = new Map(); // group -> first timestamp when 0 online urls in group
const CAPTCHA_418_WINDOW_MS = Math.max(10000, parseInt(process.env.GATEWAY_418_WINDOW_MS || '180000', 10) || 180000);
const CAPTCHA_418_SKIP_RETRY_AT = 2;
const CAPTCHA_418_FASTFAIL_AT = 3;

let stickySaveTimer = null;
let stickyDirty = false;

function loadStickyRoutingFromDisk() {
  try {
    if (!fs.existsSync(STICKY_ROUTING_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(STICKY_ROUTING_PATH, 'utf8'));
    const users = raw && typeof raw === 'object' ? (raw.users || raw) : {};
    for (const [uid, rec] of Object.entries(users)) {
      if (!uid || !rec || typeof rec !== 'object' || !rec.serial) continue;
      const group = rec.group || adbService.getGroupForSerial(rec.serial);
      const entry = {
        serial: String(rec.serial),
        backupSerial: rec.backupSerial ? String(rec.backupSerial) : null,
        group: String(group),
        updatedAt: Number(rec.updatedAt) || Date.now()
      };
      stickyUserMap.set(String(uid), entry);
      stickyUserGroupMap.set(String(uid), entry.group);
    }
  } catch (e) {
    console.warn('[PhoneSign Gateway] Không đọc được sticky_routing.json:', e.message);
  }
}

function flushStickyRoutingSync() {
  if (!stickyDirty) return;
  stickyDirty = false;
  if (stickySaveTimer) {
    clearTimeout(stickySaveTimer);
    stickySaveTimer = null;
  }
  try {
    const usersObj = {};
    for (const [uid, rec] of stickyUserMap.entries()) {
      usersObj[uid] = rec;
    }
    fs.mkdirSync(path.dirname(STICKY_ROUTING_PATH), { recursive: true });
    const tmpPath = `${STICKY_ROUTING_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), users: usersObj }, null, 2), 'utf8');
    fs.renameSync(tmpPath, STICKY_ROUTING_PATH);
  } catch (e) {
    stickyDirty = true;
    console.warn('[PhoneSign Gateway] Không ghi được sticky_routing.json:', e.message);
  }
}

function scheduleSaveStickyRouting() {
  stickyDirty = true;
  if (stickySaveTimer) return;
  stickySaveTimer = setTimeout(() => {
    stickySaveTimer = null;
    flushStickyRoutingSync();
  }, 1500);
  if (typeof stickySaveTimer.unref === 'function') {
    stickySaveTimer.unref();
  }
}

loadStickyRoutingFromDisk();
process.once('beforeExit', flushStickyRoutingSync);

function isCaptcha418Response(data) {
  return !!(data && (data.http_status === 418 || data.data?.error === 90309999));
}

function getActive418Count(userId) {
  if (!userId) return 0;
  const rec = recent418ByUser.get(userId);
  if (!rec) return 0;
  if (Date.now() - rec.lastAt > CAPTCHA_418_WINDOW_MS) {
    recent418ByUser.delete(userId);
    return 0;
  }
  return rec.count;
}

function record418Hit(userId) {
  if (!userId) return 0;
  const now = Date.now();
  if (recent418ByUser.size > 2000) {
    for (const [k, v] of recent418ByUser.entries()) {
      if (now - v.lastAt > CAPTCHA_418_WINDOW_MS) recent418ByUser.delete(k);
    }
  }
  const prev = recent418ByUser.get(userId);
  const nextCount = prev && (now - prev.lastAt <= CAPTCHA_418_WINDOW_MS) ? prev.count + 1 : 1;
  recent418ByUser.set(userId, { count: nextCount, lastAt: now });
  return nextCount;
}

function getClientKey(req) {
  const raw = String(req?.ip || req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'unknown').trim();
  const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  if (ip === '127.0.0.1' || ip === '::1') return 'local';
  return ip || 'unknown';
}

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
    model: prof?.model || prof?.deviceModel || '',
    sdkInt: prof?.sdkInt || '',
    appVersion: prof?.appVersion || '',
    prechecks: 0,
    createposts: 0,
    successPosts: 0,
    uniqueUsers: new Set(),
    lastUserId: '',
    lastAt: null
  };
  entry.serial = serial;
  entry.group = group;
  entry.model = prof?.model || prof?.deviceModel || entry.model;
  entry.sdkInt = prof?.sdkInt || entry.sdkInt;
  entry.appVersion = prof?.appVersion || entry.appVersion;
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

function getGroupForSerial(serial = '') {
  return adbService.getGroupForSerial(serial);
}

function getGroupWeight(group = '') {
  const g = String(group || '');
  if (g.startsWith('SAMSUNG_')) return SAMSUNG_SLOT_WEIGHT;
  if (g === 'NOTE8') return NOTE8_SLOT_WEIGHT;
  return TIGER_SLOT_WEIGHT;
}

function getCanonicalGroupSlots(activeUrls) {
  const selected = Array.isArray(adbService.selectedSerials)
    ? adbService.selectedSerials.filter(s => s && !String(s).startsWith('GATEWAY-'))
    : [];
  const baseGroups = selected.length > 0
    ? selected.map(s => getGroupForSerial(s))
    : activeUrls.map(u => adbService.getDeviceGroupForUrl(u));
  const slots = [];
  for (const grp of baseGroups) {
    const w = getGroupWeight(grp);
    for (let i = 0; i < w; i++) slots.push(grp);
  }
  return slots;
}

function getRealSelectedSerials(activeUrls) {
  const selected = Array.isArray(adbService.selectedSerials)
    ? adbService.selectedSerials.filter(s => s && !String(s).startsWith('GATEWAY-'))
    : [];
  if (selected.length > 0) return selected;
  const fromUrls = [];
  for (const u of activeUrls || []) {
    const s = adbService.getSerialForUrl(u);
    if (s && !String(s).startsWith('GATEWAY-') && !fromUrls.includes(s)) fromUrls.push(s);
  }
  return fromUrls;
}

function getSerialWeight(serial = '') {
  return getGroupWeight(getGroupForSerial(serial));
}

function getPrimaryLoadBySerial() {
  const counts = new Map();
  for (const rec of stickyUserMap.values()) {
    if (rec && rec.serial) {
      counts.set(rec.serial, (counts.get(rec.serial) || 0) + 1);
    }
  }
  return counts;
}

function getBackupLoadBySerial() {
  const counts = new Map();
  for (const rec of stickyUserMap.values()) {
    if (rec && rec.backupSerial) {
      counts.set(rec.backupSerial, (counts.get(rec.backupSerial) || 0) + 1);
    }
  }
  return counts;
}

function pickLeastLoadedSerial(serialPool, userId, onlineSerialSet = null) {
  if (!serialPool || serialPool.length === 0) return null;
  const preferred = onlineSerialSet
    ? serialPool.filter(s => onlineSerialSet.has(s))
    : [];
  const pool = preferred.length > 0 ? preferred : serialPool;
  const loadMap = getPrimaryLoadBySerial();
  let bestSerial = pool[0];
  let bestScore = Infinity;
  let bestTie = Infinity;
  for (const s of pool) {
    const score = (loadMap.get(s) || 0) / getSerialWeight(s);
    const tie = hashUserId(`${userId}:${s}`);
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && tie < bestTie)) {
      bestScore = score;
      bestTie = tie;
      bestSerial = s;
    }
  }
  return bestSerial;
}

function pickBackupSerialInGroup(primarySerial, group, allSerials, userId, onlineSerialSet = null) {
  const peers = (allSerials || []).filter(s => s !== primarySerial && getGroupForSerial(s) === group);
  if (peers.length === 0) return null;
  const preferred = onlineSerialSet ? peers.filter(s => onlineSerialSet.has(s)) : [];
  const pool = preferred.length > 0 ? preferred : peers;
  const pLoad = getPrimaryLoadBySerial();
  const bLoad = getBackupLoadBySerial();
  let best = pool[0];
  let bestScore = Infinity;
  let bestTie = Infinity;
  for (const s of pool) {
    const score = ((pLoad.get(s) || 0) + (bLoad.get(s) || 0) * 0.5) / getSerialWeight(s);
    const tie = hashUserId(`bak:${userId}:${s}`);
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && tie < bestTie)) {
      bestScore = score;
      bestTie = tie;
      best = s;
    }
  }
  return best;
}

function ensureStickyPinForUser(userId, activeUrls) {
  const selectedSerials = getRealSelectedSerials(activeUrls);
  const selectedSet = new Set(selectedSerials);
  const onlineSerialSet = new Set();
  for (const u of activeUrls || []) {
    const s = adbService.getSerialForUrl(u);
    if (s) onlineSerialSet.add(s);
  }

  let pin = stickyUserMap.get(userId);
  if (pin) {
    // Nếu chủ máy đã bỏ tích hẳn TOÀN BỘ nhóm cũ khỏi selectedSerials -> gán lại sạch sang máy đang chọn.
    // Nếu nhóm cũ vẫn còn trong selectedSerials (kể cả máy gốc đang nháy USB tạm) -> giữ nguyên nhóm, không nhảy chéo dòng.
    const sameGroupSelected = selectedSerials.filter(s => getGroupForSerial(s) === pin.group);
    if (selectedSerials.length > 0 && sameGroupSelected.length === 0) {
      const nextPrimary = pickLeastLoadedSerial(selectedSerials, userId, onlineSerialSet);
      const nextGroup = getGroupForSerial(nextPrimary);
      const nextBackup = pickBackupSerialInGroup(nextPrimary, nextGroup, selectedSerials, userId, onlineSerialSet);
      pin = { serial: nextPrimary, backupSerial: nextBackup, group: nextGroup, updatedAt: Date.now() };
      stickyUserMap.set(userId, pin);
      stickyUserGroupMap.set(userId, pin.group);
      scheduleSaveStickyRouting();
      return pin;
    }
    let changed = false;
    if (selectedSet.size > 0 && !selectedSet.has(pin.serial) && sameGroupSelected.length > 0) {
      // Chỉ 1 máy lẻ trong cùng nhóm bị bỏ tích -> chuyển primary sang máy cùng dòng còn lại
      pin.serial = pickLeastLoadedSerial(sameGroupSelected, userId, onlineSerialSet);
      changed = true;
    }
    if (
      sameGroupSelected.length > 1 &&
      (!pin.backupSerial || pin.backupSerial === pin.serial || !selectedSet.has(pin.backupSerial))
    ) {
      pin.backupSerial = pickBackupSerialInGroup(pin.serial, pin.group, sameGroupSelected, userId, onlineSerialSet);
      changed = true;
    }
    if (changed) {
      pin.updatedAt = Date.now();
      stickyUserMap.set(userId, pin);
      stickyUserGroupMap.set(userId, pin.group);
      scheduleSaveStickyRouting();
    }
    return pin;
  }

  const primarySerial = pickLeastLoadedSerial(selectedSerials, userId, onlineSerialSet);
  if (!primarySerial) return null;
  const group = getGroupForSerial(primarySerial);
  const backupSerial = pickBackupSerialInGroup(primarySerial, group, selectedSerials, userId, onlineSerialSet);
  pin = { serial: primarySerial, backupSerial, group, updatedAt: Date.now() };
  stickyUserMap.set(userId, pin);
  stickyUserGroupMap.set(userId, pin.group);
  scheduleSaveStickyRouting();
  return pin;
}

function getCandidateUrlsForUser(userId = null, waitMs = 0) {
  const urls = adbService.getActiveLocalSignUrls();
  if (urls.length === 0) return [];
  if (!userId) return urls;

  const urlBySerial = new Map();
  for (const u of urls) {
    const s = adbService.getSerialForUrl(u);
    if (s) urlBySerial.set(s, u);
  }

  const pin = ensureStickyPinForUser(userId, urls);
  if (!pin) return urls;

  const primaryUrl = pin.serial ? urlBySerial.get(pin.serial) : null;
  const backupUrl = pin.backupSerial ? urlBySerial.get(pin.backupSerial) : null;
  const sameGroupOnline = urls.filter(u => adbService.getDeviceGroupForUrl(u) === pin.group);
  if (sameGroupOnline.length > 0) {
    groupOfflineSince.delete(pin.group);
  }

  // Tầng 1: ưu tiên tuyệt đối đúng primarySerial (1 android_id cố định) trong cửa sổ PRIMARY_GRACE_MS
  if (primaryUrl && waitMs < PRIMARY_GRACE_MS) {
    return [primaryUrl];
  }

  // Tầng 2: nếu primary bận > PRIMARY_GRACE_MS hoặc tạm rớt USB -> chỉ fallback trong CÙNG nhóm dòng máy
  const ordered = [];
  if (primaryUrl) ordered.push(primaryUrl);
  if (backupUrl && !ordered.includes(backupUrl)) ordered.push(backupUrl);
  // Chỉ mở sang các máy khác cùng nhóm nếu cả primary lẫn backup đều đang offline
  if (!primaryUrl && !backupUrl) {
    for (const u of sameGroupOnline) {
      if (!ordered.includes(u)) ordered.push(u);
    }
  }
  if (ordered.length > 0) {
    return ordered;
  }

  // Cả nhóm pin.group hiện có 0 máy online (đã quá 90s grace USB của adbService -> hub đã rút hoặc chết nguồn).
  // Chờ thêm GROUP_OFFLINE_BORROW_MS (mặc định 15s) tránh nhảy nhầm lúc khởi động; sau đó mượn tạm
  // 1 máy online cố định theo hash(userId) (KHÔNG ghi đè stickyUserMap) để tránh kẹt hàng đợi 180s -> HTTP 503.
  if (STRICT_NO_BORROW) {
    return [];
  }
  const now = Date.now();
  const offlineAt = groupOfflineSince.get(pin.group);
  if (!offlineAt) {
    groupOfflineSince.set(pin.group, now);
    if (GROUP_OFFLINE_BORROW_MS > 0) return [];
  } else if (now - offlineAt < GROUP_OFFLINE_BORROW_MS) {
    return [];
  }
  const fallbackUrl = urls[hashUserId(userId) % urls.length];
  return fallbackUrl ? [fallbackUrl] : [];
}

let externalWaitTimer = null;

function scheduleExternalWaitDrain() {
  if (externalWaitTimer || waitQueue.length === 0) return;
  externalWaitTimer = setTimeout(() => {
    externalWaitTimer = null;
    drainWaitQueue();
    if (waitQueue.length > 0) {
      scheduleExternalWaitDrain();
    }
  }, 200);
}

function pickIdlePhoneUrlForUser(userId = null, waitMs = 0) {
  const candidates = getCandidateUrlsForUser(userId, waitMs);
  if (candidates.length === 0) return null;
  if (userId) {
    // Giữ nguyên thứ tự ưu tiên: primaryUrl -> backupUrl -> sameGroup
    for (let i = 0; i < candidates.length; i++) {
      const u = candidates[i];
      if (busyPhoneUrls.has(u)) continue;
      const serial = adbService.getSerialForUrl(u);
      if (serial && adbService.isExternalDeviceLocked(serial)) continue;
      return u;
    }
    return null;
  }
  for (let i = 0; i < candidates.length; i++) {
    const idx = (rrCursor + i) % candidates.length;
    const u = candidates[idx];
    if (busyPhoneUrls.has(u)) continue;
    const serial = adbService.getSerialForUrl(u);
    if (serial && adbService.isExternalDeviceLocked(serial)) continue;
    rrCursor = (rrCursor + 1) % 1000000;
    return u;
  }
  return null;
}

function pruneDeadWaitQueueItems() {
  const now = Date.now();
  for (let i = waitQueue.length - 1; i >= 0; i--) {
    const item = waitQueue[i];
    if (item.cancelled || (typeof item.isAborted === 'function' && item.isAborted())) {
      waitQueue.splice(i, 1);
      droppedZombieCount++;
      item.abortWith(new Error('CLIENT_DISCONNECTED'));
      continue;
    }
    if (item.maxWaitMs > 0 && now - item.enqueuedAt >= item.maxWaitMs) {
      waitQueue.splice(i, 1);
      droppedTimeoutCount++;
      const err = new Error(`PhoneSign Gateway hàng đợi quá tải (chờ quá ${Math.round(item.maxWaitMs / 1000)}s)`);
      err.statusCode = 503;
      item.abortWith(err);
    }
  }
}

function markClientServed(clientKey = 'unknown') {
  serveTickCounter++;
  clientLastServedTick.set(clientKey, serveTickCounter);
  clientServedCounts.set(clientKey, (clientServedCounts.get(clientKey) || 0) + 1);
}

function drainWaitQueue() {
  pruneDeadWaitQueueItems();
  while (waitQueue.length > 0) {
    let bestIdx = -1;
    let bestUrl = null;
    let bestLastServed = Infinity;
    let bestEnqueuedAt = Infinity;
    for (let i = 0; i < waitQueue.length; i++) {
      const item = waitQueue[i];
      if (item.cancelled || (typeof item.isAborted === 'function' && item.isAborted())) {
        waitQueue.splice(i, 1);
        i--;
        droppedZombieCount++;
        item.abortWith(new Error('CLIENT_DISCONNECTED'));
        continue;
      }
      const waitMs = Math.max(0, Date.now() - item.enqueuedAt);
      const idleUrl = pickIdlePhoneUrlForUser(item.userId, waitMs);
      if (!idleUrl) continue;
      const clientLast = clientLastServedTick.get(item.clientKey) || 0;
      if (
        clientLast < bestLastServed ||
        (clientLast === bestLastServed && item.enqueuedAt < bestEnqueuedAt)
      ) {
        bestIdx = i;
        bestUrl = idleUrl;
        bestLastServed = clientLast;
        bestEnqueuedAt = item.enqueuedAt;
      }
    }
    if (bestIdx === -1 || !bestUrl) break;
    const [chosen] = waitQueue.splice(bestIdx, 1);
    markClientServed(chosen.clientKey);
    chosen.runWithUrl(bestUrl);
  }
  if (waitQueue.length > 0) {
    scheduleExternalWaitDrain();
  }
}

function enqueuePhoneTask(taskFn, userId = null, opts = {}) {
  const res = opts.res || null;
  const clientKey = opts.clientKey || 'unknown';
  const maxWaitMs = Number.isFinite(opts.maxWaitMs) ? opts.maxWaitMs : MAX_QUEUE_WAIT_MS;
  let clientClosed = false;
  const isAborted = () => clientClosed || !!(res && (res.destroyed || (res.closed && !res.writableEnded)));

  return new Promise((resolve, reject) => {
    let settled = false;
    let queueItem = null;

    const cleanupResListener = () => {
      if (res && onResClose) {
        res.removeListener('close', onResClose);
      }
    };

    const safeResolve = (val) => {
      if (settled) return;
      settled = true;
      cleanupResListener();
      resolve(val);
    };

    const safeReject = (err) => {
      if (settled) return;
      settled = true;
      cleanupResListener();
      reject(err);
    };

    const onResClose = () => {
      if (res && res.writableEnded) return;
      clientClosed = true;
      if (queueItem && !queueItem.started) {
        queueItem.cancelled = true;
        const idx = waitQueue.indexOf(queueItem);
        if (idx !== -1) {
          waitQueue.splice(idx, 1);
          droppedZombieCount++;
        }
        safeReject(new Error('CLIENT_DISCONNECTED'));
      }
    };

    if (res) {
      res.on('close', onResClose);
    }

    const runWithUrl = async (assignedUrl) => {
      if (queueItem) queueItem.started = true;
      if (isAborted()) {
        droppedZombieCount++;
        safeReject(new Error('CLIENT_DISCONNECTED'));
        drainWaitQueue();
        return;
      }
      busyPhoneUrls.add(assignedUrl);
      const serial = adbService.getSerialForUrl(assignedUrl);
      const extLocked = serial ? await adbService.acquireCrossProcessLock(serial, 65000) : false;
      try {
        if (isAborted()) {
          droppedZombieCount++;
          safeReject(new Error('CLIENT_DISCONNECTED'));
          return;
        }
        const result = await taskFn(assignedUrl);
        safeResolve(result);
      } catch (err) {
        safeReject(err);
      } finally {
        if (extLocked && serial) {
          adbService.releaseCrossProcessLock(serial);
        }
        busyPhoneUrls.delete(assignedUrl);
        drainWaitQueue();
      }
    };

    if (isAborted()) {
      droppedZombieCount++;
      safeReject(new Error('CLIENT_DISCONNECTED'));
      return;
    }

    const idleUrl = pickIdlePhoneUrlForUser(userId);
    if (idleUrl) {
      markClientServed(clientKey);
      runWithUrl(idleUrl);
    } else {
      pruneDeadWaitQueueItems();
      if (waitQueue.length >= MAX_QUEUE_TOTAL) {
        const err = new Error(`PhoneSign Gateway hàng đợi đã đầy (${waitQueue.length}/${MAX_QUEUE_TOTAL})`);
        err.statusCode = 503;
        safeReject(err);
        return;
      }
      queueItem = {
        userId,
        clientKey,
        enqueuedAt: Date.now(),
        maxWaitMs,
        cancelled: false,
        started: false,
        isAborted,
        runWithUrl,
        abortWith: (err) => safeReject(err)
      };
      waitQueue.push(queueItem);
      scheduleExternalWaitDrain();
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
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    const isConnLost = code === 'ECONNREFUSED' || code === 'ECONNRESET' || msg.includes('ECONNREFUSED') || msg.includes('socket hang up');
    if (preferredUrl) {
      if (isConnLost) {
        await adbService.ensureForwardForUrl(targetLocalUrl).catch(() => false);
      }
      await adbService.restartShopeeAppForSign(targetLocalUrl, null, null, isConnLost);
      return await requestFn(targetLocalUrl);
    }
    if (isConnLost) {
      await adbService.ensureForwardForUrl(targetLocalUrl).catch(() => false);
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

    const clientKey = getClientKey(req);

    // Chặn đốt điện thoại khi cùng 1 userId dính Captcha 418 liên tiếp (>= 3 lần trong 3 phút)
    if (userId && getActive418Count(userId) >= CAPTCHA_418_FASTFAIL_AT) {
      fastFailed418Count++;
      recordRecentFailure({
        client: clientKey,
        userId,
        port: 'FAST_FAIL_418',
        stage: 'fast_fail_418',
        httpStatus: 418,
        code: 90309999,
        msg: 'Gateway fast-fail 418 (userId đang dính Captcha 418 liên tiếp)'
      });
      return res.status(200).json({
        code: 418,
        http_status: 418,
        data: { error: 90309999, fast_fail: true },
        msg: 'HTTP 418 Captcha (Gateway fast-fail)',
        error: 'HTTP 418 Captcha (Gateway fast-fail)'
      });
    }

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
          recordRecentFailure({
            client: clientKey,
            userId,
            port: assignedBaseUrl,
            stage: 'precheck',
            httpStatus: early.earlyReturn?.http_status || null,
            code: early.earlyReturn?.data?.code ?? early.earlyReturn?.code ?? null,
            msg: String(early.earlyReturn?.data?.msg || early.earlyReturn?.msg || JSON.stringify(early.earlyReturn || {})).slice(0, 220)
          });
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

      const firstIs418 = isCaptcha418Response(postRes.data);
      let hit418Count = firstIs418 ? record418Hit(userId) : 0;
      const shouldRetryOnPhone =
        postRes.data &&
        cookie &&
        ((firstIs418 && hit418Count < CAPTCHA_418_SKIP_RETRY_AT) ||
          postRes.data.data?.code === 98001004 ||
          postRes.data.data?.code === 300014);

      if (shouldRetryOnPhone) {
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
        if (isCaptcha418Response(postRes.data)) {
          record418Hit(userId);
        }
      }

      const postId = postRes.data?.data?.data?.post_id || postRes.data?.data?.post_id;
      const postOk = !!(postRes.data?.code === 0 && postId);
      if (postOk && userId) {
        recent418ByUser.delete(userId);
      }
      recordPortStat(assignedBaseUrl, 'createpost', userId, postOk);
      if (!postOk) {
        recordRecentFailure({
          client: clientKey,
          userId,
          port: assignedBaseUrl,
          stage: 'createpost',
          httpStatus: postRes.data?.http_status || postRes.status || null,
          code: postRes.data?.data?.code ?? postRes.data?.data?.error ?? postRes.data?.code ?? null,
          msg: String(
            postRes.data?.data?.msg ||
            postRes.data?.data?.error_msg ||
            postRes.data?.msg ||
            postRes.data?.error ||
            JSON.stringify(postRes.data || {})
          ).slice(0, 260)
        });
      }
      return postRes.data;
    }, userId, { res, clientKey });

    if (res.writableEnded || res.destroyed) return;

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
    if (err?.message === 'CLIENT_DISCONNECTED' || res.writableEnded || res.destroyed) {
      return;
    }
    const statusCode = err?.statusCode || 502;
    return res.status(statusCode).json({ code: 1, error: err.message, msg: err.message });
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
      appVersion: entry.appVersion,
      prechecks: entry.prechecks,
      createposts: entry.createposts,
      successPosts: entry.successPosts,
      uniqueUsersCount: entry.uniqueUsers.size,
      lastUserId: entry.lastUserId,
      lastAt: entry.lastAt
    });
  }
  const groupSummary = {};
  const serialSummary = {};
  for (const rec of stickyUserMap.values()) {
    if (!rec) continue;
    groupSummary[rec.group] = (groupSummary[rec.group] || 0) + 1;
    serialSummary[rec.serial] = (serialSummary[rec.serial] || 0) + 1;
  }
  const waitQueueByGroup = {};
  const waitQueueByClient = {};
  const activeUrls = adbService.getActiveLocalSignUrls();
  for (const item of waitQueue) {
    const pin = item.userId ? stickyUserMap.get(item.userId) : null;
    const grp = pin ? pin.group : 'ANY';
    waitQueueByGroup[grp] = (waitQueueByGroup[grp] || 0) + 1;
    const ck = item.clientKey || 'unknown';
    waitQueueByClient[ck] = (waitQueueByClient[ck] || 0) + 1;
  }
  const servedByClient = {};
  for (const [k, v] of clientServedCounts.entries()) {
    servedByClient[k] = v;
  }
  const now418 = Date.now();
  let active418UsersCount = 0;
  for (const [k, v] of recent418ByUser.entries()) {
    if (now418 - v.lastAt > CAPTCHA_418_WINDOW_MS) {
      recent418ByUser.delete(k);
    } else if (v.count >= CAPTCHA_418_FASTFAIL_AT) {
      active418UsersCount++;
    }
  }
  return res.json({
    code: 0,
    activeUrls,
    busyUrls: Array.from(busyPhoneUrls),
    waitQueueLength: waitQueue.length,
    waitQueueByGroup,
    waitQueueByClient,
    servedByClient,
    droppedZombieCount,
    droppedTimeoutCount,
    fastFailed418Count,
    active418UsersCount,
    stickyUsersTotal: stickyUserMap.size,
    stickyUsersByGroup: groupSummary,
    stickyUsersBySerial: serialSummary,
    crossGroupViolations,
    recentFailures: recentFailures.slice(-30),
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
  enqueuePhoneTask,
  _internal: {
    getCandidateUrlsForUser,
    pickIdlePhoneUrlForUser,
    ensureStickyPinForUser,
    flushStickyRoutingSync,
    loadStickyRoutingFromDisk,
    stickyUserMap,
    record418Hit,
    getActive418Count,
    recent418ByUser
  }
};
