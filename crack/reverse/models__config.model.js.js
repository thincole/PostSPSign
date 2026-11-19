function a0_0x1012(_0x45e8f3, _0x4d0c7b) {
  const _0x1105cd = a0_0x1105();
  return (
    (a0_0x1012 = function(_0x1012b2, _0x471cbd) {
      _0x1012b2 = _0x1012b2 - 0xe8;
      let _0x4ac54e = _0x1105cd[_0x1012b2];
      if (a0_0x1012["ZarCbA"] === undefined) {
        var _0x1f51e5 = function(_0x175d3f) {
          const _0x5daaf0 =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
          let _0x28ddba = "",
            _0x2b390f = "";
          for (
            let _0x52b5d9 = 0x0, _0x331bf2, _0x566ba1, _0x58931d = 0x0;
            (_0x566ba1 = _0x175d3f["charAt"](_0x58931d++));
            ~_0x566ba1 &&
            ((_0x331bf2 =
                _0x52b5d9 % 0x4 ? _0x331bf2 * 0x40 + _0x566ba1 : _0x566ba1),
              _0x52b5d9++ % 0x4) ?
            (_0x28ddba += String["fromCharCode"](
              0xff & (_0x331bf2 >> ((-0x2 * _0x52b5d9) & 0x6)),
            )) :
            0x0
          ) {
            _0x566ba1 = _0x5daaf0["indexOf"](_0x566ba1);
          }
          for (
            let _0xa5d9c2 = 0x0, _0x20327d = _0x28ddba["length"]; _0xa5d9c2 < _0x20327d; _0xa5d9c2++
          ) {
            _0x2b390f +=
              "%" +
              ("00" + _0x28ddba["charCodeAt"](_0xa5d9c2)["toString"](0x10))[
                "slice"
              ](-0x2);
          }
          return decodeURIComponent(_0x2b390f);
        };
        ((a0_0x1012["jdSJHB"] = _0x1f51e5),
          (_0x45e8f3 = arguments),
          (a0_0x1012["ZarCbA"] = !![]));
      }
      const _0x371644 = _0x1105cd[0x0],
        _0x3eacb9 = _0x1012b2 + _0x371644,
        _0xefead0 = _0x45e8f3[_0x3eacb9];
      return (
        !_0xefead0 ?
        ((_0x4ac54e = a0_0x1012["jdSJHB"](_0x4ac54e)),
          (_0x45e8f3[_0x3eacb9] = _0x4ac54e)) :
        (_0x4ac54e = _0xefead0),
        _0x4ac54e
      );
    }),
    a0_0x1012(_0x45e8f3, _0x4d0c7b)
  );
}
const a0_0x1ba884 = a0_0x1012;
(function(_0x5f7023, _0x13a1cb) {
  const _0x4c30cf = a0_0x1012,
    _0x55109f = _0x5f7023();
  while (!![]) {
    try {
      const _0x2a370a =
        (-parseInt('7535IvMinG') / 0x1) *
        (-parseInt('22muDgyR') / 0x2) +
        -parseInt('2121582ElEbRt') / 0x3 +
        (parseInt('260dZoPgp') / 0x4) * (parseInt('51500OoyIta') / 0x5) +
        (parseInt('946878mzshXr') / 0x6) *
        (-parseInt('14lfyrJE') / 0x7) +
        -parseInt('7429192srEClS') / 0x8 +
        -parseInt('5064273sNERFY') / 0x9 +
        parseInt('23269900SQVzOC') / 0xa;
      if (_0x2a370a === _0x13a1cb) break;
      else _0x55109f["push"](_0x55109f["shift"]());
    } catch (_0x40ec29) {
      _0x55109f["push"](_0x55109f["shift"]());
    }
  }
})(a0_0x1105, 0x89fd9);
const db = require("../database/connection")['getConnection'](),
  createTableQuery =
  "\x0a\x20\x20CREATE\x20TABLE\x20IF\x20NOT\x20EXISTS\x20config\x20(\x0a\x20\x20\x20\x20id\x20INTEGER\x20PRIMARY\x20KEY\x20CHECK\x20(id\x20=\x201),\x0a\x20\x20\x20\x20video_index\x20INTEGER\x20DEFAULT\x200,\x0a\x20\x20\x20\x20running_time_again\x20TEXT\x20DEFAULT\x20\x2707:00\x27,\x0a\x20\x20\x20\x20crawler_cookies\x20TEXT\x20DEFAULT\x20\x27\x27\x0a\x20\x20)\x0a";
db["run"](createTableQuery, [], function(_0x28c509) {
  const _0x3b5848 = a0_0x1ba884;
  if (_0x28c509) {
    console["error"]('Error creating config table:', _0x28c509);
    return;
  }
  (db['all']('PRAGMA table_info(config)', [], (_0x5096f6, _0x4a176f) => {
      const _0x2a09ae = _0x3b5848;
      if (_0x5096f6) return;
      (!_0x4a176f["some"](
          (_0x92a0e5) => _0x92a0e5["name"] === 'credit_url',
        ) && db["run"]('ALTER TABLE config ADD COLUMN credit_url TEXT DEFAULT \'https://credit.toolshopee.vn/api/sign\''),
        !_0x4a176f["some"](
          (_0x23630c) => _0x23630c['name'] === 'credit_key',
        ) && db["run"]('ALTER TABLE config ADD COLUMN credit_key TEXT DEFAULT \'Gte3Ka4W2Y2RTJ7MdcqFYua6nnMOImWx7BU2e2ZcseG5gBvU\''),
        !_0x4a176f['some'](
          (_0xab465a) => _0xab465a['name'] === 'blacklist_keywords',
        ) &&
        db['run'](
          "ALTER\x20TABLE\x20config\x20ADD\x20COLUMN\x20blacklist_keywords\x20TEXT\x20DEFAULT\x20\x27\x27",
        ),
        !_0x4a176f["some"](
          (_0x322bde) => _0x322bde["name"] === 'api_url_key1',
        ) && db['run']('ALTER TABLE config ADD COLUMN api_url_key1 TEXT DEFAULT \'\''));
    }),
    db['get'](
      "SELECT\x20*\x20FROM\x20config\x20WHERE\x20id\x20=\x201",
      [],
      (_0x4ef8a4, _0x1a5c54) => {
        const _0x39fba6 = _0x3b5848;
        if (_0x4ef8a4) {
          console['error']("Error\x20checking\x20config:", _0x4ef8a4);
          return;
        }!_0x1a5c54 &&
          db["run"]('INSERT INTO config (id, video_index) VALUES (1, 0)', [], function(_0x24dbc7) {
            const _0xd373b3 = _0x39fba6;
            if (_0x24dbc7) {
              console['error']('Error inserting default config:', _0x24dbc7);
              return;
            }
            console['log']("Default\x20config\x20created");
          });
      },
    ));
  db.run("ALTER TABLE config ADD COLUMN is_aigc INTEGER DEFAULT 1", (err) => {});
  db.run("ALTER TABLE config ADD COLUMN use_proxy_queue_lock INTEGER DEFAULT 1", (err) => {});
  db.run("ALTER TABLE config ADD COLUMN sign_mode TEXT DEFAULT 'credit'", (err) => {});
  db.run("ALTER TABLE config ADD COLUMN phone_sign_url TEXT DEFAULT 'http://100.79.170.67:8080'", (err) => {});
  db.run("ALTER TABLE config ADD COLUMN phone_sign_key TEXT DEFAULT 'ThinAPTM'", (err) => {});
  db.run("UPDATE config SET phone_sign_url = 'http://100.79.170.67:8080' WHERE phone_sign_url IS NULL OR phone_sign_url = '' OR phone_sign_url = 'http://127.0.0.1:8080'", (err) => {});
});
class Config {
  static async ['getVideoIndex']() {
    const _0x51ae31 = a0_0x1ba884,
      _0x3e8fd1 = {
        MVheS: 'SELECT video_index FROM config WHERE id = 1'
      };
    return new Promise((_0x55ffb7, _0x43dafe) => {
      const _0x508b90 = _0x51ae31;
      db["get"](_0x3e8fd1['MVheS'], [], (_0x501056, _0x94b4b0) => {
        if (_0x501056) return _0x43dafe(_0x501056);
        _0x55ffb7(_0x94b4b0 ? _0x94b4b0["video_index"] : 0x0);
      });
    });
  }
  static async ['getRunningTimeAgain']() {
    const _0x2051ec = a0_0x1ba884,
      _0x51c550 = {
        rVxBT: function(_0x1b163f, _0x47adae) {
          return _0x1b163f(_0x47adae);
        },
        hUFgh: "07:00",
        sULfT: 'SELECT running_time_again FROM config WHERE id = 1',
      };
    return new Promise((_0x437cfe, _0x129bde) => {
      db["get"](_0x51c550["sULfT"], [], (_0x2edca8, _0x1fd95a) => {
        const _0x13e698 = a0_0x1012;
        if (_0x2edca8) return _0x129bde(_0x2edca8);
        _0x51c550['rVxBT'](
          _0x437cfe,
          _0x1fd95a ? _0x1fd95a['running_time_again'] : _0x51c550["hUFgh"],
        );
      });
    });
  }
  static async ["updateVideoIndex"](_0x45a2ec) {
    return new Promise((_0x4c6734, _0x50ef34) => {
      const _0x168422 = a0_0x1012;
      db["run"]('UPDATE config SET video_index = ? WHERE id = 1', [_0x45a2ec], (_0x4b925b) => {
        if (_0x4b925b) return _0x50ef34(_0x4b925b);
        _0x4c6734();
      });
    });
  }
  static async ['updateRunningTimeAgain'](_0x5f27ed) {
    return new Promise((_0x2472fa, _0x12f1b3) => {
      const _0x139628 = a0_0x1012,
        _0x5b7984 = {
          tjDip: function(_0x5d479a, _0x5b91d2) {
            return _0x5d479a(_0x5b91d2);
          },
        };
      db['run'](
        "UPDATE\x20config\x20SET\x20running_time_again\x20=\x20?\x20WHERE\x20id\x20=\x201",
        [_0x5f27ed],
        (_0x2c5c10) => {
          const _0x1e1d7e = _0x139628;
          if (_0x2c5c10)
            return _0x5b7984['tjDip'](_0x12f1b3, _0x2c5c10);
          _0x2472fa();
        },
      );
    });
  }
  static async ['getAllCookies']() {
    const _0x4041be = a0_0x1ba884,
      _0xb6bba5 = {
        Hujsn: 'Error getting all cookies:'
      };
    try {
      const _0x227aaa = await new Promise((_0x4ae84e, _0x2c39e4) => {
        const _0x4863fa = _0x4041be,
          _0x5b2f36 = {
            BQTXS: function(_0x4ffe4c, _0x1a3dd3) {
              return _0x4ffe4c(_0x1a3dd3);
            },
          };
        db['get'](
          "SELECT\x20crawler_cookies\x20FROM\x20config\x20WHERE\x20id\x20=\x201",
          [],
          (_0x2f3d22, _0x202b49) => {
            if (_0x2f3d22) return _0x2c39e4(_0x2f3d22);
            _0x5b2f36["BQTXS"](_0x4ae84e, _0x202b49);
          },
        );
      });
      return _0x227aaa && _0x227aaa["crawler_cookies"] ?
        JSON["parse"](_0x227aaa['crawler_cookies']) :
        [];
    } catch (_0x29f9d0) {
      console["error"](_0xb6bba5["Hujsn"], _0x29f9d0);
      throw _0x29f9d0;
    }
  }
  static async ["getCreditSettings"]() {
    return new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM config WHERE id = 1",
        [],
        (err, row) => {
          if (err) return reject(err);
          const sign_mode = row?.sign_mode || "credit";
          const defaultCreditUrl = "https://creditmls2026video.toolshopee.vn/api/sign";
          const defaultCreditKey = "Gte3Ka4W2Y2RTJ7MdcqFYua6nnMOImWx7BU2e2ZcseG5gBvU";
          const phone_sign_url = row?.phone_sign_url || "http://100.79.170.67:8080";
          const phone_sign_key = row?.phone_sign_key || "ThinAPTM";
          const credit_url = row?.credit_url || defaultCreditUrl;
          const credit_key = row?.credit_key || defaultCreditKey;
          const active_url = sign_mode === "phone" ? phone_sign_url : credit_url;
          const active_key = sign_mode === "phone" ? phone_sign_key : credit_key;
          resolve({
            sign_mode,
            credit_url: active_url,
            credit_key: active_key,
            raw_credit_url: credit_url,
            raw_credit_key: credit_key,
            phone_sign_url,
            phone_sign_key,
          });
        }
      );
    });
  }
  static async ["updateCreditSettings"](credit_url, credit_key, sign_mode = 'credit', phone_sign_url = 'http://100.79.170.67:8080', phone_sign_key = 'ThinAPTM') {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("ALTER TABLE config ADD COLUMN sign_mode TEXT DEFAULT 'credit'", (err) => {});
        db.run("ALTER TABLE config ADD COLUMN phone_sign_url TEXT DEFAULT 'http://100.79.170.67:8080'", (err) => {});
        db.run("ALTER TABLE config ADD COLUMN phone_sign_key TEXT DEFAULT 'ThinAPTM'", (err) => {});
        db.run(
          "UPDATE config SET credit_url = ?, credit_key = ?, sign_mode = ?, phone_sign_url = ?, phone_sign_key = ? WHERE id = 1",
          [credit_url, credit_key, sign_mode, phone_sign_url, phone_sign_key],
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    });
  }
  static async ['getBlacklistKeywords']() {
    const _0x39d7c0 = a0_0x1ba884,
      _0x401c75 = {
        PboYu: 'SELECT blacklist_keywords FROM config WHERE id = 1'
      };
    return new Promise((_0x229d6e, _0x37ab7f) => {
      const _0x57193a = _0x39d7c0,
        _0x44b850 = {
          xgqqK: function(_0x34cb43, _0x1d547e) {
            return _0x34cb43(_0x1d547e);
          },
          sMTLV: function(_0x12a68b, _0x29a093) {
            return _0x12a68b(_0x29a093);
          },
        };
      db['get'](
        _0x401c75['PboYu'],
        [],
        (_0x2fc3f1, _0x126878) => {
          const _0x430da8 = _0x57193a;
          if (_0x2fc3f1) return _0x44b850["xgqqK"](_0x37ab7f, _0x2fc3f1);
          _0x44b850['sMTLV'](
            _0x229d6e,
            _0x126878?.['blacklist_keywords'] || "",
          );
        },
      );
    });
  }
  static async ['updateBlacklistKeywords'](_0x205906) {
    const _0x4f3d06 = {
      Eeemz: function(_0x5bab8a, _0x5dede1) {
        return _0x5bab8a || _0x5dede1;
      },
    };
    return new Promise((_0x586ffd, _0x17175d) => {
      const _0x3d3383 = a0_0x1012;
      db["run"](
        'UPDATE config SET blacklist_keywords = ? WHERE id = 1',
        [_0x4f3d06['Eeemz'](_0x205906, "")],
        (_0x346120) => {
          if (_0x346120) return _0x17175d(_0x346120);
          _0x586ffd();
        },
      );
    });
  }
  static async ["getApiUrlKey1"]() {
    const _0x5ab2b3 = {
      JKhsi: function(_0x163e5f, _0x5a163e) {
        return _0x163e5f(_0x5a163e);
      },
    };
    return new Promise((_0x1141a2, _0x420db9) => {
      const _0x886de7 = a0_0x1012;
      db["get"]('SELECT api_url_key1 FROM config WHERE id = 1', [], (_0x574d0d, _0x5549ee) => {
        const _0x31ad50 = _0x886de7;
        if (_0x574d0d) return _0x5ab2b3['JKhsi'](_0x420db9, _0x574d0d);
        _0x1141a2(_0x5549ee?.["api_url_key1"] || "");
      });
    });
  }
  static async ["updateApiUrlKey1"](_0x182d7a) {
    const _0x46236c = {
      LgPnS: function(_0x1f177d) {
        return _0x1f177d();
      },
      fWYQl: "UPDATE\x20config\x20SET\x20api_url_key1\x20=\x20?\x20WHERE\x20id\x20=\x201",
      WgCXA: function(_0x40d8eb, _0x1a34d6) {
        return _0x40d8eb || _0x1a34d6;
      },
    };
    return new Promise((_0x36983c, _0x5a57de) => {
      const _0xeaab3 = a0_0x1012;
      db["run"](
        _0x46236c['fWYQl'],
        [_0x46236c["WgCXA"](_0x182d7a, "")],
        (_0x3cc9da) => {
          const _0x189591 = _0xeaab3;
          if (_0x3cc9da) return _0x5a57de(_0x3cc9da);
          _0x46236c['LgPnS'](_0x36983c);
        },
      );
    });
  }
  static async ["updateAllCookies"](_0x291afd) {
    const _0x14fd9a = a0_0x1ba884,
      _0x48c0fe = {
        LKeEJ: "UPDATE\x20config\x20SET\x20crawler_cookies\x20=\x20?\x20WHERE\x20id\x20=\x201",
      };
    try {
      await new Promise((_0x32f782, _0x540e41) => {
        const _0x5e011c = a0_0x1012,
          _0xcafd29 = {
            BWZjT: function(_0xdaa637) {
              return _0xdaa637();
            },
          };
        db["run"](
          _0x48c0fe["LKeEJ"],
          [JSON['stringify'](_0x291afd)],
          (_0x158e13) => {
            const _0x52da87 = _0x5e011c;
            if (_0x158e13) return _0x540e41(_0x158e13);
            _0xcafd29['BWZjT'](_0x32f782);
          },
        );
      });
    } catch (_0x121783) {
      console["error"]('Error updating all cookies:', _0x121783);
      throw _0x121783;
    }
  }
  // AIGC (AI Generated Content)
  static async getIsAigc() {
    return new Promise((resolve, reject) => {
      db.get("SELECT is_aigc FROM config WHERE id = 1", [], (err, row) => {
        if (err) return reject(err);
        resolve(row?.is_aigc == null ? true : Number(row.is_aigc) === 1);
      });
    });
  }
  static async updateIsAigc(isAigc) {
    return new Promise((resolve, reject) => {
      db.run("UPDATE config SET is_aigc = ? WHERE id = 1", [isAigc ? 1 : 0], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
  static async getUseProxyQueueLock() {
    return new Promise((resolve) => {
      db.get("SELECT use_proxy_queue_lock FROM config WHERE id = 1", [], (err, row) => {
        if (err || !row) return resolve(1);
        resolve(row.use_proxy_queue_lock !== 0 ? 1 : 0);
      });
    });
  }
  static async updateUseProxyQueueLock(enabled) {
    const val = enabled ? 1 : 0;
    return new Promise((resolve, reject) => {
      db.run("UPDATE config SET use_proxy_queue_lock = ? WHERE id = 1", [val], (err) => {
        if (err) return reject(err);
        resolve(val);
      });
    });
  }
}

function a0_0x1105() {
  const _0x1a22f3 = [
    "u0vmrunuignYzwrPDf91CMWSignYzwrPDf9RzxKGrLjptsbJB25MAwCGv0HfuKuGAwqGpsaX",
    "z2v0qMXHy2TSAxn0s2v5D29Yzhm",
    "yMXHy2TSAxn0x2TLExDVCMrZ",
    "CLz4qLq",
    "y3jHD2XLCL9JB29RAwvZ",
    "nZuZnuL2twLUrW",
    "rxjYB3iGAw5Zzxj0Aw5NigrLzMf1BhqGy29UzMLNoG",
    "u0vmrunuigjSywnRBgLZDf9RzxL3B3jKCYbguK9nignVBMzPzYbxsevsrsbPzca9ide",
    "r3nwvgi",
    "DgPeAxa",
    "mJeYmtu4mKvSrwjsDa",
    "Ahr0Chm6lY9JCMvKAxqUDg9VBhnOB3bLzs52BI9HCgKVC2LNBG",
    "quXurviGvefcteuGy29UzMLNiefercbdt0Xvtu4GyxbPx3vYBf9RzxKXifrfwfqGrevgqvvmvcaNjW",
    "ugjVwxu",
    "C01utfy",
    "u0vmrunuihzPzgvVx2LUzgv4iezst00Gy29UzMLNifDirvjfigLKid0Gmq",
    "nta2ndi3m3norvjgwq",
    "C3rYAw5NAwz5",
    "ywXS",
    "z2v0",
    "Bg9N",
    "rwvLBxO",
    "quXurviGvefcteuGy29UzMLNiefercbdt0Xvtu4Gy3jLzgL0x3vYBcburvHuierfrKfvtfqGj2H0DhbZoI8Vy3jLzgL0lNrVB2XZAg9WzwuUDM4VyxbPl3nPz24N",
    "z2v0q29UBMvJDgLVBG",
    "ufjbr01bihrHyMXLx2LUzM8Oy29UzMLNkq",
    "tgDqBLm",
    "C29Tzq",
    "CNvU",
    "DxbKyxrLuNvUBMLUz1rPBwvbz2fPBG",
    "zxjYB3i",
    "DxbKyxrLqMXHy2TSAxn0s2v5D29Yzhm",
    "u0vmrunuigfWAv91CMXFA2v5msbguK9nignVBMzPzYbxsevsrsbPzca9ide",
    "rxjYB3iGDxbKyxrPBMCGywXSignVB2TPzxm6",
    "mJmYnJK5mdbtuvz6t0m",
    "nte1mdbpB3LjDge",
    "otq2odC4BxPZAfHY",
    "BMfTzq",
    "vvbeqvrfignVBMzPzYbtrvqGy3jLzgL0x3vYBca9id8SignYzwrPDf9RzxKGpsa/ifDirvjfigLKid0Gmq",
    "sKTOC2K",
    "zLDzuwW",
    "z2v0vMLKzw9jBMrLEa",
    "CNvUBMLUz190Aw1Lx2fNywLU",
    "mJyWzfPVugDW",
    "tvzOzvm",
    "rxjYB3iGz2v0DgLUzYbHBgWGy29VA2LLCZO",
    "rxjYB3iGy3jLyxrPBMCGy29UzMLNihrHyMXLoG",
    "quXurviGvefcteuGy29UzMLNiefercbdt0Xvtu4Gy3jLzgL0x2TLEsburvHuierfrKfvtfqGj0D0ztnlytrxmLKYuLrkn01Ky3fgwxvHnM5Utu9jBvD4n0jvmMuYwMnZzuC1z0j2vsC",
    "z2v0qwXSq29VA2LLCW",
    "mtrSzNLYsKu",
    "nZqYote5mNnYrunSuW",
    "vvbeqvrfignVBMzPzYbtrvqGyMXHy2TSAxn0x2TLExDVCMrZid0GpYbxsevsrsbPzca9ide",
    "u0vmrunuihj1BM5PBMDFDgLTzv9Hz2fPBIbguK9nignVBMzPzYbxsevsrsbPzca9ide",
    "y3jLzgL0x3vYBa",
    "vvbeqvrfignVBMzPzYbtrvqGDMLKzw9FAw5KzxGGpsa/ifDirvjfigLKid0Gmq",
    "yxbPx3vYBf9RzxKX",
    "mJjTDurNEvi",
    "z2v0uNvUBMLUz1rPBwvbz2fPBG",
    "su5trvjuieLove8Gy29UzMLNicHPzcWGDMLKzw9FAw5KzxGPifzbtfvfuYaOmsWGmcK",
    "y3jLzgL0x2TLEq",
    "qLDAALq",
  ];
  a0_0x1105 = function() {
    return _0x1a22f3;
  };
  return a0_0x1105();
}
module["exports"] = Config;
