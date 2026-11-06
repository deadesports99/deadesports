/**
 * Preflight + live-gateway check for Razorpay.
 *
 * Run this BEFORE the first real customer pays, and again whenever the keys or
 * the deployment change:
 *
 *   npx tsx src/scripts/razorpayLiveCheck.ts
 *   npx tsx src/scripts/razorpayLiveCheck.ts --create-order
 *   npx tsx src/scripts/razorpayLiveCheck.ts --sign order_xxx pay_yyy
 *
 * It never prints a secret and never touches the database:
 *  - no flags            -> validate configuration and key shapes (offline)
 *  - `--create-order`    -> create a real ₹1 order on the configured gateway
 *  - `--sign o p`        -> compute the checkout signature to compare against
 *                           what Razorpay Checkout returned
 *
 * The full ₹1 UPI walkthrough is in docs/RAZORPAY_LIVE_RUNBOOK.md.
 */
import crypto from 'node:crypto';
import { paymentConfig } from '../config/payment.js';
import { env } from '../config/env.js';
import { paymentGateway } from '../services/paymentGateway.service.js';

const args = process.argv.slice(2);
const mask = (value?: string) => (value ? `${value.slice(0, 8)}…${value.slice(-4)}` : '(missing)');

function problems(): string[] {
  const out: string[] = [];

  if (paymentConfig.provider !== 'razorpay') {
    out.push(`PAYMENT_PROVIDER=${paymentConfig.provider} — the live check needs razorpay`);
  }

  const keyId = paymentConfig.razorpay.keyId ?? '';
  if (!keyId) {
    out.push('RAZORPAY_KEY_ID is missing (dashboard -> Settings -> API keys)');
  } else if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    out.push(`RAZORPAY_KEY_ID does not look like rzp_test_* / rzp_live_* (got ${mask(keyId)})`);
  }

  if (!paymentConfig.razorpay.keySecret) out.push('RAZORPAY_KEY_SECRET is missing');
  if (!paymentConfig.razorpay.webhookSecret) {
    out.push('RAZORPAY_WEBHOOK_SECRET is missing — every webhook will be rejected');
  }

  if (env.NODE_ENV === 'production' && keyId.startsWith('rzp_test_')) {
    out.push('NODE_ENV=production with a TEST key — real customers cannot pay');
  }
  if (env.NODE_ENV !== 'production' && keyId.startsWith('rzp_live_')) {
    out.push('LIVE keys on a non-production server — a test could move real money');
  }

  if (paymentConfig.publicBaseUrl.includes('localhost')) {
    out.push(`PUBLIC_BASE_URL points at ${paymentConfig.publicBaseUrl} — Razorpay callbacks will not reach it`);
  }

  return out;
}

async function main(): Promise<void> {
  console.log('💳 Razorpay preflight');
  console.log(`  provider      : ${paymentConfig.provider}`);
  console.log(`  key id        : ${mask(paymentConfig.razorpay.keyId)}`);
  console.log(`  webhook secret: ${paymentConfig.razorpay.webhookSecret ? 'set' : 'missing'}`);
  console.log(`  api base      : ${env.RAZORPAY_API_BASE_URL}`);
  console.log(`  public base   : ${paymentConfig.publicBaseUrl}`);
  console.log(
    `  amount limits : ₹${paymentConfig.minAmountPaise / 100} – ₹${paymentConfig.maxAmountPaise / 100}`,
  );
  console.log(`  order TTL     : ${paymentConfig.orderTtlSeconds}s`);

  const found = problems();
  if (found.length > 0) {
    console.error('\n❌ Configuration is not ready:');
    for (const p of found) console.error(`  - ${p}`);
    process.exitCode = 1;
    if (!args.includes('--create-order')) return;
    console.error('\nRefusing to touch the live gateway with a broken configuration.');
    return;
  }
  console.log('\n✅ Configuration looks valid.');

  if (args.includes('--sign')) {
    const [orderId, paymentId] = args.slice(args.indexOf('--sign') + 1);
    if (!orderId || !paymentId) {
      console.error('usage: --sign <providerOrderId> <paymentId>');
      process.exitCode = 1;
      return;
    }
    const signature = crypto
      .createHmac('sha256', paymentConfig.razorpay.keySecret ?? '')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    console.log(`\nexpected signature for ${orderId} | ${paymentId}:\n  ${signature}`);
    return;
  }

  if (args.includes('--create-order')) {
    const receipt = `preflight_${Date.now()}`;
    console.log('\n→ creating a ₹1 order on the configured gateway…');
    const order = await paymentGateway.createOrder({
      amountPaise: 100,
      receipt,
      notes: { purpose: 'preflight', environment: env.NODE_ENV },
    });
    console.log('✅ gateway accepted the order');
    console.log(`  providerOrderId : ${order.orderId}`);
    console.log(`  amountPaise     : ${order.amountPaise}`);
    console.log(`  keyId for SDK   : ${mask(order.keyId ?? undefined)}`);
    console.log(`  expiresAt       : ${order.expiresAt.toISOString()}`);
    console.log('\nNext: open docs/RAZORPAY_LIVE_RUNBOOK.md and finish the ₹1 UPI payment.');
  }
}

main().catch((err) => {
  console.error('✖ Razorpay preflight failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
