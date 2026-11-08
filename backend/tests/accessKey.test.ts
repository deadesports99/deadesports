import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCESS_KEY_LENGTH,
  accessKeyHint,
  formatAccessKey,
  generateOtpCode,
  generateRawAccessKey,
  hashAccessKey,
  hashOtp,
  isWellFormedAccessKey,
  normalizeAccessKey,
  verifyAccessKey,
  verifyOtpHash,
} from '../src/utils/accessKey.js';

describe('generateRawAccessKey', () => {
  it('is exactly 24 alphanumeric characters', () => {
    for (let index = 0; index < 50; index += 1) {
      const key = generateRawAccessKey();
      assert.equal(key.length, ACCESS_KEY_LENGTH);
      assert.match(key, /^[A-Za-z0-9]{24}$/);
    }
  });

  it('uses mixed case and digits across many keys', () => {
    const all = Array.from({ length: 200 }, () => generateRawAccessKey()).join('');
    assert.match(all, /[A-Z]/);
    assert.match(all, /[a-z]/);
    assert.match(all, /[0-9]/);
  });

  it('never repeats (1000 keys)', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateRawAccessKey()));
    assert.equal(keys.size, 1000);
  });
});

describe('formatAccessKey', () => {
  it('groups 24 characters as 6-6-6-6', () => {
    assert.equal(formatAccessKey('K7pQ2x9mR4tL8vN3sW5cB6dE'), 'K7pQ2x-9mR4tL-8vN3sW-5cB6dE');
  });

  it('ignores existing dashes/spaces so paste always works', () => {
    assert.equal(formatAccessKey('K7pQ2x-9mR4tL 8vN3sW-5cB6dE'), 'K7pQ2x-9mR4tL-8vN3sW-5cB6dE');
  });
});

describe('normalizeAccessKey', () => {
  it('keeps only A-Z / a-z / 0-9', () => {
    assert.equal(normalizeAccessKey(' K7pQ2x-9mR4tL_8vN3sW/5cB6dE '), 'K7pQ2x9mR4tL8vN3sW5cB6dE');
  });
});

describe('isWellFormedAccessKey', () => {
  it('accepts 24 characters with or without dashes', () => {
    assert.equal(isWellFormedAccessKey('K7pQ2x9mR4tL8vN3sW5cB6dE'), true);
    assert.equal(isWellFormedAccessKey('K7pQ2x-9mR4tL-8vN3sW-5cB6dE'), true);
  });

  it('rejects wrong lengths', () => {
    assert.equal(isWellFormedAccessKey('K7pQ2x9mR4tL8vN3sW5cB6d'), false);
    assert.equal(isWellFormedAccessKey('K7pQ2x9mR4tL8vN3sW5cB6dEE'), false);
    assert.equal(isWellFormedAccessKey(''), false);
  });
});

describe('hashAccessKey / verifyAccessKey', () => {
  it('is deterministic and returns 64 hex characters', () => {
    const key = generateRawAccessKey();
    assert.equal(hashAccessKey(key), hashAccessKey(key));
    assert.match(hashAccessKey(key), /^[0-9a-f]{64}$/);
  });

  it('never stores the plain key', () => {
    const key = generateRawAccessKey();
    assert.notEqual(hashAccessKey(key), key);
    assert.equal(hashAccessKey(key).includes(key), false);
  });

  it('accepts the same key typed with dashes or spaces', () => {
    const key = generateRawAccessKey();
    const stored = hashAccessKey(key);
    assert.equal(verifyAccessKey(formatAccessKey(key), stored), true);
    assert.equal(verifyAccessKey(` ${key} `, stored), true);
  });

  it('rejects a wrong key', () => {
    const key = generateRawAccessKey();
    const other = generateRawAccessKey();
    assert.equal(verifyAccessKey(other, hashAccessKey(key)), false);
  });

  it('rejects a malformed stored hash without throwing', () => {
    assert.equal(verifyAccessKey(generateRawAccessKey(), 'not-a-hash'), false);
  });
});

describe('accessKeyHint', () => {
  it('exposes only the last four characters', () => {
    const key = 'K7pQ2x9mR4tL8vN3sW5cB6dE';
    assert.equal(accessKeyHint(key), 'B6dE');
    assert.equal(accessKeyHint(formatAccessKey(key)), 'B6dE');
    assert.equal(accessKeyHint(key).length, 4);
  });
});

describe('OTP helpers', () => {
  it('generates 6-digit numeric codes', () => {
    for (let index = 0; index < 100; index += 1) {
      assert.match(generateOtpCode(), /^\d{6}$/);
    }
  });

  it('hashes and verifies an OTP', () => {
    const code = generateOtpCode();
    const stored = hashOtp(code);
    assert.match(stored, /^[0-9a-f]{64}$/);
    assert.equal(verifyOtpHash(code, stored), true);
    assert.equal(verifyOtpHash('000000', stored), code === '000000');
  });

  it('treats whitespace-padded OTP input as the same code', () => {
    const code = generateOtpCode();
    assert.equal(verifyOtpHash(` ${code} `, hashOtp(code)), true);
  });

  it('rejects a malformed stored hash without throwing', () => {
    assert.equal(verifyOtpHash('123456', 'oops'), false);
  });
});
