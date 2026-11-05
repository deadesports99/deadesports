import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertPaymentConfig, isPaymentConfigured, paymentConfig } from '../src/config/payment.js';

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
