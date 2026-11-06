import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertPaymentConfig,
  isPaymentConfigured,
  paymentConfig,
  paymentConfigProblems,
} from '../src/config/payment.js';

describe('paymentConfig', () => {
  it('uses integer paise limits with min below max', () => {
    assert.equal(Number.isInteger(paymentConfig.minAmountPaise), true);
    assert.equal(Number.isInteger(paymentConfig.maxAmountPaise), true);
    assert.ok(paymentConfig.minAmountPaise > 0);
    assert.ok(paymentConfig.minAmountPaise < paymentConfig.maxAmountPaise);
  });

  it('always works in INR with a positive order TTL', () => {
    assert.equal(paymentConfig.currency, 'INR');
    assert.ok(paymentConfig.orderTtlSeconds > 0);
  });

  it('publicBaseUrl never ends with a slash (checkout links are joined with /api)', () => {
    assert.equal(paymentConfig.publicBaseUrl.endsWith('/'), false);
  });

  it('mock provider is always "configured" so demos run without keys', () => {
    assert.equal(isPaymentConfigured(), paymentConfig.provider === 'mock' ? true : isPaymentConfigured());
  });

  it('assertPaymentConfig passes for the current (mock) configuration', () => {
    assert.doesNotThrow(() => assertPaymentConfig());
  });
});

describe('paymentConfigProblems (launch rules)', () => {
  const base = {
    nodeEnv: 'development',
    provider: 'mock' as const,
    minAmountPaise: 1_000,
    maxAmountPaise: 1_000_000,
    razorpay: {},
  };

  it('refuses to boot with the mock provider in production', () => {
    // A typo here would send every real customer to the demo checkout and
    // collect no money, so it is fatal instead of a warning.
    assert.deepEqual(paymentConfigProblems({ ...base, nodeEnv: 'production' }), [
      'PAYMENT_PROVIDER=mock is not allowed in production — set razorpay and the live keys',
    ]);
  });

  it('allows mock outside production', () => {
    assert.deepEqual(paymentConfigProblems({ ...base, nodeEnv: 'development' }), []);
    assert.deepEqual(paymentConfigProblems({ ...base, nodeEnv: 'test' }), []);
  });

  it('requires both Razorpay keys when the provider is razorpay', () => {
    const problems = paymentConfigProblems({ ...base, nodeEnv: 'production', provider: 'razorpay' });
    assert.equal(problems.length, 2);
    assert.match(problems[0], /RAZORPAY_KEY_ID/);
    assert.match(problems[1], /RAZORPAY_KEY_SECRET/);
  });

  it('accepts a fully configured production deployment', () => {
    assert.deepEqual(
      paymentConfigProblems({
        ...base,
        nodeEnv: 'production',
        provider: 'razorpay',
        razorpay: { keyId: 'rzp_live_x', keySecret: 's', webhookSecret: 'w' },
      }),
      [],
    );
  });

  it('rejects an inverted amount range', () => {
    assert.deepEqual(
      paymentConfigProblems({ ...base, nodeEnv: 'production', provider: 'razorpay', minAmountPaise: 5_000_000, razorpay: { keyId: 'a', keySecret: 'b' } }),
      ['PAYMENT_MIN_AMOUNT_PAISE cannot exceed PAYMENT_MAX_AMOUNT_PAISE'],
    );
  });
});
