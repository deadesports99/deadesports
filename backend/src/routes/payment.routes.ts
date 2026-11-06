import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.js';

/**
 * Payment routes — mounted at /api/payments (and /api/v1/payments).
 *
 *  POST /orders                 authenticated -> create gateway order
 *  GET  /my                     authenticated -> the caller's own top-up history
 *  GET  /orders/:id             authenticated -> poll order status
 *  POST /verify                 authenticated -> verify checkout signature + settle
 *  POST /webhook                public        -> Razorpay webhook (HMAC verified)
 *  GET  /demo/checkout          public, mock  -> standalone mock checkout page
 *  POST /demo/pay               public, mock  -> simulate success / failure
 *
 * The webhook is intentionally public: Razorpay has no JWT. Its authenticity
 * comes from the HMAC over the RAW body captured in app.ts.
 */
export const paymentRouter: Router = Router();

/** Order creation: 6 / min / user — a player tops up a few times at most. */
const paymentOrderRateLimiter = createRateLimiter({
  name: 'payment-order',
  windowMs: 60_000,
  max: 6,
  key: (req) => `user:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  message: 'Too many payment attempts — try again in a minute.',
});

/** Verification polling: 20 / min / user (client polls after checkout). */
const paymentVerifyRateLimiter = createRateLimiter({
  name: 'payment-verify',
  windowMs: 60_000,
  max: 20,
  key: (req) => `user:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  message: 'Too many verification attempts — try again in a minute.',
});

/** Demo endpoints are public (no JWT in a browser tab) -> key by IP. */
const demoRateLimiter = createRateLimiter({
  name: 'payment-demo',
  windowMs: 60_000,
  max: 20,
  key: (req) => `ip:${req.ip ?? 'unknown'}`,
  message: 'Too many demo payment attempts — try again in a minute.',
});

// ── Authenticated player endpoints ──────────────────────────────────────
paymentRouter.get('/config', paymentController.getGatewayInfo);
// Player's own top-up history (read-only; the Wallet screen lists it).
paymentRouter.get('/my', authenticate, paymentVerifyRateLimiter, paymentController.getMyPayments);
paymentRouter.post('/orders', authenticate, paymentOrderRateLimiter, paymentController.createOrder);
paymentRouter.get('/orders/:id', authenticate, paymentController.getOrder);
paymentRouter.post('/orders/:id/sync', authenticate, paymentVerifyRateLimiter, paymentController.syncOrder);
paymentRouter.post('/verify', authenticate, paymentVerifyRateLimiter, paymentController.verifyPayment);

// ── Gateway callback (signature-verified, no JWT) ───────────────────────
paymentRouter.post('/webhook', paymentController.handleWebhook);

// ── Mock-mode helpers (400 when provider is razorpay) ───────────────────
paymentRouter.get('/demo/checkout', demoRateLimiter, paymentController.demoCheckoutPage);
paymentRouter.get('/demo/checkout.js', demoRateLimiter, paymentController.demoCheckoutScript);
paymentRouter.post('/demo/pay', demoRateLimiter, paymentController.demoPay);
