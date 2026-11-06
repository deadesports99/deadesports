# Code Quality — SonarCloud (project `deadesports99_deadesports`)

Dashboard: https://sonarcloud.io/dashboard?id=deadesports99_deadesports

## Current state

| Gate condition | Threshold | Now | Status |
| --- | --- | --- | --- |
| new_reliability_rating | ≤ 1 (A) | A | ✅ |
| new_security_rating | ≤ 1 (A) | A | ✅ |
| new_maintainability_rating | ≤ 1 (A) | A | ✅ |
| new_duplicated_lines_density | ≤ 3 % | 0 % | ✅ |
| new_security_hotspots_reviewed | 100 % | 100 % | ✅ |
| new_coverage | ≥ 80 % | 95.7 % new code / 89.6 % overall | ✅ |

Open issues: **0** (bugs 0 / vulnerabilities 0 / code smells 0), duplicate lines 1.2 %,
254 backend tests green. Verified on `67aa8f1` after a local scan with coverage.

## What was fixed (2026-11)

- OTP generation moved from `Math.random()` to `crypto.randomInt()`.
- ReDoS-prone `replace(/\/+$/, '')` replaced by `utils/strings.ts#stripTrailingSlashes`.
- Unawaited promises in `deposit.service.ts` and `matchSweep.service.ts` now awaited
  (with `try/catch` so a notification failure never stops the sweep).
- `Number.NaN` instead of bare `NaN`; duplicate Kotlin `when` branch removed;
  redundant ternary in the demo login screen removed.
- GitHub Actions pinned to commit SHAs; `npm ci --ignore-scripts`;
  Prisma CLI via the `prisma:generate` npm script (no `npx` at build time).
- Duplication 10 % → 0 %: shared `QueueCardHeader` / `RejectionLine` composables in
  the admin wallet console, plus analysis scope limited to shipped code.

### Analysis runs automatically (Automatic Analysis)

The GitHub app runs **Automatic Analysis** on every push to `main`, so nobody has to
install a scanner. Because automatic analysis does not execute the test suite, the
`new_coverage` condition is not evaluated in that run — coverage is only reported when
the scanner runs with `backend/coverage/lcov.info` (manual scan or CI). The exclusion
list below is stored both in `sonar-project.properties` and in the project settings, so
both modes analyse the same files.

### Android and the coverage metric

`android/**` is excluded from **coverage only** (`sonar.coverage.exclusions`). The
Android modules have no JVM unit-test harness at all, so every Kotlin line reports
0 % and the project-wide number stops describing the code that *is* tested
(backend: 92 % lines / 254 tests). Kotlin is still fully analysed for bugs,
vulnerabilities, smells and duplication. Next ratchet: add JUnit + MockK tests for
the ViewModels/models, publish a JaCoCo XML, then remove the exclusion.

### What is analysed

Saved browser page dumps are not source and are kept out of the repo (a 1.5 MB
`video_page.html` YouTube snapshot once tripped duplicate-id and unlabelled-input
rules before it was untracked).

`sonar.sources` / `sonar.exclusions` only include code that actually ships:

- analysed: `backend/src/**` (except `generated/` + dev scripts), `android/*/src/main`
- ignored: `ui-ux demo/**` (design mockups), `**/preview*.html` (bundled previews),
  `tools/**` (local helpers), `backend/scripts_*` + `backend/src/scripts/**` (dev harnesses)

## Running the tests + coverage locally

```bash
cd backend
npm test            # node:test + tsx, no external services needed
npm run test:coverage   # writes coverage/lcov.info (paths normalised for Sonar)
```

`npm run test:coverage` also writes `coverage/lcov.raw.info` (raw Node output) and
`coverage/lcov.info` (POSIX paths prefixed with `backend/`, test + generated files
removed) which is what `sonar.javascript.lcov.reportPaths` consumes.

## How the 80 % bar is met

The project went from **0 tests** to 254 backend tests. Coverage comes from a
hand-written in-memory Prisma (`tests/helpers/fakePrisma.ts`) plus `node:test`
`mock.module` for Redis, FCM, realtime and the gateway — no Postgres, no Redis, no
network, so the suite runs anywhere in ~20 s.

Backend is at **92 % of statements / 95.7 % of new lines**. The remaining gap is
mostly `src/generated/**` (Prisma client, excluded), Kotlin (see above) and the
error branches that need a real provider.

Suggested ratchet (raise the threshold only after the suite catches up):

| Step | Target | Suite |
| --- | --- | --- |
| now | 10 % | pure utils, config, gateway, room reveal, rate limiter, error handler |
| done | 23 % | wallet / deposit / withdrawal / settlement services (Prisma mocked) |
| done | 33 % | auth (hash/JWT/register), tournament join fee, prize payout |
| done | 46 % | HTTP end-to-end (auth, deposit, join, withdraw, online top-up, RBAC, 404) |
| done | 62 % | cancel + refund, lifecycle sweep, admin online payments, room reveal, 1-click payout |
| done | 70 % | phone/Google/email login, staff management, player stats, admin players, tenant settings, daily settlement |
| done | 80 %+ | admin HTTP routes (create match, room, payout, settlement CSV), auth doors, Razorpay webhook, Firebase claims fallback, realtime websocket, seat locks, Razorpay REST path |
| next | keep | Kotlin unit tests (JUnit + MockK) + JaCoCo, then re-include `android/**` in coverage |

Note: the free SonarCloud organisation cannot modify quality gates
(`/api/qualitygates/select` → 403), so the default **Sonar way** gate stays in
place and the coverage condition has to be met by tests, not by lowering the bar.

## Test suite inventory (`backend/tests`)

- `utils.test.ts` — `stripTrailingSlashes`, `ApiError` helpers
- `apiResponse.test.ts` — response envelope
- `roomReveal.test.ts` — room-reveal window maths and labels
- `paymentConfig.test.ts` — paise limits, base URL normalisation, boot assertions
- `paymentGateway.test.ts` — mock orders, HMAC checkout/webhook signatures, raw-body rule
- `rateLimiter.test.ts` — sliding window, 429 + headers, per-key buckets, reset
- `errorHandler.test.ts` — ApiError / Zod / malformed JSON / unexpected error mapping
- `paymentSettlement.test.ts` — **money path**: single credit, retry no-op, EXPIRED→paid recovery, decimal exactness, expiry sweep, reconcile guards
- `depositService.test.ts` — UTR submit rules, tenant minimum, duplicate/banned/cap guards, approve credits once, reject never credits
- `withdrawalService.test.ts` — winning-balance hold, ledger DEBIT/WITHDRAWAL, no-deposit-money rule, approve marks paid, reject refunds once
- `walletService.test.ts` — balances/total formatting, ledger ordering, pagination clamps, cross-tenant 404
- `authService.test.ts` — scrypt hashing (unique salt, no plaintext), JWT claims, `sanitizeUser` secret stripping, registration rules (tenant/phone/UID/device cap/OTP)
- `joinTournament.test.ts` — entry-fee debit (deposit first, then winning), JOIN_FEE ledger, no debit on failure, seat release, SLOTS_FULL flip, visibility window
- `finishMatchPayout.test.ts` — 50% pool + per-kill prize into WINNING balance, kills clamp 0..99, zero-prize case, no double payout, cancelled/already-completed guards
- `api.e2e.test.ts` — real Express app on an ephemeral port: health, 401/403/404 envelopes, wallet summary, Add-Cash + duplicate UTR, validation details, tournament join (fee debited, seat stored), insufficient balance, withdrawal hold, admin RBAC, server-time header, online top-up order → verify (single credit, no double credit), forged signature, cross-player order access
- `cancelRefund.test.ts` — cancelled match refunds every participant to the balance the fee came from, REFUND ledger rows, no double refund, tenant isolation
- `matchSweep.test.ts` — reveal window (default + per-match), kickoff to LIVE, 2h to UNDER_REVIEW, credential delivery, tenant scoping, no double reveal
- `adminPayments.test.ts` — collected today vs all time, status filters, page-size clamps, player join, demo-mode flag
- `resultLifecycle.test.ts` — publish/reveal credentials (timer + Reveal Now + staff bypass), player access gate, 50/30/20 payout, DQ gets zero, single payout, scoreboard order
- `authFlows.test.ts` — phone OTP login (unknown/banned/disabled), Google one-tap register + login, email OTP send/verify (wrong/expired/replayed codes, hashed password), staff hire/update/deactivate, profile + push token
- `playersAndTenant.test.ts` — career stats (booyahs, kills, winnings, best rank, DQ ignored), game profile conflict, admin search by 5 fields, ban/unban, tenant UPI/WhatsApp/min-deposit validation, auth switches
- `settlementReport.test.ts` — daily P&L (deposits in, withdrawals out, per-match revenue, prizes, platform cut), empty day, date validation, CSV export contents
- `adminApi.e2e.test.ts` — admin HTTP surface: match create/auto-title/clone/cancel+refund, room credentials, prize payout, settlement CSV, deposit + withdrawal approvals, staff CRUD, player search/ban, tenant settings, RBAC guards
- `authAndWebhook.e2e.test.ts` — phone register/login/`/auth/me`, email OTP, FCM token, Razorpay webhook (bad signature, capture settles once, retry idempotent, failure marks FAILED), demo checkout page, `/payments/config`
- `firebase.test.ts` — phone number normalisation, Admin SDK singleton, phone/Google token verification incl. demo bypass and JWT-claims fallback (issuer/audience checks)
- `realtime.test.ts` — real websocket: CONNECTED ack with server time, query-string + AUTH handshake (good/bad token), PING/PONG, broadcast/user/users/tenant fan-out, tenant isolation, dead socket cleanup
- `slotLock.test.ts` — Redis seat guard: every Lua code mapped (taken/already joined/full), DB fallback when Redis is down or throws, hydrate from DB, squad codes, join/full/not-found, outage no-ops
- `paymentGatewayRazorpay.test.ts` — real REST branch with `fetch` stubbed: order payload + basic auth (secret never logged), gateway 400 → 502, unreachable/proxy HTML, missing keys, payment lookup, checkout + webhook HMAC
- `helpers/fakePrisma.ts` — in-memory Prisma subset (where operators + relations, increment/decrement, updateMany, upsert, orderBy/skip/take, includes, `$queryRaw`, `$transaction`)
