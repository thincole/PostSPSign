require('./utils/logger');
const a0_0x1a1224 = a0_0x2846;
((function(_0x3b040d, _0x1f4501) {
    const _0x35a6dc = a0_0x2846,
      _0x2be217 = _0x3b040d();
    while (!![]) {
      try {
        const _0x5803b7 =
          parseInt('862352PoPYhr') / 0x1 +
          -parseInt('1362280QbrPpI') / 0x2 +
          (-parseInt('939KzzFBo') / 0x3) *
          (-parseInt('12028BgTMpU') / 0x4) +
          -parseInt('2533670zogwMT') / 0x5 +
          -parseInt('2589510DeOSdK') / 0x6 +
          -parseInt('514619wVIJwL') / 0x7 +
          (-parseInt('30112qLaWTS') / 0x8) *
          (-parseInt('963dGuQUM') / 0x9);
        if (_0x5803b7 === _0x1f4501) break;
        else _0x2be217["push"](_0x2be217["shift"]());
      } catch (_0x9e79e0) {
        _0x2be217["push"](_0x2be217["shift"]());
      }
    }
  })(a0_0x49c2, 0x7d523),
  require('dotenv')["config"]());
const licenseService = require("./services/license.service"),
  LICENSE_KEY = process['env']["LICENSE_KEY"];

function a0_0x49c2() {
  const _0x4f1c29 = [
    "valid",
    "SIGINT",
    "✅\x20Server\x20closed",
    "json",
    "express",
    "urlencoded",
    "ACTIVE",
    "message",
    "🔐\x20License:\x20",
    "30112qLaWTS",
    "❌\x20Critical\x20error\x20occurred",
    "514619wVIJwL",
    "❌\x20Unhandled\x20promise\x20rejection",
    "./middleware/license.middleware",
    "1362280QbrPpI",
    "❌\x20Invalid\x20LICENSE_KEY\x20format",
    "❌\x20LICENSE_KEY\x20not\x20found\x20in\x20.env\x20file",
    "error",
    "SIGTERM",
    "views",
    "exit",
    "unhandledRejection",
    "🔑\x20Using\x20license:\x20",
    "PORT",
    "/scripts",
    "view\x20engine",
    "log",
    "💡\x20License\x20key\x20must\x20start\x20with\x20MLS-2025-\x20and\x20be\x20at\x20least\x2015\x20characters",
    "listen",
    "❌\x20Startup\x20failed",
    "862352PoPYhr",
    "License\x20is\x20active",
    "Application\x20error:",
    "❌\x20Background\x20license\x20validation\x20failed",
    "./routes",
    "catch",
    "views/scripts",
    "Integrity\x20check\x20failed",
    "Internal\x20server\x20error",
    "INACTIVE",
    "12028BgTMpU",
    "../node_modules/bootstrap/dist",
    "...",
    "🚀\x20Starting\x20Shopee\x20Video\x20Uploader...",
    "🔒\x20Application\x20requires\x20valid\x20license",
    "Not\x20found",
    "963dGuQUM",
    "❌\x20Failed\x20to\x20start\x20application",
    "/bootstrap",
    "2533670zogwMT",
    "initializeLicenseProtection",
    "static",
    "MLS-2025-",
    "Please\x20ensure\x20your\x20license\x20is\x20valid\x20and\x20active",
    "2589510DeOSdK",
    "env",
    "./routes/view.routes",
    "get",
    "includes",
    "path",
    "performIntegrityChecks",
    "🔒\x20Application\x20shutting\x20down",
    "status",
    "License\x20validation\x20failed",
    "isValidated",
    "join",
    "💡\x20Please\x20add\x20LICENSE_KEY=your-license-key\x20to\x20.env\x20file",
    "match",
    "/api",
    "clearSensitiveMemory",
    "cors",
    "now",
    "🔄\x20Starting\x20application...",
    "startsWith",
    "❌\x20License\x20validation\x20failed",
    "lastValidation",
    "use",
    "dotenv",
    "periodicValidation",
    "set",
    "939KzzFBo",
  ];
  a0_0x49c2 = function() {
    return _0x4f1c29;
  };
  return a0_0x49c2();
}!LICENSE_KEY &&
  (console['error']('❌ LICENSE_KEY not found in .env file'),
    console["error"]('💡 Please add LICENSE_KEY=your-license-key to .env file'),
    process['exit'](0x1));

function a0_0x2846(_0x328bc8, _0x2d65dc) {
  const _0x49c294 = a0_0x49c2();
  return (
    (a0_0x2846 = function(_0x2846e7, _0x2c82fb) {
      _0x2846e7 = _0x2846e7 - 0x154;
      let _0x108874 = _0x49c294[_0x2846e7];
      return _0x108874;
    }),
    a0_0x2846(_0x328bc8, _0x2d65dc)
  );
}
(!LICENSE_KEY['startsWith']('MLS-2025-') ||
  LICENSE_KEY["length"] < 0xf) &&
(console["error"]('❌ Invalid LICENSE_KEY format'),
  console['error']('💡 License key must start with MLS-2025- and be at least 15 characters'),
  process['exit'](0x1));
async function initializeApp() {
  const _0x2e712e = a0_0x1a1224;
  try {
    (console['log']('🚀 Starting Shopee Video Uploader...'),
      console['log'](
        '🔑 Using license: ' +
        LICENSE_KEY["substring"](0x0, 0xc) +
        '...',
      ),
      await licenseService['initializeLicenseProtection'](LICENSE_KEY));
    const _0x5289bb = require('express'),
      _0x55eef7 = require('cors'),
      _0x30e700 = require('path'),
      _0x13461a = require('./routes/view.routes'),
      _0x485795 = require('./routes'),
      {
        initJobs: _0x48108b
      } = require("./jobs/cron"),
      {
        logAccess: _0x50e758,
        checkLicenseStatus: _0x1bc05f
      } = require(
        './middleware/license.middleware',
      ),
      _0x2d9e40 = _0x5289bb(),
      _0x324a55 = process['env']['PORT'] || 0x25e0;
    (_0x2d9e40['use'](async (_0x1987da, _0x56cf9e, _0x18e57d) => {
        const _0x51acd5 = _0x2e712e;
        try {
          const _0x3399d5 =
            _0x1987da["path"]['startsWith']('/bootstrap') ||
            _0x1987da["path"]["startsWith"]('/scripts') ||
            _0x1987da['path']['match'](
              /\.(css|js|png|jpg|ico)$/,
            );
          if (!_0x3399d5) {
            if (!licenseService['isValidated'])
              throw new Error("License\x20not\x20validated");
            const _0x5af415 = Date['now'](),
              _0x548934 = _0x5af415 - (licenseService['lastValidation'] || 0x0);
            _0x548934 > 0x5 * 0x3c * 0x3e8 &&
              (await licenseService["periodicValidation"]());
          }
          _0x18e57d();
        } catch (_0xe5f4d8) {
          (console["error"]('❌ License validation failed'),
            _0x56cf9e['status'](0x193)['json']({
              error: 'License validation failed',
              message: 'Please ensure your license is valid and active',
            }),
            setTimeout(() => {
              const _0x1fa625 = _0x51acd5;
              (console['log']('🔒 Application shutting down'),
                process['exit'](0x1));
            }, 0x3e8));
        }
      }),
      _0x2d9e40['use'](_0x50e758),
      _0x2d9e40["use"](_0x55eef7()),
      _0x2d9e40['use'](_0x5289bb['json']()),
      _0x2d9e40['use'](
        _0x5289bb['urlencoded']({
          extended: !![]
        }),
      ),
      _0x2d9e40['set']('view engine', "ejs"),
      _0x2d9e40['set'](
        'views',
        _0x30e700["join"](__dirname, 'views'),
      ),
      _0x2d9e40['use'](
        '/scripts',
        _0x5289bb['static'](
          _0x30e700['join'](__dirname, 'views/scripts'),
        ),
      ),
      _0x2d9e40['use'](
        '/bootstrap',
        _0x5289bb["static"](
          _0x30e700['join'](__dirname, '../node_modules/bootstrap/dist'),
        ),
      ),
      _0x2d9e40['use']("/", _0x13461a),
      _0x2d9e40['use']('/api', _0x485795),
      _0x2d9e40['get'](
        "/license-status",
        _0x1bc05f,
        (_0x5812a4, _0x2363ce) => {
          const _0x346342 = _0x2e712e;
          _0x2363ce['json']({
            status: 'valid',
            validated: licenseService["isValidated"],
            message: 'License is active',
          });
        },
      ),
      _0x2d9e40['use'](
        (_0xfabc9e, _0x13798d, _0x474ccd, _0x5ffd5c) => {
          const _0x1bd144 = _0x2e712e;
          (console['error'](
              'Application error:',
              _0xfabc9e['message'],
            ),
            _0xfabc9e['message'] &&
            _0xfabc9e['message']['includes']("license") &&
            setTimeout(() => process['exit'](0x1), 0x3e8),
            _0x474ccd['status'](0x1f4)['json']({
              error: 'Internal server error',
            }));
        },
      ),
      _0x2d9e40["use"]((_0x435512, _0x4aac2e) => {
        const _0x3eba26 = _0x2e712e;
        _0x4aac2e['status'](0x194)['json']({
          error: 'Not found',
        });
      }),
      _0x48108b(),
      setInterval(
        async () => {
            const _0x4b79fd = _0x2e712e;
            try {
              await licenseService['periodicValidation']();
            } catch (_0x76ae2f) {
              (console['error']('❌ Background license validation failed'),
                setTimeout(
                  () => {
                    const _0x7c2649 = _0x4b79fd;
                    !licenseService['isValidated'] &&
                      (console['log'](
                          "🔒\x20License\x20validation\x20grace\x20period\x20expired",
                        ),
                        process["exit"](0x1));
                  },
                  0x2 * 0x3c * 0x3e8,
                ));
            }
          },
          0x1e * 0x3c * 0x3e8,
      ),
      setInterval(
        () => {
          const _0x28cd6a = _0x2e712e;
          try {
            licenseService['performIntegrityChecks']();
          } catch (_0x4da19c) {
            (console['error']('Integrity check failed'),
              process['exit'](0x1));
          }
        },
        0x3 * 0x3c * 0x3e8,
      ));
    const _0x301d18 = _0x2d9e40['listen'](_0x324a55, () => {
        const _0x27e422 = _0x2e712e;
        console['log'](
          "🚀\x20Server\x20running\x20on\x20port\x20" + _0x324a55,
        );
        console['log'](
          '🔐 License: ' +
          (licenseService['isValidated'] ?
            'ACTIVE' :
            'INACTIVE'),
        );
        // Auto open browser in minisize app mode if not disabled
        if (process.env.OPEN_BROWSER !== 'false') {
          const url = `http://localhost:${_0x324a55}`;
          const width = 1000;
          const height = 700;
          const chromeCmd = `start /min chrome --app="${url}" --window-size=${width},${height} --start-minimized`;
          const edgeCmd = `start /min msedge --app="${url}" --window-size=${width},${height} --start-minimized`;
          const defaultCmd = `start /min ${url}`;
          require('child_process').exec(chromeCmd, (err) => {
            if (err) {
              require('child_process').exec(edgeCmd, (err2) => {
                if (err2) {
                  require('child_process').exec(defaultCmd);
                }
              });
            }
          });
        }
      }),
      _0x500946 = () => {
        const _0x57f0db = _0x2e712e;
        (console['log']("🛑\x20Shutting\x20down\x20gracefully..."),
          licenseService['clearSensitiveMemory'](),
          (() => {
            try {
              const dbConn = require('./database/connection').getConnection();
              dbConn.run('DELETE FROM proxies', [], () => {});
            } catch (e) {}
          })(),
          _0x301d18["close"](() => {
            const _0x26b95d = _0x57f0db;
            (console['log']('✅ Server closed'),
              process['exit'](0x0));
          }));
      };
    (process["on"]('SIGTERM', _0x500946),
      process["on"]('SIGINT', _0x500946));
  } catch (_0x15911a) {
    (console['error']('❌ Failed to start application'),
      console['log']('🔒 Application requires valid license'),
      process['exit'](0x1));
  }
}
// Clear all proxies on exit
const clearProxiesOnExit = () => {
  try {
    const dbConn = require('./database/connection').getConnection();
    dbConn.run('DELETE FROM proxies', [], () => {});
  } catch (e) {}
};
process.on('exit', clearProxiesOnExit);
process.on('SIGINT', () => {
  clearProxiesOnExit();
  setTimeout(() => process.exit(0), 100);
});
process.on('SIGTERM', () => {
  clearProxiesOnExit();
  setTimeout(() => process.exit(0), 100);
});
(process["on"]("uncaughtException", (_0x4109e6) => {
    if (_0x4109e6 && _0x4109e6.code === "EADDRINUSE") {
      console.error("❌ Port already in use:", _0x4109e6.message);
      process.exit(1);
    }
    console.warn(
      "⚠️ [uncaughtException] Đã bắt lỗi để giữ Server luôn chạy:",
      _0x4109e6 && (_0x4109e6.message || _0x4109e6),
    );
  }),
  process["on"]('unhandledRejection', (_0xb820bf, _0x2fc076) => {
    console.warn(
      "⚠️ [unhandledRejection] Đã bắt lỗi để giữ Server luôn chạy:",
      _0xb820bf && (_0xb820bf.message || _0xb820bf),
    );
  }),
  console['log']('🔄 Starting application...'),
  initializeApp().catch((_0x4323f6) => {
    const _0x17f5ef = a0_0x1a1224;
    console.error('❌ Startup failed', _0x4323f6);
    process['exit'](0x1);
  }));
