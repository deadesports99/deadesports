# Next Phase Plan (after Phases 1–11)

> Written after the payment gateway + admin visibility + quality workstream closed.
> Current baseline: `npm test` **254/254**, Sonar gate **OK** (0 issues, 1.2 %
> duplication, 89.6 % overall / 95.7 % new-code coverage on backend lines),
> backend 92 % of statements, Android verified on device.

## Where we stand (one screen)

| Area | State |
| --- | --- |
| Backend API (auth, tournaments, slots, sweep, results, payouts, wallets, admin, settlement) | Done, tested |
| Real-money top-ups (Razorpay + mock, webhook, idempotent settlement, reconcile) | Done, tested (mock provider) |
| Admin wallet console incl. Online tab | Done, on device |
| Player wallet + Add Money | Done, on device |
| Test suite / quality gate | Done (254 tests, gate OK) |
| Android unit tests | **None** - biggest remaining gap |
| Live Razorpay run | Blocked on keys |
| Cloud deployment | Not started (plan ready in `PRODUCTION_CLOUD_EXECUTION_PLAN.md`) |

## Priority order

### P1 - Kotlin unit tests + JaCoCo (re-include Android in coverage)
**Why:** the client is 4 148 Kotlin lines with zero automated checks. Every wallet,
join and payout rule is only proven on the server; a wrong client state (double
tap on Pay, stale balance, missing tenant header) still ships.

**Scope (pure JVM, no emulator, runs in CI):**

1. Add to `android/gradle/libs.versions.toml`: `junit4`, `mockk`, `kotlinx-coroutines-test`, `turbine`.
2. `core` module: `testImplementation` deps + `jacocoTestReport` producing XML.
3. Tests to write first (highest risk, no Android framework needed):
   - `ApiEnvelope` / `ApiError` mapping (server envelope to UI error text)
   - `Payment.kt` model parsing (status, amount formatting, `payable` helpers)
   - `SessionManager` (token/tenant persistence contract via a fake DataStore)
   - `PlayerViewModel`: add-money -> order -> verify success/failure, balance refresh, join fee guard
   - `AdminViewModel`: online-payments list, `demoMode` banner, sync (reconcile) path, approve/reject guards
   - `TimeAuthority` server-offset maths
4. Wire `sonar.coverage.jacoco.xmlReportPaths=android/*/build/reports/jacoco/test/jacocoTestReport.xml`.
5. Remove `android/**` from `sonar.coverage.exclusions`; keep Compose screens excluded
   only if they still have no UI tests (document why).

**Done when:** `./gradlew test` green, JaCoCo XML exists for `core` + both app modules,
Sonar shows Android coverage > 0 and the gate is still OK.

### P2 - Player payment history screen
**Why:** players cannot see their own top-ups; support currently answers "did my
money come?" by hand.

- Backend: `GET /api/v1/payments/my` (paginated, own orders only, status + amount +
  time + provider id). Reuse `paymentAdmin.service` shape, add tenant/user scoping.
- Android: list inside the Wallet screen ("Recent top-ups"), tap -> detail sheet with
  status explanation and a **Re-check** button wired to the existing reconcile path.
- Tests: backend HTTP e2e (own orders only, cross-player 404, pagination), plus a
  `PlayerViewModel` unit test for the new state.

**Done when:** a player can prove their ₹500 top-up reached the wallet, and a failed
one explains why.

### P3 - Auto-reconcile sweep
**Why:** if a webhook never arrives (proxy, cold start), money sits in "pending"
until a human taps Sync.

- `paymentReconcileSweep`: every N minutes, take orders `CREATED/AUTHORIZED` older
  than 5 minutes but not expired, call `reconcilePaymentOrder`, log outcome.
- Reuse the expiry sweep interval pattern; make it disable-able by env.
- Tests: sweep reconciles a stale pending order exactly once, skips fresh orders,
  skips mock provider (nothing remote to ask).

**Done when:** killing the webhook route still ends with the correct balance.

### P4 - Live gateway verification (needs keys)
- `.env` with `rzp_test_*`, `PAYMENT_PROVIDER=razorpay`, real webhook secret.
- One ₹1 UPI top-up from a device: order created, checkout, signature verified,
  single credit, webhook retry does nothing.
- One failure path (cancel checkout) -> order stays pending -> sweep or Sync expires it.
- One refund test in the Razorpay dashboard for a captured order.

**Done when:** screenshots of the payment in the Razorpay dashboard + the matching
ledger row in the app.

### P5 - Go-live hardening (then deploy)
- Run `PRODUCTION_CLOUD_EXECUTION_PLAN.md` Phase 1 blockers and **Section V2**
  (demo/test/debug removal) end to end.
- `PAYMENT_PROVIDER=razorpay`, HTTPS webhook URL, `TRUST_PROXY=true`, per-tenant limits.
- Then Phases 0-10 of the cloud plan: Render + Upstash + Supabase + domain + signed APKs.

## Out of scope for now
- iOS app, player screenshot upload (official results model), per-tenant Razorpay keys,
  SaaS billing for white-label clients.

## Suggested sequence
`P1 -> P2 -> P3 -> P4 (when keys arrive) -> P5`

P1 is the only one that removes a real risk without new infrastructure; P2/P3 are
small and user-visible; P4/P5 are gated on external inputs (keys, domain).
