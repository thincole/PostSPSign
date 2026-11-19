const a0_0x540f6f = a0_0x3316;
(function(_0x199af4, _0x1feaf6) {
  const _0x356978 = a0_0x3316,
    _0x3c0efd = _0x199af4();
  while (!![]) {
    try {
      const _0x4c84f7 = -parseInt('586omtiVj') / 0x1 * (parseInt('2916OpSdSJ') / 0x2) + parseInt('3420531JpkiFW') / 0x3 + parseInt('496kRnsnJ') / 0x4 * (-parseInt('14095FsRCCW') / 0x5) + -parseInt('147348cWAHCM') / 0x6 * (parseInt('112PjiOqy') / 0x7) + -parseInt('6386136xohrlW') / 0x8 * (parseInt('9LlHVPc') / 0x9) + -parseInt('6117170GGLElP') / 0xa + parseInt('77AdouGu') / 0xb * (parseInt('4253700pOuDig') / 0xc);
      if (_0x4c84f7 === _0x1feaf6) break;
      else _0x3c0efd['push'](_0x3c0efd['shift']());
    } catch (_0x224b8d) {
      _0x3c0efd['push'](_0x3c0efd['shift']());
    }
  }
}(a0_0x3135, 0x960f6));
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  os = require('os'),
  FINGERPRINT_FILE = path['join'](__dirname, '../../.machine_id');

function patchLicenseService(_0x1c401c) {
  const _0x522964 = a0_0x540f6f,
    _0xdf1fa6 = {
      'faKHL': 'utf8',
      'djxzq': 'generateHardwareFingerprint'
    };
  if (!_0x1c401c || typeof _0x1c401c !== 'object') return;
  const _0x8f74e3 = findMethod(_0x1c401c, _0xdf1fa6['djxzq']);
  if (!_0x8f74e3) return;
  const {
    key: _0x464a42,
    fn: _0x1e5a89
  } = _0x8f74e3;
  _0x1c401c[_0x464a42] = function() {
    const _0x472111 = _0x522964;
    try {
      if (fs['existsSync'](FINGERPRINT_FILE)) {
        const _0x4b9682 = fs['readFileSync'](FINGERPRINT_FILE, _0xdf1fa6['faKHL'])['trim']();
        if (_0x4b9682 && _0x4b9682['length'] >= 0x10) return _0x4b9682;
      }
    } catch (_0x213545) {}
    let _0x55e062;
    try {
      _0x55e062 = _0x1e5a89['call'](this);
    } catch (_0x250308) {
      _0x55e062 = generateStableFingerprint();
    }
    try {
      fs['writeFileSync'](FINGERPRINT_FILE, _0x55e062, 'utf8');
    } catch (_0x15ddd1) {}
    return _0x55e062;
  };
}

function generateStableFingerprint() {
  const _0x1d2e87 = a0_0x540f6f,
    _0x245d93 = {
      'wdVqg': '00:00:00:00:00:00',
      'aLgtb': 'MLS@2025Shopee'
    },
    _0x4a542f = [],
    _0x381d22 = os['networkInterfaces']();
  for (const _0x4ba923 of Object['values'](_0x381d22)) {
    for (const _0x1a7690 of _0x4ba923) {
      _0x1a7690['mac'] && _0x1a7690['mac'] !== _0x245d93['wdVqg'] && _0x4a542f['push'](_0x1a7690['mac']);
    }
  }
  const _0x248e76 = os['cpus']()[0x0];
  _0x248e76 && (_0x4a542f['push'](_0x248e76['model']['replace'](/\s+/g, '')), _0x4a542f['push'](String(_0x248e76['speed'])));
  _0x4a542f['push'](String(os['totalmem']())), _0x4a542f['push'](os['arch']()), _0x4a542f['push'](os['platform']());
  const _0x339d94 = _0x4a542f['sort']()['join']('|') + _0x245d93['aLgtb'];
  return crypto['createHash']('sha256')['update'](_0x339d94)['digest']('hex')['substring'](0x0, 0x20);
}

function findMethod(_0x5b56c7, _0x45c54a) {
  const _0x58fbfa = a0_0x540f6f,
    _0x263940 = {
      'dQQQM': function(_0x259373, _0x443df0) {
        return _0x259373 === _0x443df0;
      },
      'VoVFm': 'function',
      'ZhfUD': 'constructor',
      'XkVTm': function(_0x2f9f3d, _0x5533f9) {
        return _0x2f9f3d === _0x5533f9;
      },
      'LXHId': 'string'
    };
  if (typeof _0x5b56c7[_0x45c54a] === 'function') return {
    'key': _0x45c54a,
    'fn': _0x5b56c7[_0x45c54a]
  };
  if (_0x5b56c7['constructor'] && _0x5b56c7['constructor']['prototype']) {
    const _0x324124 = _0x5b56c7['constructor']['prototype'];
    if (_0x263940['dQQQM'](typeof _0x324124[_0x45c54a], _0x263940['VoVFm'])) return {
      'key': _0x45c54a,
      'fn': _0x324124[_0x45c54a]
    };
  }
  for (const _0x540f1d of Object['getOwnPropertyNames'](Object['getPrototypeOf'](_0x5b56c7))) {
    if (typeof _0x5b56c7[_0x540f1d] !== 'function') continue;
    if (_0x540f1d === _0x263940['ZhfUD']) continue;
    try {
      const _0x3785a7 = _0x5b56c7[_0x540f1d]['call'](_0x5b56c7);
      if (_0x263940['XkVTm'](typeof _0x3785a7, _0x263940['LXHId']) && /^[0-9a-f]{20,40}$/ ['test'](_0x3785a7)) return {
        'key': _0x540f1d,
        'fn': _0x5b56c7[_0x540f1d]
      };
    } catch (_0x120be6) {}
  }
  return null;
}

function a0_0x3135() {
  const _0x3e41da = ['ChvZAa', 'nJeXnZe3meDhtevSua', 'ouXSsfzqyW', 'y3jLyxrLsgfZAa', 'DxrMoa', 'z2vUzxjHDgviyxjKD2fYzuzPBMDLCNbYAw50', 'D3jPDgvgAwXLu3LUyW', 'DhjPBq', 'BwfJ', 'BgvUz3rO', 'nJm4nJeZnNHVAhjSvW', 'tuXtqdiWmJvtAg9Wzwu', 'mteYugPPt3f5', 'zgLNzxn0', 'C2HHmJu2', 'mJKXnK9Wu2rtsG', 'AM9PBG', 'zxHPC3rZu3LUyW', 'ndK2A1jUC25k', 'nZDbzg91r3u', 'mtqWotvgC1jdq1C', 'ntG2B210AvzQ', 'zNvUy3rPB24', 'y29UC3rYDwn0B3i', 'zMflseW', 'yxjJAa', 'CMvWBgfJzq', 'BMv0D29YA0LUDgvYzMfJzxm', 'ndi1mZCWmhbpDurPzW', 'yuXNDgi', 'mZqYmduZmuPWA2LgvW', 'D2rwCwC', 'B2jQzwn0', 'vM9wrM0', 'mtq3mZq4y1Dbsenn', 'DxbKyxrL'];
  a0_0x3135 = function() {
    return _0x3e41da;
  };
  return a0_0x3135();
}

function a0_0x3316(_0x24a7bc, _0x5bb88b) {
  const _0x313583 = a0_0x3135();
  return a0_0x3316 = function(_0x331621, _0x13a801) {
    _0x331621 = _0x331621 - 0xd6;
    let _0x5b3a2c = _0x313583[_0x331621];
    if (a0_0x3316['PzaZlW'] === undefined) {
      var _0x5bd761 = function(_0x526ff8) {
        const _0x599a6c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
        let _0x7d7d8f = '',
          _0x4a9e80 = '';
        for (let _0x4fd286 = 0x0, _0x134aaa, _0x2cd380, _0x4f3548 = 0x0; _0x2cd380 = _0x526ff8['charAt'](_0x4f3548++); ~_0x2cd380 && (_0x134aaa = _0x4fd286 % 0x4 ? _0x134aaa * 0x40 + _0x2cd380 : _0x2cd380, _0x4fd286++ % 0x4) ? _0x7d7d8f += String['fromCharCode'](0xff & _0x134aaa >> (-0x2 * _0x4fd286 & 0x6)) : 0x0) {
          _0x2cd380 = _0x599a6c['indexOf'](_0x2cd380);
        }
        for (let _0x1a0d4a = 0x0, _0x4f582c = _0x7d7d8f['length']; _0x1a0d4a < _0x4f582c; _0x1a0d4a++) {
          _0x4a9e80 += '%' + ('00' + _0x7d7d8f['charCodeAt'](_0x1a0d4a)['toString'](0x10))['slice'](-0x2);
        }
        return decodeURIComponent(_0x4a9e80);
      };
      a0_0x3316['Iacati'] = _0x5bd761, _0x24a7bc = arguments, a0_0x3316['PzaZlW'] = !![];
    }
    const _0x4cf663 = _0x313583[0x0],
      _0xbb4819 = _0x331621 + _0x4cf663,
      _0x4498aa = _0x24a7bc[_0xbb4819];
    return !_0x4498aa ? (_0x5b3a2c = a0_0x3316['Iacati'](_0x5b3a2c), _0x24a7bc[_0xbb4819] = _0x5b3a2c) : _0x5b3a2c = _0x4498aa, _0x5b3a2c;
  }, a0_0x3316(_0x24a7bc, _0x5bb88b);
}
module['exports'] = {
  'patchLicenseService': patchLicenseService,
  'FINGERPRINT_FILE': FINGERPRINT_FILE
};
