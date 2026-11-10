const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const axios = require('axios');

const noKeepAliveAgent = new http.Agent({ keepAlive: false });
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
    this._cachedProfile = null;
    this._cachedAt = 0;
    this._pkgVersionCache = {
      'com.shopee.vn': { code: '36448', name: '3.64.48' },
      'com.shopee.ph': { code: '38528', name: '3.85.28' }
    };
    this._ensurePromise = null;
    // Quét cả cổng ADB 5038 và 5037 để nhận đủ toàn bộ máy TIGER 10 kể cả khi tool khác mở cổng 5037
    this.adbServerPorts = ['5038', '5037'];
    this._serialPortMap = new Map();
    this._devicePortMap = new Map(); // serial -> localPort (8080, 8081, 8082...)
    this._lastLaunchAt = new Map(); // serial -> timestamp
    this._rrIndex = 0;
    this._postSessionQueue = Promise.resolve();
    this._activeFreshCount = 0;
    this._freshSessionSerials = new Set();
    this._lastFreshSession = { startedAt: 0, userId: null, clean: false };
    this._provisionedSerials = new Set();
    this.selectedSerials = this._loadSelectedSerials();
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

  runCommand(args) {
    return new Promise((resolve, reject) => {
      execFile(this.adbPath, args, { encoding: 'utf-8', timeout: 15000 }, (err, stdout, stderr) => {
        if (err && !stdout) {
          return reject(new Error((stderr || '').trim() || err.message));
        }
        resolve((stdout || '').trim());
      });
    });
  }

  runCommandWithServerPort(serverPort, args) {
    const fullArgs = serverPort ? ['-P', String(serverPort), ...args] : args;
    return this.runCommand(fullArgs);
  }

  async _getServerPortForSerial(serial) {
    if (serial && this._serialPortMap.has(serial)) {
      return this._serialPortMap.get(serial);
    }
    await this.getDevices();
    return (serial && this._serialPortMap.get(serial)) || '5038';
  }

  async getDevices(allowAutoRecover = true) {
    const seen = new Map();
    const offlineSerials = [];
    for (const srvPort of this.adbServerPorts) {
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
              offlineSerials.push(serial);
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
      const toRecover = new Set(offlineSerials);
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
          for (const srvP of this.adbServerPorts) {
            await this.runCommandWithServerPort(srvP, ['reconnect', 'offline']).catch(() => {});
          }
          for (const s of toRecover) {
            if (s.startsWith('TIGER10')) {
              this._lastPnpRestartMap.set(s, now);
              await new Promise((res) => {
                execFile('pnputil', ['/restart-device', `USB\\VID_1782&PID_4003\\${s}`], { timeout: 6000 }, () => res());
              });
            }
          }
          await new Promise(r => setTimeout(r, 1500));
          return await this.getDevices(false);
        } catch (_) {}
      }
    }

    return Array.from(seen.values());
  }

  async getForwardList() {
    const forwards = [];
    const seenKey = new Set();
    for (const srvPort of this.adbServerPorts) {
      try {
        const output = await this.runCommandWithServerPort(srvPort, ['forward', '--list']);
        const lines = output.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            const key = `${parts[0]}|${parts[1]}|${parts[2]}`;
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

    // Nếu thiết bị này đã được forward sẵn đúng cổng localPort -> remotePort thì chỉ kiểm tra mở App
    const alreadyForwarded = currentForwards.some(
      f => f.serial === serial && f.local === `tcp:${localPort}` && f.remote === `tcp:${remotePort}`
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
      for (const srvPort of this.adbServerPorts) {
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
        this._cachedProfile = this._buildProfileFromDebugInfo(dbg, serial);
        this._cachedAt = Date.now();
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
        "su -c 'stat -c %s /data/data/com.shopee.vn/shared_prefs/login.xml 2>/dev/null || echo 0'"
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
      const restoreCmd = [
        'am force-stop com.shopee.vn',
        'UID=$(stat -c %u /data/data/com.shopee.vn)',
        'chattr -i /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml 2>/dev/null || true',
        'cp -f /data/local/tmp/sp_backup/login.xml /data/data/com.shopee.vn/shared_prefs/login.xml',
        'cp -f /data/local/tmp/sp_backup/userLoginData.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml',
        'cp -f /data/local/tmp/sp_backup/SPHelper_sp_main.xml /data/data/com.shopee.vn/shared_prefs/SPHelper_sp_main.xml',
        'mkdir -p /data/data/com.shopee.vn/files/77334490142e6a39d1d70d047074898488d73e61',
        'cp -f /data/local/tmp/sp_backup/77334490142e6a39d1d70d047074898488d73e61 /data/data/com.shopee.vn/files/77334490142e6a39d1d70d047074898488d73e61/77334490142e6a39d1d70d047074898488d73e61',
        'chown $UID:$UID /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml /data/data/com.shopee.vn/shared_prefs/SPHelper_sp_main.xml',
        'chown -R $UID:$UID /data/data/com.shopee.vn/files/77334490142e6a39d1d70d047074898488d73e61',
        'chmod 440 /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml',
        'chmod 660 /data/data/com.shopee.vn/shared_prefs/SPHelper_sp_main.xml',
        'chattr +i /data/data/com.shopee.vn/shared_prefs/login.xml /data/data/com.shopee.vn/shared_prefs/userLoginData.xml 2>/dev/null || true'
      ].join(' && ');
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', `su -c '${restoreCmd}'`]).catch(() => {});
      console.log(`🔒 [PhoneSign] Đã tự động nạp và khóa cứng phiên SDK cho thiết bị ${serial}`);
    } catch (_) {}
  }

  async _launchShopeeApp(srvPort, serial) {
    const lastLaunch = this._lastLaunchAt.get(serial) || 0;
    if (Date.now() - lastLaunch < 12000) {
      return;
    }
    this._lastLaunchAt.set(serial, Date.now());
    try {
      await this._ensurePhoneSessionFiles(srvPort, serial);
      // Đảm bảo tắt Magisk Enforce DenyList để Zygisk + LSPosed (SPSign-v2) luôn được nạp vào com.shopee.vn
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', "su -c 'magisk --denylist disable'"]).catch(() => {});
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']).catch(() => {});
      await this.runCommandWithServerPort(srvPort, ['-s', serial, 'shell', 'am', 'force-stop', 'com.shopee.vn']).catch(() => {});
      await this.runCommandWithServerPort(srvPort, [
        '-s', serial,
        'shell', 'am', 'start',
        '-n', 'com.shopee.vn/com.shopee.app.ui.home.HomeActivity_'
      ]).catch(() => {});
    } catch (_) {}
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
          await this.runCommandWithServerPort(f.adbServerPort || '5038', ['-s', f.serial, 'forward', '--remove', f.local]).catch(() => {});
        }
      }
      for (const srvPort of this.adbServerPorts) {
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
    const forwardBySerial = new Map();
    this._devicePortMap.clear();
    for (const f of forwards) {
      if (/^tcp:808\d$/.test(f.local) && onlineSerialSet.has(f.serial)) {
        forwardBySerial.set(f.serial, f.local);
        const portNum = parseInt(f.local.replace('tcp:', ''), 10);
        if (!isNaN(portNum)) {
          this._devicePortMap.set(f.serial, portNum);
        }
      }
    }

    // Nếu chưa lưu selectedSerials lần nào, hoặc không có máy nào đang cắm khớp với danh sách cũ -> tự chọn máy đang cắm
    const hasOnlineSelected = Array.isArray(this.selectedSerials) && onlineDevices.some(d => this.selectedSerials.includes(d.serial));
    if (this.selectedSerials === null || (!hasOnlineSelected && onlineDevices.length > 0)) {
      const initiallyForwarded = onlineDevices
        .filter(d => forwardBySerial.has(d.serial))
        .map(d => d.serial);
      if (initiallyForwarded.length > 0) {
        this._saveSelectedSerials(initiallyForwarded);
      } else if (onlineDevices.length > 0) {
        this._saveSelectedSerials([onlineDevices[0].serial]);
      } else if (this.selectedSerials === null) {
        this._saveSelectedSerials([]);
      }
    }

    const selectedSet = new Set(this.selectedSerials || []);

    // Tự động khôi phục ADB Forward (tcp:8080, 8081, 8082...) cố định theo vị trí máy trong danh sách tích chọn
    const selectedList = this.selectedSerials || [];
    for (let i = 0; i < selectedList.length; i++) {
      const s = selectedList[i];
      if (!onlineSerialSet.has(s)) continue;
      const desiredPort = 8080 + i;
      this._devicePortMap.set(s, desiredPort);
      if (forwardBySerial.get(s) !== `tcp:${desiredPort}`) {
        try {
          await this.forwardPort(s, desiredPort, 8080);
          forwardBySerial.set(s, `tcp:${desiredPort}`);
          this._devicePortMap.set(s, desiredPort);
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
            const dbg = await this._queryDebugInfo(`http://127.0.0.1:${localPort}`, 1200);
            if (dbg && dbg.sdk_loaded) {
              sdkReady = true;
              androidId = dbg.android_id || null;
              packageName = dbg.package || 'com.shopee.vn';
              riskTokenLen = dbg.risk_token_len || 0;
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
            const srvPort = dev.adbServerPort || '5038';
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
        const profile = this._buildProfileFromDebugInfo(dbg);
        this._cachedProfile = profile;
        this._cachedAt = Date.now();
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

  isSessionFreshForUser(userId = null, maxAgeMs = 8000) {
    const s = this._lastFreshSession;
    if (!s || !s.clean) return false;
    if (Date.now() - s.startedAt > maxAgeMs) return false;
    if (s.userId && userId && s.userId !== userId) return false;
    return true;
  }

  markSessionUsed(userId = null, stillCleanForCreatePost = false) {
    if (this._lastFreshSession) {
      if (userId) this._lastFreshSession.userId = userId;
      this._lastFreshSession.clean = !!stillCleanForCreatePost;
    }
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
          || (targetSerial && onlineDevs.some(d => d.serial === targetSerial) && targetSerial)
          || (expectedSerialByPort && onlineDevs.some(d => d.serial === expectedSerialByPort) && expectedSerialByPort)
          || (Array.isArray(this.selectedSerials) && onlineDevs.some(d => d.serial === this.selectedSerials[0]) && this.selectedSerials[0])
          || (onlineDevs.find(d => d.serial === DEFAULT_TIGER10_PROFILE.serial)?.serial)
          || onlineDevs[0].serial;

        const localPortCheck = this._devicePortMap.get(targetSerial) || port || 8080;
        const srvPortCheck = this._serialPortMap.get(targetSerial) || '5038';
        try {
          const fwds = await this.getForwardList();
          const hasFwd = fwds.some(f => f.serial === targetSerial && f.local === `tcp:${localPortCheck}` && f.remote === 'tcp:8080');
          if (!hasFwd) {
            await this.runCommandWithServerPort(srvPortCheck, ['-s', targetSerial, 'forward', `tcp:${localPortCheck}`, 'tcp:8080']).catch(() => {});
            this._devicePortMap.set(targetSerial, localPortCheck);
          }
        } catch (_) {}
      }

      const localPort = this._devicePortMap.get(targetSerial) || port || 8080;
      const localUrl = `http://127.0.0.1:${localPort}`;
      const srvPort = this._serialPortMap.get(targetSerial) || '5038';

      this._lastLaunchAt.set(targetSerial, Date.now());
      try {
        const lastCheck = this._lastSessionFileCheckMap.get(targetSerial) || 0;
        if (Date.now() - lastCheck > 300000) {
          await this._ensurePhoneSessionFiles(srvPort, targetSerial);
          this._lastSessionFileCheckMap.set(targetSerial, Date.now());
        }
        await this.runCommandWithServerPort(srvPort, [
          '-s', targetSerial,
          'shell',
          'am force-stop com.shopee.vn && am start -n com.shopee.vn/com.shopee.app.ui.home.HomeActivity_'
        ]);
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
            this._lastFreshSession = {
              startedAt: Date.now(),
              userId: userId || null,
              clean: true
            };
            return { ready: true, serial: targetSerial, localUrl, profile, debugInfo: dbg };
          }
        } catch (_) {}
      }

      return {
        ready: false,
        serial: targetSerial,
        localUrl,
        profile: this._cachedProfile || DEFAULT_TIGER10_PROFILE
      };
    } finally {
      this._inFreshSession = false;
    }
  }

  withFreshPhoneSession(phoneSignUrl, fn) {
    return fn();
  }

  async getPhoneDeviceProfile() {
    return this._cachedProfile || DEFAULT_TIGER10_PROFILE;
  }

  getDefaultProfile() {
    return this._cachedProfile || DEFAULT_TIGER10_PROFILE;
  }
}

module.exports = new AdbService();
