# Payment Gateway — Razorpay + Mock (complete)

> Status: **done and tested.** Backend endpoints, DB model, idempotent
> settlement, webhook verification, mock checkout page and the Android
> "Add Money" screen are all in place.
> Smoke test: `cd backend && npx tsx src/scripts/testPaymentFlow.ts` → 19/19.

---

## 1. How the money path works

```
Player (Android)                  Backend                        Gateway
─────────────────────────────────────────────────────────────────────────
Add Money ₹100
  │ POST /api/payments/orders
  ├─────────────────────────────▶ create PaymentOrder (CREATED)
  │                               └─ gateway.createOrder ───────▶ order_xxx
  │ ◀── orderId, providerOrderId, amountPaise, keyId / checkoutUrl
  │
  ├─ Razorpay SDK (native)  or  browser (mock demo page)
  │                                                    payment captured
  │
  ├─ POST /api/payments/verify (orderId, paymentId, signature)   ← SDK path
  │        └─ HMAC check ─▶ settleCapturedPayment()  ── idempotent
  │
  │        (or) POST /api/payments/webhook  ← gateway server-to-server
  │             └─ HMAC over RAW body ─▶ settleCapturedPayment()
  │
  └─ wallet depositBalance += amount, WalletLedger (CREDIT/ADD_MONEY)
```

Key rules (do not change casually):

- **Amounts are integer paise** everywhere in the API/DB (`amountPaise`).
- **Settlement is idempotent**: the order is claimed with a conditional
  `updateMany(status != CAPTURED)` inside a Serializable transaction, then the
  balance increment + ledger row commit together. Client retries, webhook
  replays and double taps can never double-credit.
- **No `Wallet` table** exists. Balances live on `User.depositBalance` /
  `User.winningBalance`; settlement increments `depositBalance`.
- **Webhook signature uses the raw bytes.** `app.ts` stashes `rawBody` for
  `/api/payments/webhook` and `/api/v1/payments/webhook`; never re-serialise.
- A payment that succeeds *after* a local `EXPIRED`/`FAILED` mark is still
  credited (money in must never be lost).

## 2. Files

| Path | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | `PaymentOrder` model + `PaymentStatus` enum |
| `backend/src/config/payment.ts` | Provider config + `assertPaymentConfig()` (boot check) |
| `backend/src/services/paymentGateway.service.ts` | mock + Razorpay REST client (no SDK dependency) |
| `backend/src/services/payment.settlement.ts` | idempotent settlement + `expireStalePaymentOrders()` |
| `backend/src/controllers/payment.controller.ts` | create / get / verify / sync / webhook / demo |
| `backend/src/routes/payment.routes.ts` | routes + per-user/IP rate limits |
| `backend/public/demo-checkout.html` | mock checkout page (Pay / Simulate failure) |
| `backend/public/demo-checkout.js` | page logic — external file because Helmet's CSP blocks inline scripts |
| `backend/.env.payment.example` | env template |
| `backend/src/scripts/testPaymentFlow.ts` | 19-check end-to-end smoke test |
| `android/core/.../model/Payment.kt` | Moshi models |
| `android/core/.../network/TourneyApi.kt` | `payments/*` endpoints |
| `android/app-player/.../AddMoneySheet.kt` | Add Money UI + checkout launcher |
| `android/app-player/.../PlayerViewModel.kt` | create / verify / sync top-up state |
| `android/app-player/.../MainActivity.kt` | Razorpay SDK callbacks |

## 3. Endpoints

Mounted at **both** `/api/payments` and `/api/v1/payments`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/config` | public | provider + amount limits + `demoMode` flag |
| GET | `/api/v1/admin/wallet/payments` | admin (`canManageWallet`) | online order list + today/total collection summary (`?status=ALL / CAPTURED / PENDING / FAILED / EXPIRED`, plus `page` and `limit`) |
| POST | `/api/v1/admin/wallet/payments/:id/sync` | admin (`canManageWallet`) | reconcile one order with the gateway (idempotent) |
| POST | `/orders` | JWT | body `{ "amountPaise": 10000 }` |
| GET | `/orders/:id` | JWT (owner) | poll order status |
| POST | `/orders/:id/sync` | JWT (owner) | reconcile a missed callback; optional `{ paymentId }` |
| POST | `/verify` | JWT (owner) | body `{ orderId, paymentId, signature }` |
| POST | `/webhook` | HMAC | `x-razorpay-signature`, raw body; public |
| GET | `/demo/checkout?orderId=...` | public | mock mode only |
| POST | `/demo/pay` | public | mock mode only, `{ orderId, outcome: "success" \| "failure" }` |

Statuses: `CREATED → PENDING → CAPTURED`, or `FAILED` / `EXPIRED`.
Orders auto-expire after `PAYMENT_ORDER_TTL_SECONDS` (default 900) via a sweep
in `server.ts` (every `PAYMENT_EXPIRY_SWEEP_INTERVAL_MS`, default 5 min).

## 4. Configuration

See `backend/.env.payment.example`. Defaults are mock-safe:

```env
PAYMENT_PROVIDER=mock          # mock | razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
PAYMENT_MIN_AMOUNT_PAISE=1000  # ₹10
PAYMENT_MAX_AMOUNT_PAISE=1000000 # ₹10,000
PAYMENT_ORDER_TTL_SECONDS=900
PAYMENT_MOCK_AUTO_CAPTURE=true
PAYMENT_EXPIRY_SWEEP_INTERVAL_MS=300000
PUBLIC_BASE_URL=http://localhost:5000
```

`server.ts` calls `assertPaymentConfig()` **before** listening: missing keys or
`mock` in production stop the boot instead of failing on a player's top-up.

## 5. Local demo (no keys)

```bash
cd backend
npm run dev
# login as a player -> copy the JWT, then:
curl -X POST http://localhost:5000/api/payments/orders \
  -H "Authorization: Bearer <JWT>" -H "Content-Type: application/json" \
  -d '{"amountPaise":10000}'
# open the returned checkoutUrl, click "Pay now"
curl http://localhost:5000/api/v1/wallet -H "Authorization: Bearer <JWT>"
```

In the Android app: **Wallet → ➕ Add Cash** → pick ₹100 → *Continue to
checkout* (opens the browser) → pay → return to the app (it auto-checks the
order and refreshes the balance).

## 6. Razorpay go-live checklist

1. Dashboard → API Keys → use `rzp_live_*` in `backend/.env`.
2. Set `PAYMENT_PROVIDER=razorpay`, `PUBLIC_BASE_URL=https://<api-domain>`.
3. Dashboard → Webhooks → `https://<api-domain>/api/payments/webhook`,
   events `payment.captured`, `payment.failed`, `order.paid`; copy the signing
   secret into `RAZORPAY_WEBHOOK_SECRET`.
4. `TRUST_PROXY=true` behind Render/Caddy so rate limits key on the real IP.
5. Test with card `4111 1111 1111 1111`, any future expiry, CVV `123`.
6. Android: no extra config — the app reads `keyId` + `providerOrderId` from
   the create-order response and opens the native SDK.
7. Rebuild the APK: `./gradlew :app-player:assembleDebug` (or release).

## 7. Not implemented yet

- **Refunds** — `PaymentStatus.REFUNDED` exists but no refund endpoint.
  Add `POST /api/payments/:id/refund` calling `POST /v1/payments/:id/refund`.
- **Background reconciliation job** for `PENDING` orders older than N minutes
  (`/orders/:id/sync` covers the on-demand case).
- **Automated tests in CI** — the smoke script is manual; wire it behind a
  `PAYMENT_SMOKE=1` guard if you want it in the pipeline.

## 8. Admin visibility (NEW)

The wallet console now has a third tab **⚡ Online** (`AdminWalletScreen`):

- **Today ₹X** and **Total collected ₹Y** (captured only), plus pending/failed counts.
- Every online order with player, amount, status, provider badge and time.
- Filters: ALL / CAPTURED / PENDING / FAILED.
- **Check with gateway** button on pending/expired orders → calls
  `POST /api/v1/admin/wallet/payments/:id/sync` (idempotent; safe to spam).
- A **⚠ DEMO gateway** line appears while `PAYMENT_PROVIDER=mock`, so nobody
  mistakes demo money for real collections.

Player app also shows a **⚠ DEMO MODE** banner in the Add Money sheet, driven by
the public `GET /api/payments/config` endpoint.
