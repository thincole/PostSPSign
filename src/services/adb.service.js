const { execFile } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const axios = require('axios');

const noKeepAliveAgent = new http.Agent({ keepAlive: false });
const gatewayKeepAliveAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 100,
  maxFreeSockets: 32,
  timeout: 300000
});
const httpsGatewayKeepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 100,
  maxFreeSockets: 32,
  timeout: 300000
});
const SELECTED_DEVICES_PATH = path.join(__dirname, '../database/adb_selected_devices.json');

const DEFAULT_TIGER10_PROFILE = {
  serial: 'TIGER10VN0000859',
  model: 'TIGER 10',
  brand: 'OSCAL',
  sdkInt: '33',
  androidId: 'c7498c7b5b527e19',
  packageName: 'com.shopee.vn',
  appVersion: '36448',
  appVersionName: '3.64.48',
  deviceModelInfo: 'Brand/OSCAL Model/TIGER 10 OSVer/33 Manufacturer/OSCAL',
  liveDeviceModel: 'oscal+tiger+10',
  clientInfo: 'device_id=c7498c7b5b527e19;device_model=TIGER 10;os=0;os_version=33;client_version=36448;network=1;platform=1;rn_version=6.97.5;api_source=na;cpu_model=;live_device_model=oscal+tiger+10',
  userAgent: 'okhttp/3.12.4 app_type=1 platform=native_android os_ver=33 appver=36448',
  cronetUserAgent: 'okhttp/3.12.4 app_type=1 platform=native_android os_ver=33 appver=36448 Cronet/102.0.5005.61'
};

class AdbService {
  constructor() {
    const postSpAdb = 'E:\\0 - Post SP phone\\adb.exe';
    const xiaoweiAdb = 'C:\\Program Files (x86)\\xiaowei_android\\tools\\adb.exe';
    const bundledAdb = path.join(__dirname, '../../bin/platform-tools/adb.exe');
    if (fs.existsSync(postSpAdb)) {
      this.adbPath = postSpAdb;
    } else if (fs.existsSync(xiaoweiAdb)) {
      this.adbPath = xiaoweiAdb;
    } else if (fs.existsSync(bundledAdb)) {
      this.adbPath = bundledAdb;
    } else {
      this.adbPath = 'adb';
    }
    this.adb5037Path = (process.env.ADB_USE_XIAOWEI_5037 === '1' && fs.existsSync(xiaoweiAdb))
      ? xiaoweiAdb
      : this.adbPath;
    this._cachedProfile = null;
    this._cachedAt = 0;
    this._pkgVersionCache = {
      'com.shopee.vn': { code: '36448', name: '3.64.48' },
      'com.shopee.ph': { code: '38528', name: '3.85.28' }
    };
    this._ensurePromise = null;
    // Cổng ADB độc quyền cho hệ thống PhoneSign (SP Phone Post & Duet Phone)
    // Tách riêng khỏi 5037 (FNT / scrcpy / mặc định) và 5038 (Xiaowei / tool khác) để tránh bị cướp máy
    this.adbServerPorts = (process.env.ADB_SERVER_PORTS || '5048')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    this.primaryAdbPort = this.adbServerPorts[0] || '5048';
    this.hijackAdbPorts = ['5037', '5038'].filter(p => !this.adbServerPorts.includes(p));
    this._lastHijackReclaimAt = new Map();
    this._serialPortMap = new Map();
    this._devicePortMap = new Map(); // serial -> localPort (8080, 8081, 8082...)
    this._lastLaunchAt = new Map(); // serial -> timestamp
    this._rrIndex = 0;
    this._postSessionQueue = Promise.resolve();
    this._activeFreshCount = 0;
    this._freshSessionSerials = new Set();
    this._lastFreshSession = { startedAt: 0, userId: null, clean: false };
    this._lastFreshSessionByUrl = new Map();
    this._profileByUrl = new Map();
    this._provisionedSerials = new Set();
    this._remotePhoneCountByOrigin = new Map(); // origin -> { count, fetchedAt, inFlight }
    this._loggedRemoteMaxSign = new Set();
    this._crossProcessLocks = new Map();
    this.selectedSerials = this._loadSelectedSerials();
  }

  _getCrossLockPath(serial) {
    const safe = String(serial || 'default').replace(/[^A-Za-z0-9._-]/g, '_');
    return path.join(os.tmpdir(), 'spsign_phone_locks', `${safe}.lock`);
  }

  _isPidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    if (pid === process.pid) return true;
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return !!(e && e.code === 'EPERM');
    }
  }

  _readCrossLockMeta(lockPath) {
    try {
      const raw = fs.readFileSync(lockPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      if (e && e.code === 'ENOENT') return null;
      return {};
    }
  }

  _isCrossLockStale(lockPath, staleMs = 65000) {
    const meta = this._readCrossLockMeta(lockPath);
    if (meta === null) return false;
    if (Number.isInteger(meta.pid) && !this._isPidAlive(meta.pid)) return true;
    if (typeof meta.ts === 'number' && (Date.now() - meta.ts) > staleMs) return true;
    if (Object.keys(meta).length === 0) {
      try {
        const st = fs.statSync(lockPath);
        return (Date.now() - st.mtimeMs) > 5000;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  isExternalDeviceLocked(serial, staleMs = 65000) {
    if (!serial) return false;
    const lockPath = this._getCrossLockPath(serial);
    const meta = this._readCrossLockMeta(lockPath);
    if (!meta) return false;
    if (meta.pid === process.pid) return false;
    return !this._isCrossLockStale(lockPath, staleMs);
  }

  tryAcquireCrossProcessLockSync(serial, staleMs = 65000) {
    if (!serial) return true;
    const curCount = this._crossProcessLocks.get(serial) || 0;
    if (curCount > 0) {
      this._crossProcessLocks.set(serial, curCount + 1);
      return true;
    }
    const lockPath = this._getCrossLockPath(serial);
    try {
      fs.mkdirSync(path.dirname(lockPath), { recursive: true });
      const fd = fs.openSync(lockPath, 'wx');
      try {
        const payload = JSON.stringify({ pid: process.pid, app: 'tool_upload', ts: Date.now() });
        fs.writeFileSync(fd, payload, 'utf-8');
      } finally {
        fs.closeSync(fd);
      }
      this._crossProcessLocks.set(serial, 1);
      return true;
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        if (this._isCrossLockStale(lockPath, staleMs)) {
          try {
            fs.unlinkSync(lockPath);
            return this.tryAcquireCrossProcessLockSync(serial, staleMs);
          } catch (_) {}
        }
        return false;
      }
      return false;
    }
  }

  async acquireCrossProcessLock(serial, timeoutMs = 65000, staleMs = 65000) {
    if (!serial) return true;
    const deadline = Date.now() + Math.max(500, timeoutMs);
    while (true) {
      if (this.tryAcquireCrossProcessLockSync(serial, staleMs)) {
        return true;
      }
      if (Date.now() >= deadline) {
        return false;
      }
      await new Promise(r => setTimeout(r, 120));
    }
  }

  releaseCrossProcessLock(serial) {
    if (!serial) return;
    const curCount = this._crossProcessLocks.get(serial) || 0;
    if (curCount <= 0) return;
    if (curCount > 1) {
      this._crossProcessLocks.set(serial, curCount - 1);
      return;
    }
    this._crossProcessLocks.delete(serial);
    const lockPath = this._getCrossLockPath(serial);
    const meta = this._readCrossLockMeta(lockPath);
    if (meta === null || meta.pid === process.pid || Object.keys(meta).length === 0) {
      try {
        fs.unlinkSync(lockPath);
      } catch (_) {}
    }
  }

  get _inFreshSession() {
    return this._activeFreshCount > 0;
  }

  set _inFreshSession(val) {
    if (val) {
      this._activeFreshCount++;
    } else {
      this._activeFreshCount = Math.max(0, this._activeFreshCount - 1);
    }
  }

  set _inFreshSession(val) {
    if (val) {
      this._activeFreshCount++;
    } else {
      this._activeFreshCount = Math.max(0, this._activeFreshCount - 1);
    }
  }

  _loadSelectedSerials() {
    try {
      if (fs.existsSync(SELECTED_DEVICES_PATH)) {
        const raw = JSON.parse(fs.readFileSync(SELECTED_DEVICES_PATH, 'utf-8'));
        if (Array.isArray(raw?.selectedSerials)) {
          return raw.selectedSerials.filter(Boolean);
        }
      }
    } catch (_) {}
    return null; // null nghĩa là chưa cấu hình tay lần nào -> sẽ tự nhận từ các máy đang forward
  }

  _saveSelectedSerials(serials) {
    this.selectedSerials = Array.isArray(serials) ? Array.from(new Set(serials.filter(Boolean))) : [];
    try {
      const dir = path.dirname(SELECTED_DEVICES_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SELECTED_DEVICES_PATH, JSON.stringify({ selectedSerials: this.selectedSerials }, null, 2), 'utf-8');
    } catch (_) {}
    return this.selectedSerials;
  }

  runCommand(args, customAdbPath = null, timeoutMs = 15000) {
    const bin = customAdbPath || this.adbPath;
    return new Promise((resolve, reject) => {
      execFile(bin, args, { encoding: 'utf-8', timeout: timeoutMs }, (err, stdout, stderr) => {
        if (err && !stdout) {
          return reject(new Error((stderr || '').trim() || err.message));
        }
        resolve((stdout || '').trim());
      });
    });
  }

  runCommandWithServerPort(serverPort, args, timeoutMs = 15000) {
    const fullArgs = serverPort ? ['-P', String(serverPort), ...args] : args;
    const bin = String(serverPort) === '5037' ? this.adb5037Path : this.adbPath;
    return this.runCommand(fullArgs, bin, timeoutMs);
  }

  _isLocalPortOpen(port, timeoutMs = 150) {
    return new Promise((resolve) => {
      const portNum = parseInt(port, 10);
      if (!Number.isFinite(portNum) || portNum <= 0) return resolve(false);
      const sock = new net.Socket();
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        try { sock.destroy(); } catch (_) {}
        resolve(ok);
      };
      sock.setTimeout(timeoutMs);
      sock.once('connect', () => done(true));
      sock.once('timeout', () => done(false));
      sock.once('error', () => done(false));
      try {
        sock.connect(portNum, '127.0.0.1');
      } catch (_) {
        done(false);
      }
    });
  }

  async _getActiveAdbServerPorts() {
    return this.adbServerPorts.length > 0 ? this.adbServerPorts : [this.primaryAdbPort];
  }

  _sendAdbTcpCommand(port, cmd, timeoutMs = 800) {
    return new Promise((resolve) => {
      const portNum = parseInt(port, 10);
      if (!Number.isFinite(portNum) || portNum <= 0) return resolve({ ok: false, data: '' });
      const sock = new net.Socket();
      let buf = Buffer.alloc(0);
      let settled = false;
      const finish = (ok, data = '') => {
        if (settled) return;
        settled = true;
        try { sock.destroy(); } catch (_) {}
        resolve({ ok, data });
      };
      sock.setTimeout(timeoutMs);
      sock.on('data', (chunk) => {
        buf = Buffer.concat([buf, chunk]);
        if (cmd === 'host:kill' && buf.length >= 4) {
          return finish(buf.slice(0, 4).toString() === 'OKAY', buf.toString('utf8'));
        }
        if (buf.length >= 8) {
          const tag = buf.slice(0, 4).toString();
          if (tag === 'OKAY') {
            const len = parseInt(buf.slice(4, 8).toString(), 16);
            if (!isNaN(len) && buf.length >= 8 + len) {
              return finish(true, buf.slice(8, 8 + len).toString('utf8'));
            }
          } else if (tag === 'FAIL') {
            return finish(false, buf.toString('utf8'));
          }
        }
      });
      sock.once('end', () => finish(buf.slice(0, 4).toString() === 'OKAY', buf.slice(8).toString('utf8')));
      sock.once('timeout', () => finish(false, ''));
      sock.once('error', () => finish(false, ''));
      try {
        sock.connect(portNum, '127.0.0.1', () => {
          const hexLen = cmd.length.toString(16).padStart(4, '0');
          sock.write(hexLen + cmd);
        });
      } catch (_) {
        finish(false, '');
      }
    });
  }

  async _reclaimHijackedPhones() {
    if (!Array.isArray(this.hijackAdbPorts) || this.hijackAdbPorts.length === 0) return false;
    const now = Date.now();
    let reclaimed = false;
    const stolenSerials = new Set();
    for (const roguePort of this.hijackAdbPorts) {
      const lastTry = this._lastHijackReclaimAt.get(roguePort) || 0;
      if (now - lastTry < 5000) continue;
      // Truy vấn trực tiếp TCP protocol để KHÔNG bao giờ vô tình khởi động daemon 5037/5038
      const devResp = await this._sendAdbTcpCommand(roguePort, 'host:devices', 600);
      if (!devResp.ok || !devResp.data) continue;
      const serialsOnRogue = devResp.data
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => l.split(/\s+/)[0])
        .filter(Boolean);
      if (serialsOnRogue.length > 0) {
        this._lastHijackReclaimAt.set(roguePort, Date.now());
        serialsOnRogue.forEach(s => stolenSerials.add(s));
        console.warn(`🛡️ [ADB-${this.primaryAdbPort}] Phát hiện ${serialsOnRogue.length} máy đang bị cổng ${roguePort} giữ (${serialsOnRogue.join(', ')}) -> Thu hồi về cổng độc quyền ${this.primaryAdbPort}`);
        await this._sendAdbTcpCommand(roguePort, 'host:kill', 600);
        reclaimed = true;
      }
    }
    if (reclaimed) {
      await this.runCommandWithServerPort(this.primaryAdbPort, ['start-server'], 6000).catch(() => {});
      await new Promise(r => setTimeout(r, 350));
      const checkResp = await this._sendAdbTcpCommand(this.primaryAdbPort, 'host:devices', 800);
      const onPrimary = new Set(
        (checkResp.data || '').split('\n').map(l => l.trim().split(/\s+/)[0]).filter(Boolean)
      );
      let restartedAny = false;
      for (const s of stolenSerials) {
        if (onPrimary.has(s)) continue;
        const instanceId = this._getUsbInstanceIdForSerial(s);
        if (!instanceId) continue;
        restartedAny = true;
        await new Promise((res) => {
          execFile('pnputil', ['/restart-device', instanceId], { timeout: 6000 }, () => res());
        });
      }
      if (restartedAny) {
        await new Promise(r => setTimeout(r, 1500));
      }
      await this.runCommandWithServerPort(this.primaryAdbPort, ['devices', '-l'], 5000).catch(() => {});
    }
    return reclaimed;
  }

  _getUsbInstanceIdForSerial(serial = '') {
    const s = String(serial || '').trim();
    if (!s) return null;
    if (s.startsWith('TIGER10')) return `USB\\VID_1782&PID_4003\\${s}`;
    if (/^R[0-9A-Z]{8,}$/i.test(s)) return `USB\\VID_04E8&PID_6860\\${s}`;
    return null;
  }

  async _getServerPortForSerial(serial) {
    if (serial && this._serialPortMap.has(serial)) {
      return this._serialPortMap.get(serial);
    }
    await this.getDevices();
    return (serial && this._serialPortMap.get(serial)) || this.primaryAdbPort;
  }

  async getDevices(allowAutoRecover = true) {
    if (allowAutoRecover) {
      await this._reclaimHijackedPhones().catch(() => false);
    }
    const seen = new Map();
    const offlinePortsBySerial = new Map();
    const activePorts = await this._getActiveAdbServerPorts();
    for (const srvPort of activePorts) {
      try {
        const output = await this.runCommandWithServerPort(srvPort, ['devices', '-l']);
        const lines = output.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
          if (line.startsWith('*') || line.startsWith('List of')) continue;
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const serial = parts[0];
            const status = parts[1];
            if (status === 'offline') {
              if (!offlinePortsBySerial.has(serial)) offlinePortsBySerial.set(serial, new Set());
              offlinePortsBySerial.get(serial).add(srvPort);
            }
            const modelMatch = line.match(/model:(\S+)/);
            const deviceMatch = line.match(/device:(\S+)/);
            const model = modelMatch ? modelMatch[1] : (deviceMatch ? deviceMatch[1] : (serial.startsWith('TIGER10') ? 'TIGER 10' : 'Unknown'));

            if (!seen.has(serial) || status === 'device') {
              this._serialPortMap.set(serial, srvPort);
              seen.set(serial, {
                serial,
                status,
                model: model.replace(/_/g, ' '),
                adbServerPort: srvPort,
                raw: line
              });
            }
          }
        }
      } catch (_) {}
    }

    if (allowAutoRecover) {
      if (!this._lastPnpRestartMap) this._lastPnpRestartMap = new Map();
      const now = Date.now();
      const toRecover = new Set();
      const reconnectPorts = new Set();
      for (const [serial, ports] of offlinePortsBySerial.entries()) {
        const current = seen.get(serial);
        if (!current || current.status !== 'device') {
          toRecover.add(serial);
          ports.forEach(p => reconnectPorts.add(p));
        }
      }
      if (Array.isArray(this.selectedSerials)) {
        for (const sel of this.selectedSerials) {
          const dev = seen.get(sel);
          if (!dev || dev.status !== 'device') {
            const lastRestart = this._lastPnpRestartMap.get(sel) || 0;
            if (now - lastRestart > 45000) {
              toRecover.add(sel);
            }
          }
        }
      }
      if (toRecover.size > 0) {
        try {
          for (const srvP of reconnectPorts) {
            await this.runCommandWithServerPort(srvP, ['reconnect', 'offline']).catch(() => {});
          }
          let restartedAny = false;
          for (const s of toRecover) {
            const instanceId = this._getUsbInstanceIdForSerial(s);
            if (!instanceId) continue;
            const lastRestart = this._lastPnpRestartMap.get(s) || 0;
            if (now - lastRestart <= 45000) continue;
            this._lastPnpRestartMap.set(s, now);
            restartedAny = true;
            await new Promise((res) => {
              execFile('pnputil', ['/restart-device', instanceId], { timeout: 6000 }, () => res());
            });
          }
          if (restartedAny || reconnectPorts.size > 0) {
            await new Promise(r => setTimeout(r, 1500));
            await this._reclaimHijackedPhones().catch(() => false);
            return await this.getDevices(false);
          }
        } catch (_) {}
      }
    }

    return Array.from(seen.values());
  }

  async getForwardList() {
    const forwards = [];
    const seenKey = new Set();
    const activePorts = await this._getActiveAdbServerPorts();
    for (const srvPort of activePorts) {
      try {
        const output = await this.runCommandWithServerPort(srvPort, ['forward', '--list']);
        const lines = output.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            const key = `${srvPort}|${parts[0]}|${parts[1]}|${parts[2]}`;
            if (!seenKey.has(key)) {
              seenKey.add(key);
              forwards.push({
                serial: parts[0],
                local: parts[1],
                remote: parts[2],
                adbServerPort: srvPort
              });
            }
          }
        }
      } catch (_) {}
    }
    return forwards;
  }

  async forwardPort(serial, localPort = 8080, remotePort = 8080) {
    if (!serial) {
      throw new Error('Cần chỉ định Serial của thiết bị');
    }
    const ownerSrvPort = await this._getServerPortForSerial(serial);
    const currentForwards = await this.getForwardList();

    // Chỉ coi là đã forward nếu đúng cổng ADB đang giữ thiết bị (5038 hoặc 5037)
    const alreadyForwarded = currentForwards.some(
      f =>
        f.serial === serial &&
        f.local === `tcp:${localPort}` &&
        f.remote === `tcp:${remotePort}` &&
        (!f.adbServerPort || f.adbServerPort === ownerSrvPort)
    );

    if (!alreadyForwarded) {
      // Gỡ bỏ các forward tcp:<localPort> cũ (kèm -s <serial> để không bị lỗi khi cắm nhiều máy) và các cổng 808x dư của chính thiết bị này
      for (const f of currentForwards) {
        if (
          f.local === `tcp:${localPort}` ||
          (f.serial === serial && f.local !== `tcp:${localPort}` && /^tcp:808\d$/.test(f.local))
        ) {
          await this.runCommandWithServerPort(f.adbServerPort || ownerSrvPort, ['-s', f.serial, 'forward', '--remove', f.local]).catch(() => {});
        }
      }
      const activePorts = await this._getActiveAdbServerPorts();
      for (const srvPort of activePorts) {
        await this.runCommandWithServerPort(srvPort, ['forward', '--remove', `tcp:${localPort}`]).catch(() => {});
      }

      const args = ['-s', serial, 'forward', `tcp:${localPort}`, `tcp:${remotePort}`];
      await this.runCommandWithServerPort(ownerSrvPort, args);
    }

    this._devicePortMap.set(serial, localPort);

    // Kiểm tra nhanh nếu thiết bị vừa được chọn đã mở sẵn App Shopee
    const localUrl = `http://127.0.0.1:${localPort}`;
    try {
      const dbg = await this._queryDebugInfo(localUrl, 1500);
      if (dbg && dbg.sdk_loaded) {
        const prof = this._buildProfileFromDebugInfo(dbg, serial);
        this._cachedProfile = prof;
        this._cachedAt = Date.now();
        this._profileByUrl.set(localUrl, prof);
        return 'OK';
      }
    } catch (_) {}

    // Đánh thức và khởi chạy com.shopee.vn trên đúng thiết bị vừa chọn
    await this._launchShopeeApp(ownerSrvPort, serial);

    return 'OK';
  }

  async _ensurePhoneSessionFiles(srvPort, serial) {
    if (!serial || this._provisionedSerials.has(serial)) return;
    this._provisionedSerials.add(serial);
    try {
      const backupDir = path.join(__dirname, '../database/sp_phone_backup');
      if (!fs.existsSync(path.join(backupDir, 'login.xml'))) return;

      const sizeOut = await this.runCommandWithServerPort(srvPort, [
        '-s', serial, 'shell',
        "PATH=$PATH:/debug_ramdisk:/sbin su -c 'stat -c %s /data/data/com.shopee.vn/shared_prefs/login.xml 2>/dev/null || echo 0'"
      ]).catch(() => '0');
      const loginSize = parseInt(String(sizeOut).trim(), 10) || 0;
      if (loginSize >= 200) return;

      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', 'mkdir -p /data/local/tmp/sp_backup']).catch(() => {});
      for (const fname of ['login.xml', 'userLoginData.xml', 'SPHelper_sp_main.xml', '77334490142e6a39d1d70d047074898488d73e61']) {
        const localFile = path.join(backupDir, fname);
        if (fs.existsSync(localFile)) {
          await this.runCommandWithServerPort(srvPort, ['-s', serial, 'push', localFile, `/data/local/tmp/sp_backup/${fname}`]).catch(() => {});
        }
      }
      const isTiger = String(serial).toUpperCase().startsWith('TIGER');
      const restoreCmd = [
        'am force-stop com.shopee.vn',
        'UID=$(stat -c %u /data/data/com.shopee.vn)',
        'chattr -i /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml 2>/dev/null || true',
        'mkdir -p /data/data/com.shopee.vn/shared_prefs /data/data/com.shopee.vn/files/77334490142e6a39d1d70d047074898488d73e61',
        'cp -f /data/local/tmp/sp_backup/login.xml /data/data/com.shopee.vn/shared_prefs/login.xml',
        'cp -f /data/local/tmp/sp_backup/userLoginData.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml',
        'cp -f /data/local/tmp/sp_backup/SPHelper_sp_main.xml /data/data/com.shopee.vn/shared_prefs/SPHelper_sp_main.xml',
        ...(isTiger
          ? ['cp -f /data/local/tmp/sp_backup/77334490142e6a39d1d70d047074898488d73e61 /data/data/com.shopee.vn/files/77334490142e6a39d1d70d047074898488d73e61/77334490142e6a39d1d70d047074898488d73e61']
          : []),
        'chown -R $UID:$UID /data/data/com.shopee.vn/shared_prefs /data/data/com.shopee.vn/files',
        'chmod 771 /data/data/com.shopee.vn/shared_prefs /data/data/com.shopee.vn/files',
        'chmod 440 /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml',
        'chmod 660 /data/data/com.shopee.vn/shared_prefs/SPHelper_sp_main.xml',
        'restorecon -FR /data/data/com.shopee.vn 2>/dev/null || true',
        'chattr +i /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml 2>/dev/null || true'
      ].join(' && ');
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', `PATH=$PATH:/debug_ramdisk:/sbin su -c '${restoreCmd}'`]).catch(() => {});
      console.log(`🔒 [PhoneSign] Đã tự động nạp và khóa cứng phiên SDK cho thiết bị ${serial}`);
    } catch (_) {}
  }

  async _launchShopeeApp(srvPort, serial) {
    if (this.isExternalDeviceLocked(serial)) {
      return;
    }
    const lastLaunch = this._lastLaunchAt.get(serial) || 0;
    if (Date.now() - lastLaunch < 12000) {
      return;
    }
    const gotLock = await this.acquireCrossProcessLock(serial, 8000);
    if (!gotLock) return;
    this._lastLaunchAt.set(serial, Date.now());
    try {
      await this._ensurePhoneSessionFiles(srvPort, serial);
      // Đảm bảo tắt Magisk Enforce DenyList để Zygisk + LSPosed (SPSign-v2) luôn được nạp vào com.shopee.vn
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', "PATH=$PATH:/debug_ramdisk:/sbin su -c 'PATH=$PATH:/debug_ramdisk:/sbin magisk --denylist disable'"]).catch(() => {});
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']).catch(() => {});
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', 'am', 'force-stop', 'com.shopee.vn']).catch(() => {});
      await this.runCommandWithServerPort(srvPort, [
        '-s', serial,
        'shell', 'am', 'start',
        '-n', 'com.shopee.vn/com.shopee.app.ui.home.HomeActivity_'
      ]).catch(() => {});
    } catch (_) {
    } finally {
      this.releaseCrossProcessLock(serial);
    }
  }

  /**
   * Đồng bộ danh sách các điện thoại được tích chọn:
   * - Máy tích chọn thứ 1 -> Cổng 8080
   * - Máy tích chọn thứ 2 -> Cổng 8081
   * - Máy tích chọn thứ 3 -> Cổng 8082
   * - Máy bỏ tích -> Gỡ forward để ngừng dùng ký số
   */
  async setSelectedDevices(serials = []) {
    const saved = this._saveSelectedSerials(serials);
    const [devices, forwards] = await Promise.all([
      this.getDevices(),
      this.getForwardList()
    ]);
    const onlineSet = new Set(devices.filter(d => d.status === 'device').map(d => d.serial));
    const activeSerials = saved.filter(s => onlineSet.has(s));

    // Gỡ forward của các thiết bị không nằm trong danh sách tích chọn
    for (const f of forwards) {
      if (/^tcp:808\d$/.test(f.local) && !activeSerials.includes(f.serial)) {
        const srvPort = f.adbServerPort || (await this._getServerPortForSerial(f.serial));
        await this.runCommandWithServerPort(srvPort, ['-s', f.serial, 'forward', '--remove', f.local]).catch(() => {});
        this._devicePortMap.delete(f.serial);
      }
    }

    // Gỡ toàn bộ tcp:8080..8089 trước khi gán lại theo đúng thứ tự máy được tích chọn
    const desiredPortBySerial = new Map();
    activeSerials.forEach((s, idx) => {
      desiredPortBySerial.set(s, 8080 + idx);
    });

    // Kiểm tra xem cấu hình cổng hiện tại đã khớp 100% với desiredPortBySerial chưa
    let needsRebind = false;
    for (const [s, desiredPort] of desiredPortBySerial.entries()) {
      const hasExact = forwards.some(f => f.serial === s && f.local === `tcp:${desiredPort}` && f.remote === 'tcp:8080');
      if (!hasExact) {
        needsRebind = true;
        break;
      }
    }

    if (needsRebind) {
      for (const f of forwards) {
        if (/^tcp:808\d$/.test(f.local)) {
          await this.runCommandWithServerPort(f.adbServerPort || this.primaryAdbPort, ['-s', f.serial, 'forward', '--remove', f.local]).catch(() => {});
        }
      }
      const activePorts = await this._getActiveAdbServerPorts();
      for (const srvPort of activePorts) {
        for (let p = 8080; p < 8080 + Math.max(activeSerials.length, 4); p++) {
          await this.runCommandWithServerPort(srvPort, ['forward', '--remove', `tcp:${p}`]).catch(() => {});
        }
      }
    }

    this._devicePortMap.clear();
    for (let i = 0; i < activeSerials.length; i++) {
      const s = activeSerials[i];
      const port = 8080 + i;
      try {
        await this.forwardPort(s, port, 8080);
      } catch (e) {
        console.warn(`[ADB] Lỗi gán cổng ${port} cho ${s}:`, e.message);
      }
    }

    return this.getDevicesWithStatus();
  }

  /**
   * Trả về danh sách chi tiết toàn bộ điện thoại đang kết nối kèm trạng thái tích chọn & trạng thái SDK
   */
  async getDevicesWithStatus() {
    const [devices, forwards] = await Promise.all([
      this.getDevices(),
      this.getForwardList()
    ]);

    const onlineDevices = devices.filter(d => d.status === 'device');
    const onlineSerialSet = new Set(onlineDevices.map(d => d.serial));
    const onlineServerBySerial = new Map(onlineDevices.map(d => [d.serial, d.adbServerPort]));
    const forwardBySerial = new Map();
    const nextPortMap = new Map();
    for (const f of forwards) {
      if (
        /^tcp:808\d$/.test(f.local) &&
        onlineSerialSet.has(f.serial) &&
        (!f.adbServerPort || f.adbServerPort === onlineServerBySerial.get(f.serial))
      ) {
        forwardBySerial.set(f.serial, f.local);
        const portNum = parseInt(f.local.replace('tcp:', ''), 10);
        if (!isNaN(portNum)) {
          nextPortMap.set(f.serial, portNum);
        }
      }
    }

    // Chỉ tự động khởi tạo selectedSerials nếu chưa từng cấu hình (null hoặc mảng rỗng)
    if (!Array.isArray(this.selectedSerials) || this.selectedSerials.length === 0) {
      const diskSerials = this._loadSelectedSerials();
      if (Array.isArray(diskSerials) && diskSerials.length > 0) {
        this.selectedSerials = diskSerials;
      } else if (onlineDevices.length > 0) {
        this._saveSelectedSerials(onlineDevices.map(d => d.serial));
      }
    }

    const selectedSet = new Set(this.selectedSerials || []);

    // Tự động khôi phục ADB Forward (tcp:8080, 8081, 8082...) cố định theo vị trí máy trong danh sách tích chọn
    const selectedList = this.selectedSerials || [];
    for (let i = 0; i < selectedList.length; i++) {
      const s = selectedList[i];
      if (!onlineSerialSet.has(s)) continue;
      const desiredPort = 8080 + i;
      nextPortMap.set(s, desiredPort);
      if (forwardBySerial.get(s) !== `tcp:${desiredPort}`) {
        try {
          await this.forwardPort(s, desiredPort, 8080);
          forwardBySerial.set(s, `tcp:${desiredPort}`);
          nextPortMap.set(s, desiredPort);
          forwards.push({
            serial: s,
            local: `tcp:${desiredPort}`,
            remote: 'tcp:8080',
            adbServerPort: await this._getServerPortForSerial(s)
          });
        } catch (e) {
          console.warn(`[ADB] Không thể tự động khôi phục cổng ${desiredPort} cho ${s}:`, e.message);
        }
      }
    }
    this._devicePortMap = nextPortMap;

    const detailedDevices = await Promise.all(
      devices.map(async (dev) => {
        const localForward = forwardBySerial.get(dev.serial) || null;
        const localPort = localForward ? parseInt(localForward.replace('tcp:', ''), 10) : null;
        const isSelected = selectedSet.has(dev.serial);
        let sdkReady = false;
        let androidId = null;
        let packageName = null;
        let riskTokenLen = 0;

        if (localPort) {
          try {
            const localUrl = `http://127.0.0.1:${localPort}`;
            const dbg = await this._queryDebugInfo(localUrl, 1200);
            if (dbg && dbg.sdk_loaded) {
              sdkReady = true;
              androidId = dbg.android_id || null;
              packageName = dbg.package || 'com.shopee.vn';
              riskTokenLen = dbg.risk_token_len || 0;
              const prof = this._buildProfileFromDebugInfo(dbg, dev.serial);
              this._profileByUrl.set(localUrl, prof);
            }
          } catch (_) {}

          if (!sdkReady && this._inFreshSession && this._cachedProfile) {
            sdkReady = true;
            androidId = this._cachedProfile.androidId || null;
            packageName = this._cachedProfile.packageName || 'com.shopee.vn';
            riskTokenLen = this._cachedProfile.riskTokenLen || 155;
          }

          // Nếu máy đang được tích chọn nhưng App Shopee chưa mở (sdkReady = false) -> tự động mở bằng _launchShopeeApp (throttle 12s/lần)
          if (isSelected && !sdkReady && !this._inFreshSession && dev.status === 'device') {
            const srvPort = dev.adbServerPort || this.primaryAdbPort;
            this._launchShopeeApp(srvPort, dev.serial).catch(() => {});
          }
        }

        return {
          ...dev,
          selected: isSelected,
          localForward,
          localPort,
          sdkReady,
          androidId,
          packageName,
          riskTokenLen
        };
      })
    );

    return {
      devices: detailedDevices,
      forwards,
      selectedSerials: Array.from(selectedSet)
    };
  }

  /**
   * Lấy URL ký số cục bộ tiếp theo (Round-Robin qua tất cả các điện thoại đang được tích chọn)
   */
  getActiveLocalSignUrls() {
    const selected = Array.isArray(this.selectedSerials) ? this.selectedSerials : [];
    const urls = [];
    for (const s of selected) {
      const p = this._devicePortMap.get(s);
      if (p) urls.push(`http://127.0.0.1:${p}`);
    }
    if (urls.length === 0) {
      return ['http://127.0.0.1:8080'];
    }
    return urls;
  }

  getNextLocalSignUrl() {
    const urls = this.getActiveLocalSignUrls();
    const chosen = urls[this._rrIndex % urls.length];
    this._rrIndex = (this._rrIndex + 1) % 1000000;
    return chosen;
  }

  getSelectedCount() {
    const selected = Array.isArray(this.selectedSerials) ? this.selectedSerials : [];
    return Math.max(1, selected.length);
  }

  _buildProfileFromDebugInfo(dbg = {}, serial = null) {
    const resolvedSerial = serial || (Array.isArray(this.selectedSerials) && this.selectedSerials[0]) || DEFAULT_TIGER10_PROFILE.serial;
    const model = String(dbg.model || DEFAULT_TIGER10_PROFILE.model).trim();
    const brand = String(dbg.brand || DEFAULT_TIGER10_PROFILE.brand).trim();
    const sdkInt = String(dbg.sdk_int || DEFAULT_TIGER10_PROFILE.sdkInt).trim();
    const androidId = String(dbg.android_id || DEFAULT_TIGER10_PROFILE.androidId).trim();
    const packageName = String(dbg.package || DEFAULT_TIGER10_PROFILE.packageName).trim();
    const pkgVer = this._pkgVersionCache[packageName] || this._pkgVersionCache['com.shopee.vn'];
    const appVersion = pkgVer.code;
    const appVersionName = pkgVer.name;
    const deviceModelInfo = `Brand/${brand} Model/${model} OSVer/${sdkInt} Manufacturer/${brand}`;
    const liveDeviceModel = `${brand.toLowerCase()}+${model.toLowerCase().replace(/\s+/g, '+')}`;
    const clientInfo = `device_id=${androidId};device_model=${model};os=0;os_version=${sdkInt};client_version=${appVersion};network=1;platform=1;rn_version=6.97.5;api_source=na;cpu_model=;live_device_model=${liveDeviceModel}`;
    const userAgent = `okhttp/3.12.4 app_type=1 platform=native_android os_ver=${sdkInt} appver=${appVersion}`;
    const cronetUserAgent = `${userAgent} Cronet/102.0.5005.61`;

    return {
      serial: resolvedSerial,
      model,
      brand,
      sdkInt,
      androidId,
      packageName,
      appVersion,
      appVersionName,
      deviceModelInfo,
      liveDeviceModel,
      clientInfo,
      userAgent,
      cronetUserAgent,
      sdkLoaded: !!dbg.sdk_loaded,
      riskTokenLen: dbg.risk_token_len || 0
    };
  }

  async _queryDebugInfo(baseUrl, timeoutMs = 2500) {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/debug_info`;
    const res = await axios.get(url, { timeout: timeoutMs, httpAgent: noKeepAliveAgent });
    if (res.data && res.data.code === 0) {
      return res.data;
    }
    return null;
  }

  getNoKeepAliveAgent() {
    return noKeepAliveAgent;
  }

  _isLoopbackGatewayUrl(targetUrl) {
    try {
      const parsed = new URL(String(targetUrl || '').trim());
      const host = (parsed.hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
      return host === '127.0.0.1' || host === 'localhost' || host === '::1';
    } catch (_) {
      return false;
    }
  }

  /**
   * Chọn HTTP/HTTPS agent: tắt keepAlive cho ADB forward loopback (tránh socket treo khi am force-stop),
   * bật keepAlive cho Node Gateway qua LAN/Tailscale/DERP để tái sử dụng TCP connection.
   */
  getAxiosGatewayAgents(targetUrl) {
    const raw = String(targetUrl || '').trim().toLowerCase();
    if (raw.startsWith('https://')) {
      return { httpsAgent: httpsGatewayKeepAliveAgent };
    }
    if (this._isLoopbackGatewayUrl(targetUrl)) {
      return { httpAgent: noKeepAliveAgent };
    }
    return { httpAgent: gatewayKeepAliveAgent };
  }

  getGatewayHttpAgent(targetUrl) {
    if (this._isLoopbackGatewayUrl(targetUrl)) {
      return noKeepAliveAgent;
    }
    return gatewayKeepAliveAgent;
  }

  async selectSigningDevice(preferredSerial = null, port = 8080) {
    const [devices, forwards] = await Promise.all([
      this.getDevices(),
      this.getForwardList()
    ]);
    const onlineDevices = devices.filter(d => d.status === 'device');
    if (onlineDevices.length === 0) return null;

    if (preferredSerial) {
      const found = onlineDevices.find(d => d.serial === preferredSerial);
      if (found) return found.serial;
    }

    // Ưu tiên tuyệt đối thiết bị được gán cho cổng `port` (8080 -> máy 1, 8081 -> máy 2, 8082 -> máy 3)
    for (const [s, p] of this._devicePortMap.entries()) {
      if (p === port) {
        const found = onlineDevices.find(d => d.serial === s);
        if (found) return found.serial;
      }
    }

    if (Array.isArray(this.selectedSerials) && this.selectedSerials.length > 0) {
      const portIdx = Math.max(0, port - 8080);
      const expectedSerial = this.selectedSerials[portIdx];
      if (expectedSerial) {
        const found = onlineDevices.find(d => d.serial === expectedSerial);
        if (found) return found.serial;
      }
    }

    const activeForward = forwards.find(f => f.local === `tcp:${port}`);
    if (activeForward) {
      const found = onlineDevices.find(d => d.serial === activeForward.serial);
      if (found) return found.serial;
    }

    if (Array.isArray(this.selectedSerials) && this.selectedSerials.length > 0) {
      const foundSelected = onlineDevices.find(d => this.selectedSerials.includes(d.serial));
      if (foundSelected) return foundSelected.serial;
    }

    const tigerExact = onlineDevices.find(d => d.serial === 'TIGER10VN0000859');
    if (tigerExact) return tigerExact.serial;

    const tigerModel = onlineDevices.find(d => (d.model || '').toUpperCase().includes('TIGER'));
    if (tigerModel) return tigerModel.serial;

    return onlineDevices[0].serial;
  }

  async ensurePhoneSignReady(phoneSignUrl = 'http://127.0.0.1:8080', preferredSerial = null) {
    if (this._inFreshSession) {
      return { ready: true, profile: this._cachedProfile || DEFAULT_TIGER10_PROFILE };
    }
    if (this._ensurePromise) {
      return this._ensurePromise;
    }
    this._ensurePromise = this._doEnsurePhoneSignReady(phoneSignUrl, preferredSerial).finally(() => {
      this._ensurePromise = null;
    });
    return this._ensurePromise;
  }

  _isSelfHost(hostname) {
    if (!hostname) return true;
    const h = String(hostname).toLowerCase();
    if (h === '127.0.0.1' || h === 'localhost' || h === '::1') return true;
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.address && net.address.toLowerCase() === h) return true;
      }
    }
    return false;
  }

  async _doEnsurePhoneSignReady(phoneSignUrl = 'http://127.0.0.1:8080', preferredSerial = null) {
    let baseUrl = (phoneSignUrl || 'http://127.0.0.1:8080').trim().replace(/\/+$/, '');
    let port = 8080;
    try {
      const parsed = new URL(baseUrl);
      if (parsed.port) port = parseInt(parsed.port, 10) || 8080;
      if (this._isSelfHost(parsed.hostname)) {
        baseUrl = `http://127.0.0.1:${port}`;
      }
    } catch (_) {}

    // 1. Fast path: check if SPSign-v2 is already responding on baseUrl
    try {
      const dbg = await this._queryDebugInfo(baseUrl, 3500);
      if (dbg && dbg.sdk_loaded) {
        const profile = this._buildProfileFromDebugInfo(dbg, this.getSerialForUrl(baseUrl));
        this._cachedProfile = profile;
        this._cachedAt = Date.now();
        this._profileByUrl.set(baseUrl, profile);
        return { ready: true, profile, debugInfo: dbg };
      }
    } catch (_) {}

    // 2. Find target USB device & ensure ADB port forward
    const targetSerial = await this.selectSigningDevice(preferredSerial, port);
    if (!targetSerial) {
      this._cachedProfile = this._cachedProfile || DEFAULT_TIGER10_PROFILE;
      this._cachedAt = Date.now();
      return {
        ready: false,
        profile: this._cachedProfile,
        error: 'Không tìm thấy thiết bị Android nào đang kết nối ADB'
      };
    }

    const localUrl = `http://127.0.0.1:${port}`;

    try {
      await this.forwardPort(targetSerial, port, 8080);
    } catch (e) {
      console.warn(`[ADB] Lỗi forward tcp:${port} cho ${targetSerial}:`, e.message);
    }

    // 3. Re-test after port forward in case Shopee was already running
    try {
      const dbg = await this._queryDebugInfo(localUrl, 2000);
      if (dbg && dbg.sdk_loaded) {
        const profile = this._buildProfileFromDebugInfo(dbg, targetSerial);
        this._cachedProfile = profile;
        this._cachedAt = Date.now();
        this._profileByUrl.set(localUrl, profile);
        return { ready: true, profile, debugInfo: dbg };
      }
    } catch (_) {}

    // 4. Wake device & launch Shopee so SPSign-v2 XposedSignServer starts on port 8080
    try {
      const ownerSrvPort = await this._getServerPortForSerial(targetSerial);
      await this._launchShopeeApp(ownerSrvPort, targetSerial);
    } catch (e) {
      console.warn(`[ADB] Không thể tự mở com.shopee.vn trên ${targetSerial}:`, e.message);
    }

    // 5. Wait and poll /api/debug_info until SHPSSDK is loaded
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const dbg = await this._queryDebugInfo(localUrl, 2500);
        if (dbg && dbg.sdk_loaded) {
          const profile = this._buildProfileFromDebugInfo(dbg, targetSerial);
          this._cachedProfile = profile;
          this._cachedAt = Date.now();
          this._profileByUrl.set(localUrl, profile);
          console.log(`📱 [PhoneSign] Đã tự động kích hoạt SPSign-v2 trên ${profile.brand} ${profile.model} (${targetSerial}, Android ${profile.sdkInt}, ID: ${profile.androidId})`);
          return { ready: true, profile, debugInfo: dbg };
        }
      } catch (_) {}
    }

    return {
      ready: false,
      profile: this._cachedProfile || DEFAULT_TIGER10_PROFILE,
      error: `Đã mở Shopee trên ${targetSerial} nhưng cổng ${port} chưa phản hồi`
    };
  }

  isSessionFreshForUser(userId = null, maxAgeMs = 8000, phoneUrl = null) {
    const s = (phoneUrl && this._lastFreshSessionByUrl.get(phoneUrl)) || this._lastFreshSession;
    if (!s || !s.clean) return false;
    if (Date.now() - s.startedAt > maxAgeMs) return false;
    if (s.userId && userId && s.userId !== userId) return false;
    return true;
  }

  markSessionUsed(userId = null, stillCleanForCreatePost = false, phoneUrl = null) {
    if (phoneUrl && this._lastFreshSessionByUrl.has(phoneUrl)) {
      const sUrl = this._lastFreshSessionByUrl.get(phoneUrl);
      if (userId) sUrl.userId = userId;
      sUrl.clean = !!stillCleanForCreatePost;
    }
    if (this._lastFreshSession) {
      if (userId) this._lastFreshSession.userId = userId;
      this._lastFreshSession.clean = !!stillCleanForCreatePost;
    }
  }

  getSerialForUrl(phoneUrl = null) {
    if (!phoneUrl) return null;
    let port = 8080;
    try {
      const parsed = new URL(phoneUrl.trim());
      if (parsed.port) port = parseInt(parsed.port, 10) || 8080;
    } catch (_) {}
    for (const [s, p] of this._devicePortMap.entries()) {
      if (p === port) return s;
    }
    const portIdx = Math.max(0, port - 8080);
    if (Array.isArray(this.selectedSerials) && this.selectedSerials[portIdx]) {
      return this.selectedSerials[portIdx];
    }
    return null;
  }

  getDeviceGroupForUrl(phoneUrl = null) {
    const serial = String(this.getSerialForUrl(phoneUrl) || '').toUpperCase();
    if (serial.startsWith('TIGER')) {
      return 'TIGER';
    }
    if (serial) {
      return `SAMSUNG_${serial}`;
    }
    const prof = this._profileByUrl.get(phoneUrl);
    if (prof) {
      const brandUpper = String(prof.brand || '').toUpperCase();
      const modelUpper = String(prof.model || '').toUpperCase();
      if (brandUpper.includes('OSCAL') || modelUpper.includes('TIGER')) {
        return 'TIGER';
      }
      return `SAMSUNG_${modelUpper || 'DEFAULT'}`;
    }
    return 'TIGER';
  }

  getProfileForUrl(phoneUrl = null) {
    if (phoneUrl && this._profileByUrl.has(phoneUrl)) {
      return this._profileByUrl.get(phoneUrl);
    }
    const serial = this.getSerialForUrl(phoneUrl);
    if (serial) {
      for (const [, prof] of this._profileByUrl.entries()) {
        if (prof && prof.serial === serial) return prof;
      }
    }
    return this._cachedProfile || DEFAULT_TIGER10_PROFILE;
  }

  async restartShopeeAppForSign(phoneSignUrl = 'http://127.0.0.1:8080', preferredSerial = null, userId = null) {
    this._inFreshSession = true;
    try {
      let port = 8080;
      try {
        const parsed = new URL((phoneSignUrl || 'http://127.0.0.1:8080').trim());
        if (parsed.port) port = parseInt(parsed.port, 10) || 8080;
      } catch (_) {}

      if (!this._lastSessionFileCheckMap) this._lastSessionFileCheckMap = new Map();
      let targetSerial = preferredSerial;
      if (!targetSerial) {
        for (const [s, p] of this._devicePortMap.entries()) {
          if (p === port) {
            targetSerial = s;
            break;
          }
        }
      }

      const now = Date.now();
      if (!targetSerial || !this._lastTopologyCheckAt || (now - this._lastTopologyCheckAt) > 60000) {
        const onlineDevs = (await this.getDevices().catch(() => [])).filter(d => d.status === 'device');
        if (onlineDevs.length === 0) {
          return {
            ready: true,
            remote: true,
            profile: this._cachedProfile || DEFAULT_TIGER10_PROFILE
          };
        }
        this._lastTopologyCheckAt = now;
        const portIdx = Math.max(0, port - 8080);
        const expectedSerialByPort = Array.isArray(this.selectedSerials) ? this.selectedSerials[portIdx] : null;
        targetSerial = preferredSerial
          || (expectedSerialByPort && onlineDevs.some(d => d.serial === expectedSerialByPort) && expectedSerialByPort)
          || (targetSerial && onlineDevs.some(d => d.serial === targetSerial) && targetSerial)
          || (Array.isArray(this.selectedSerials) && onlineDevs.some(d => d.serial === this.selectedSerials[0]) && this.selectedSerials[0])
          || (onlineDevs.find(d => d.serial === DEFAULT_TIGER10_PROFILE.serial)?.serial)
          || onlineDevs[0].serial;

        const targetIdx = Array.isArray(this.selectedSerials) ? this.selectedSerials.indexOf(targetSerial) : -1;
        const localPortCheck = (targetIdx >= 0 ? 8080 + targetIdx : null) || this._devicePortMap.get(targetSerial) || port || 8080;
        const srvPortCheck = this._serialPortMap.get(targetSerial) || this.primaryAdbPort;
        try {
          const fwds = await this.getForwardList();
          const hasFwd = fwds.some(
            f =>
              f.serial === targetSerial &&
              f.local === `tcp:${localPortCheck}` &&
              f.remote === 'tcp:8080' &&
              (!f.adbServerPort || f.adbServerPort === srvPortCheck)
          );
          if (!hasFwd) {
            await this.runCommandWithServerPort(srvPortCheck, ['-s', targetSerial, 'forward', `tcp:${localPortCheck}`, 'tcp:8080']).catch(() => {});
            this._devicePortMap.set(targetSerial, localPortCheck);
          }
        } catch (_) {}
      }

      const targetIdxFinal = Array.isArray(this.selectedSerials) ? this.selectedSerials.indexOf(targetSerial) : -1;
      const localPort = (targetIdxFinal >= 0 ? 8080 + targetIdxFinal : null) || this._devicePortMap.get(targetSerial) || port || 8080;
      const localUrl = `http://127.0.0.1:${localPort}`;
      let srvPort = this._serialPortMap.get(targetSerial) || this.primaryAdbPort;

      const extLockOk = await this.acquireCrossProcessLock(targetSerial, 65000);
      try {
        this._lastLaunchAt.set(targetSerial, Date.now());
        try {
          const lastCheck = this._lastSessionFileCheckMap.get(targetSerial) || 0;
          if (Date.now() - lastCheck > 300000) {
            await this._ensurePhoneSessionFiles(srvPort, targetSerial);
            this._lastSessionFileCheckMap.set(targetSerial, Date.now());
          }
          try {
            await this.runCommandWithServerPort(srvPort, [
              '-s', targetSerial,
              'shell',
              'am force-stop com.shopee.vn && am start -n com.shopee.vn/com.shopee.app.ui.home.HomeActivity_'
            ]);
          } catch (_) {
            // Nếu thiết bị vừa đổi chủ giữa 5038 <-> 5037 trong cửa sổ cache 60s, quét lại & forward sang cổng mới
            this._lastTopologyCheckAt = 0;
            await this.getDevices(false).catch(() => []);
            const refreshedSrvPort = this._serialPortMap.get(targetSerial);
            if (refreshedSrvPort && refreshedSrvPort !== srvPort) {
              srvPort = refreshedSrvPort;
              await this.runCommandWithServerPort(srvPort, ['-s', targetSerial, 'forward', `tcp:${localPort}`, 'tcp:8080']).catch(() => {});
              await this.runCommandWithServerPort(srvPort, [
                '-s', targetSerial,
                'shell',
                'am force-stop com.shopee.vn && am start -n com.shopee.vn/com.shopee.app.ui.home.HomeActivity_'
              ]);
            }
          }
        } catch (_) {}

        const startWait = Date.now();
        while (Date.now() - startWait < 10000) {
          await new Promise(r => setTimeout(r, 120));
          try {
            const dbg = await this._queryDebugInfo(localUrl, 1000);
            if (dbg && dbg.sdk_loaded && (dbg.risk_token_len || 0) >= 50) {
              const profile = this._buildProfileFromDebugInfo(dbg, targetSerial);
              this._cachedProfile = profile;
              this._cachedAt = Date.now();
              this._profileByUrl.set(localUrl, profile);
              const sessionObj = {
                startedAt: Date.now(),
                userId: userId || null,
                clean: true
              };
              this._lastFreshSession = sessionObj;
              this._lastFreshSessionByUrl.set(localUrl, sessionObj);
              return { ready: true, serial: targetSerial, localUrl, profile, debugInfo: dbg };
            }
          } catch (_) {}
        }

        return {
          ready: false,
          serial: targetSerial,
          localUrl,
          profile: this.getProfileForUrl(localUrl)
        };
      } finally {
        if (extLockOk) {
          this.releaseCrossProcessLock(targetSerial);
        }
      }
    } finally {
      this._inFreshSession = false;
    }
  }

  _getGatewayOrigin(phoneSignUrl) {
    if (!phoneSignUrl || typeof phoneSignUrl !== 'string') return null;
    try {
      const parsed = new URL(phoneSignUrl.trim());
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Truy vấn số thiết bị đang hoạt động trên Gateway từ xa (/api/routing_stats) có cache 60s
   * để máy trạm tự động mở rộng maxSignConcurrent tương ứng số điện thoại thực tế.
   */
  async _getRemoteGatewayInfo(phoneSignUrl) {
    const origin = this._getGatewayOrigin(phoneSignUrl);
    if (!origin || this._isLoopbackGatewayUrl(origin)) {
      return { count: 0, isNodeGateway: false };
    }

    const now = Date.now();
    const cached = this._remotePhoneCountByOrigin.get(origin);
    if (cached && now - cached.fetchedAt < 60000) {
      return { count: cached.count, isNodeGateway: !!cached.isNodeGateway };
    }
    if (cached && cached.inFlight) {
      return cached.count > 0 || cached.fetchedAt > 0
        ? { count: cached.count, isNodeGateway: !!cached.isNodeGateway }
        : cached.inFlight;
    }

    const fetchPromise = (async () => {
      try {
        const reqOpts = {
          timeout: 1500,
          validateStatus: s => s >= 200 && s < 500,
          ...this.getAxiosGatewayAgents(origin)
        };
        const res = await axios.get(`${origin}/api/routing_stats`, reqOpts);
        const isNodeGateway = res?.data?.code === 0 && Array.isArray(res?.data?.activeUrls);
        const count = isNodeGateway ? res.data.activeUrls.length : 0;
        const info = { count, isNodeGateway };
        this._remotePhoneCountByOrigin.set(origin, { ...info, fetchedAt: Date.now(), inFlight: null });
        return info;
      } catch (_) {
        const fallbackInfo = {
          count: cached ? cached.count : 0,
          isNodeGateway: cached ? !!cached.isNodeGateway : false
        };
        // Cache kết quả lỗi ngắn 30s để tránh nghẽn mỗi bài khi Gateway tạm thời không phản hồi
        this._remotePhoneCountByOrigin.set(origin, { ...fallbackInfo, fetchedAt: Date.now() - 30000, inFlight: null });
        return fallbackInfo;
      }
    })();

    this._remotePhoneCountByOrigin.set(origin, {
      count: cached ? cached.count : 0,
      isNodeGateway: cached ? !!cached.isNodeGateway : false,
      fetchedAt: cached ? cached.fetchedAt : 0,
      inFlight: fetchPromise
    });

    // Nếu đã có cache cũ, làm mới nền không làm chậm luồng đang chạy
    if (cached && (cached.count > 0 || cached.fetchedAt > 0)) {
      return { count: cached.count, isNodeGateway: !!cached.isNodeGateway };
    }
    return await fetchPromise;
  }

  async _getRemotePhoneCount(phoneSignUrl) {
    const info = await this._getRemoteGatewayInfo(phoneSignUrl);
    return info.count;
  }

  async isNodeGateway(phoneSignUrl) {
    const info = await this._getRemoteGatewayInfo(phoneSignUrl);
    return !!info.isNodeGateway;
  }

  /**
   * Tính giới hạn đồng thời phía client cho pha ký (/precheck + /createpost).
   * Trên máy trạm (không cắm USB trực tiếp), mở rộng trần từ 15 lên tối thiểu 48 (hoặc 12 * số phone Gateway).
   */
  async _resolveMaxSignConcurrent(phoneSignUrl) {
    const envOverride = parseInt(process.env.MAX_SIGN_CONCURRENT || '', 10);
    if (Number.isFinite(envOverride) && envOverride > 0) {
      return envOverride;
    }

    const localCount = Array.isArray(this.selectedSerials) ? this.selectedSerials.length : 0;
    if (localCount > 0) {
      return Math.min(120, Math.max(15, localCount * 10));
    }

    const remoteCount = await this._getRemotePhoneCount(phoneSignUrl);
    const maxConcurrent = Math.min(120, Math.max(48, remoteCount * 12));
    const origin = this._getGatewayOrigin(phoneSignUrl) || 'remote';
    const logKey = `${origin}:${maxConcurrent}`;
    if (!this._loggedRemoteMaxSign.has(logKey)) {
      this._loggedRemoteMaxSign.add(logKey);
      console.log(`🌐 [PhoneSign] Chế độ máy trạm (${origin}, Gateway=${remoteCount || 'auto'} máy) -> mở rộng maxSignConcurrent = ${maxConcurrent}`);
    }
    return maxConcurrent;
  }

  async withFreshPhoneSession(phoneSignUrl, fn) {
    if (!this._signActiveCount) this._signActiveCount = 0;
    if (!this._signWaitQueue) this._signWaitQueue = [];
    const maxSignConcurrent = await this._resolveMaxSignConcurrent(phoneSignUrl);

    while (this._signActiveCount >= maxSignConcurrent) {
      await new Promise(resolve => this._signWaitQueue.push(resolve));
    }
    this._signActiveCount++;
    try {
      return await fn();
    } finally {
      this._signActiveCount--;
      if (this._signWaitQueue.length > 0) {
        const next = this._signWaitQueue.shift();
        next();
      }
    }
  }

  async getPhoneDeviceProfile() {
    return this._cachedProfile || DEFAULT_TIGER10_PROFILE;
  }

  getDefaultProfile() {
    return this._cachedProfile || DEFAULT_TIGER10_PROFILE;
  }
}

module.exports = new AdbService();
