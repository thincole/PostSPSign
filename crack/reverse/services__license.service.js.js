const a0_0x4ef507 = a0_0x5474;

function a0_0x5474(_0x4d47ea, _0x347662) {
  const _0x5548bc = a0_0x5548();
  return a0_0x5474 = function(_0x5474e6, _0x45f7e0) {
    _0x5474e6 = _0x5474e6 - 0x125;
    let _0x1ce59a = _0x5548bc[_0x5474e6];
    return _0x1ce59a;
  }, a0_0x5474(_0x4d47ea, _0x347662);
}(function(_0x406b29, _0x216d61) {
  const _0x2c119a = a0_0x5474,
    _0x4a3b88 = _0x406b29();
  while (!![]) {
    try {
      const _0x335dd0 = -parseInt('9npStQD') / 0x1 * (-parseInt('312964cjszcD') / 0x2) + -parseInt('4286508RPLgAn') / 0x3 * (-parseInt('4MVxTtP') / 0x4) + -parseInt('65865tvHbbf') / 0x5 * (-parseInt('54dVZfrv') / 0x6) + -parseInt('707KUwFMl') / 0x7 * (-parseInt('80384tidEOZ') / 0x8) + parseInt('4184307QTkRBN') / 0x9 * (parseInt('30WBinoq') / 0xa) + parseInt('124179suHKtp') / 0xb * (parseInt('1680DXRRVJ') / 0xc) + -parseInt('78443781vxMHqd') / 0xd;
      if (_0x335dd0 === _0x216d61) break;
      else _0x4a3b88['push'](_0x4a3b88['shift']());
    } catch (_0x333c9f) {
      _0x4a3b88['push'](_0x4a3b88['shift']());
    }
  }
}(a0_0x5548, 0xde937));
const crypto = require('crypto'),
  os = require('os'),
  https = require('https');
class LicenseService {
  constructor() {
    const _0x170fe1 = a0_0x4ef507;
    this['serverDomain'] = process['env']['LICENSE_SERVER_DOMAIN'] || 'license.becoin.xyz', this['serverPort'] = process['env']['LICENSE_SERVER_PORT'] || '443', this['baseUrl'] = 'https://' + this['serverDomain'], this['enableCertPinning'] = process['env']['ENABLE_CERT_PINNING'] === 'true', this['serverFingerprint'] = process['env']['SERVER_CERT_FINGERPRINT'], this['isCloudflare'] = process['env']['CLOUDFLARE_SSL'] === 'true', this['baseSecret'] = process['env']['LICENSE_BASE_SECRET'] || 'MLS@2025Shopee', this['encryptionKey'] = this['deriveEncryptionKey'](), this['appSignature'] = 'shopee_uploader_v7_mls_2025', this['licenseKey'] = null, this['lastValidation'] = null, this['validationInterval'] = 0x1e * 0x3c * 0x3e8, this['isValidated'] = ![], this['debugMode'] = process['env']['NODE_ENV'] === 'development', this['debugMode'] && (console['log']('🌐 License Server: ' + this['baseUrl']), console['log']('🔐 Certificate Pinning: ' + (this['enableCertPinning'] ? 'Enabled' : 'Disabled')));
  } ['deriveEncryptionKey']() {
    const _0x17207c = a0_0x4ef507;
    try {
      const _0x4f8610 = [this['baseSecret'], 'app.py', 'Python 3.13.0', 'Windows', 'fixed_salt_mls_2025'],
        _0x58ad78 = _0x4f8610['join']('|'),
        _0x5452bf = crypto['createHash']('sha256')['update']('mls_shopee_salt_2025')['digest'](),
        _0x5577ce = crypto['pbkdf2Sync'](_0x58ad78, _0x5452bf, 0x186a0, 0x20, 'sha512');
      return _0x5577ce;
    } catch (_0x563f50) {
      return crypto['createHash']('sha256')['update'](this['baseSecret'] + 'fallback_salt')['digest']();
    }
  } ['generateHardwareFingerprint']() {
    const _0x72d521 = a0_0x4ef507;
    try {
      const _0x2b859b = os['networkInterfaces'](),
        _0x29b806 = [];
      for (const _0x506aa0 of Object['values'](_0x2b859b)) {
        for (const _0x2f79cb of _0x506aa0) {
          _0x2f79cb['mac'] && _0x2f79cb['mac'] !== '00:00:00:00:00:00' && _0x29b806['push'](_0x2f79cb['mac']);
        }
      }
      const _0x3829d8 = os['cpus']()[0x0],
        _0x5dc1c7 = [_0x3829d8['model']['replace'](/\s+/g, ''), _0x3829d8['speed']['toString'](), os['cpus']()['length']['toString']()]['join']('|'),
        _0x26d34c = [_0x5dc1c7, os['totalmem']()['toString'](), _0x29b806['sort']()['join']('|'), os['platform'](), os['arch'](), os['hostname'](), process['platform']]['join']('|');
      return crypto['createHash']('sha256')['update'](_0x26d34c + this['appSignature'])['digest']('hex')['substring'](0x0, 0x20);
    } catch (_0x393879) {
      throw new Error('Failed to generate hardware fingerprint');
    }
  } ['encryptPayload'](_0x2c0306) {
    const _0x315d1c = a0_0x4ef507;
    try {
      const _0x141bd0 = JSON['stringify'](_0x2c0306),
        _0x56a7d2 = crypto['randomBytes'](0x10),
        _0x1f4e11 = Date['now']()['toString'](),
        _0xb3a36a = Buffer['from'](this['appSignature'] + _0x1f4e11),
        _0x446fe3 = crypto['createCipheriv']('aes-256-gcm', this['encryptionKey'], _0x56a7d2);
      _0x446fe3['setAAD'](_0xb3a36a);
      let _0x1dddb3 = _0x446fe3['update'](_0x141bd0, 'utf8');
      _0x1dddb3 = Buffer['concat']([_0x1dddb3, _0x446fe3['final']()]);
      const _0x38e2d4 = _0x446fe3['getAuthTag'](),
        _0x58f1c0 = Buffer['concat']([_0x56a7d2, _0x38e2d4, _0xb3a36a, _0x1dddb3]),
        _0x1df985 = _0x58f1c0['toString']('base64'),
        _0x1f43a6 = crypto['randomBytes'](0x10)['toString']('hex'),
        _0x147f3e = Date['now'](),
        _0x4db4a1 = _0x1df985 + _0x147f3e + _0x1f43a6 + this['appSignature'],
        _0x13f3d = crypto['createHmac']('sha256', this['encryptionKey'])['update'](_0x4db4a1)['digest']('hex');
      return {
        'payload': _0x1df985,
        'timestamp': _0x147f3e,
        'nonce': _0x1f43a6,
        'signature': _0x13f3d
      };
    } catch (_0x266f33) {
      throw new Error('Encryption failed');
    }
  } ['decryptResponse'](_0x2f9e5a) {
    const _0x93f626 = a0_0x4ef507;
    try {
      const _0x4f41af = Buffer['from'](_0x2f9e5a, 'base64'),
        _0x233972 = _0x4f41af['slice'](0x0, 0x10),
        _0x599ecc = this['appSignature']['length'];
      for (let _0x2f0764 = 0xa; _0x2f0764 <= 0xd; _0x2f0764++) {
        try {
          const _0x981280 = _0x599ecc + _0x2f0764,
            _0x167983 = _0x4f41af['slice'](0x10, 0x10 + _0x981280),
            _0x37187e = _0x4f41af['slice'](0x10 + _0x981280),
            _0x3a5343 = _0x37187e['slice'](0x0, -0x10),
            _0x4ead60 = _0x37187e['slice'](-0x10),
            _0x17de76 = crypto['createDecipheriv']('aes-256-gcm', this['encryptionKey'], _0x233972);
          _0x17de76['setAAD'](_0x167983), _0x17de76['setAuthTag'](_0x4ead60);
          let _0x3b5d51 = _0x17de76['update'](_0x3a5343, null, 'utf8');
          _0x3b5d51 += _0x17de76['final']('utf8');
          const _0x136b54 = JSON['parse'](_0x3b5d51);
          return _0x136b54;
        } catch (_0x4cf1cd) {
          continue;
        }
      }
      throw new Error('Could\x20not\x20decrypt\x20response');
    } catch (_0x38bc86) {
      throw new Error('Decryption failed');
    }
  } ['generateValidationEndpoints']() {
    const _0x156dc8 = a0_0x4ef507;
    return [{
      'hostname': this['serverDomain'],
      'port': 0x1bb,
      'path': '/validate'
    }, {
      'hostname': this['serverDomain'],
      'port': 0x1bb,
      'path': '/v1/validate'
    }, {
      'hostname': this['serverDomain'],
      'port': 0x1bb,
      'path': '/api/validate'
    }];
  }
  async ['validateLicense'](_0x3c94f0) {
    const _0x3d3e7a = a0_0x4ef507;
    try {
      this['debugMode'] && console['log']('🔄 Validating license...');
      const _0x5b971d = this['generateHardwareFingerprint'](),
        _0x1afc0f = this['generateValidationEndpoints']();
      let _0x3fc0b3;
      for (const _0x3c1fd8 of _0x1afc0f) {
        try {
          const _0x52807a = await this['validateWithEndpoint'](_0x3c94f0, _0x3c1fd8, _0x5b971d);
          if (_0x52807a) return this['isValidated'] = !![], this['lastValidation'] = Date['now'](), this['licenseKey'] = _0x3c94f0, console['log']('✅\x20License\x20activated\x20successfully'), !![];
        } catch (_0x46a5d1) {
          _0x3fc0b3 = _0x46a5d1;
          continue;
        }
      }
      throw _0x3fc0b3 || new Error('License validation failed');
    } catch (_0x200d07) {
      this['isValidated'] = ![];
      if (_0x200d07['message']['includes']('deactivated')) console['log']('❌ License is deactivated');
      else {
        if (_0x200d07['message']['includes']('expired')) console['log']('❌ License has expired');
        else {
          if (_0x200d07['message']['includes']('Maximum machines')) console['log']('❌\x20Maximum\x20machine\x20limit\x20reached');
          else _0x200d07['message']['includes']('Invalid') ? console['log']('❌ Invalid license key') : console['log']('❌ License validation failed');
        }
      }
      throw new Error('License\x20validation\x20failed');
    }
  }
  async ['validateWithEndpoint'](_0x4aae17, _0x13cc2a, _0x249bb8) {
    const _0x18714b = a0_0x4ef507,
      _0x113b84 = {
        'key': _0x4aae17,
        'fingerprint': _0x249bb8,
        'timestamp': Date['now'](),
        'app_version': '7.0',
        'app_signature': this['appSignature'],
        'node_version': process['version'],
        'platform': os['platform']()
      },
      _0x5f390b = this['encryptPayload'](_0x113b84),
      _0x196afb = JSON['stringify']({
        'data': _0x5f390b['payload'],
        'timestamp': _0x5f390b['timestamp'],
        'nonce': _0x5f390b['nonce'],
        'signature': _0x5f390b['signature']
      }),
      _0xd5e937 = {
        'hostname': _0x13cc2a['hostname'],
        'port': _0x13cc2a['port'],
        'path': _0x13cc2a['path'],
        'method': 'POST',
        'headers': {
          'Content-Type': 'application/json',
          'Content-Length': _0x196afb['length'],
          'User-Agent': 'ShopeeUploader/7.0',
          'X-App-Signature': this['appSignature'],
          'Accept': 'application/octet-stream, application/json, */*',
          'Accept-Encoding': 'gzip,\x20deflate,\x20br',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'DNT': '1',
          'Origin': 'https://' + _0x13cc2a['hostname'],
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        'timeout': 0x3a98
      };
    return this['enableCertPinning'] && this['serverFingerprint'] && (_0xd5e937['checkServerIdentity'] = (_0x1c15f9, _0x47e087) => {
      const _0x3f75b3 = _0x18714b,
        _0xd8a97 = _0x47e087['fingerprint256'];
      if (_0xd8a97 !== this['serverFingerprint']) throw new Error('Certificate validation failed');
    }), new Promise((_0x229d10, _0x30e450) => {
      const _0x2d123a = _0x18714b,
        _0x23569f = https['request'](_0xd5e937, _0x1afba7 => {
          const _0x5074a1 = _0x2d123a;
          let _0x378c20 = '';
          _0x1afba7['on']('data', _0x60e49a => {
            _0x378c20 += _0x60e49a;
          }), _0x1afba7['on']('error', _0xerr => {
            _0x30e450(_0xerr);
          }), _0x1afba7['on']('end', () => {
            const _0x3fd72d = _0x5074a1;
            try {
              if (_0x1afba7['statusCode'] !== 0xc8) {
                _0x30e450(new Error('Server\x20returned\x20' + _0x1afba7['statusCode']));
                return;
              }
              const _0xf80bc0 = this['decryptResponse'](_0x378c20);
              _0xf80bc0['valid'] && _0xf80bc0['fingerprint'] === _0x249bb8 ? _0x229d10(!![]) : _0x30e450(new Error(_0xf80bc0['message'] || 'License\x20validation\x20failed'));
            } catch (_0x13b369) {
              _0x30e450(new Error('Invalid server response'));
            }
          });
        });
      _0x23569f['on']('error', _0x1f36f2 => {
        const _0x3effbe = _0x2d123a;
        _0x30e450(new Error('Connection failed'));
      }), _0x23569f['on']('timeout', () => {
        const _0x145b43 = _0x2d123a;
        _0x23569f['destroy'](), _0x30e450(new Error('Request timeout'));
      }), _0x23569f['write'](_0x196afb), _0x23569f['end']();
    });
  }
  async ['periodicValidation']() {
    const _0x2a36dc = a0_0x4ef507;
    if (!this['licenseKey']) throw new Error('No license key set');
    const _0x2cbf70 = Date['now']();
    if (this['lastValidation'] && _0x2cbf70 - this['lastValidation'] < this['validationInterval']) return this['isValidated'];
    return this['debugMode'] && console['log']('🔄 Periodic license check...'), await this['validateLicense'](this['licenseKey']);
  } ['isDebuggerAttached']() {
    const _0xbcdea7 = a0_0x4ef507;
    return process['execArgv']['some'](_0x81780d => _0x81780d['includes']('--inspect') || _0x81780d['includes']('--debug') || _0x81780d['includes']('--debug-brk'));
  } ['isBeingMonitored']() {
    const _0x125a54 = a0_0x4ef507;
    try {
      const {
        execSync: _0x3f9b6f
      } = require('child_process');
      let _0x216656 = '';
      os['platform']() === 'win32' ? _0x216656 = _0x3f9b6f('tasklist', {
        'encoding': 'utf8'
      }) : _0x216656 = _0x3f9b6f('ps\x20aux', {
        'encoding': 'utf8'
      });
      const _0x1a3653 = ['procmon', 'wireshark', 'fiddler', 'burpsuite', 'cheatengine', 'ollydbg', 'x64dbg', 'ida', 'ghidra'];
      return _0x1a3653['some'](_0x3989b4 => _0x216656['toLowerCase']()['includes'](_0x3989b4));
    } catch (_0x1eecde) {
      return ![];
    }
  } ['performIntegrityChecks']() {
    const _0x566c2e = a0_0x4ef507;
    this['isDebuggerAttached']() && this['triggerAntiTamper']('Debugger detected'), this['isBeingMonitored']() && this['triggerAntiTamper']('Monitoring detected'), !this['isValidated'] && this['triggerAntiTamper']('License invalid');
  } ['triggerAntiTamper'](_0x2a5fe8) {
    const _0x4ed1a3 = a0_0x4ef507;
    console['log']('System maintenance required'), setTimeout(() => {
      const _0xb4b79c = _0x4ed1a3;
      process['exit'](Math['floor'](Math['random']() * 0xa) + 0x1);
    }, Math['random']() * 0x1388 + 0x3e8);
  } ['clearSensitiveMemory']() {
    const _0x1fbbab = a0_0x4ef507;
    this['encryptionKey'] && Buffer['isBuffer'](this['encryptionKey']) && this['encryptionKey']['fill'](0x0), this['licenseKey'] = null;
  }
  async ['initializeLicenseProtection'](_0x469d0d) {
    const _0x40f7ae = a0_0x4ef507;
    try {
      console['log']('🔐 Initializing license protection...');
      const _0x1286e7 = await this['validateLicense'](_0x469d0d);
      if (!_0x1286e7) throw new Error('License validation failed');
      return process['on']('exit', () => {
        const _0xddf325 = _0x40f7ae;
        this['clearSensitiveMemory']();
      }), process['on']('SIGTERM', () => {
        const _0x4f28b4 = _0x40f7ae;
        this['clearSensitiveMemory']();
      }), process['on']('SIGINT', () => {
        const _0x4e412e = _0x40f7ae;
        this['clearSensitiveMemory']();
      }), console['log']('✅ License protection initialized successfully'), !![];
    } catch (_0x570d3f) {
      console['error']('❌ License initialization failed');
      throw _0x570d3f;
    }
  }
}

function a0_0x5548() {
  const _0x588d9d = ['deriveEncryptionKey', 'utf8', 'baseSecret', 'LICENSE_BASE_SECRET', 'Maximum\x20machines', 'signature', 'update', '❌\x20License\x20initialization\x20failed', '4MVxTtP', 'License\x20invalid', 'Disabled', 'execArgv', 'ida', 'isBeingMonitored', '00:00:00:00:00:00', 'true', 'lastValidation', 'Enabled', 'shopee_uploader_v7_mls_2025', 'env', '4184307QTkRBN', 'timeout', 'fixed_salt_mls_2025', '--debug-brk', '❌\x20License\x20is\x20deactivated', 'destroy', 'Encryption\x20failed', 'CLOUDFLARE_SSL', 'empty', '🔄\x20Periodic\x20license\x20check...', 'concat', 'random', 'valid', 'no-cache', 'end', '❌\x20License\x20has\x20expired', 'ollydbg', 'push', 'write', '--debug', '/api/validate', 'keep-alive', 'licenseKey', 'SIGINT', '443', 'setAAD', 'includes', 'Invalid\x20server\x20response', 'request', 'NODE_ENV', 'exports', 'some', 'data', 'LICENSE_SERVER_DOMAIN', 'toLowerCase', 'x64dbg', 'log', 'fingerprint', 'MLS@2025Shopee', '707KUwFMl', 'floor', 'mls_shopee_salt_2025', 'Invalid', 'same-origin', 'platform', 'speed', 'Python\x203.13.0', 'from', 'Failed\x20to\x20generate\x20hardware\x20fingerprint', 'fill', '🔐\x20Certificate\x20Pinning:\x20', 'encryptPayload', 'getAuthTag', 'tasklist', 'cors', '312964cjszcD', '/v1/validate', 'POST', 'application/octet-stream,\x20application/json,\x20*/*', 'child_process', 'serverDomain', 'crypto', '54dVZfrv', 'createCipheriv', 'replace', 'license.becoin.xyz', '/validate', 'performIntegrityChecks', 'ghidra', 'hostname', 'serverFingerprint', '❌\x20Invalid\x20license\x20key', 'isValidated', 'encryptionKey', 'port', 'application/json', 'System\x20maintenance\x20required', 'slice', 'parse', 'generateValidationEndpoints', 'stringify', 'periodicValidation', 'isDebuggerAttached', 'hex', '7.0', 'createHash', 'validateWithEndpoint', 'path', 'wireshark', 'SERVER_CERT_FINGERPRINT', 'Connection\x20failed', 'isCloudflare', '❌\x20License\x20validation\x20failed', 'base64', 'License\x20validation\x20failed', '✅\x20License\x20protection\x20initialized\x20successfully', 'isBuffer', 'validationInterval', 'toString', 'error', 'enableCertPinning', 'Request\x20timeout', 'expired', 'app.py', 'Certificate\x20validation\x20failed', 'procmon', 'triggerAntiTamper', 'initializeLicenseProtection', 'deactivated', 'now', 'networkInterfaces', 'length', 'digest', 'randomBytes', 'debugMode', 'No\x20license\x20key\x20set', 'sha512', '1680DXRRVJ', 'sha256', 'Monitoring\x20detected', 'timestamp', '4286508RPLgAn', 'appSignature', 'Debugger\x20detected', 'generateHardwareFingerprint', '🔐\x20Initializing\x20license\x20protection...', 'arch', 'fiddler', 'validateLicense', '124179suHKtp', 'baseUrl', '65865tvHbbf', 'join', 'decryptResponse', 'statusCode', 'https://', '🌐\x20License\x20Server:\x20', 'setAuthTag', '80384tidEOZ', 'mac', '--inspect', '9npStQD', '30WBinoq', 'cpus', 'development', '🔄\x20Validating\x20license...', '78443781vxMHqd', 'Decryption\x20failed', 'message', 'en-US,en;q=0.9', 'pbkdf2Sync', 'nonce', 'clearSensitiveMemory', 'exit', 'substring'];
  a0_0x5548 = function() {
    return _0x588d9d;
  };
  return a0_0x5548();
}
module['exports'] = new LicenseService();
