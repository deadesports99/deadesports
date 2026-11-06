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
