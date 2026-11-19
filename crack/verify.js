'use strict';
/**
 * Offline verification of the patched license layer.
 * Does not start Express, does not open the database.
 *
 *   node crack/verify.js
 */

const path = require('path');

process.chdir(path.join(__dirname, '..'));
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const licenseService = require('../src/services/license.service');
const mw = require('../src/middleware/license.middleware');

const KEY = process.env.LICENSE_KEY || 'MLS-2025-local-test';
const results = [];
const check = (name, ok, extra) => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};

// Fake Express req/res so the middleware can be exercised for real.
function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(body) { res.body = body; return res; },
  };
  return res;
}

(async () => {
  const boot = await licenseService.initializeLicenseProtection(KEY);
  check('initializeLicenseProtection', boot === true && licenseService.isValidated === true);

  check('isValidated after boot', licenseService.isValidated === true);
  check('fingerprint stable', (() => {
    const a = licenseService.generateHardwareFingerprint();
    const b = licenseService.generateHardwareFingerprint();
    return a === b && /^[0-9a-f]{16,64}$/.test(a);
  })(), licenseService.generateHardwareFingerprint());
  check('periodicValidation', (await licenseService.periodicValidation()) === true);
  check('performIntegrityChecks does not exit', (() => {
    licenseService.performIntegrityChecks();
    return true;
  })());
  check('isDebuggerAttached false', licenseService.isDebuggerAttached() === false);
  check('isBeingMonitored false', licenseService.isBeingMonitored() === false);

  // protectRoute
  {
    const res = fakeRes();
    let nexted = false;
    await mw.protectRoute({ method: 'GET', path: '/threads', ip: '127.0.0.1' }, res, () => { nexted = true; });
    check('protectRoute passes', nexted === true && res.statusCode === 200);
  }

  // protectVideoOperations
  {
    const res = fakeRes();
    let nexted = false;
    await mw.protectVideoOperations({ method: 'POST', path: '/videos' }, res, () => { nexted = true; });
    check('protectVideoOperations passes', nexted === true);
  }

  // checkLicenseStatus
  {
    const res = fakeRes();
    let nexted = false;
    await mw.checkLicenseStatus({ method: 'GET', path: '/logs' }, res, () => { nexted = true; });
    check('checkLicenseStatus passes', nexted === true && res.statusCode === 200);
  }

  // AES compatibility with the original wire format (online mode parity).
  {
    const sealed = licenseService.encryptPayload({ key: 'K', fingerprint: 'F', timestamp: 1 });
    check('encryptPayload shape', Boolean(sealed.payload && sealed.nonce && sealed.signature && sealed.timestamp));
    // Server responses use the wire layout iv | aad | body | tag.
    const crypto = require('crypto');
    const iv = crypto.randomBytes(16);
    const aad = Buffer.from(licenseService.appSignature + Date.now());
    const cipher = crypto.createCipheriv('aes-256-gcm', licenseService.encryptionKey, iv);
    cipher.setAAD(aad);
    const body = Buffer.concat([cipher.update(JSON.stringify({ valid: true }), 'utf8'), cipher.final()]);
    const blob = Buffer.concat([iv, aad, body, cipher.getAuthTag()]).toString('base64');
    const decoded = licenseService.decryptResponse(blob);
    check('decryptResponse round-trip', decoded && decoded.valid === true);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('VERIFY CRASHED:', err);
  process.exit(2);
});
