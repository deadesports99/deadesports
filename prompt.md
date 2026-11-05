# Handoff Prompt — Payment Gateway Integration (Tourney / Free Fire Tournament Platform)

> **Purpose of this file:** Handoff document for the next AI agent. It records
> what has already been built, what is still pending, and the exact steps to
> finish the job. Read this fully before touching any code.

---

## 1. Project context

- **Repo root:** `C:\Free Fire turnament`
- **Backend:** Node.js + Express + TypeScript + Prisma (PostgreSQL via `@prisma/adapter-pg`)
- **Android app:** Kotlin + Jetpack Compose (separate `android/` tree — not touched by this task)
- **Goal of this task:** Add an **online payment gateway** so players can top up their wallet with real money. Chosen provider: **Razorpay** (India — UPI / cards / netbanking / wallets). A **`mock` provider** was also built so the whole flow can be demoed locally without any keys.

---

## 2. What has ALREADY been done (do not redo)

The following files were created or modified. **All of them are already in the repo** — verify with `git status` / `git log` before assuming anything is missing.

### New files created
| File | Purpose |
|---|---|
| `backend/src/config/payment.ts` | Provider config, env validation, `assertPaymentConfig()` |
| `backend/src/services/paymentGateway.service.ts` | Gateway abstraction — `createOrder`, `verifyCheckoutSignature`, `verifyWebhookSignature`, `fetchPayment`. Handles both `mock` and `razorpay`. |
| `backend/src/services/payment.settlement.ts` | Idempotent settlement — marks order `CAPTURED`, credits `User.depositBalance`, writes `WalletLedger` row (`category: ADD_MONEY`). |
| `backend/src/controllers/payment.controller.ts` | `createOrder`, `getOrder`, `verifyPayment`, `handleWebhook`, `demoCheckoutPage`, `demoPay` |
| `backend/src/routes/payment.routes.ts` | Routes + rate limiter. Webhook + demo endpoints are public; order/verify are behind `authenticate`. |
| `backend/src/middlewares/auth.ts` | `authenticate` (JWT verify + fresh DB user load + ban check), `authorize(roles)`, `requirePermission(keys)` |
| `backend/public/demo-checkout.html` | Standalone mock checkout page (Pay / Simulate failure buttons) |
| `backend/.env.payment.example` | Env template for payment vars |

### Files modified
| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Added `PaymentStatus` enum, `PaymentOrder` model, `Tenant.paymentOrders` + `User.paymentOrders` back-relations |
| `backend/src/app.ts` | Mounted `/api/payments` router; added `express.json({ verify })` hook that stashes `rawBody` for `/api/payments/webhook` (needed for signature verification) |
| `backend/src/server.ts` | Calls `assertPaymentConfig()` at boot; runs a 5-minute sweep that marks stale `CREATED`/`PENDING` orders as `EXPIRED`; clears the timer on shutdown |
| `backend/src/config/env.ts` | Added Zod-validated payment env vars (`PAYMENT_PROVIDER`, `RAZORPAY_*`, `PAYMENT_*`, `PUBLIC_BASE_URL`) |
| `backend/src/config/payment.ts` | Reads from `env` (not raw `process.env`) |

### Design decisions already made (keep them)
- **Amounts are in paise (integer)** everywhere — no floats.
- **Settlement is idempotent** — a second call for a `CAPTURED` order is a no-op.
- **Wallet model:** the schema has **no `Wallet` table**. Balances live on `User.depositBalance` / `User.winningBalance`. Settlement increments `depositBalance` directly and writes a `WalletLedger` row. Do **not** introduce a `Wallet` model unless you also migrate everything else.
- **Webhook signature** is verified against the **raw body** captured in `app.ts`. Do not remove that `verify` hook.
- **Mock provider** uses an HMAC signature derived from `RAZORPAY_KEY_SECRET || 'mock_secret'` so the same verify path runs in demo mode.

---

## 3. What is STILL PENDING (the actual work)

### 3.1 Install dependencies
