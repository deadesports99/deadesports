# 💳 Phase 10: Online Payments (Razorpay/Mock), Email-Auth & Settings Polish

> **Scope (built by the concurrent IDE agent, audited & stabilised here):**
> real online wallet top-up (mock gateway in dev, Razorpay in production), a
> player "Add Money" checkout sheet, an admin **Online payments** console, plus
> email+password+OTP authentication and per-tenant auth-method toggles.
> **Status:** ✅ Working — backend build clean · payment smoke **19/19** ·
> Phase 8/9 regressions **36/36 + 44/44** · both APKs build & device-tested.

---

## What was added

### Player app
- **`AddMoneySheet.kt`** — amount chips (₹10/50/100/500/1000) + custom amount,
  DEMO-MODE banner, `Continue to demo checkout`, and a
  `Pay via UPI & enter UTR instead` fallback that opens the classic
  QR/UPI/UTR sheet. Live status: "₹100 added to your wallet" + Done.
- **Login** — new tabbed auth: Phone (Firebase SMS OTP) / Email (email +
  password + 6-digit OTP, debug OTP shown in dev). Modes follow the tenant's
  auth-method toggles from `GET /tenant/settings`.

### Admin app
- **Wallet Console → Online tab** — today's collected ₹, paid/pending/failed
  counts, DEMO banner, order list (player, amount, status, payment id) + sync.
- **App Settings → Player Authentication Methods** — Email / Phone / Google
  toggles with "at least one must stay on" guard; saving verified end-to-end
  (`PATCH /admin/tenant/settings` → DB → GET reflects immediately).

### Backend
- **`PaymentOrder`** model (amounts in paise), `PaymentStatus` enum, `User.passwordHash`,
  `Tenant.allowPhoneAuth / allowGoogleAuth / allowEmailAuth`, `EmailOtp` model.
- **Payment engine** — `paymentGateway.service.ts` (mock + Razorpay), order create,
  status poll, `/verify` signature check, public HMAC-verified `/webhook`,
  `/demo/checkout` + `/demo/pay` mock helpers, settlement into the double-entry
  ledger (idempotent — no double credit), stale-order expiry sweep in `server.ts`.
- **Auth** — email OTP send/verify endpoints; phone/Google/email gates per tenant;
  `loginWithPhone` now requires a Firebase idToken (production hardening).

## Audit fixes applied in this session
1. **Schema/DB drift repaired** — concurrent edits had added columns/models without
   `db push` (`allowDirectNumber` vs `allowEmailAuth`, `PaymentOrder`, `EmailOtp`);
   a **duplicate `EmailOtp` model** broke `prisma validate`. Synced schema ↔ DB ↔
   generated client; removed the duplicate; dropped the unused `allowDirectNumber`.
2. **Auth flags restored** — tenant had `allowPhoneAuth=false` and
   `allowGoogleAuth=false` (only email on), which would lock admins/players out
   after logout. Restored all three to `true`.
3. **Regression scripts fixed** — phone-only login is gone, so `scripts_phase8/9`
   now sign a short-lived JWT from the seeded user directly (same token a real
   session carries).
4. **`backend/.env.example`** — added the missing `PAYMENT_* / PUBLIC_BASE_URL /
   RAZORPAY_*` block so a fresh deployment can configure payments.

## Verification
- `npx tsx src/scripts/testPaymentFlow.ts` → **19/19** (order, checkout page, credit,
  double-pay idempotency, verify, sync, bad/good webhook signature, replay, failed
  payment, ownership 403, auto-cleanup).
- `scripts_phase8_visibility.ts` → **36/36**; `scripts_phase9_room_reveal.ts` → **44/44**.
- Device (RMX5070 via adb): Add Money → mock checkout in Chrome → "Payment captured
  and wallet credited" → app balance **₹710 → ₹810**, sheet showed
  "✅ ₹100 added to your wallet"; admin Online tab showed Today ₹810 / 5 paid orders;
  auth toggles saved and reflected in the API. No FATAL crashes in logcat.
