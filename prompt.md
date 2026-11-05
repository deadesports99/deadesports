# Handoff — next work (payment gateway is DONE)

> Payment gateway ka kaam pura ho gaya hai. Full details:
> **`docs/PAYMENT_GATEWAY.md`**.
> Smoke test: `cd backend && npx tsx src/scripts/testPaymentFlow.ts` → 19/19 pass.

---

## 1. Kya complete hua (is pass me)

### Backend (Razorpay + mock)
- `PaymentOrder` model + `PaymentStatus` enum (amounts in **paise**), applied to
  the database with `prisma db push`.
- `src/config/payment.ts` — provider config + boot-time `assertPaymentConfig()`.
- `src/services/paymentGateway.service.ts` — mock + Razorpay REST (no npm SDK;
  Node 22 global `fetch`), checkout + webhook HMAC verification (constant time).
- `src/services/payment.settlement.ts` — **idempotent** settlement inside a
  Serializable transaction (status claim → balance increment → `WalletLedger`
  CREDIT/ADD_MONEY row) + `expireStalePaymentOrders()`.
- `src/controllers/payment.controller.ts` — create / get / verify / **sync** /
  webhook / demo pay + demo checkout page.
- `src/routes/payment.routes.ts` — mounted at `/api/payments` and
  `/api/v1/payments`; 6/min orders, 20/min verify+sync, 20/min demo per IP.
- `app.ts` — raw-body capture for webhook signatures (must stay).
- `server.ts` — boot config check + 5-minute expiry sweep (cleared on shutdown).
- `public/demo-checkout.html`, `.env.payment.example`, `Dockerfile` copies
  `public/`.

### Android (player app)
- `core/.../model/Payment.kt`, `TourneyApi` payment endpoints.
- `PlayerViewModel` — create order, verify signature, sync/check status,
  refresh wallet + deposits on success.
- `AddMoneySheet.kt` — presets + custom amount, native Razorpay checkout for
  `provider=razorpay`, browser checkout for `mock`, "Already paid? Check status".
- `WalletScreen` — ➕ Add Cash opens the instant sheet; manual UPI + UTR flow
  still available inside it.
- `MainActivity` — Razorpay `PaymentResultWithDataListener` + `Checkout.preload`.
- Razorpay SDK `com.razorpay:checkout:1.6.41` added; dependency verification
  metadata regenerated.

### Verification done
- `npx tsc --noEmit` → 0 errors.
- `npx tsx src/scripts/testPaymentFlow.ts` → 19/19 (order, credit, no double
  credit, verify, sync, webhook good/bad/replay, failed order, 403, limits).
- `./gradlew :app-player:assembleDebug :app-admin:assembleDebug` → BUILD SUCCESSFUL.
- Not verified: a real Razorpay payment (needs live/test keys) and the Android
  UI on a device/emulator.

## 2. Ab kya karna hai (next steps, priority order)

1. **Device test** — install the player APK, Wallet → Add Cash → mock pay →
   balance update. (I could not run an emulator.)
2. **Razorpay test-mode** — set `PAYMENT_PROVIDER=razorpay` + `rzp_test_*` keys,
   pay with `4111 1111 1111 1111`, confirm `/verify` + webhook settle once.
3. **Refund endpoint** — `POST /api/payments/:id/refund` (enum already has
   `REFUNDED`); reverse the ledger with a DEBIT row.
4. **Background reconciliation** — cron/sweep for `PENDING` orders older than
   N minutes → `paymentGateway.fetchPayment()` → settle.
5. **Admin visibility** — show `PaymentOrder` rows in the admin wallet console
   (currently only DepositRequest / WithdrawalRequest are listed).
6. **CI** — run the payment smoke test behind a flag (needs DB access).

## 3. Rules that must not be broken

- Amounts are **integer paise**; never floats.
- Settlement must stay **idempotent** (conditional status claim in a transaction).
- Webhook verification needs the **raw body** (`app.ts` hook).
- No `Wallet` table — use `User.depositBalance` + `WalletLedger`.
- Mock signature secret = `RAZORPAY_KEY_SECRET || 'mock_secret'`.
