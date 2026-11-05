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
| new_coverage | ≥ 80 % | 22.8 % | ❌ (test backlog) |

Open issues: **0** (bugs 0 / vulnerabilities 0 / code smells 0).

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

### What is analysed

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

## Why coverage is not 80 % yet

The project went from **0 tests** to a real suite, but 80 % of *new code* means
~5 400 of 6 700 lines covered. Two suites are needed:

1. **Backend** — services talk to Prisma/Redis. Covering them needs either
   dependency injection or Prisma/Redis mocks (`node:test` `mock.module`), plus a
   throwaway Postgres for integration tests.
2. **Android (Kotlin)** — currently 0 % and it is ~40 % of the codebase; needs
   JUnit/Robolectric + Compose UI tests and a `jacocoTestReport` wired to
   `sonar.coverage.jacoco.xmlReportPaths`.

Suggested ratchet (raise the threshold only after the suite catches up):

| Step | Target | Suite |
| --- | --- | --- |
| now | 10 % | pure utils, config, gateway, room reveal, rate limiter, error handler |
| done | 23 % | wallet / deposit / withdrawal / settlement services (Prisma mocked) |
| next | 35 % | auth + tournament + result services, API routes via supertest |
| later | 50 % | auth + tournament + result services, API route tests via supertest |
| goal | 80 % | Kotlin unit tests (JUnit + JaCoCo) + full service coverage |

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
- `helpers/fakePrisma.ts` — in-memory Prisma subset (where operators, increment/decrement, updateMany, orderBy/skip/take, `$transaction`)
