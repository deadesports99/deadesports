import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import { paymentConfig } from '../src/config/payment.js';
import { paymentGateway } from '../src/services/paymentGateway.service.js';

describe('paymentGateway (mock provider)', () => {
  it('uses the configured provider', () => {
    assert.equal(paymentGateway.provider, paymentConfig.provider);
    assert.equal(paymentGateway.provider, 'mock');
  });

  it('createOrder returns a local mock order with a demo checkout link', async () => {
    const before = Date.now();
    const order = await paymentGateway.createOrder({ amountPaise: 25_000, receipt: 'rcpt_1' });

    assert.equal(order.provider, 'mock');
    assert.match(order.orderId, /^order_mock_[0-9a-f]{18}$/);
    assert.equal(order.amountPaise, 25_000);
    assert.equal(order.currency, 'INR');
    assert.equal(order.keyId, null);
    assert.ok(order.checkoutUrl?.includes(`orderId=${order.orderId}`));
    assert.ok(order.expiresAt.getTime() >= before + paymentConfig.orderTtlSeconds * 1000 - 1_000);
  });

  it('accepts its own mock signature and rejects anything else', () => {
    const orderId = 'order_mock_abc';
    const paymentId = 'pay_mock_xyz';
    const signature = paymentGateway.mockSignature(orderId, paymentId);

    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId, paymentId, signature }), true);
    // any single character change must fail
    const tampered = (signature[0] === 'a' ? 'b' : 'a') + signature.slice(1);
    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId, paymentId, signature: tampered }), false);
    // mismatched ids fail even with a valid-looking signature
    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId, paymentId: 'pay_other', signature }), false);
  });

  it('rejects empty checkout inputs instead of throwing', () => {
    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId: '', paymentId: 'p', signature: 's' }), false);
    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId: 'o', paymentId: '', signature: 's' }), false);
    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId: 'o', paymentId: 'p', signature: '' }), false);
    // different length must not throw inside timingSafeEqual
    assert.equal(paymentGateway.verifyCheckoutSignature({ orderId: 'o', paymentId: 'p', signature: 'deadbeef' }), false);
  });

  it('verifies webhooks over the raw body bytes only', () => {
    const raw = Buffer.from('{"event":"payment.captured","payload":{"id":"pay_1"}}');
    const secret =
      paymentConfig.razorpay.webhookSecret ?? paymentConfig.razorpay.keySecret ?? paymentConfig.mockSecret;
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');

    assert.equal(paymentGateway.verifyWebhookSignature(raw, signature), true);
    // re-serialised JSON (extra space) must be rejected — proves raw bytes are used
    const reserialised = Buffer.from('{"event":"payment.captured", "payload":{"id":"pay_1"}}');
    assert.equal(paymentGateway.verifyWebhookSignature(reserialised, signature), false);
    assert.equal(paymentGateway.verifyWebhookSignature(raw, ''), false);
  });

  it('fetchPayment is a no-op in mock mode (nothing remote to ask)', async () => {
    assert.equal(await paymentGateway.fetchPayment('pay_mock_1'), null);
  });
});
