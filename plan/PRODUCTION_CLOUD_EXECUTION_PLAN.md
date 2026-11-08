# Production Cloud Execution Plan

## Goal

Move the Free Fire Tournament backend from `localhost:5000` to a secure public
HTTPS API and rebuild the Player/Admin Android apps against that API. Execute
the phases in order. Do not publish APKs or accept real money before Phase 8
and Phase 9 are complete.

## Recommended path

Use this path for the first launch:

```text
Render Web Service + Upstash Redis + Supabase PostgreSQL + Cloudflare DNS
```

The repository also contains a VPS path in `backend/docker-compose.prod.yml`,
but use only one cloud backend at a time.

## Current implementation status

Already prepared:

- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/docker-compose.prod.yml`
- `backend/.env.production.example`
- `backend/Caddyfile`
- `render.yaml`
- `DEPLOYMENT.md`
- `/health`, `/health/ready`, `/health/db`, `/health/redis`
- Supabase pool sizing and Redis timeout/fallback handling
- Android HTTPS API configuration and `-PapiBaseUrl` override
- Real-money top-ups: Razorpay + mock provider, webhook, idempotent settlement (`docs/PAYMENT_GATEWAY.md`)
- Admin online-payments tab in the Wallet Console (collected today, per-order Sync)
- 254 backend tests and a green SonarCloud quality gate (`docs/CODE_QUALITY.md`)

The security and database blockers below must be completed before deployment.

---

## Phase 0 — Decide values and create a private launch record

### Owner actions

- [ ] Choose the real API hostname, for example `api.alphaesports.in`.
- [ ] Choose Render or VPS. This plan assumes Render.
- [ ] Confirm the Supabase project and region.
- [ ] Confirm the production tenant UUID and owner phone number.
- [ ] Confirm Android package IDs and client brand.

### Keep these values private

```text
API_DOMAIN=api.<your-domain>
DATABASE_URL=<Supabase pooler URL>
REDIS_URL=<Upstash rediss URL>
JWT_SECRET=<random 64+ character value>
FCM_CREDENTIALS_JSON=<optional one-line Firebase service account JSON>
TENANT_ID=<production tenant UUID>
```

Never commit real values to `.env.example`, APK assets, screenshots, Git, or
chat. Store secrets in provider dashboards or a password manager.

### Done when

- [ ] One provider, one database, one Redis instance, and one API hostname are
      selected.
- [ ] A private record contains the values and rollback owner.

---

## Phase 1 — Fix production blockers

### 1.1 Enforce Firebase OTP

Files: `backend/src/controllers/auth.controller.ts`,
`backend/src/services/auth.service.ts`, `backend/src/config/env.ts`.

- [ ] In production, require `idToken` for login and registration.
- [ ] Keep phone-only auth only behind an explicit local/test flag, defaulting
      to disabled.
- [ ] Derive the account phone from the verified Firebase token, not from an
      untrusted request field.
- [ ] Keep mock OTP tokens disabled in production.

Acceptance: a known phone number alone cannot log in/register in production;
a valid Firebase phone token can authenticate the correct tenant user.

### 1.2 Remove the public rate-limit bypass

File: `backend/src/middlewares/rateLimiter.ts`.

- [ ] Delete the `x-stress-test: apex-ff-internal` production bypass.
- [ ] Allow limiter reset/disable only when `NODE_ENV=test`.
- [ ] If stress testing needs a bypass, use a test-only server secret that is
      unavailable in production.

Acceptance: repeated login, deposit, withdrawal, and join requests receive
`429`; arbitrary headers cannot disable limits.

### 1.3 Make proxy trust safe

Files: `backend/src/config/env.ts`, `backend/src/app.ts`.

- [ ] Replace boolean `TRUST_PROXY=true` with a numeric hop count, normally
      `TRUST_PROXY=1` behind Render/Caddy.
- [ ] Parse and bound the value as `false` or a non-negative integer.
- [ ] Verify forged `X-Forwarded-For` headers cannot bypass IP rate limits.

### 1.4 Make cancellation idempotent

File: `backend/src/services/tournament.service.ts`.

- [ ] After `FOR UPDATE`, re-check the locked tournament status.
- [ ] Allow only one valid transition to `CANCELLED`.
- [ ] Return `409` for a second cancellation attempt.
- [ ] Ensure one refund and one refund ledger row per player.

Acceptance: two simultaneous cancel requests never double-refund.

### 1.5 Bound payout money and result input

Files: `backend/src/controllers/result.controller.ts`,
`backend/src/services/result.service.ts`.

- [ ] Reject duplicate player IDs.
- [ ] Reject duplicate non-disqualified ranks.
- [ ] Validate every result belongs to a participant.
- [ ] Calculate the complete payout before wallet writes.
- [ ] Enforce the agreed prize/kill budget cap.
- [ ] Keep repeated payout requests idempotent.

Acceptance: malformed lists return `400` before credits, total credits stay
within budget, and retries do not pay twice.

### 1.6 Harden device lock

Files: `backend/prisma/schema.prisma`,
`backend/src/services/auth.service.ts`.

- [ ] **Remove Dev Testing Overrides:** Remove developer phone bypass (`DEV_TEST_DEVICE_IDS` with `'1d24b2b7de7dafdb'`, `'d75a826d9b6319b1'`, and `DEV_UNLIMITED_DEVICE_ACCOUNTS`) from `backend/src/services/auth.service.ts`.
- [ ] Decide whether banned devices may ever register again; default to no.
- [ ] Add a migration-safe tenant/device uniqueness strategy.
- [ ] Convert unique-constraint races into clean `403/409` responses.
- [ ] Finalize production device account limit (strict 1 per device vs 2 per device).

Acceptance: concurrent registration cannot create two active accounts for one
tenant/device, and a banned device cannot simply re-register.

### 1.7 Prevent spreadsheet formula injection

File: `backend/src/services/settlement.service.ts`.

- [ ] Prefix CSV values beginning with `=`, `+`, `-`, or `@` with a single
      quote before export.
- [ ] Apply this to names, IGN, phone, references, and notes.

### 1.8 Make Firebase setup explicit

Files: `android/core/src/main/java/com/tourney/core/firebase/PhoneAuthManager.kt`,
Player/Admin login screens.

- [ ] Make `google-services.json` required for production OTP APKs, or restore
      a documented development fallback.
- [ ] Fail clearly during setup if OTP configuration is missing.
- [ ] Verify Firebase package IDs and SHA-1/SHA-256 fingerprints.

---

## Phase 2 — Create and apply the production database migration

The repository currently has no `backend/prisma/migrations` directory. Do not
deploy schema changes with only `prisma generate`.

### Local preparation

```powershell
cd "C:\Free Fire turnament\backend"
npm ci
npx prisma validate
npx prisma generate
```

- [ ] Back up the production Supabase database.
- [ ] Review new `Tenant` columns and the device constraint.
- [ ] Create a named Prisma migration.
- [ ] Review generated SQL manually.
- [ ] If the database was created with `db push`, baseline it first instead of
      blindly running an initial migration against populated tables.

### Apply

```powershell
cd "C:\Free Fire turnament\backend"
npx prisma migrate deploy
npx prisma generate
```

Done when migration files exist, production migration history is recorded,
existing rows remain readable, and `npx prisma validate` passes.

---

## Phase 3 — Local production-like validation

### Backend

```powershell
cd "C:\Free Fire turnament\backend"
npm ci
npm run prisma:generate
npm run build
```

- [ ] Start with test-only production-like environment values.
- [ ] Check `/health`, `/health/ready`, `/health/db`, and `/health/redis`.
- [ ] Stop Redis and verify the API stays alive while Redis reports degraded.
- [ ] Verify CORS, proxy IP handling, and secret redaction in logs.

### Docker

Start Docker Desktop, then:

```powershell
cd "C:\Free Fire turnament\backend"
Copy-Item .env.production.example .env.production
# Edit .env.production with test-only values.
docker compose -f docker-compose.prod.yml config --quiet
docker build -t free-fire-tournament-api:local .
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl.exe -fsS http://localhost/health
docker compose -f docker-compose.prod.yml down
Remove-Item .env.production
```

Done when backend build, Docker build, Compose validation, health, and
graceful shutdown all pass.

---

## Phase 4 — Prepare Supabase production data

- [ ] Confirm the production Supabase project.
- [ ] Use the Session/PgBouncer pooler URL on port `6543` for the app.
- [ ] Include `pgbouncer=true&connection_limit=10`.
- [ ] Apply the migration from Phase 2.
- [ ] Create/verify the production tenant and owner `ADMIN` user.
- [ ] Set production UPI, payee, WhatsApp, and minimum deposit values.
- [ ] Verify no demo tenant/player is used for real money.

### Tenant SQL template

Run only after replacing and reviewing placeholders:

```sql
INSERT INTO "Tenant"
  (id, subdomain, "brandName", "primaryColor", "commissionRate",
   "upiId", "upiName", "supportWhatsapp", "minDeposit", "isActive", "createdAt")
VALUES
  (gen_random_uuid(), '<subdomain>', '<brand name>', '#FF5722', 10,
   '<upi-id>', '<payee name>', '<whatsapp digits>', 10, true, now())
RETURNING id;

INSERT INTO "User"
  (id, "tenantId", "phoneNumber", name, email, role, "createdAt")
VALUES
  (gen_random_uuid(), '<tenant uuid>', '<owner phone>', '<owner name>',
   '<owner email>', 'ADMIN', now());
```

Done when the tenant UUID is recorded privately and the owner is found by the
intended phone number.

---

## Phase 5 — Create production Redis

- [ ] Create an Upstash Redis database in a nearby region.
- [ ] Copy the TLS URL as `REDIS_URL=rediss://...`.
- [ ] Confirm Lua `EVAL`, hashes, sets, pipelines, and TTL commands work.
- [ ] Never expose Redis credentials to Android.
- [ ] Verify `/health/redis` returns 200.
- [ ] Verify reserve/release slot and team create/join behavior.
- [ ] Disconnect Redis and verify API fallback does not crash the process.

---

## Phase 6 — Deploy the API to Render

- [ ] Connect the repository and select the root `render.yaml` Blueprint.
- [ ] Use `backend/Dockerfile` and health path `/health`.
- [ ] Deploy only after Phase 1 and Phase 2 are complete.
- [ ] Save the generated Render hostname privately.

Set these in the Render dashboard:

```text
NODE_ENV=production
PORT=10000
TRUST_PROXY=1
DATABASE_URL=<Supabase pooler URL on 6543>
REDIS_URL=<Upstash TLS URL>
JWT_SECRET=<random 64+ character secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=<HTTPS origins, or * for Android-only>
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=10000
DB_POOL_CONNECTION_TIMEOUT_MS=5000
FCM_CREDENTIALS_JSON=<optional one-line JSON>
```

Done when Render is green, `/health` is 200, `/health/ready` is 200, and logs
show no secrets.

---

## Phase 7 — Connect custom domain and HTTPS

For Render, add this DNS record:

```text
Type: CNAME
Name: api
Target: <render-service-hostname>.onrender.com
```

- [ ] Wait for DNS propagation and certificate issuance.
- [ ] Verify the hostname resolves to the intended service.
- [ ] Verify the certificate is valid.

```powershell
curl.exe -i https://api.<your-domain>/health
curl.exe -i https://api.<your-domain>/api/v1/health
curl.exe -i https://api.<your-domain>/api/v1/health/ready
```

Expected: HTTPS works, all three endpoints return 200, and no secret appears
in responses.

---

## Phase 8 — Build Android apps against the real domain

Do not use a placeholder domain in a release APK. First complete Phase 7.

Update the client config with:

```json
{
  "api_base_url": "https://api.<your-domain>/api/v1",
  "tenant_id": "<production tenant UUID>"
}
```

### Debug build

```powershell
cd "C:\Free Fire turnament\android"
.\gradlew.bat :app-player:assembleDebug :app-admin:assembleDebug `
  -PapiBaseUrl=https://api.<your-domain>/api/v1 --console=plain
```

- [ ] Inspect generated assets for the real URL and tenant UUID.
- [ ] Confirm package IDs and matching `google-services.json` files.

### Release build

```powershell
.\gradlew.bat :app-player:assembleRelease :app-admin:assembleRelease `
  -PapiBaseUrl=https://api.<your-domain>/api/v1 --console=plain
```

- [ ] Sign each release with the correct client keystore.
- [ ] Never reuse a client keystore for another client.
- [ ] Increase `version_code` for every upload.
- [ ] Record APK SHA-256 hashes.

---

## Phase 9 — Real-device and money-flow verification

Use two physical Android phones over 4G/5G. Disconnect USB after installation.
Use small test amounts and record IDs for cleanup/refund.

### Player checks

- [ ] Firebase OTP registration, logout, and login.
- [ ] Tournament feed over mobile data.
- [ ] Deposit/UTR submission and Admin approval.
- [ ] Correct wallet debit and ledger row after joining.
- [ ] Duplicate slot/join rejection.
- [ ] Room locked before T-15 and visible after T-15.
- [ ] Wallet, withdrawal, WhatsApp support, profile, and theme switch.

### Admin checks

- [ ] Owner OTP login.
- [ ] Match creation and staff permission boundaries.
- [ ] Deposit approval/rejection and room publishing.
- [ ] Lifecycle sweep.
- [ ] Cancellation with exactly one refund per player.
- [ ] Result payout budget and idempotency.
- [ ] Settlement CSV export.
- [ ] Match cloning starts with zero seats.

### Security checks

- [ ] Android sends only HTTPS.
- [ ] No USB ADB reverse or local Wi-Fi backend is required.
- [ ] Public-IP rate limits trigger.
- [ ] Emulator join block behaves as intended.
- [ ] Same-device second account is rejected.
- [ ] Cross-tenant IDs cannot read or mutate another tenant's data.

---

## Phase 10 — Monitoring and rollback

- [ ] Save Render health/log URLs.
- [ ] Monitor `/health` and `/health/ready`.
- [ ] Keep Supabase backups enabled.
- [ ] Keep a release log with APK version, API revision, migration, domain,
      and test date.
- [ ] Assign a rollback owner.
- [ ] Keep the last known-good API/APK version identified.
- [ ] Never delete ledger, deposit, withdrawal, or payout rows during rollback.
- [ ] Do not reverse a database migration while old and new app versions may
      both be active.

### Rollback order

1. Stop distributing the new APKs.
2. Roll back or repoint the API service.
3. Preserve database records and investigate the incident.
4. Record affected tenants/users and the recovery action.

---

## ⚠️ Special Cleanup Section — Developer Testing Overrides (MUST REMOVE BEFORE LAUNCH)

> **Purpose:** Dedicated tracking section for temporary developer testing overrides and exemptions added to the codebase so they are guaranteed to be cleaned up before production cloud deployment.

### 1. Developer Phone Multi-Account Exemption
* **File:** `backend/src/services/auth.service.ts` (lines ~89-125)
* **What was configured:**
  * **Whitelisted Developer Device IDs:** `'1d24b2b7de7dafdb'` (:app-player package SSAID) and `'d75a826d9b6319b1'` (shell Android ID on Jay's Realme P3 5G), plus `DEV_UNLIMITED_DEVICE_ACCOUNTS` env flag, to allow unlimited test accounts on the developer's physical phone.
  * **General Device Limit:** Configured to allow up to 2 accounts per physical mobile device (to accommodate dual/family accounts).
* **Pre-Launch Removal Action:**
  - [ ] Delete `DEV_TEST_DEVICE_IDS` containing `'1d24b2b7de7dafdb'` and `'d75a826d9b6319b1'` from `backend/src/services/auth.service.ts`.
  - [ ] Decide and finalize production policy: strictly 1 account per device (`countOnDevice >= 1`) or 2 accounts per device (`countOnDevice >= 2`).
  - [ ] Verify `DEV_UNLIMITED_DEVICE_ACCOUNTS` is disabled and absent in `.env.production`.

---

## ⚠️ Section V2 - Demo / Test / Debug Code Removal (MUST REMOVE BEFORE LAUNCH)

> **Why this section exists:** the platform was built and demoed without live gateway
> keys, with local phones and with seeded accounts. Every shortcut below is safe in
> development and unsafe (or embarrassing) in production. Tick each box only after the
> file/flag is gone from the deployed artifact - not just from your editor.
>
> Verify with: `grep -rn "mock\|demo\|BYPASS\|DEV_" backend/src backend/public --include=*.ts --include=*.js --include=*.html`

### A. Mock payment gateway (highest risk - moves no real money, but takes none either)

| Item | File | Remove / change |
| --- | --- | --- |
| Mock provider branch | `backend/src/services/paymentGateway.service.ts` | Keep the code, set `PAYMENT_PROVIDER=razorpay`. A `mock` provider in production is only a boot **warning**, so a typo here means paying customers silently get demo orders. |
| Demo checkout page + script | `backend/public/demo-checkout.html`, `backend/public/demo-checkout.js` | Delete before the public deploy (or keep them out of the Docker image). |
| Demo routes | `backend/src/controllers/payment.controller.ts` (`demoCheckoutPage`, `demoCheckoutScript`, `demoPay`) | Return `404` when `PAYMENT_PROVIDER !== 'mock'`, then delete in the clean-up commit. |
| Auto-capture flag | `PAYMENT_MOCK_AUTO_CAPTURE` in `.env.payment.example` | Must be absent/false in production; a real gateway must never auto-capture from the server. |
| Mock signatures | `paymentGateway.mockSignature()` | Used by tests only - never call it from a production route. |
| `demoMode` flag leak | `backend/src/controllers/payment.controller.ts`, `paymentAdmin.service.ts` | Keep it (admin needs to know), but confirm the Android Admin app shows a red "DEMO MODE - no real money" banner when true. |

- [x] Code side done: **mock in production is fatal** (`paymentConfigProblems`, 5 tests) instead of a warning.
      Ops side (real keys in `.env.production`) still needs the Razorpay account.
- [x] Demo routes unreachable: they now answer **404** (not 400) when the provider is not mock.
- [x] `public/demo-checkout.*` and `src/scripts` are in `.dockerignore` (never in the image).
- [ ] Admin app shows the DEMO banner only when the API reports `demoMode: true`.

### B. OTP / login bypasses

| Item | File | Remove / change |
| --- | --- | --- |
| `mock_otp_` token bypass | `backend/src/services/firebase.service.ts` (~line 80) | Guarded by `NODE_ENV !== 'production' \|\| BYPASS_OTP_FOR_TESTING === 'true'` - both must be false, and the flag must be deleted from the code afterwards. |
| `mock_google_` token bypass | `backend/src/services/firebase.service.ts` (~line 160) | Same treatment. |
| Developer device IDs | `backend/src/services/auth.service.ts` (`DEV_TEST_DEVICE_IDS`, ~line 116) | Delete the whitelisted SSAIDs, then finalise the per-device account cap (1 or 2). |
| Unlimited device accounts | `DEV_UNLIMITED_DEVICE_ACCOUNTS` env flag | Absent in `.env.production`. |
| Debug logging | `backend/src/services/auth.service.ts:133` (`console.log` on every device check) | Remove or gate behind `env.NODE_ENV === 'development'` - it leaks device IDs into cloud logs. |

- [x] Both bypass branches **deleted** from `firebase.service.ts`; test auth uses `tests/helpers/fakeFirebase.ts`.
- [x] `DEV_TEST_DEVICE_IDS`, the whitelist bypass and `DEV_UNLIMITED_DEVICE_ACCOUNTS` are gone.
- [x] Device testing needs *some* login on a machine without Firebase credentials, so the bypass
      returned as **one explicit flag**: `DEV_FAKE_FIREBASE=true` accepts `dev_otp_<phone>` /
      `dev_google_<uid>` **only** when `NODE_ENV === 'development'`. `assertDevAuthConfig()` makes
      booting production with it **fatal**, the Admin/Player debug APK has a "Dev login (no OTP)"
      button that is compiled out of release builds, and `.env.production.example` ships it false.
- [x] Policy = **max 2 accounts per device** (`MAX_ACCOUNTS_PER_DEVICE`), covered by `authService.test.ts`.

### C. Seeded demo data and demo tenants

| Item | File | Remove / change |
| --- | --- | --- |
| Demo tenant + demo admins | `backend/prisma/seed.ts` | Seeded phones `9999900001` (ADMIN), `9999900002` (SUB_ADMIN), plus `99999692404`, `99999627799`. Change passwords/OTP or delete the demo tenant before launch. |
| Demo tournaments / slots | `backend/prisma/seed.ts` | Do not run the seed against production; production tenant is created with the Phase 4 SQL template. |
| Test admin credentials in docs | `docs/*.md`, `plan/*.md`, Android `ui-ux demo/**` | Make sure no live credential or seeded phone is quoted in anything shipped with the APK or the website. |

- [ ] Production tenant created via the SQL template, not the seed script.
- [ ] Seeded phones either deleted or rotated with a fresh OTP/PIN.
- [ ] `npm run seed` is not part of the production start command.

### D. Developer harness code that must not ship

| Item | Path | Action |
| --- | --- | --- |
| Ad-hoc lifecycle/stress scripts | `backend/scripts_lifecycle.ts`, `scripts_phase6.ts`, `scripts_phase8_visibility.ts`, `scripts_phase9_room_reveal.ts`, `scripts_stress_test.ts` | Keep in the repo for testing, excluded from the image and from Sonar analysis (already excluded). |
| Dev/test harnesses | `backend/src/scripts/**` (18 files: `testPaymentFlow.ts`, `testRealtime*.ts`, `hookAndroid.js`, `patch*.js`, `fixFeedTabs.js`, ...) | Excluded from Sonar and from the Docker build; delete the one-off patch scripts (`patch*`, `fix*`, `removeSpinners`) since they already did their job. |
| Test suite | `backend/tests/**` | Keep in git, excluded from the image (already in `.dockerignore`). Never mount into production. |
| Coverage output | `backend/coverage/**` | Excluded from the image; do not commit generated reports. |
| Design mockups | `ui-ux demo/**`, `**/preview*.html` | Not part of the APK; keep out of the deployed website root. |
| Enumeration check script | `backend/src/utils/*` dev helpers | Confirm none are reachable from a route. |

- [ ] `docker run <image> sh -c "ls src/scripts public tests"` shows nothing but production files.
- [x] Deleted `fixFeedTabs.js`, `patch*Service.js`, `removeSpinners.js`, `hookAndroid.js`.
- [ ] `.dockerignore` still lists `tests`, `coverage`, `.env*`, `src/generated`.

### E. Android release build hygiene

| Item | File | Action |
| --- | --- | --- |
| Localhost default API | `android/core/src/main/java/com/tourney/core/theme/ClientConfig.kt:41` (`http://localhost:5000/api/v1`) | Release builds must always pass `-PapiBaseUrl=https://api.<domain>/api/v1`; keep the localhost default for debug only. |
| Realtime base URL fallback | `android/core/src/main/java/com/tourney/core/network/TourneyRealtimeClient.kt:87` (`http://localhost:5000`) | Derive from `ClientConfig` (it currently defaults to localhost) - otherwise realtime silently fails on real devices. |
| Cleartext traffic | `AndroidManifest.xml` (`usesCleartextTraffic`) | Must be false/absent in release; debug-only network config. |
| Adb reverse instructions | `docs/*.md`, `README` | Fine in docs, never in a release build. |
| Debug signing | `android/app-*/build.gradle.kts` | Signed with a real keystore for Play/APK distribution; debug keystore never on the store build. |
| Razorpay test key | Android `Payment.kt` / checkout init | Key comes from the backend response (`keyId`); confirm it is the live key, not `rzp_test_*`. |

- [x] Release gate added to both apps: `assembleRelease`/`bundleRelease` **fail** unless the API URL is `https://`.
      Verified: localhost -> build fails with a clear message; `-PapiBaseUrl=https://api.thunderesports.in/api/v1` -> APK ships that URL.
- [x] Realtime URL is derived from the API base (`wss://` for https, `ws://` for http) and is unit-tested;
      an empty base URL now disables realtime instead of guessing localhost. Fixed a real bug where hosts
      starting with `api.` were stripped to nothing by a naive `/api` split.
- [ ] No debug keystore in the distributed artifact.

### F. Operational leftovers that look like demo code

- [ ] `TRUST_PROXY=true` set on Render (otherwise rate limiting keys off the proxy IP).
- [ ] Realtime `console.log('... Gateway mounted')` reduced to a single startup line.
- [ ] `/health/db` and `/health/redis` require no auth but must not print connection strings.
- [ ] Log level: no `console.log` of phone numbers, device IDs or gateway payloads in production.
- [ ] Rate-limit bypass header/env removed (see Phase 1.2).
- [ ] Sonar exclusions re-checked after the removals - deleting files can leave dead patterns behind.

### G. Sign-off

- [ ] Ran the full list once on a staging deploy and once on the production deploy.
- [ ] `grep -rn "mock_otp_\|mock_google_\|DEV_TEST_DEVICE_IDS\|BYPASS_OTP_FOR_TESTING\|DEMO" backend/src android/*/src/main` returns only intentional, env-gated hits.
- [ ] `npm test` still green after every removal commit (254 tests at time of writing).

---

## Final go-live gate

- [ ] Developer Testing Overrides completely removed from `backend/src/services/auth.service.ts`.
- [ ] Section V2 (demo/test/debug removal) fully ticked on the production deploy.
- [ ] Phase 1 security blockers fixed and reviewed.
- [ ] Phase 2 migration applied and recorded.
- [ ] Phase 3 local production-like checks pass.
- [ ] Phase 4 production tenant/owner verified.
- [ ] Phase 5 Redis connected and fallback tested.
- [ ] Phase 6 cloud API healthy.
- [ ] Phase 7 custom HTTPS domain works.
- [ ] Phase 8 signed APKs point to the real domain.
- [ ] Phase 9 physical-phone 4G/5G flow passes.
- [ ] Phase 10 monitoring, backups, and rollback are assigned.

## First step

Start with Phase 0. Then begin Phase 1 locally:

```powershell
cd "C:\Free Fire turnament\backend"
npm run build
npx prisma validate
```

Check boxes only after the command or real-world step has actually been
completed.

---

## Section V3 — Demo / test relaxations that are ON right now (REVERT BEFORE LAUNCH)

Everything below was switched on to let us test fast (100 fake accounts, instant
logins, last-seat races). Each row says what it weakens and exactly how to put the
security back. Work top to bottom — the first four are the real ones.

| # | Relaxation | Where | What it weakens | How to revert |
|---|------------|-------|-----------------|---------------|
| 1 | `PHONE_OTP_BYPASS=true` | `backend/.env` | Any 10-digit phone + **any** 6-digit OTP logs in as that player (no SMS, account auto-created). | Set `PHONE_OTP_BYPASS=false`, restart API. `grep PHONE_OTP_BYPASS backend/.env` must show `false`. |
| 2 | `PHONE_OTP_ENABLED=false` | `backend/.env` | Firebase phone auth is killed, so real SMS OTP cannot be used at all. | Set `PHONE_OTP_ENABLED=true` (requires working Firebase phone provider + Blaze plan). |
| 3 | `allowPhoneAuth=false` (tenant row) | Admin app → Settings, or `Tenant` table in Supabase | Player phone signup/login is disabled tenant-wide. | Admin → Settings → turn **Phone Auth** on (`update "Tenant" set "allowPhoneAuth"=true`). |
| 4 | `DEV_FAKE_FIREBASE=true` | `backend/.env` | Accepts `dev_otp_<phone>` as a valid Firebase token — a full auth bypass if it ever reaches production. Server refuses to boot in production with it set (`assertDevAuthConfig`), keep it that way. | Remove the line entirely (do not just set `false`) and restart. |
| 5 | `RATE_LIMIT_ALLOW_IPS=127.0.0.1,::1` | `backend/.env` | Every rate limiter (auth 5/min, deposit 3/min, join) is skipped for those IPs — brute-force protection off for the dev machine. Ignored when `NODE_ENV=production`; boot logs a warning while it is set. | Set `RATE_LIMIT_ALLOW_IPS=` (empty) and restart. Boot log must no longer print the `RATE_LIMIT_ALLOW_IPS` warning. |
| 6 | `x-stress-test: apex-ff-internal` header | `backend/src/middlewares/rateLimiter.ts` | Requests carrying this header skip **all** rate limits. Now gated to non-production only. | Delete the whole `x-stress-test` branch in `rateLimiter.ts` (see Phase 1.2). |
| 7 | 100 seeded test players (`TEST BOT 001…100`, phones `9000000001…9000000100`, ₹200 each) | Supabase `User` / `WalletLedger` | Fake players pollute the roster, the settlement report and the leaderboard; seeded ₹20,000 shows up in wallet totals. | `cd backend && npx tsx scripts/seedTestAccounts.ts delete` (only touches `TEST BOT%` rows). Verify: `npx tsx scripts/seedTestAccounts.ts list` → `total: 0`. |
| 8 | `PAYMENT_PROVIDER=mock` | `backend/.env` | Add-money succeeds without a real gateway payment. `assertPaymentConfig` blocks production unless real keys exist — keep it that way. | Set `PAYMENT_PROVIDER=razorpay` + `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`. |
| 9 | "Auto-fill demo" button (code `482916`) | `android/core/.../ui/auth/AuthOtpScreen.kt` | Ships a one-tap OTP into the store build — anyone can log in as any number. | Delete the `TextButton` block that fills `482916` and rebuild + re-sign both apps. |
| 10 | API base URL `http://localhost:5000/api/v1` | `android/**/assets/client_config.json` | Release APK cannot reach production and exposes the dev host. | Point it at the HTTPS domain (Phase 8) and rebuild. |
| 11 | Admin email+password login removed | `app-admin` (only phone OTP login now) | Not a security hole — but if the owner loses the admin phone, nobody can get in. | Keep Firebase phone auth working for the admin number, and record a recovery procedure. |

### Revert order (do it in this sequence)

1. Delete the seeded test players (#7) — do it first so no test row survives a
   config change.
2. Fire real OTP (#1 → #2 → #3) and check one real phone logs in.
3. Remove `DEV_FAKE_FIREBASE` (#4) and the rate-limit escape hatches (#5, #6),
   restart the API, and confirm the boot warnings are gone.
4. Swap the payment provider to live keys (#8) and run one ₹1 top-up.
5. Remove the app-side demo bits (#9) and repoint the API URL (#10), then
   rebuild, re-sign and reinstall both APKs.
6. Re-run `npm test` (296 tests) + Section G sign-off list.

### One-command check that nothing was missed

```bash
cd backend
grep -n "PHONE_OTP_BYPASS\|PHONE_OTP_ENABLED\|DEV_FAKE_FIREBASE\|RATE_LIMIT_ALLOW_IPS\|PAYMENT_PROVIDER" .env
grep -rn "x-stress-test" src/                      # must be empty after Phase 1.2
grep -rn "482916\|Auto-fill demo" ../android/*/src # must be empty
npx tsx scripts/seedTestAccounts.ts list | tail -1 # must print total: 0
```

### V3.1 Join latency — what it is now and the one real fix

Measured on this dev machine (Supabase in `eu-west-2` London, player in India):

| Step | Time |
|---|---|
| One round-trip to the database (`SELECT 1`) | **180 ms** |
| Single join, 6 queries (context → debit → ledger → seat → commit) | **1.4 s** directly, **1.9 s** through the API |
| 55 players hammering the last 3 seats | 11 s wall, p50 9 s, **0 errors, exactly 3 winners** |

An optimised join now needs **5 queries** (it was 10): one fused query returns the
match row + booked count + lowest free seat, the wallet debit does
`UPDATE ... RETURNING` (no second read), and the seat count is reused instead of
re-counted. That already halved the 55-way race (22 s → 11 s).

The remaining cost is **network distance, not code** — 6 × 180 ms is the floor.
Before launch, host the database in **`ap-south-1` (Mumbai)** to cut the
round-trip to ~10-30 ms; the same join then lands around **150-250 ms** with no
code change.

- [ ] Production Supabase project created in `ap-south-1` (or the closest region to the players).
- [ ] Re-ran `npx tsx scripts/measureJoin.ts --count 6` against it and recorded the new average.

## V3.2 Burst behaviour on the last seats (100-200 players at once)

The scenario that matters most: a match is **1-2 seats short of full** and everybody
taps *join* in the same second. Measured with the real backend + real Postgres
(Supabase `eu-west-2`, sessions through the API, 100 `TEST BOT` accounts):

| Burst | Free seats | Winners | Rejections | 5xx | Wall time |
|---|---|---|---|---|---|
| 53 requests (53 players) | 3 | **3** | 50 × 409 SLOTS_FULL | 0 | 11 s |
| 53 requests | 1 | **1** (seat 48) | 52 × 409 SLOTS_FULL | 0 | 9 s |
| 108 requests (54 players × 2 taps) | 2 | **2** (47, 48) | 106 × 409 | 0 | 11 s |
| **216 requests (54 players × 4 taps)** | 2 | **2** (47, 48) | 214 × 409 | **0** | 17 s |

DB invariants verified after every run: no oversell, no duplicate seat numbers, exactly
one `JOIN_FEE` ledger row per seat, fee total = seats × fee, no negative wallet, server
still healthy afterwards (0 uncaught exceptions, no restart).

### What actually broke under load (and the fixes)

1. **Supabase session pooler caps the connection count.** With
   `connection_limit=25` the pooler answered
   `EMAXCONNSESSION: max clients reached in session mode - max clients are limited to pool_size: 15`.
   Keep `connection_limit ≤ 15` while on the **session** pooler (port 5432).
2. **Prisma pool timeouts leaked as `500 Database operation failed`.** 216 taps on a
   15-connection pool overflow the pool; Prisma throws
   `timeout exceeded when trying to connect` (`P2024`), which used to hit the generic
   handler. Now: `mapJoinError()` + `errorHandler.ts` turn every pool/connection
   failure into **`503 Server is busy — please try again in a moment`** with a
   `Retry-After` header. No bare 500s are reachable from the join path.
3. **Retrying pool errors multiplied the load.** `isRetryable()` now retries only real
   seat races (`P2002` unique-seat, `P2034` write conflict); `P2024`/`P2028` are
   answered immediately instead of being retried ×4.
4. **A queue inside the process is cheaper than a queue inside the pool.** `joinTournament`
   now goes through an in-memory gate: `JOIN_MAX_INFLIGHT` (default 12) joins may touch
   the DB at once, `JOIN_MAX_QUEUE` (400) wait in memory, anything beyond that gets the
   503 "tap again" answer. This is what turned 216 concurrent taps into **0 errors**.

### App side (no crash, honest message)

The player app's join sheet already renders the server message
(`PlayerViewModel.joinMatchError` ← `ApiException.message`), so a burst produces
*"Tournament is not accepting entries (status: SLOTS_FULL)"* or *"The server is busy
right now — please tap join again"* as inline text — no spinner lock, no crash.
`startMatchSweep` flipping a match to `LIVE` mid-burst is also handled: joins answer
`409 Entry closed — joining stops 1 minute before the match starts`.

### Tuning before launch

- [ ] Keep `JOIN_MAX_INFLIGHT` ≤ `connection_limit` (defaults 12 / 15).
- [ ] On a bigger plan, switch to the **transaction pooler** (port 6543,
      `?pgbouncer=true`) and raise `connection_limit` to 40-60 for head-room.
- [ ] Re-run the proof after any DB/pool change:
      `cd backend && npx tsx scripts/raceJoinTest.ts --fill 46 --race 100 --slots 48 --dup 4`
      (expect 2 winners, 214 clean 409s, 0 five-hundreds).
- [ ] Run a **single backend instance** for these tests — a stale second copy on
      port 5000 (`EADDRINUSE`) silently serves half the requests and fakes failures.

### V3.2.1 What a losing player actually reads

A burst used to end with database vocabulary in the join sheet
(`Tournament is not accepting entries (status: SLOTS_FULL)`). Now:

| Situation | Server answer | App |
|---|---|---|
| Seats gone (status `SLOTS_FULL`, or the last seat was taken mid-burst) | `409 Slot Full — all seats are taken` | Card badge turns **Slot Full** (red), gold button becomes **Slot Full** and is disabled, hint *"Slot Full — all seats are taken. Better luck next match."* |
| Match started / entries closed | `409 Entry closed — …` | Button: *Entry closed — joining stops 1 min before start* |
| Server momentarily saturated | `503 Server is busy — please try again in a moment` + `Retry-After` | Same sentence inline, button stays tappable |

No `SLOTS_FULL`, no status codes, no "network error" wording reaches the player.
Covered by tests `joinTournament.test.ts` → *"tells a player Slot Full…"* and
*"answers a full match that switched to SLOTS_FULL…"*.
Verified on device: 47/48 sheet open → last seat taken → tap join → sheet flips to
**Slot Full** with the hint, card badge also flips to **Slot Full** after the feed refresh.

## V3.3 End-to-end match flow (create → 48 joins → room → payout)

One script walks the whole match life-cycle against the running API and the real DB:

```bash
cd backend && npx tsx scripts/e2eMatchFlow.ts            # run it, keep the match
cd backend && npx tsx scripts/e2eMatchFlow.ts --cleanup  # run it and delete what it made
```

Last run: **14/14 checks passed**.

| Stage | What was proven |
|---|---|
| Create (admin) | 48-slot match, ₹10 fee, ₹200 pool, ₹5/kill |
| 48 joins | all 48 seats booked, `0` failures, status **SLOTS_FULL**, 48 `JOIN_FEE` rows = **₹480**, one player `₹200 → ₹190` |
| Room publish | admin sets Room ID/Password → reveal-now → a seated player reads `77112233 / fire123` |
| Payout | rank 1/2/3 = 50/30/20 % + kills × ₹5 → **₹345** credited exactly, rank-1 wallet `₹190 → ₹425` |
| Idempotency | second payout: `409`, prize ledger unchanged (₹345), no double credit |
| Scoreboard | a player reads the official 48-row result via `/tournaments/:id/results` |
| Finish | match lands in **COMPLETED** |

### Two real bugs this flow caught (both fixed)

1. **Seat-herd on retry.** Every join asked for the *lowest* free seat, so 6 simultaneous
   joins all aimed at the same number and the retries collided again — 15 of 48 joins
   died with "Every seat is being taken". Retries (`attempt > 1`) now pick a **random**
   free seat (`loadJoinContext(..., randomSeat)`), `MAX_JOIN_ATTEMPTS` is 8, and 48 joins
   complete with 0 errors.
2. **Match stuck in OPEN with 48/48.** The in-transaction flip counts only the seats that
   transaction can see, so two last-seat joins could both read 47 and neither flipped the
   status. A post-commit `reconcileFullStatus()` (`UPDATE … WHERE count(*) >= totalSlots`)
   now settles it with the true count — verified `SLOTS_FULL` on the live DB.
