import { stripTrailingSlashes } from '../utils/strings.js';
import { env } from './env.js';

/**
 * Payment gateway configuration.
 *
 * Two providers are supported:
 *  - `mock`     : zero external calls. An HMAC signature is derived from
 *                 RAZORPAY_KEY_SECRET (or `mock_secret`) so the exact same
 *                 verification code path runs locally / in demos.
 *  - `razorpay` : real Razorpay orders + checkout signature + webhook HMAC.
 *
 * All money amounts are integers in PAISE. No floats anywhere on the money path.
 */
export type PaymentProviderName = 'mock' | 'razorpay';

export interface PaymentConfig {
  provider: PaymentProviderName;
  currency: 'INR';
  /** ₹10 default — below UPI minimums and gateway fees. */
  minAmountPaise: number;
  /** ₹10,000 default — keeps a single top-up bounded for KYC/risk rules. */
  maxAmountPaise: number;
  /** Checkout order lifetime in seconds (default 900 = 15 min). */
  orderTtlSeconds: number;
  /** Mock mode only: credit the wallet immediately on "Pay now". */
  mockAutoCapture: boolean;
  /** Public base URL used for the mock checkout link. */
  publicBaseUrl: string;
  /** Secret used to sign/verify mock signatures when no real key is set. */
  mockSecret: string;
  razorpay: {
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
  };
}

export const paymentConfig: PaymentConfig = {
  provider: env.PAYMENT_PROVIDER,
  currency: 'INR',
  minAmountPaise: env.PAYMENT_MIN_AMOUNT_PAISE,
  maxAmountPaise: env.PAYMENT_MAX_AMOUNT_PAISE,
  orderTtlSeconds: env.PAYMENT_ORDER_TTL_SECONDS,
  mockAutoCapture: env.PAYMENT_MOCK_AUTO_CAPTURE,
  publicBaseUrl: stripTrailingSlashes(env.PUBLIC_BASE_URL),
  mockSecret: env.RAZORPAY_KEY_SECRET || 'mock_secret',
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  },
};

/** True when the effective signature secret of the active provider is set. */
export function isPaymentConfigured(): boolean {
  if (paymentConfig.provider === 'mock') return true;
  return Boolean(paymentConfig.razorpay.keyId && paymentConfig.razorpay.keySecret);
}

/**
 * Fail fast at boot instead of failing on the first player top-up.
 * Called from `server.ts` before listening.
 */
export function assertPaymentConfig(): void {
  const problems: string[] = [];

  if (paymentConfig.minAmountPaise > paymentConfig.maxAmountPaise) {
    problems.push('PAYMENT_MIN_AMOUNT_PAISE cannot exceed PAYMENT_MAX_AMOUNT_PAISE');
  }

  if (paymentConfig.provider === 'razorpay') {
    if (!paymentConfig.razorpay.keyId) problems.push('RAZORPAY_KEY_ID is required for razorpay');
    if (!paymentConfig.razorpay.keySecret) problems.push('RAZORPAY_KEY_SECRET is required for razorpay');
    if (!paymentConfig.razorpay.webhookSecret) {
      // Not fatal (checkout verify still works) but webhooks will be rejected.
      console.warn(
        '⚠ RAZORPAY_WEBHOOK_SECRET is not set — /api/payments/webhook will reject every event.',
      );
    }
  }

  if (env.NODE_ENV === 'production' && paymentConfig.provider === 'mock') {
    // Warning, not fatal: a demo deploy must not lose tournaments/wallet over
    // this. Payments still work end-to-end, just without real money.
    console.warn(
      '⚠ PAYMENT_PROVIDER=mock in production — no real money will be collected. ' +
        'Set razorpay + live keys before go-live.',
    );
  }

  if (problems.length > 0) {
    throw new Error(
      '❌ Invalid payment configuration:\n' + problems.map((p) => `  - ${p}`).join('\n'),
    );
  }

  const mode =
    paymentConfig.provider === 'mock'
      ? `mock (auto-capture=${paymentConfig.mockAutoCapture})`
      : 'razorpay';
  console.log(`💳 Payment gateway ready: ${mode}`);
}
