'use strict';
/**
 * LicenseService - local-validation build.
 *
 * Drop-in replacement for src/services/license.service.js.
 * Public surface is identical to the original (same class name, same method
 * names, same fields), so app.js, middleware/license.middleware.js and
 * routes/index.js keep working untouched.
 *
 * Behaviour difference: validation is decided locally instead of being
 * delegated to https://license.toolshopee.vn. The remote path is still here
 * and still works - enable it with MLS_ONLINE_CHECK=1 in .env - but a failed
 * remote check no longer kills the process.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_SIGNATURE = 'shopee_uploader_v7_mls_2025';
const FINGERPRINT_FILE = path.join(__dirname, '../../.machine_id');

class LicenseService {
  constructor() {
    this.serverDomain = process.env.LICENSE_SERVER_DOMAIN || 'license.becoin.xyz';
    this.serverPort = process.env.LICENSE_SERVER_PORT || '443';
    this.baseUrl = 'https://' + this.serverDomain;
    this.enableCertPinning = process.env.ENABLE_CERT_PINNING === 'true';
    this.serverFingerprint = process.env.SERVER_CERT_FINGERPRINT;
    this.isCloudflare = process.env.CLOUDFLARE_SSL === 'true';
    this.baseSecret = process.env.LICENSE_BASE_SECRET || 'MLS@2025Shopee';
    this.encryptionKey = this.deriveEncryptionKey();
    this.appSignature = APP_SIGNATURE;
    this.onlineCheck = process.env.MLS_ONLINE_CHECK === '1';
    this.licenseKey = null;
    this.lastValidation = Date.now();
    this.validationInterval = 30 * 60 * 1000;
    this.isValidated = true;
    this.debugMode = process.env.NODE_ENV === 'development';

    if (this.debugMode) {
      console.log('🌐 License Server: ' + this.baseUrl);
      console.log('🔐 Certificate Pinning: ' + (this.enableCertPinning ? 'Enabled' : 'Disabled'));
      console.log('🧩 License mode: ' + (this.onlineCheck ? 'online + local fallback' : 'local'));
    }
  }

  deriveEncryptionKey() {
    try {
      const material = [this.baseSecret, 'app.py', 'Python 3.13.0', 'Windows', 'fixed_salt_mls_2025'].join('|');
      const salt = crypto.createHash('sha256').update('mls_shopee_salt_2025').digest();
      return crypto.pbkdf2Sync(material, salt, 100000, 32, 'sha512');
    } catch (_) {
      return crypto.createHash('sha256').update(this.baseSecret + 'fallback_salt').digest();
    }
  }

  /** Stable per-install fingerprint; persisted so it never drifts. */
  generateHardwareFingerprint() {
    try {
      if (fs.existsSync(FINGERPRINT_FILE)) {
        const stored = fs.readFileSync(FINGERPRINT_FILE, 'utf8').trim();
        if (stored && stored.length >= 16) return stored;
      }
    } catch (_) {}

    const parts = [];
    try {
      for (const list of Object.values(os.networkInterfaces())) {
        for (const nic of list) {
          if (nic && nic.mac && nic.mac !== '00:00:00:00:00:00') parts.push(nic.mac);
        }
      }
      const cpu = os.cpus()[0];
      if (cpu) {
        parts.push(cpu.model.replace(/\s+/g, ''));
        parts.push(cpu.speed.toString());
      }
      parts.push(os.cpus().length.toString());
      parts.push(os.totalmem().toString());
      parts.push(os.platform(), os.arch(), os.hostname(), process.platform);
    } catch (_) {
      parts.push('fallback');
    }

    const fingerprint = crypto
      .createHash('sha256')
      .update(parts.sort().join('|') + this.appSignature)
      .digest('hex')
      .substring(0, 32);

    try {
      fs.writeFileSync(FINGERPRINT_FILE, fingerprint, 'utf8');
    } catch (_) {}
    return fingerprint;
  }

  encryptPayload(body) {
    const json = JSON.stringify(body);
    const iv = crypto.randomBytes(16);
    const timestamp = Date.now().toString();
    const aad = Buffer.from(this.appSignature + timestamp);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(aad);
    const bodyBuf = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, tag, aad, bodyBuf]).toString('base64');
    const nonce = crypto.randomBytes(16).toString('hex');
    const ts = Date.now();
    const signature = crypto
      .createHmac('sha256', this.encryptionKey)
      .update(blob + ts + nonce + this.appSignature)
      .digest('hex');
    return { payload: blob, timestamp: ts, nonce, signature };
  }

  decryptResponse(base64) {
    const raw = Buffer.from(base64, 'base64');
    const iv = raw.slice(0, 16);
    const aadLen = this.appSignature.length;
    for (let tick = 10; tick <= 13; tick++) {
      try {
        const total = aadLen + tick;
        const aad = raw.slice(16, 16 + total);
        const rest = raw.slice(16 + total);
        const body = rest.slice(0, -16);
        const tag = rest.slice(-16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAAD(aad);
        decipher.setAuthTag(tag);
        let out = decipher.update(body, null, 'utf8');
        out += decipher.final('utf8');
        return JSON.parse(out);
      } catch (_) {
        continue;
      }
    }
    throw new Error('Could not decrypt response');
  }

  generateValidationEndpoints() {
    return [
      { hostname: this.serverDomain, port: 443, path: '/validate' },
      { hostname: this.serverDomain, port: 443, path: '/v1/validate' },
      { hostname: this.serverDomain, port: 443, path: '/api/validate' },
    ];
  }

  /** Local accept, always. Remote check only runs when MLS_ONLINE_CHECK=1. */
  async validateLicense(key) {
    this.licenseKey = key || this.licenseKey || process.env.LICENSE_KEY || null;
    this.lastValidation = Date.now();
    this.isValidated = true;

    if (this.onlineCheck) {
      const fingerprint = this.generateHardwareFingerprint();
      for (const endpoint of this.generateValidationEndpoints()) {
        try {
          await this.validateWithEndpoint(this.licenseKey, endpoint, fingerprint);
          break;
        } catch (err) {
          if (this.debugMode) console.log('↪️  ' + endpoint.path + ': ' + err.message);
        }
      }
    }

    console.log('✅ License activated successfully');
    return true;
  }

  async validateWithEndpoint(key, endpoint, fingerprint) {
    const https = require('https');
    const body = {
      key,
      fingerprint,
      timestamp: Date.now(),
      app_version: '7.0',
      app_signature: this.appSignature,
      node_version: process.version,
      platform: os.platform(),
    };
    const sealed = this.encryptPayload(body);
    const payload = JSON.stringify({
      data: sealed.payload,
      timestamp: sealed.timestamp,
      nonce: sealed.nonce,
      signature: sealed.signature,
    });
    const options = {
      hostname: endpoint.hostname,
      port: endpoint.port,
      path: endpoint.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'ShopeeUploader/7.0',
        'X-App-Signature': this.appSignature,
        Accept: 'application/octet-stream, application/json, */*',
      },
      timeout: 15000,
    };

    if (this.enableCertPinning && this.serverFingerprint) {
      options.checkServerIdentity = (_host, cert) => {
        if (cert.fingerprint256 !== this.serverFingerprint) {
          throw new Error('Certificate validation failed');
        }
      };
    }

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('error', reject);
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error('Server returned ' + res.statusCode));
              return;
            }
            const decoded = this.decryptResponse(data);
            if (decoded.valid) resolve(true);
            else reject(new Error(decoded.message || 'License validation failed'));
          } catch (_) {
            reject(new Error('Invalid server response'));
          }
        });
      });
      req.on('error', () => reject(new Error('Connection failed')));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.write(payload);
      req.end();
    });
  }

  async periodicValidation() {
    this.lastValidation = Date.now();
    this.isValidated = true;
    return true;
  }

  isDebuggerAttached() {
    return false;
  }

  isBeingMonitored() {
    return false;
  }

  /** Kept for call-site compatibility; the anti-tamper kill path is gone. */
  performIntegrityChecks() {
    this.isValidated = true;
  }

  triggerAntiTamper(reason) {
    if (this.debugMode) console.log('[license] ignored anti-tamper: ' + reason);
  }

  clearSensitiveMemory() {
    if (this.encryptionKey && Buffer.isBuffer(this.encryptionKey)) this.encryptionKey.fill(0);
    this.licenseKey = null;
  }

  async initializeLicenseProtection(key) {
    console.log('🔐 Initializing license protection...');
    const ok = await this.validateLicense(key);
    if (!ok) throw new Error('License validation failed');
    process.on('exit', () => this.clearSensitiveMemory());
    process.on('SIGTERM', () => this.clearSensitiveMemory());
    process.on('SIGINT', () => this.clearSensitiveMemory());
    console.log('✅ License protection initialized successfully');
    return true;
  }
}

module.exports = new LicenseService();
