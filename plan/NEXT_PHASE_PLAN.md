# Next Phase Plan — small steps (tick as we go)

> Rule of this file: **no big phases, only small steps.** Each step is 15–45 min,
> has a visible check, and gets `[x]` the moment it is done and pushed.
> If a test file turns out to be unnecessary, it gets **deleted**, not kept.

Baseline at start: `npm test` 254/254, Sonar gate OK, 0 issues, backend 92 % lines.

---

## Progress tracker

| Step | Kaam | Status |
| --- | --- | --- |
| A1 | Gradle test deps + JaCoCo in `core` | ✅ |
| A2 | First Kotlin test file (models) | ✅ |
| A3 | Money-call helper tests (`apiCall` + error mapping) | ✅ |
| A3b | `TopUpController` (pure) + 17 money-path tests | ✅ |
| A4 | `AdminViewModel` tests (online tab + sync) | ⬜ |
| A5 | JaCoCo XML into Sonar, Android back in coverage | ⬜ |
| B1 | Backend `GET /payments/my` | ⬜ |
| B2 | Wallet screen "Recent top-ups" list | ⬜ |
| C1 | Auto-reconcile sweep | ⬜ |
| D1 | Live Razorpay run (needs keys) | ⬜ |
| E1 | Go-live cleanup (Section V2) | ⬜ |

---

## A. Kotlin unit tests (biggest gap: 4 148 lines, 0 tests)

**A1 — build setup (15 min)** — ✅ done
- [x] `android/gradle/libs.versions.toml`: `junit 4.13.2`, `mockk 1.13.13`, `kotlinx-coroutines-test`, `jacoco 0.8.12`.
- [x] `android/core/build.gradle.kts`: `testImplementation` + `jacocoTestReport` task (XML).
- [x] `gradle/verification-metadata.xml` refreshed (dependency verification was blocking the new jars).
- Check: `./gradlew :core:testDebugUnitTest` green.

**A2 — first test, pure models (30 min)** — ✅ done
- [x] `android/core/src/test/java/com/tourney/core/model/PaymentModelTest.kt` — 6 tests: paise→rupees,
      razorpay vs mock checkout, CAPTURED-only rule, settlement flags, gateway limits, admin label fallback.
- Check: `tests="6" failures="0"`, JaCoCo XML written (`core/build/reports/jacoco/jacocoTestReport/`).

**A3 — money-call helper (`apiCall`) (45 min)** — ✅ done
- [x] `android/core/src/test/java/com/tourney/core/network/ApiCallTest.kt` — 6 tests: success payload,
      success-without-data is an error, HTTP envelope → `ApiException` + `details`, non-JSON body,
      empty body, per-field validation messages.
- [x] `testImplementation(libs.org.json)` because `android.jar` ships only json stubs on the JVM.
- Check: 12/12 Kotlin tests green, `core` line coverage 2.3 % → 3.8 %.

**A3b — top-up state machine, extracted and tested (1 h)** — ✅ done
- [x] `core/payment/TopUpController.kt` — the money rules moved out of `PlayerViewModel` into a
      framework-free class (`PaymentOrdersApi` interface + Compose state). No Android imports.
- [x] `PlayerViewModel` now delegates (`activeTopUp`, `topUpMessage`, `topUpBusy`, `topUpSettled`,
      `gatewayInfo`, `createTopUp`, `syncTopUp`, `clearTopUp` keep the same public API) and only
      wires Retrofit + wallet refresh (`onSettled(rupees)`).
- [x] `TopUpControllerTest` — 17 tests: one order at a time (double tap), minimum amount, gateway
      failure, network crash, captured verify settles once + refreshes wallet with the right amount,
      uncaptured verify keeps the order, missing signature falls back to server reconcile, bad
      signature keeps money pending, cancel/error messages, Check status (already captured, late
      capture, PENDING/FAILED/EXPIRED wording, no order, double tap), gateway info cached once,
      clear resets everything.
- Chose extraction over Robolectric: deterministic, no 100 MB download, and the ViewModel got thinner.
- Check: 29 Kotlin tests green, `:app-player` + `:app-admin` assemble, `core` lines 3.8 % → 7.8 %.

**A4 — `AdminViewModel` online tab (45 min)**
- [ ] Today's collected total, status filter, `demoMode` banner flag, Sync calls reconcile once.
- Check: `:app-admin:test` green.

**A5 — coverage plumbed (20 min)**
- [ ] `sonar.coverage.jacoco.xmlReportPaths=android/*/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml`.
- [ ] Remove `android/**` from `sonar.coverage.exclusions` **only when Kotlin line coverage is high
      enough that the gate stays green** (right now `core` is 2.3 % of 2 070 lines). Until then the
      exclusion stays and the Android number is tracked in the report instead of the gate.
- Check: Sonar shows a non-zero Kotlin coverage number without turning the gate red.

## B. Player payment history

**B1 — backend (45 min)**
- [ ] `GET /api/v1/payments/my` — own orders only, paginated, `{ items, pagination }`.
- [ ] Tests: own-only, cross-player 404, page clamps. Reuse `FakePrisma`, no new test file
      unless the existing `api.e2e.test.ts` is the wrong home.

**B2 — Android (45 min)**
- [ ] Wallet screen: "Recent top-ups (5)" list + tap for detail + **Re-check** (reconcile).
- Check: on device, a FAILED order shows why and Re-check updates it.

## C. Auto-reconcile sweep

**C1 (45 min)**
- [ ] `paymentReconcileSweep`: pending orders older than 5 min → `reconcilePaymentOrder`,
      env on/off, same interval pattern as the expiry sweep.
- [ ] Tests: reconciles once, skips fresh orders, no-op in mock mode.

## D. Live gateway (blocked on keys)

**D1** — `rzp_test_*` keys, one ₹1 UPI top-up, retry idempotency, one cancel, one refund.

## E. Go-live

**E1** — `PRODUCTION_CLOUD_EXECUTION_PLAN.md` Phase 1 + **Section V2** (demo code removal),
then deploy.

---

## Test file rule (apply every step)

1. Ek behaviour ka ek hi ghar: naya test purane file me fit ho to **naya file mat banao**.
2. Jo file sirf do-line smoke test hai aur usse koi regression nahi pakadta → **delete**.
3. Jo test production code delete hone se mar gaya → test bhi saath delete.
4. Har deletion ke baad `npm test` chalao; coverage gir gaya to wajah likho, chhupao nahi.

Current audit: koi duplicate test file nahi mila. Merge candidates sirf
`apiResponse.test.ts` (2 tests, envelope) hai — `utils.test.ts` me daal sakte hain,
par value zero hai, isliye abhi chhod diya.
