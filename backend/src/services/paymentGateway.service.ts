import crypto from 'node:crypto';
import { paymentConfig, type PaymentProviderName } from '../config/payment.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Gateway abstraction — the ONLY place that talks to a payment provider.
 *
 * `mock`   : everything is generated locally. Signatures use the same
 *            HMAC-SHA256(`order_id|payment_id`, secret) formula Razorpay uses,
 *            so the verify path is identical in demo and production.
 * `razorpay`: thin REST client over https://api.razorpay.com/v1 (Basic auth).
 *            We deliberately avoid the `razorpay` npm SDK — global `fetch`
 *            (Node 18+) is enough and keeps the dependency tree small.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

export interface CreateOrderInput {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayOrder {
  provider: PaymentProviderName;
  /** Provider-side order id (`order_mock_*` / Razorpay `order_*`). */
  orderId: string;
  amountPaise: number;
  currency: string;
  /** Publishable key for the client checkout SDK (null in mock mode). */
  keyId: string | null;
  /** Browser checkout URL (mock mode only, null for Razorpay). */
  checkoutUrl: string | null;
  expiresAt: Date;
}

export interface VerifyCheckoutInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface FetchedPayment {
  id: string;
  orderId: string;
  status: string;
  amountPaise: number;
}

/** Constant-time compare of two hex signatures. */
function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(received, 'utf8');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

function hmacHex(payload: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** Razorpay checkout signature: HMAC-SHA256(`order_id|payment_id`, key_secret). */
function checkoutSignature(orderId: string, paymentId: string, secret: string): string {
  return hmacHex(`${orderId}|${paymentId}`, secret);
}

async function razorpayRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { keyId, keySecret } = paymentConfig.razorpay;
  if (!keyId || !keySecret) {
    throw ApiError.internal('Razorpay keys are not configured');
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  let response: Response;
  try {
    response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // Network / DNS / timeout — never leak the credentials in the message.
    throw new ApiError(
      502,
      `Payment gateway unreachable: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON gateway response (proxy error page etc.)
  }

  if (!response.ok) {
    const description =
      (parsed as { error?: { description?: string } } | null)?.error?.description ??
      `HTTP ${response.status}`;
    throw new ApiError(502, `Payment gateway rejected the request: ${description}`);
  }

  return parsed as T;
}

export const paymentGateway = {
  get provider(): PaymentProviderName {
    return paymentConfig.provider;
  },

  /**
   * Create a provider-side order. Called AFTER the local PaymentOrder row is
   * created so the local id can travel in `notes` (webhook reconciliation).
   */
  async createOrder(input: CreateOrderInput): Promise<GatewayOrder> {
    const expiresAt = new Date(Date.now() + paymentConfig.orderTtlSeconds * 1000);

    if (paymentConfig.provider === 'mock') {
      const orderId = `order_mock_${crypto.randomBytes(9).toString('hex')}`;
      return {
        provider: 'mock',
        orderId,
        amountPaise: input.amountPaise,
        currency: paymentConfig.currency,
        keyId: null,
        checkoutUrl: `${paymentConfig.publicBaseUrl}/api/payments/demo/checkout?orderId=${encodeURIComponent(orderId)}`,
        expiresAt,
      };
    }

    const order = await razorpayRequest<{
      id: string;
      amount: number;
      currency: string;
      status: string;
    }>('POST', '/orders', {
      amount: input.amountPaise,
      currency: paymentConfig.currency,
      receipt: input.receipt,
      notes: input.notes ?? {},
      // Razorpay's own expiry (seconds) — keeps gateway and local TTL aligned.
      expire_by: Math.floor(expiresAt.getTime() / 1000),
    });

    return {
      provider: 'razorpay',
      orderId: order.id,
      amountPaise: order.amount,
      currency: order.currency,
      keyId: paymentConfig.razorpay.keyId ?? null,
      checkoutUrl: null,
      expiresAt,
    };
  },

  /**
   * Verify the checkout handoff signature returned by the client SDK.
   * Both providers use the same formula; only the secret differs.
   */
  verifyCheckoutSignature({ orderId, paymentId, signature }: VerifyCheckoutInput): boolean {
    if (!orderId || !paymentId || !signature) return false;
    const secret = paymentConfig.razorpay.keySecret ?? paymentConfig.mockSecret;
    return signaturesMatch(checkoutSignature(orderId, paymentId, secret), signature);
  },

  /** Generate a mock checkout signature (demo mode only). */
  mockSignature(orderId: string, paymentId: string): string {
    return checkoutSignature(orderId, paymentId, paymentConfig.mockSecret);
  },

  /**
   * Verify a webhook against the RAW request body bytes. Never use the parsed
   * JSON here — re-serialising changes whitespace and breaks the HMAC.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!rawBody || !signature) return false;
    const secret =
      paymentConfig.razorpay.webhookSecret ?? paymentConfig.razorpay.keySecret ?? paymentConfig.mockSecret;
    return signaturesMatch(hmacHex(rawBody, secret), signature);
  },

  /**
   * Reconciliation helper: ask the gateway what actually happened to a payment.
   * Returns null in mock mode (there is nothing remote to ask).
   */
  async fetchPayment(paymentId: string): Promise<FetchedPayment | null> {
    if (paymentConfig.provider === 'mock') return null;

    const payment = await razorpayRequest<{
      id: string;
      order_id: string;
      status: string;
      amount: number;
    }>('GET', `/payments/${encodeURIComponent(paymentId)}`);

    return {
      id: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amountPaise: payment.amount,
    };
  },
};
