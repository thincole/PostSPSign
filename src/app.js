require('./utils/logger');
const a0_0x1a1224 = a0_0x2846;
((function (_0x3b040d, _0x1f4501) {
  const _0x35a6dc = a0_0x2846,
    _0x2be217 = _0x3b040d();
  while (!![]) {
    try {
      const _0x5803b7 =
        parseInt(_0x35a6dc(0x170)) / 0x1 +
        -parseInt(_0x35a6dc(0x160)) / 0x2 +
        (-parseInt(_0x35a6dc(0x1a2)) / 0x3) *
          (-parseInt(_0x35a6dc(0x17a)) / 0x4) +
        -parseInt(_0x35a6dc(0x183)) / 0x5 +
        -parseInt(_0x35a6dc(0x188)) / 0x6 +
        -parseInt(_0x35a6dc(0x15d)) / 0x7 +
        (-parseInt(_0x35a6dc(0x15b)) / 0x8) *
          (-parseInt(_0x35a6dc(0x180)) / 0x9);
      if (_0x5803b7 === _0x1f4501) break;
      else _0x2be217["push"](_0x2be217["shift"]());
    } catch (_0x9e79e0) {
      _0x2be217["push"](_0x2be217["shift"]());
    }
  }
})(a0_0x49c2, 0x7d523),
  require(a0_0x1a1224(0x19f))["config"]());
const licenseService = require("./services/license.service"),
  LICENSE_KEY = process[a0_0x1a1224(0x189)]["LICENSE_KEY"];
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
  a0_0x49c2 = function () {
    return _0x4f1c29;
  };
  return a0_0x49c2();
}
!LICENSE_KEY &&
  (console[a0_0x1a1224(0x163)](a0_0x1a1224(0x162)),
  console["error"](a0_0x1a1224(0x194)),
  process[a0_0x1a1224(0x166)](0x1));
function a0_0x2846(_0x328bc8, _0x2d65dc) {
  const _0x49c294 = a0_0x49c2();
  return (
    (a0_0x2846 = function (_0x2846e7, _0x2c82fb) {
      _0x2846e7 = _0x2846e7 - 0x154;
      let _0x108874 = _0x49c294[_0x2846e7];
      return _0x108874;
    }),
    a0_0x2846(_0x328bc8, _0x2d65dc)
  );
}
(!LICENSE_KEY[a0_0x1a1224(0x19b)](a0_0x1a1224(0x186)) ||
  LICENSE_KEY["length"] < 0xf) &&
  (console["error"](a0_0x1a1224(0x161)),
  console[a0_0x1a1224(0x163)](a0_0x1a1224(0x16d)),
  process[a0_0x1a1224(0x166)](0x1));
async function initializeApp() {
  const _0x2e712e = a0_0x1a1224;
  try {
    (console[_0x2e712e(0x16c)](_0x2e712e(0x17d)),
      console[_0x2e712e(0x16c)](
        _0x2e712e(0x168) +
          LICENSE_KEY["substring"](0x0, 0xc) +
          _0x2e712e(0x17c),
      ),
      await licenseService[_0x2e712e(0x184)](LICENSE_KEY));
    const _0x5289bb = require(_0x2e712e(0x156)),
      _0x55eef7 = require(_0x2e712e(0x198)),
      _0x30e700 = require(_0x2e712e(0x18d)),
      _0x13461a = require(_0x2e712e(0x18a)),
      _0x485795 = require(_0x2e712e(0x174)),
      { initJobs: _0x48108b } = require("./jobs/cron"),
      { logAccess: _0x50e758, checkLicenseStatus: _0x1bc05f } = require(
        _0x2e712e(0x15f),
      ),
      _0x2d9e40 = _0x5289bb(),
      _0x324a55 = process[_0x2e712e(0x189)][_0x2e712e(0x169)] || 0x25e0;
    (_0x2d9e40[_0x2e712e(0x19e)](async (_0x1987da, _0x56cf9e, _0x18e57d) => {
      const _0x51acd5 = _0x2e712e;
      try {
        const _0x3399d5 =
          _0x1987da["path"][_0x51acd5(0x19b)](_0x51acd5(0x182)) ||
          _0x1987da["path"]["startsWith"](_0x51acd5(0x16a)) ||
          _0x1987da[_0x51acd5(0x18d)][_0x51acd5(0x195)](
            /\.(css|js|png|jpg|ico)$/,
          );
        if (!_0x3399d5) {
          if (!licenseService[_0x51acd5(0x192)])
            throw new Error("License\x20not\x20validated");
          const _0x5af415 = Date[_0x51acd5(0x199)](),
            _0x548934 = _0x5af415 - (licenseService[_0x51acd5(0x19d)] || 0x0);
          _0x548934 > 0x5 * 0x3c * 0x3e8 &&
            (await licenseService["periodicValidation"]());
        }
        _0x18e57d();
      } catch (_0xe5f4d8) {
        (console["error"](_0x51acd5(0x19c)),
          _0x56cf9e[_0x51acd5(0x190)](0x193)[_0x51acd5(0x155)]({
            error: _0x51acd5(0x191),
            message: _0x51acd5(0x187),
          }),
          setTimeout(() => {
            const _0x1fa625 = _0x51acd5;
            (console[_0x1fa625(0x16c)](_0x1fa625(0x18f)),
              process[_0x1fa625(0x166)](0x1));
          }, 0x3e8));
      }
    }),
      _0x2d9e40[_0x2e712e(0x19e)](_0x50e758),
      _0x2d9e40["use"](_0x55eef7()),
      _0x2d9e40[_0x2e712e(0x19e)](_0x5289bb[_0x2e712e(0x155)]()),
      _0x2d9e40[_0x2e712e(0x19e)](
        _0x5289bb[_0x2e712e(0x157)]({ extended: !![] }),
      ),
      _0x2d9e40[_0x2e712e(0x1a1)](_0x2e712e(0x16b), "ejs"),
      _0x2d9e40[_0x2e712e(0x1a1)](
        _0x2e712e(0x165),
        _0x30e700["join"](__dirname, _0x2e712e(0x165)),
      ),
      _0x2d9e40[_0x2e712e(0x19e)](
        _0x2e712e(0x16a),
        _0x5289bb[_0x2e712e(0x185)](
          _0x30e700[_0x2e712e(0x193)](__dirname, _0x2e712e(0x176)),
        ),
      ),
      _0x2d9e40[_0x2e712e(0x19e)](
        _0x2e712e(0x182),
        _0x5289bb["static"](
          _0x30e700[_0x2e712e(0x193)](__dirname, _0x2e712e(0x17b)),
        ),
      ),
      _0x2d9e40[_0x2e712e(0x19e)]("/", _0x13461a),
      _0x2d9e40[_0x2e712e(0x19e)](_0x2e712e(0x196), _0x485795),
      _0x2d9e40[_0x2e712e(0x18b)](
        "/license-status",
        _0x1bc05f,
        (_0x5812a4, _0x2363ce) => {
          const _0x346342 = _0x2e712e;
          _0x2363ce[_0x346342(0x155)]({
            status: _0x346342(0x1a3),
            validated: licenseService["isValidated"],
            message: _0x346342(0x171),
          });
        },
      ),
      _0x2d9e40[_0x2e712e(0x19e)](
        (_0xfabc9e, _0x13798d, _0x474ccd, _0x5ffd5c) => {
          const _0x1bd144 = _0x2e712e;
          (console[_0x1bd144(0x163)](
            _0x1bd144(0x172),
            _0xfabc9e[_0x1bd144(0x159)],
          ),
            _0xfabc9e[_0x1bd144(0x159)] &&
              _0xfabc9e[_0x1bd144(0x159)][_0x1bd144(0x18c)]("license") &&
              setTimeout(() => process[_0x1bd144(0x166)](0x1), 0x3e8),
            _0x474ccd[_0x1bd144(0x190)](0x1f4)[_0x1bd144(0x155)]({
              error: _0x1bd144(0x178),
            }));
        },
      ),
      _0x2d9e40["use"]((_0x435512, _0x4aac2e) => {
        const _0x3eba26 = _0x2e712e;
        _0x4aac2e[_0x3eba26(0x190)](0x194)[_0x3eba26(0x155)]({
          error: _0x3eba26(0x17f),
        });
      }),
      _0x48108b(),
      setInterval(
        async () => {
          const _0x4b79fd = _0x2e712e;
          try {
            await licenseService[_0x4b79fd(0x1a0)]();
          } catch (_0x76ae2f) {
            (console[_0x4b79fd(0x163)](_0x4b79fd(0x173)),
              setTimeout(
                () => {
                  const _0x7c2649 = _0x4b79fd;
                  !licenseService[_0x7c2649(0x192)] &&
                    (console[_0x7c2649(0x16c)](
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
            licenseService[_0x28cd6a(0x18e)]();
          } catch (_0x4da19c) {
            (console[_0x28cd6a(0x163)](_0x28cd6a(0x177)),
              process[_0x28cd6a(0x166)](0x1));
          }
        },
        0x3 * 0x3c * 0x3e8,
      ));
    const _0x301d18 = _0x2d9e40[_0x2e712e(0x16e)](_0x324a55, () => {
        const _0x27e422 = _0x2e712e;
        console[_0x27e422(0x16c)](
          "🚀\x20Server\x20running\x20on\x20port\x20" + _0x324a55,
        );
        console[_0x27e422(0x16c)](
          _0x27e422(0x15a) +
            (licenseService[_0x27e422(0x192)]
              ? _0x27e422(0x158)
              : _0x27e422(0x179)),
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
        (console[_0x57f0db(0x16c)]("🛑\x20Shutting\x20down\x20gracefully..."),
          licenseService[_0x57f0db(0x197)](),
          (() => {
            try {
              const dbConn = require('./database/connection').getConnection();
              dbConn.run('DELETE FROM proxies', [], () => {});
            } catch(e) {}
          })(),
          _0x301d18["close"](() => {
            const _0x26b95d = _0x57f0db;
            (console[_0x26b95d(0x16c)](_0x26b95d(0x154)),
              process[_0x26b95d(0x166)](0x0));
          }));
      };
    (process["on"](_0x2e712e(0x164), _0x500946),
      process["on"](_0x2e712e(0x1a4), _0x500946));
  } catch (_0x15911a) {
    (console[_0x2e712e(0x163)](_0x2e712e(0x181)),
      console[_0x2e712e(0x16c)](_0x2e712e(0x17e)),
      process[_0x2e712e(0x166)](0x1));
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
  process["on"](a0_0x1a1224(0x167), (_0xb820bf, _0x2fc076) => {
    console.warn(
      "⚠️ [unhandledRejection] Đã bắt lỗi để giữ Server luôn chạy:",
      _0xb820bf && (_0xb820bf.message || _0xb820bf),
    );
  }),
  console[a0_0x1a1224(0x16c)](a0_0x1a1224(0x19a)),
  initializeApp().catch((_0x4323f6) => {
    const _0x17f5ef = a0_0x1a1224;
    console.error(_0x17f5ef(0x16f), _0x4323f6);
    process[_0x17f5ef(0x166)](0x1);
  }));
