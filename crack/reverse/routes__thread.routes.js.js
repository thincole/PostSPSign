function a0_0x3a39(_0x3ef6c3, _0xbcf7ef) {
  const _0x5b2f27 = a0_0x5b2f();
  return a0_0x3a39 = function(_0x3a3998, _0x4e110e) {
    _0x3a3998 = _0x3a3998 - 0x111;
    let _0xa299f4 = _0x5b2f27[_0x3a3998];
    if (a0_0x3a39['wWuBDH'] === undefined) {
      var _0x3d5c73 = function(_0x41e85c) {
        const _0x4189d0 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';
        let _0x328690 = '',
          _0x35b7ef = '';
        for (let _0x295c68 = 0x0, _0xfcb4d, _0x3426b3, _0x285679 = 0x0; _0x3426b3 = _0x41e85c['charAt'](_0x285679++); ~_0x3426b3 && (_0xfcb4d = _0x295c68 % 0x4 ? _0xfcb4d * 0x40 + _0x3426b3 : _0x3426b3, _0x295c68++ % 0x4) ? _0x328690 += String['fromCharCode'](0xff & _0xfcb4d >> (-0x2 * _0x295c68 & 0x6)) : 0x0) {
          _0x3426b3 = _0x4189d0['indexOf'](_0x3426b3);
        }
        for (let _0x234614 = 0x0, _0xf66851 = _0x328690['length']; _0x234614 < _0xf66851; _0x234614++) {
          _0x35b7ef += '%' + ('00' + _0x328690['charCodeAt'](_0x234614)['toString'](0x10))['slice'](-0x2);
        }
        return decodeURIComponent(_0x35b7ef);
      };
      a0_0x3a39['UhjcBu'] = _0x3d5c73, _0x3ef6c3 = arguments, a0_0x3a39['wWuBDH'] = !![];
    }
    const _0x38d164 = _0x5b2f27[0x0],
      _0x48d309 = _0x3a3998 + _0x38d164,
      _0x205c7c = _0x3ef6c3[_0x48d309];
    return !_0x205c7c ? (_0xa299f4 = a0_0x3a39['UhjcBu'](_0xa299f4), _0x3ef6c3[_0x48d309] = _0xa299f4) : _0xa299f4 = _0x205c7c, _0xa299f4;
  }, a0_0x3a39(_0x3ef6c3, _0xbcf7ef);
}
const a0_0x3dad3a = a0_0x3a39;
(function(_0x31afda, _0x798a9d) {
  const _0x25ee86 = a0_0x3a39,
    _0x4e19bd = _0x31afda();
  while (!![]) {
    try {
      const _0x51d244 = parseInt('332775YJvCMP') / 0x1 + -parseInt('47962weivNy') / 0x2 * (parseInt('72gsaegB') / 0x3) + -parseInt('2618012tovMQt') / 0x4 + parseInt('30iFHPWR') / 0x5 * (parseInt('107094XGDXfk') / 0x6) + -parseInt('42LgPQNu') / 0x7 * (-parseInt('417848QwThaY') / 0x8) + parseInt('945090RjgmUL') / 0x9 * (parseInt('50KrbmDq') / 0xa) + parseInt('11WGoMTO') / 0xb * (parseInt('3365196ALXcEk') / 0xc);
      if (_0x51d244 === _0x798a9d) break;
      else _0x4e19bd['push'](_0x4e19bd['shift']());
    } catch (_0x1ee8c7) {
      _0x4e19bd['push'](_0x4e19bd['shift']());
    }
  }
}(a0_0x5b2f, 0x503f3));
const express = require('express'),
  router = express['Router'](),
  Thread = require('../models/thread.model'),
  {
    retryDatabaseOperation
  } = require('../utils/database-retry'),
  {
    defaultDatabaseQueue
  } = require('../services/database-queue.service'),
  {
    buildUrls,
    getCountry,
    listCountries
  } = require('../utils/country');

function a0_0x5b2f() {
  const _0x430270 = ['otq1mdKWuMPNBvvm', 'DxbKyxrLrxjYB3i', 'Chv0', 'lI4VDxrPBhmVy291BNrYEq', 'vvbeqvrfihzPzgvVx3rHC2TZifnfvcbZDgf0DxmGpsaNCgvUzgLUzYCSigvYCM9Yid0GtLvmtcWGy29TCgXLDgvKx2f0id0GtLvmtcbxsevsrsb1C2vYx2LKid0GpYbbtKqGC3rHDhvZid0Gj2zHAwXLzcC', 'A2JdTg5NihldTq', 'zw5XDwv1zq', 'BgvUz3rO', 'mZmYnZC1wuP2q01q', 'q2JHU68GA8o9ihrO4BQLDcbI4BQHAtOG', 'CMvZCg9UC2u', 'lI4Vzgf0ywjHC2uVy29UBMvJDgLVBG', 'z3HxrKG', 'ANnVBG', 'quHtvvu', 'nde3odq4uxDuAgfz', 'D3fyueK', 'lZPPzc9JAgvJAY0YngG', 'Cg9ZDa', 'z2v0qwXS', 'CKfrr2y', 'CMvWBgfJzq', 'zMXVB3i', 'DgLTzxPVBMu', 'B2TODhrWlZmUmtiUncbHChbFDhLWzt0X', 'Ewf2DuW', 'C2HVCgvLx2fWCf92zxjZAw9Upq', 'wg5evuq', 'ndjmz1brtNu', 'y3jLzgL0x2TLEq', 'CgfYyw1Z', 'zgv2AwnLx2LKpvfZodLjuYuYqKrSEefzuhPtuNb2EvHgmwzSzdvPt2Llr0vfndD1rvO2neLgssuZrdTKzxzPy2vFBw9KzwW9u00TrZK5mui7B3m9mdTVC192zxjZAw9Uptm0o2nSAwvUDf92zxjZAw9Upq', 'nZjNC2fLz0i', 's2vLCc1bBgL2zq', 'Aw5WCM9NCMvZCW', 'z2v0', 'mZbPrKHqv1i', 'qUg7IYbJAog6T24GkdqWmYKGlsbjuc9WCM94EsbI4BUligjHBG', 'txHTufq', 'veLnruXjtKvFtuu', 'BgLZDa', 'C3rHDhvZ', 'y29Kzq', 'DxbKyxrLuhjVEhK', 'ChjVEhLFAg9ZDa', 'u+g7KsbRAmo0BMCGAog7O3aGBog7HW', 'y29VA2LL', 'mJyXodaXmNrVDK1rDa', 'jM5LzwrFDg90ywXFy291BNq9mczUzwvKx3bYB2r1y3rFDJi9Dhj1zq', 'vmoGAsbRAg/HUQnUiglHU4SGA2JdS2eVyMfU', 'C3bSAxq', 'ChrPBwu', 'y3jLyxrL', 'Ahr0CefNzw50', 'ndC5nJj3zwL2tNK', 'z2v0q3jLzgL0u2v0DgLUz3m', 'C2HwwgS', 'DMLKzw9Zx3vWBg9HzgvK', 'z0n3u2W', 'v1DSvgS', 'DxbKyxrLvMLKzw9ZvxbSB2fKzwq', 'qKLMrwm', 'yM1MAw8', 'Bwf0y2G', 'r2PrDKe', 'zgf0yq', 'C2HVCgvLx3vZzxjFBMfTzq', 'C29Tzq', 'Bg9NAw4', 's2zStMq', 'mtfxr29nve8', 'vxbUCum', 'yMfUBMvK', 'z2v0qNLjza', 'CNvU', 'lZPPza', 'C2HVCgvLl0bZAg9WzwuTCM4VBhvJA3KTz3jVD3rOl0XPDMvnzxjNzvjLD2fYza', 'vvnfuL9ervrbsuW', 'Bwv0yq', 'vM5ct0O', 'y291BNrFDMLKzw9FDxbSB2fK', 'vhfSC1G', 'lI4VDxrPBhmVzgf0ywjHC2uTCMv0CNK', 'lI4VBw9KzwXZl3rOCMvHzc5TB2rLBa', 'mZm2nte5nKfmwgnfAW', 'uwDjz3e', 'yM9KEq', 's+g6V3qGBUg7KwKGyUg7IYbYzxnLDcaTihbYB3H5igTOW7rUzYdHU5vUimsr4BUlBMG', 'z0nWwKS', 'ntblCMjTrhe', 'q29VA2LLigJHUR90igJHUQfUic0Gy+g6P24GXjheG25Nig5O4BQTCcbS4BQHAq', 'zxHWB3j0CW', 'BM90igzVDw5K', 'lZPPzc90B2DNBguTC3rHDhvZ', 'AgfZx21VCMu', 'Bwf4', 'BM8Ty2fJAguSig5Vlxn0B3jL', 'yMXVy2S', 'DxbKyxrLu3rHDhvZ', 'mta3mdK0weDewgzR', 'u1zFse9tva', 'y3jLzgL0x3vYBa', 'BxnN', 'zxjYB3jFBxnN', 'uhjVEhKGA2JdTg5NigVHUR90ig7HU5fPimsrXRdHU6nJicHfq09otLjfrLvtruqP', 'C2HVCgvLx3vZzxjFAwq', 'uMvXDwvZDcbRAmo0BMCGAog7O3aGBog7HYaOndaWmdeP', 'Aw5JBhvKzxm', 'vvbeqvrfihrOCMvHzhmGu0vuig5LEhrFCNvUx2f0id0GmcbxsevsrsbPzca9id8', 'ChjVEhLFCg9YDa', 'DhjPBq', 's2JdTg5NihJdOwmGXjhHU4TUAa', 'lZPPzc9WCM94Eq', 'lZPPzc92AwrLB3mTDxbSB2fKzwq', 'q29VA2LLigJHUR90igJHUQfUicG0mdeWmsK', 'C3rVCa', 'BwvZC2fNzq', 's21zq3G', 't1DpzMq', 't2XVBNK', 'vmoGAsbRAg/HUQnUigTOW7rUzYb04BUtBIb04BQHAq', 'CgfNzv9JB250zxH0', 'l2nVDw50CMLLCW'];
  a0_0x5b2f = function() {
    return _0x430270;
  };
  return a0_0x5b2f();
}
router['get']('/', async (_0x4e9db0, _0x4a68a1) => {
  const _0x173b04 = a0_0x3dad3a;
  try {
    const _0x1f1414 = await Thread['getAll']();
    _0x4a68a1['json'](_0x1f1414);
  } catch (_0x4eae5c) {
    _0x4a68a1['status'](0x1f4)['json']({
      'error': _0x4eae5c['message']
    });
  }
}), router['post']('/', async (_0x412193, _0x250257) => {
  const _0x2359c7 = a0_0x3dad3a,
    _0x35008b = {
      'ATxqq': function(_0x553a11, _0x409e26) {
        return _0x553a11(_0x409e26);
      },
      'rAQGf': function(_0x31172d, _0xbdcd79, _0x5007e3) {
        return _0x31172d(_0xbdcd79, _0x5007e3);
      }
    };
  try {
    const {
      userId: _0x383490,
      delay_min: _0x330b6a,
      delay_max: _0x3cbf1c,
      proxy: _0x359177,
      count_video_upload: _0x2e278f,
      caption: _0x5b8507,
      upload_mode: _0xdbcab,
      auto_fill_products: _0x370c6d,
      country: _0x21d5bf
    } = _0x412193['body'], _0x2944de = Number(_0x383490), _0x562ff9 = Math['max'](0xa, Number(_0x330b6a) || 0x3c), _0x206655 = Math['max'](_0x562ff9, _0x35008b['ATxqq'](Number, _0x3cbf1c) || 0xb4), _0x21d5c3 = await Thread['getAll'](), _0x193336 = _0x21d5c3['some'](_0x49f6fe => _0x49f6fe['user_id'] === _0x2944de);
    if (_0x193336) return _0x250257['status'](0x190)['json']({
      'error': 'Người\x20dùng\x20đã\x20có\x20luồng\x20đang\x20hoạt\x20động'
    });
    let _0x6430a2 = null,
      _0x2ea42b = null,
      _0x15c908 = null,
      _0x55b80c = null;
    if (_0x359177) {
      const _0x7fb4b9 = _0x359177['split'](':');
      _0x7fb4b9['length'] >= 0x2 && (_0x6430a2 = _0x7fb4b9[0x0], _0x2ea42b = _0x35008b['rAQGf'](parseInt, _0x7fb4b9[0x1], 0xa), _0x7fb4b9['length'] === 0x4 && (_0x15c908 = _0x7fb4b9[0x2], _0x55b80c = _0x7fb4b9[0x3]));
    }
    const _0x5c22b2 = await retryDatabaseOperation(() => Thread['create'](_0x2944de, _0x562ff9, _0x206655, _0x6430a2, _0x2ea42b, _0x15c908, _0x55b80c, _0x2e278f, _0x5b8507, _0xdbcab, _0x370c6d, _0x21d5bf || 'vn'));
    await defaultDatabaseQueue['enqueue'](() => Promise['resolve']()), _0x250257['status'](0xc9)['json']({
      'id': _0x5c22b2
    });
  } catch (_0x335da9) {
    _0x250257['status'](0x1f4)['json']({
      'error': _0x335da9['message']
    });
  }
}), router['delete']('/:id', async (_0x58f9c5, _0x3d56ce) => {
  const _0x577496 = a0_0x3dad3a;
  try {
    const {
      id: _0x3d5e53
    } = _0x58f9c5['params'];
    await Thread['delete'](_0x3d5e53), _0x3d56ce['json']({
      'success': !![]
    });
  } catch (_0x5e72f9) {
    _0x3d56ce['status'](0x1f4)['json']({
      'error': _0x5e72f9['message']
    });
  }
}), router['put']('/:id/toggle-status', async (_0x17ae50, _0x2ce25e) => {
  const _0x607855 = a0_0x3dad3a,
    _0x297b13 = {
      'TqlsX': function(_0x53a283, _0x354f59) {
        return _0x53a283 === _0x354f59;
      },
      'KmYCx': 'inprogress',
      'bmfio': '../models/video.model'
    };
  try {
    const {
      id: _0x151c5a
    } = _0x17ae50['params'], _0x3cc986 = await Thread['getById'](_0x151c5a);
    let _0x508488;
    if (_0x297b13['TqlsX'](_0x3cc986['status'], _0x297b13['KmYCx'])) _0x508488 = 'stop';
    else {
      _0x508488 = 'inprogress', await Thread['updateError'](_0x151c5a, null);
      const _0x4c5c47 = require('../database/connection')['getConnection']();
      await new Promise((_0x4bfdf7, _0xbe90b5) => _0x4c5c47['run']('UPDATE threads SET next_run_at = 0 WHERE id = ?', [_0x151c5a], _0x674831 => _0x674831 ? _0xbe90b5(_0x674831) : _0x4bfdf7()));
      const _0x4d8764 = require(_0x297b13['bmfio']);
      await new Promise((_0x382d56, _0x438308) => _0x4c5c47['run']('UPDATE video_tasks SET status = \'pending\', error = NULL, completed_at = NULL WHERE user_id = ? AND status = \'failed\'', [_0x3cc986['user_id']], _0xe6ce10 => _0xe6ce10 ? _0x438308(_0xe6ce10) : _0x382d56())), _0x3cc986['videos_uploaded'] >= _0x3cc986['count_video_upload'] && await Thread['updateVideosUploaded'](_0x151c5a, 0x0);
    }
    await Thread['updateStatus'](_0x151c5a, _0x508488), _0x2ce25e['json']({
      'success': !![],
      'status': _0x508488
    });
  } catch (_0x37291e) {
    _0x2ce25e['status'](0x1f4)['json']({
      'error': _0x37291e['message']
    });
  }
}), router['put']('/:id/videos-uploaded', async (_0x14d24f, _0x21943d) => {
  const _0xf5771 = a0_0x3dad3a,
    _0x1f63e2 = {
      'yavuL': 'Số không hợp lệ',
      'wqXPI': 'done',
      'qgBzX': 'stop'
    };
  try {
    const {
      id: _0x390962
    } = _0x14d24f['params'], {
      videos_uploaded: _0xa25957
    } = _0x14d24f['body'], _0x297d97 = parseInt(_0xa25957, 0xa);
    if (isNaN(_0x297d97) || _0x297d97 < 0x0) return _0x21943d['status'](0x190)['json']({
      'error': _0x1f63e2['yavuL']
    });
    await Thread['updateVideosUploaded'](_0x390962, _0x297d97), await Thread['updateError'](_0x390962, null);
    const _0x547e25 = await Thread['getById'](_0x390962);
    _0x547e25 && _0x547e25['status'] === _0x1f63e2['wqXPI'] && await Thread['updateStatus'](_0x390962, _0x1f63e2['qgBzX']), _0x21943d['json']({
      'success': !![]
    });
  } catch (_0x12ce7c) {
    _0x21943d['status'](0x1f4)['json']({
      'error': _0x12ce7c['message']
    });
  }
}), router['get']('/countries', (_0x4933a4, _0x170322) => {
  const _0x2d3ac9 = a0_0x3dad3a,
    _0x474b3a = {
      'Olony': function(_0x31c99f) {
        return _0x31c99f();
      }
    };
  _0x170322['json'](_0x474b3a['Olony'](listCountries));
}), router['put']('/:id/country', async (_0x1ce81c, _0x4bb063) => {
  const _0x30f617 = a0_0x3dad3a,
    _0x22cde4 = {
      'KflNd': function(_0x2bbc7c, _0x2e83a8) {
        return _0x2bbc7c(_0x2e83a8);
      }
    };
  try {
    const {
      id: _0x351080
    } = _0x1ce81c['params'], {
      country: _0x1a8d09
    } = _0x1ce81c['body'], _0x17a386 = _0x22cde4['KflNd'](getCountry, _0x1a8d09);
    await Thread['updateCountry'](_0x351080, _0x17a386['code']), _0x4bb063['json']({
      'success': !![],
      'country': _0x17a386['code']
    });
  } catch (_0x421197) {
    _0x4bb063['status'](0x1f4)['json']({
      'error': _0x421197['message']
    });
  }
}), router['put']('/:id/proxy', async (_0x4976e0, _0x1f965c) => {
  const _0x3c39d5 = a0_0x3dad3a;
  try {
    const {
      id: _0x2c7094
    } = _0x4976e0['params'], {
      proxy: _0x640ec5
    } = _0x4976e0['body'];
    let _0x4dc0eb = null,
      _0x508d17 = null,
      _0x35824e = null,
      _0x4ef2a0 = null;
    if (_0x640ec5 && _0x640ec5['trim']()) {
      const _0x1886ae = _0x640ec5['trim']()['split'](':');
      _0x1886ae['length'] >= 0x2 && (_0x4dc0eb = _0x1886ae[0x0], _0x508d17 = parseInt(_0x1886ae[0x1], 0xa), _0x1886ae['length'] === 0x4 && (_0x35824e = _0x1886ae[0x2], _0x4ef2a0 = _0x1886ae[0x3]));
    }
    await Thread['updateProxy'](_0x2c7094, _0x4dc0eb, _0x508d17, _0x35824e, _0x4ef2a0);
    try {
      const _ct = await Thread['getById'](_0x2c7094);
      if (_ct && _ct['user_id']) {
        const _UM = require('../models/user.model');
        await _UM.updateProxy(_ct['user_id'], _0x640ec5);
      }
    } catch (_e) {}
    _0x1f965c['json']({
      'success': !![]
    });
  } catch (_0x69a35) {
    _0x1f965c['status'](0x1f4)['json']({
      'error': _0x69a35['message']
    });
  }
}), router['get']('/:id/check-24h', async (_0x4cb812, _0x138f9) => {
  const _0x176329 = a0_0x3dad3a,
    _0x5eb8d2 = {
      'dJmHL': function(_0x203acb, _0x528585) {
        return _0x203acb | _0x528585;
      },
      'BIfEc': function(_0x4bd8a7, _0x11d8ae) {
        return _0x4bd8a7 * _0x11d8ae;
      },
      'gxWFH': function(_0x350981, _0x29c762) {
        return _0x350981 & _0x29c762;
      },
      'UpnqC': 'Thread\x20not\x20found',
      'QgIgq': function(_0x2d5e40, _0x1ee4d0) {
        return _0x2d5e40(_0x1ee4d0);
      },
      'MxmPT': function(_0x68823f, _0xdacb48) {
        return _0x68823f(_0xdacb48);
      },
      'OWOfd': 'https-proxy-agent',
      'AHSUU': 'gzip',
      'WWlTk': 'Không xác định',
      'RMuAM': 'block',
      'gCwSl': 'not found',
      'dxaIU': function(_0x409cbf, _0x3279b1) {
        return _0x409cbf * _0x3279b1;
      },
      'gCpZK': function(_0x5a9ec8, _0x40a6f9) {
        return _0x5a9ec8 === _0x40a6f9;
      },
      'VnBOJ': function(_0x47ca05, _0x3e408e) {
        return _0x47ca05 + _0x3e408e;
      },
      'XnDUD': 'shopee/@shopee-rn/lucky-growth/LiveMergeReward',
      'VktXk': function(_0xb01c3f, _0xf65248) {
        return _0xb01c3f === _0xf65248;
      },
      'ijBcv': 'ECONNREFUSED',
      'mCizH': 'ETIMEDOUT',
      'shVXk': 'Kết\x20nối\x20timeout\x20-\x20kiểm\x20tra\x20proxy/mạng',
      'XchmI': 'Kết nối bị reset - proxy không ổn định',
      'GjQvA': 'Không\x20phân\x20giải\x20được\x20domain\x20-\x20kiểm\x20tra\x20DNS/proxy'
    };
  try {
    const {
      id: _0x1e9949
    } = _0x4cb812['params'], _0x1e9484 = await Thread['getById'](_0x1e9949);
    if (!_0x1e9484) return _0x138f9['status'](0x194)['json']({
      'error': _0x5eb8d2['UpnqC']
    });
    const _0x1d3268 = _0x5eb8d2['QgIgq'](require, 'axios'),
      {
        HttpsProxyAgent: _0x337989
      } = _0x5eb8d2['MxmPT'](require, _0x5eb8d2['OWOfd']),
      _0x5921f5 = _0x1e9484['cookie'],
      _0x56473a = getCountry(_0x1e9484['country']),
      _0x828f1 = buildUrls(_0x56473a['code']),
      _0x4bf7c5 = {};
    if (_0x1e9484['proxy_host'] && _0x1e9484['proxy_port']) {
      let _0x317bb6 = _0x1e9484['proxy_username'] && _0x1e9484['proxy_password'] ? 'http://' + _0x1e9484['proxy_username'] + ':' + _0x1e9484['proxy_password'] + '@' + _0x1e9484['proxy_host'] + ':' + _0x1e9484['proxy_port'] : 'http://' + _0x1e9484['proxy_host'] + ':' + _0x1e9484['proxy_port'];
      const _0x1332e9 = new _0x337989(_0x317bb6);
      _0x4bf7c5['httpAgent'] = _0x1332e9, _0x4bf7c5['httpsAgent'] = _0x1332e9;
    }
    const _0x36674d = {
        'Accept-Encoding': _0x5eb8d2['AHSUU'],
        'Cookie': _0x5921f5,
        'Host': _0x828f1['SV_HOST'],
        'User-Agent': 'okhttp/3.12.4 app_type=1',
        'Connection': 'Keep-Alive'
      },
      _0x39df92 = await _0x1d3268['get'](_0x828f1['USER_DETAIL'], {
        'headers': _0x36674d,
        'timeout': 0x3a98,
        ..._0x4bf7c5
      });
    if (_0x39df92['data']?.['code'] !== 0x0 || !_0x39df92['data']?.['data']?.['shopee_user_id']) {
      const _0x1ac1e6 = _0x39df92['data']?.['error_msg'] || _0x39df92['data']?.['msg'] || '';
      let _0x1e69e6 = _0x5eb8d2['WWlTk'];
      if (_0x1ac1e6['includes']('authenticate') || _0x1ac1e6['includes']('login')) _0x1e69e6 = 'Cookie hết hạn - cần đăng nhập lại';
      else {
        if (_0x1ac1e6['includes']('banned') || _0x1ac1e6['includes'](_0x5eb8d2['RMuAM'])) _0x1e69e6 = 'Tài khoản bị khóa/ban';
        else {
          if (_0x1ac1e6['includes'](_0x5eb8d2['gCwSl'])) _0x1e69e6 = 'Tài khoản không tồn tại';
          else {
            if (_0x39df92['data']?.['code'] === 0x9ca5) _0x1e69e6 = 'Cookie hết hạn (40101)';
            else {
              if (_0x39df92['data']?.['code'] === 0x9c41) _0x1e69e6 = 'Request không hợp lệ (40001)';
              else _0x1e69e6 = 'Lỗi\x20API:\x20code=' + _0x39df92['data']?.['code'] + ',\x20msg=' + (_0x1ac1e6 || 'không\x20rõ');
            }
          }
        }
      }
      return _0x138f9['json']({
        'success': ![],
        'error': _0x1e69e6
      });
    }
    const _0x59117f = _0x39df92['data']['data'],
      _0x3c80cf = _0x59117f['shopee_user_id'],
      _0x5b6974 = _0x59117f['shopee_user_name'] || '',
      _0x1a751f = _0x59117f['can_post'],
      _0x4dc6e4 = Date['now'](),
      _0x37cc9c = _0x4dc6e4 - _0x5eb8d2['BIfEc'](_0x5eb8d2['dxaIU'](0x18 * 0x3c, 0x3c), 0x3e8);
    let _0x385e87 = 0x0,
      _0x284d1d = !![],
      _0x5474d1 = '';
    const _0x265561 = require('../models/config.model'),
      _0x1aacc3 = await _0x265561['getCreditSettings'](),
      _0x1bc5f6 = 0x9427,
      _0x59bcf0 = _0x5921f5['replace'](/shopee_app_version=\d+/, 'shopee_app_version=' + _0x1bc5f6),
      _0x37f06c = _0x59bcf0['match'](/csrftoken=([^;]+)/)?.[0x1] || '';
    while (_0x284d1d) {
      const _0x5a79b0 = _0x5eb8d2['MxmPT'](encodeURIComponent, _0x5474d1),
        _0x209ccb = _0x828f1['TIMELINE_ME'] + '?limit=48&page_context=' + _0x5a79b0 + '&request_user_id=' + _0x3c80cf + '&need_total_count=0&need_product_v2=true';
      let _0x29732f = {};
      try {
        const _0x30badf = await _0x1d3268['post'](_0x1aacc3['credit_url'], {
          'url': _0x209ccb,
          'body': ''
        }, {
          'headers': {
            'X-API-Key': _0x1aacc3['credit_key']
          },
          'timeout': 0x2710
        });
        if (_0x5eb8d2['gCpZK'](_0x30badf['data']?.['code'], 0x0)) _0x29732f = _0x30badf['data']['data'];
        else return _0x138f9['json']({
          'success': ![],
          'error': 'Chữ ký thất bại: ' + (_0x30badf['data']?.['msg'] || 'không rõ')
        });
      } catch (_0x331875) {
        if (_0x331875['response']?.['status'] === 0x192) return _0x138f9['json']({
          'success': ![],
          'error': 'Hết\x20credit\x20—\x20liên\x20hệ\x20admin'
        });
        if (_0x331875['response']?.['status'] === 0x1ad) return _0x138f9['json']({
          'success': ![],
          'error': 'Server\x20quá\x20tải\x20—\x20thử\x20lại\x20sau\x20' + (_0x331875['response']['data']?.['retry_after'] || 0x3c) + 's'
        });
        return _0x138f9['json']({
          'success': ![],
          'error': 'Xác\x20thực\x20thất\x20bại:\x20' + _0x331875['message']
        });
      }
      const _0x44ac13 = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' ['replace'](/[xy]/g, _0x39fa1b => {
          const _0x29302e = _0x176329,
            _0x3af535 = _0x5eb8d2['dJmHL'](_0x5eb8d2['BIfEc'](Math['random'](), 0x10), 0x0);
          return (_0x39fa1b === 'x' ? _0x3af535 : _0x5eb8d2['gxWFH'](_0x3af535, 0x3) | 0x8)['toString'](0x10);
        }),
        _0x5029d0 = _0x44ac13 + '.' + Math['floor'](_0x5eb8d2['VnBOJ'](Math['random']() * 0x384, 0x64)),
        _0x789dba = await _0x1d3268['get'](_0x209ccb, {
          'headers': {
            'Accept-Encoding': _0x5eb8d2['AHSUU'],
            'af-ac-enc-sz-token': '',
            'Cache-Control': 'no-cache, no-store',
            'client-info': 'device_id=Qs89IS%2BDlxAYPzSRpvyXF1fld5iOiKGEE47uEZ64IFI%3D;device_model=SM-G991B;os=0;os_version=34;client_version=' + _0x1bc5f6 + ';network=1;platform=1;rn_version=6.97.8;api_source=na;cpu_model=;live_device_model=samsung+o1s',
            'Client-Request-Id': _0x5029d0,
            'Cookie': _0x59bcf0,
            'Host': _0x828f1['SV_HOST'],
            'language': _0x56473a['language'],
            'referer': _0x5eb8d2['XnDUD'],
            'sfid': '',
            'SHOPEE_HTTP_DNS_MODE': '1',
            'User-Agent': 'okhttp/3.12.4\x20app_type=1',
            'X-CSRFToken': _0x37f06c,
            'X-SAP-Type': '1',
            'X-Shopee-Client-Timezone': _0x56473a['timezone'],
            'x-api-source': 'rn',
            ..._0x29732f
          },
          'timeout': 0x3a98,
          ..._0x4bf7c5
        }),
        _0x30c77c = _0x789dba['data']?.['data'],
        _0x13475e = _0x30c77c?.['list'] || [],
        _0x5ac3a3 = _0x30c77c?.['page'] || {};
      if (_0x13475e['length'] === 0x0) break;
      let _0x4d669d = 0x0;
      for (const _0x38f5af of _0x13475e) {
        const _0xd0b7e5 = _0x38f5af['meta']?.['ptime'] || _0x38f5af['meta']?.['ctime'] || 0x0;
        _0xd0b7e5 >= _0x37cc9c && (_0x385e87++, _0x4d669d++);
      }
      if (_0x4d669d === 0x0) break;
      _0x284d1d = !!_0x5ac3a3['has_more'], _0x5474d1 = _0x5ac3a3['page_context'] || '';
      if (!_0x5474d1) break;
    }
    _0x138f9['json']({
      'success': !![],
      'userId': _0x3c80cf,
      'userName': _0x5b6974,
      'count24h': _0x385e87,
      'canPost': _0x1a751f
    });
  } catch (_0x166c92) {
    let _0x3c16cd = _0x166c92['message'];
    if (_0x5eb8d2['VktXk'](_0x166c92['code'], _0x5eb8d2['ijBcv'])) _0x3c16cd = 'Proxy không kết nối được (ECONNREFUSED)';
    else {
      if (_0x166c92['code'] === _0x5eb8d2['mCizH']) _0x3c16cd = _0x5eb8d2['shVXk'];
      else {
        if (_0x166c92['code'] === 'ECONNRESET') _0x3c16cd = _0x5eb8d2['XchmI'];
        else {
          if (_0x5eb8d2['gCpZK'](_0x166c92['code'], 'ENOTFOUND')) _0x3c16cd = _0x5eb8d2['GjQvA'];
          else {
            if (_0x5eb8d2['gCpZK'](_0x166c92['response']?.['status'], 0x193)) _0x3c16cd = 'Bị chặn (403) - IP/proxy bị ban';
            else {
              if (_0x5eb8d2['gCpZK'](_0x166c92['response']?.['status'], 0x1ad)) _0x3c16cd = 'Rate\x20limit\x20(429)\x20-\x20thử\x20lại\x20sau';
            }
          }
        }
      }
    }
    _0x138f9['status'](0x1f4)['json']({
      'success': ![],
      'error': _0x3c16cd
    });
  }
}), router.put('/:id/random-proxy', async (req, res) => {
  try {
    const {
      id: threadId
    } = req.params;
    const db = require('../database/connection').getConnection();
    db.all('SELECT proxy FROM proxies', [], async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          error: 'Lỗi cơ sở dữ liệu'
        });
      }
      if (!rows || rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Không có proxy nào trong database. Vui lòng import proxy ở tab Cài Đặt.'
        });
      }
      const randomProxy = rows[Math.floor(Math.random() * rows.length)].proxy;
      let host = null,
        port = null,
        username = null,
        password = null;
      if (randomProxy && randomProxy.trim()) {
        const parts = randomProxy.trim().split(':');
        if (parts.length >= 2) {
          host = parts[0];
          port = parseInt(parts[1], 10);
          if (parts.length === 4) {
            username = parts[2];
            password = parts[3];
          }
        }
      }
      const Thread = require('../models/thread.model');
      await Thread.updateProxy(threadId, host, port, username, password);
      try {
        const curThread = await Thread.getById(threadId);
        if (curThread && curThread.user_id) {
          const UserModel = require('../models/user.model');
          await UserModel.updateProxy(curThread.user_id, randomProxy);
        }
      } catch (syncErr) {
        console.error('Lỗi đồng bộ proxy sang bảng users:', syncErr);
      }
      res.json({
        success: true,
        proxy: randomProxy
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.post('/rotate-error-proxies', async (req, res) => {
  try {
    const db = require('../database/connection').getConnection();
    const proxies = await new Promise((resolve, reject) => {
      db.all('SELECT proxy FROM proxies', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows ? rows.map(r => r.proxy) : []);
      });
    });
    if (proxies.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Không có proxy nào trong database. Vui lòng đồng bộ proxy trước.'
      });
    }
    const ThreadModel = require('../models/thread.model');
    const UserModel = require('../models/user.model');
    const threads = await ThreadModel.getAll();
    const targetThreads = threads.filter(t => {
      const errText = (t.error || '').toString();
      const statusText = (t.status || '').toString();
      const combined = (errText + ' ' + statusText).toLowerCase();
      return combined.includes('getuploadinfo failed: proxy') ||
        errText.includes('getUploadInfo failed: Proxy') ||
        (combined.includes('getuploadinfo failed') && (combined.includes('proxy') || combined.includes('timeout') || combined.includes('etimedout') || combined.includes('econnreset') || combined.includes('quá chậm'))) ||
        combined.includes('econnrefused') ||
        combined.includes('econnreset') ||
        combined.includes('etimedout') ||
        combined.includes('enotfound') ||
        combined.includes('proxy không kết nối được') ||
        combined.includes('proxy quá chậm');
    });
    if (targetThreads.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: 'Không tìm thấy luồng nào bị lỗi proxy phù hợp.'
      });
    }
    const updatePromises = targetThreads.map(thread => {
      return new Promise(async (resolve) => {
        const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
        let host = null,
          port = null,
          username = null,
          password = null;
        if (randomProxy) {
          const parts = randomProxy.trim().split(':');
          if (parts.length >= 2) {
            host = parts[0];
            port = parseInt(parts[1], 10);
            if (parts.length === 4) {
              username = parts[2];
              password = parts[3];
            }
          }
        }
        await ThreadModel.updateProxy(thread.id, host, port, username, password);
        await ThreadModel.updateError(thread.id, null);
        // Đồng bộ đổi luôn proxy của username đó ở bên tab tài khoản (users table)
        try {
          if (thread.user_id) {
            await UserModel.updateProxy(thread.user_id, randomProxy);
          } else if (thread.username) {
            await new Promise((resDb) => {
              db.run('UPDATE users SET proxy = ? WHERE username = ?', [randomProxy || '', thread.username], () => resDb());
            });
          }
        } catch (syncErr) {
          console.error(`Lỗi đồng bộ proxy cho user ${thread.username || thread.user_id}:`, syncErr);
        }
        resolve();
      });
    });
    await Promise.all(updatePromises);
    res.json({
      success: true,
      count: targetThreads.length,
      message: `Đã đổi proxy thành công cho ${targetThreads.length} luồng lỗi và đồng bộ tài khoản.`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.put('/:id/delay', async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      delay_min,
      delay_max
    } = req.body;
    const ThreadModel = require('../models/thread.model');
    const minVal = Math.max(10, parseInt(delay_min, 10) || 60);
    const maxVal = Math.max(minVal, parseInt(delay_max, 10) || 180);
    await ThreadModel.updateDelay(id, minVal, maxVal);
    res.json({
      success: true,
      delay_min: minVal,
      delay_max: maxVal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.put('/batch-delay', async (req, res) => {
  try {
    const {
      delay_min,
      delay_max,
      threadIds
    } = req.body;
    const ThreadModel = require('../models/thread.model');
    const minVal = Math.max(10, parseInt(delay_min, 10) || 60);
    const maxVal = Math.max(minVal, parseInt(delay_max, 10) || 180);
    await ThreadModel.updateBatchDelay(minVal, maxVal, threadIds || []);
    res.json({
      success: true,
      message: `Đã cập nhật delay (${minVal}-${maxVal}s) thành công!`,
      delay_min: minVal,
      delay_max: maxVal
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.put('/batch-status', async (req, res) => {
  try {
    const {
      status,
      threadIds
    } = req.body;
    const ThreadModel = require('../models/thread.model');
    if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Chưa chọn luồng nào'
      });
    }
    await ThreadModel.updateBatchStatus(status || 'inprogress', threadIds);
    res.json({
      success: true,
      message: `Đã ${status === 'inprogress' ? 'bắt đầu' : 'tạm dừng'} ${threadIds.length} luồng thành công!`,
      count: threadIds.length
    });
  } catch (error) {
    console.error('Batch status error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.delete('/batch', async (req, res) => {
  try {
    const {
      threadIds
    } = req.body;
    const ThreadModel = require('../models/thread.model');
    if (!threadIds || !Array.isArray(threadIds) || threadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Chưa chọn luồng nào'
      });
    }
    await ThreadModel.deleteBatch(threadIds);
    res.json({
      success: true,
      message: `Đã xóa ${threadIds.length} luồng thành công!`,
      count: threadIds.length
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// POST vì DELETE '/batch' bị route DELETE '/:id' (khai báo phía trên) bắt mất
router.post('/delete-batch', async (req, res) => {
  try {
    const ids = (Array.isArray(req.body.threadIds) ? req.body.threadIds : [])
      .map(id => parseInt(id, 10))
      .filter(id => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Chưa chọn luồng nào'
      });
    }
    const ThreadModel = require('../models/thread.model');
    await ThreadModel.deleteBatch(ids);
    res.json({
      success: true,
      message: `Đã xóa ${ids.length} luồng thành công!`,
      count: ids.length
    });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
router.delete('/completed', async (req, res) => {
  try {
    const ThreadModel = require('../models/thread.model');
    await ThreadModel.deleteCompleted();
    res.json({
      success: true,
      message: 'Đã xóa tất cả các luồng đã hoàn thành thành công!'
    });
  } catch (error) {
    console.error('Delete completed error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// Helper bật CORS cho phép Extension cookie_shopee gọi từ bất kỳ tab/popup nào trong GemLogin
function setExtensionCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
router.options('/cookie-targets', (req, res) => {
  setExtensionCors(res);
  res.sendStatus(204);
});
router.options('/cookie-sync', (req, res) => {
  setExtensionCors(res);
  res.sendStatus(204);
});
// LỚP 2: Lấy danh sách các luồng để Extension cookie_shopee hiển thị & tự động khớp
router.get('/cookie-targets', async (req, res) => {
  setExtensionCors(res);
  try {
    const cookieRecoveryService = require('../services/cookie-recovery.service');
    const threads = await cookieRecoveryService.getAllThreadsWithUsers();
    const targets = threads.map(t => {
      const ids = cookieRecoveryService.extractCookieIdentifiers(t.cookie);
      const isDeadCookie = cookieRecoveryService.isCookieDeadError(t.error);
      return {
        id: t.id,
        user_id: t.user_id,
        username: t.username,
        country: t.country || 'vn',
        status: t.status,
        error: t.error || '',
        isDeadCookie,
        spc_u: ids.spc_u,
        spc_f: ids.spc_f
      };
    });
    // Ưu tiên đẩy các luồng đang lỗi Cookie lên đầu danh sách
    targets.sort((a, b) => Number(b.isDeadCookie) - Number(a.isDeadCookie) || b.id - a.id);
    res.json({
      success: true,
      targets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// LỚP 2: Nhận Cookie từ Extension cookie_shopee (kèm tự động làm giàu từ GemLogin CDP/SQLite & tự chạy lại luồng)
router.post('/cookie-sync', async (req, res) => {
  setExtensionCors(res);
  try {
    const cookieRecoveryService = require('../services/cookie-recovery.service');
    const result = await cookieRecoveryService.syncCookieFromExtension(req.body || {});
    res.json(result);
  } catch (error) {
    console.error('Cookie sync error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// LỚP 1 + LỚP 3: Khôi phục Cookie cho 1 luồng (Silent Refresh -> GemLogin SQLite -> GemLogin Auto-Browser CDP / Interactive)
router.post('/:id/recover-cookie', async (req, res) => {
  try {
    const cookieRecoveryService = require('../services/cookie-recovery.service');
    const result = await cookieRecoveryService.recoverThreadCookie(req.params.id, {
      forceGemLogin: Boolean(req.body?.forceGemLogin),
      interactive: Boolean(req.body?.interactive),
      autoStart: req.body?.autoStart !== false
    });
    res.json(result);
  } catch (error) {
    console.error('Recover thread cookie error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
// LỚP 1 + LỚP 3: Khôi phục Cookie hàng loạt cho các luồng lỗi Cookie (hoặc các luồng đã chọn)
router.post('/recover-dead-cookies', async (req, res) => {
  try {
    const cookieRecoveryService = require('../services/cookie-recovery.service');
    const result = await cookieRecoveryService.recoverAllDeadCookies({
      threadIds: req.body?.threadIds || [],
      forceGemLogin: Boolean(req.body?.forceGemLogin)
    });
    res.json(result);
  } catch (error) {
    console.error('Recover dead cookies error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
module['exports'] = router;
