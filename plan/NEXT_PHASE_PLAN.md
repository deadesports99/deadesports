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
| A4 | `AdminPaymentsController` + 13 admin tests | ✅ |
| A5 | JaCoCo XML into Sonar, Android back in coverage | ⬜ |
| B1 | Backend `GET /payments/my` | ✅ |
| B2 | Wallet screen "Recent top-ups" + Re-check | ✅ |
| C1 | Auto-reconcile sweep | ✅ |
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

**A4 — admin online tab, extracted and tested (1 h)** — ✅ done
- [x] `app-admin/AdminPaymentsController.kt` — list + remembered filter + one-tap Sync, pure Kotlin.
      `AdminViewModel.paymentsUi/loadPayments/syncPayment` now delegate; the wallet banner
      (`walletBusy`, `walletMessage`, `walletError`) keeps the exact same behaviour via callbacks.
- [x] `AdminPaymentsControllerTest` — 13 tests: summary money first, loading state, server error,
      network crash, filter remembered, sync reports new balance, **sync keeps the FAILED filter**
      (bug found: reload was resetting to ALL), already-settled wording (never credits twice),
      unpaid order names the gateway status, falls back to local status, failed sync does not reload,
      double-tap Sync reconciles once, stale feedback cleared first.
- Check: 42 Kotlin tests green, both apps assemble, `:app-admin` JaCoCo XML written.

**A5 — coverage plumbed (20 min)**
- [ ] `sonar.coverage.jacoco.xmlReportPaths=android/*/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml`.
- [ ] Remove `android/**` from `sonar.coverage.exclusions` **only when Kotlin line coverage is high
      enough that the gate stays green** (right now `core` is 2.3 % of 2 070 lines). Until then the
      exclusion stays and the Android number is tracked in the report instead of the gate.
- Check: Sonar shows a non-zero Kotlin coverage number without turning the gate red.

## B. Player payment history

**B1 — backend (45 min)** — ✅ done
- [x] `src/services/paymentHistory.service.ts` + `GET /api/v1/payments/my?status=&page=&limit=`
      (auth, read-only, own orders only, newest first, limit clamped to 50, `demoMode` flag).
- [x] 8 HTTP tests appended to `api.e2e.test.ts` (no new file): 401, empty history, newest-first with
      rupees, PENDING/CAPTURED/FAILED filters, unknown filter 400, cross-player isolation, paging
      clamps + totalPages, and "listing never credits" (balance + ledger untouched).

**B2 — Android (45 min)** — ✅ done
- [x] `PlayerPayment` / `PlayerPaymentsResponse` models + `GET payments/my` in `TourneyApi`.
- [x] Wallet screen "Recent top-ups" section: amount, one-word status chip (Paid / Pending / Failed /
      Expired), time, failure reason, and a **Re-check** button only on unpaid rows.
- [x] `TopUpController.recheck(orderId, amountRupees)` reuses the exact same idempotent reconcile
      (no second code path), and the history reloads whenever money lands.
- [x] Tests: 3 new `TopUpControllerTest` cases (settles from history, still-unpaid wording, double tap)
      + 2 model cases (status wording, Re-check only on unpaid).
- Check: 50 Kotlin tests green, both apps assemble, and **verified on the Realme P3 5G** (real backend
      over `adb reverse`): wallet shows "Recent top-ups" with Paid rows, a fresh mock order shows
      **Pending + Re-check**, and tapping Re-check now shows a banner.
- Device testing caught two real gaps, both fixed: the reconcile result was invisible when the sheet was
  closed (banner added, auto-dismiss 5 s, `clearMessage()` keeps the pending order), and a 409 from the
  server ("No gateway payment recorded for this order yet") now reads in player words.

## C. Auto-reconcile sweep

**C1 (45 min)** — ✅ done
- [x] `reconcileStalePaymentOrders()` in `payment.settlement.ts`: unpaid orders **older than 5 min**,
      window still open, gateway knows a payment id -> ask the gateway -> settle through the same
      idempotent claim. Batches 20, one broken order never stops the run, mock provider is a no-op.
- [x] `server.ts` schedules it (`PAYMENT_RECONCILE_SWEEP_INTERVAL_MS`, default 5 min, `0` disables),
      with an overlap guard and cleaned up on shutdown.
- [x] 9 tests in `paymentSettlement.test.ts`: settles a missed webhook (balance + ledger), mock no-op,
      fresh checkout untouched, expired window left to the expiry sweep, no payment id, never touches
      CAPTURED, gateway says still unpaid, broken order vs healthy order, batch limit.
- [x] Documented: "two sweeps, two different jobs" table in `docs/PAYMENT_GATEWAY.md`. 271 backend tests.

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
