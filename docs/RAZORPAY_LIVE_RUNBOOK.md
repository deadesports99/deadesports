# Razorpay Live Runbook (D1) — ₹1 UPI end-to-end

> **Goal:** prove that real money can enter a player wallet and can never enter twice.
> Everything here is repeatable and safe: one ₹10 top-up (the minimum), instantly refunded.
>
> Code side is already done and tested offline: `tests/razorpayHttp.e2e.test.ts` runs the
> whole flow (order → checkout verify → settle → webhook → duplicate webhook) against a
> local Razorpay-shaped stub, so this runbook only validates the parts that need a real
> account: keys, dashboard config, and the UPI app on a phone.

---

## 0. What you need before starting

| Item | Where |
| --- | --- |
| Razorpay account (KYC complete) | https://dashboard.razorpay.com |
| **Test** API keys `rzp_test_…` + secret | Dashboard → Account & Settings → API Keys |
| **Webhook** secret (you invent it) | Dashboard → Account & Settings → Webhooks |
| A phone with GPay/PhonePe/Paytm | for the ₹10 UPI payment |
| A public HTTPS URL for the backend | ngrok (`ngrok http 5000`) is enough for the test run |

> Test-mode keys move **no real money**. Do the whole list with `rzp_test_*` first;
> repeat with `rzp_live_*` only when the test run is green.

---

## 1. Configure

```env
PAYMENT_PROVIDER=razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=<random 32+ chars you invent>
PAYMENT_MIN_AMOUNT_PAISE=1000      # ₹10 floor
PUBLIC_BASE_URL=https://<your-public-host>
```

Generate the webhook secret with something like `openssl rand -hex 24` and paste the
**same** value into the Razorpay dashboard webhook form.

## 2. Preflight (offline, 5 seconds)

```bash
cd backend
npx tsx src/scripts/razorpayLiveCheck.ts
```

Must end with `✅ Configuration looks valid.` It refuses to continue if the key shape is
wrong, the secret is missing, the webhook secret is missing, the public URL is localhost,
or if test/live keys are paired with the wrong `NODE_ENV`.

Then prove the keys actually work against Razorpay (creates a ₹1 order, no money moves):

```bash
npx tsx src/scripts/razorpayLiveCheck.ts --create-order
```

Expected: `✅ gateway accepted the order` with an `order_…` id.

## 3. Dashboard webhook

Dashboard → Webhooks → **Add new webhook**

| Field | Value |
| --- | --- |
| Webhook URL | `https://<your-public-host>/api/v1/payments/webhook` |
| Secret | same value as `RAZORPAY_WEBHOOK_SECRET` |
| Active events | `payment.captured`, `payment.failed`, `order.paid` |

Send a test event from the dashboard; the backend must answer **200**. A 400 means the
secret does not match, and every real payment will then depend on the reconcile sweep.

## 4. The ₹10 UPI run (the actual D1 test)

1. Rebuild and restart the backend (`npm run build && node dist/server.js`).
2. Install the debug player app, `adb reverse tcp:5000 tcp:5000`, log in.
3. Wallet → **Add Cash** → ₹10 → **Pay via UPI** → complete the payment in GPay/PhonePe.
4. Back in the app: the top-up row flips to **Paid**, and the deposit balance grows by ₹10.

Then verify **both** money-safety properties:

| Check | How | Expected |
| --- | --- | --- |
| Never double-credits | tap **Re-check** on the paid row, twice | balance unchanged, still one ledger row |
| Webhook works alone | pay a second ₹10, then stop the app before it returns; wait for the webhook | order becomes `CAPTURED` with no app running |
| Sweep works alone | pay a third ₹10, delete the webhook in the dashboard, wait 5 min | reconcile sweep settles it (log: `Reconcile sweep: settled 1/1`) |
| Abandoned checkout expires | open checkout, close it, wait 15 min | order `EXPIRED`, no money moved |
| Failed payment | use Razorpay's test card/UPI failure | order `FAILED`, no credit, nothing in the wallet |

Database spot-check (Supabase SQL editor):

```sql
select o.id, o.status, o."amountPaise", o."providerPaymentId", l.amount, l."referenceId"
from "PaymentOrder" o
left join "WalletLedger" l on l."referenceId" = o."providerPaymentId"
order by o."createdAt" desc
limit 10;
-- the ledger row is linked by providerPaymentId (WalletLedger.referenceId)
```

Exactly one `WalletLedger` row per `CAPTURED` order — that is the invariant the whole
idempotency design exists for.

## 5. Refund the test money

Dashboard → Transactions → the ₹10 payment → **Refund** → full amount.
Record the refund id in the launch notes; the platform intentionally does not auto-refund
(admin refunds stay manual for now, see `plan/ROADMAP.md` Phase 12).

## 6. Live keys (only after the test run is green)

1. Swap `RAZORPAY_KEY_ID/SECRET` to `rzp_live_*` **and** re-create the webhook secret.
2. Re-run `npx tsx src/scripts/razorpayLiveCheck.ts` — it warns if live keys sit on a
   non-production server, and the backend refuses to boot with `mock` in production.
3. Repeat the ₹10 run once with a real account, then refund it.
4. Keep `PAYMENT_RECONCILE_SWEEP_INTERVAL_MS` at 300000 (5 min) in production.

## 7. Known limits (deliberate, not bugs)

- **No auto-refund on cancel** — a paid-but-cancelled match refunds via the admin flow, not the gateway.
- **No per-tenant Razorpay keys** — one merchant account per deployment.
- **Settlement is manual-reconcile friendly** — the admin Wallet Console has one-tap **Sync**
  for the rare case where both the webhook and the sweep are down.
- **`PAYMENT_PROVIDER=mock` in production is fatal by design** (`paymentConfigProblems`).
  If someone genuinely needs a demo deploy, use a separate environment with
  `NODE_ENV!=production`.
