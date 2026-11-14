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
  /** Master switch — when false no payment route is mounted and no keys are needed. */
  enabled: boolean;
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
  enabled: env.PAYMENTS_ENABLED,
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
  if (!paymentConfig.enabled) return false;
  if (paymentConfig.provider === 'mock') return true;
  return Boolean(paymentConfig.razorpay.keyId && paymentConfig.razorpay.keySecret);
}

export interface PaymentConfigInput {
  nodeEnv: string;
  provider: PaymentProviderName;
  minAmountPaise: number;
  maxAmountPaise: number;
  razorpay: { keyId?: string; keySecret?: string; webhookSecret?: string };
  /** Defaults to enabled so existing call sites/tests keep their meaning. */
  paymentsEnabled?: boolean;
}

/**
 * The launch rules, as a pure function so they can be unit-tested without
 * reloading `env` (imports freeze it).
 */
export function paymentConfigProblems(input: PaymentConfigInput): string[] {
  const problems: string[] = [];

  if (input.minAmountPaise > input.maxAmountPaise) {
    problems.push('PAYMENT_MIN_AMOUNT_PAISE cannot exceed PAYMENT_MAX_AMOUNT_PAISE');
  }

  // Online top-up switched off: nothing can be charged, so gateway rules are moot.
  if (input.paymentsEnabled === false) return problems;

  if (input.provider === 'razorpay') {
    if (!input.razorpay.keyId) problems.push('RAZORPAY_KEY_ID is required for razorpay');
    if (!input.razorpay.keySecret) problems.push('RAZORPAY_KEY_SECRET is required for razorpay');
  }

  if (input.nodeEnv === 'production' && input.provider === 'mock') {
    // Fatal, not a warning: a typo here means every real customer gets a demo
    // order and no money is ever collected. Refusing to boot is the loud,
    // cheap failure (see PRODUCTION_CLOUD_EXECUTION_PLAN V2-A).
    problems.push(
      'PAYMENT_PROVIDER=mock is not allowed in production — set razorpay and the live keys',
    );
  }

  return problems;
}

/**
 * Fail fast at boot instead of failing on the first player top-up.
 * Called from `server.ts` before listening.
 */
export function assertPaymentConfig(): void {
  if (paymentConfig.provider === 'razorpay' && !paymentConfig.razorpay.webhookSecret) {
    // Not fatal (checkout verify still works) but webhooks will be rejected.
    console.warn(
      '⚠ RAZORPAY_WEBHOOK_SECRET is not set — /api/payments/webhook will reject every event.',
    );
  }

  const problems = paymentConfigProblems({
    nodeEnv: env.NODE_ENV,
    provider: paymentConfig.provider,
    minAmountPaise: paymentConfig.minAmountPaise,
    maxAmountPaise: paymentConfig.maxAmountPaise,
    razorpay: paymentConfig.razorpay,
    paymentsEnabled: paymentConfig.enabled,
  });

  if (problems.length > 0) {
    throw new Error(
      '❌ Invalid payment configuration:\n' + problems.map((p) => `  - ${p}`).join('\n'),
    );
  }

  if (!paymentConfig.enabled) {
    console.warn(
      '💳 Online wallet top-up is DISABLED (PAYMENTS_ENABLED=false) — payment routes are not ' +
        'mounted. Wallet credits continue through manual UTR approval.',
    );
    return;
  }

  const mode =
    paymentConfig.provider === 'mock'
      ? `mock (auto-capture=${paymentConfig.mockAutoCapture})`
      : 'razorpay';
  console.log(`💳 Payment gateway ready: ${mode}`);
}
