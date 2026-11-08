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
- Check: 56 Kotlin tests green, both apps assemble, and **verified on the Realme P3 5G** (real backend
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

---

## E1 — go-live hardening (`PRODUCTION_CLOUD_EXECUTION_PLAN.md` V2) — 🔶 code side done

Done (each item verified, not just edited):
- [x] **V2-A** mock provider in production is now **fatal**, not a warning (`paymentConfigProblems`, 5 tests);
      demo routes answer **404** instead of "this endpoint exists but is disabled";
      `public/demo-checkout.*` and `src/scripts` excluded from the Docker image.
- [x] **V2-B** `mock_otp_` / `mock_google_` bypasses **deleted** from `firebase.service.ts`
      (test auth moved to `tests/helpers/fakeFirebase.ts`), `DEV_TEST_DEVICE_IDS` and
      `DEV_UNLIMITED_DEVICE_ACCOUNTS` deleted, per-device debug `console.log` deleted.
      Device policy is now one explicit `MAX_ACCOUNTS_PER_DEVICE = 2`, already covered by a test.
- [x] **V2-D** one-off patch scripts deleted (`fixFeedTabs`, `patchResult/Sweep/TournamentService`,
      `removeSpinners`, `hookAndroid`); `src/scripts` never ships.
- [x] **V2-E** release gate in both apps: `assembleRelease`/`bundleRelease` fail unless the API URL is `https://`
      (verified both ways). Realtime URL derived from the API base and unit-tested; **found and fixed a real bug**
      where a host starting with `api.` was truncated to an empty origin by a naive `/api` split.
- [x] **V2-F / Phase 1.7 — CSV spreadsheet formula injection closed.** All three exporters
      (match roster, device groups, daily settlement) had their own `csvEscape` that only did
      RFC-4180 quoting. A player types their own In-Game Name, so `=cmd|'/c calc'!A0` would be
      evaluated by Excel / LibreOffice when the organiser opened the export (DDE execution).
      Quoting does **not** help — those programs evaluate formulas inside quoted cells.
      Fixed with one shared `src/utils/csv.ts` (`csvEscape` + `csvRow`) that prefixes a single
      apostrophe for any cell starting with `=`, `+`, `-`, `@`, TAB or CR, then applies normal
      quoting. 10 new tests in `tests/csvExport.test.ts`.
      **Proven end-to-end:** set a real slot's IGN to `=cmd|'/c calc'!A0` → export → cell came back
      as `'=cmd|'/c calc'!A0` (Excel now treats it as text). Slot restored afterwards.
- [x] Backend **306 tests**, Kotlin **66 tests**, all green; release APK built with the live-domain URL.

Still needs a human / an account (not code):
- [ ] Razorpay **live** keys in `.env.production` (D1).
- [ ] Real **release keystore** — the release APK is currently `-unsigned`, which is safe but not shippable.
- [ ] Do **not** run `prisma/seed.ts` against production; create the production tenant via the Phase 4 SQL template.
- [ ] Ops flags on Render: `TRUST_PROXY=true`, no `BYPASS_OTP_FOR_TESTING`, monitoring + backups + rollback owner.

---

## D1 — live Razorpay (₹1/₹10 UPI) — 🔶 everything but the account

Done without keys (all verified):
- [x] `RAZORPAY_API_BASE_URL` is configurable (default = real API), so the gateway client can be
      exercised against a faithful local stub or behind a proxy.
- [x] `tests/razorpayHttp.e2e.test.ts` — **7 tests over real HTTP** against a local Razorpay-shaped
      server: order create with Basic auth + money fields + gateway-side expiry + no secret in the
      payload; checkout verify settles once and a retry never double-credits; forged signature →
      400 + order FAILED + no ledger row; webhook settles from the RAW-body HMAC and a duplicate
      delivery is a no-op; bad webhook signature → 400; gateway rejection → 502 with the draft order
      closed; `/payments/config` reports real gateway mode and leaks no secret.
- [x] `backend/src/scripts/razorpayLiveCheck.ts` — preflight that validates key shape, secret,
      webhook secret, public URL and test/live-vs-NODE_ENV pairing, and can create a real ₹1 order
      (`--create-order`) or print the expected checkout signature (`--sign o p`).
- [x] `docs/RAZORPAY_LIVE_RUNBOOK.md` — the exact ₹10 UPI run: config, dashboard webhook, the five
      money-safety checks (double-credit, webhook-only, sweep-only, expiry, failure), SQL spot-check,
      refund, live-key swap, and the deliberate limits.

Blocked on a human/account:
- [ ] `rzp_test_*` keys in `backend/.env` → run `npx tsx src/scripts/razorpayLiveCheck.ts --create-order`.
- [ ] One real ₹10 UPI payment on the device, then refund it.
- [ ] Then repeat with `rzp_live_*` and a public HTTPS webhook URL.

---

## Live test on a real device (Realme P3 5G, local backend over `adb reverse`) — ✅

Admin app, end to end, every screen touched:

| Function | Result |
| --- | --- |
| Create Match | Match **#12 Bermuda Solo** created: ₹10 entry, ₹100 pool, ₹5/kill, 12:00 PM IST, listed immediately |
| Publish Room ID | Room `88451230` / `ff2026` stored, status *hidden until T-15*, then **Reveal now** → `ROOM OUT` and visible to the player |
| Spectator / End match | Winner by FF UID `123456789`, 2 kills → prize preview **50% of ₹100 + 2×₹5 = ₹60**, "winner APE-0214 paid" |
| Manage Matches | Live / Upcoming / History tabs, seats 1/48, cancel+refund & clone actions present |
| Wallet Console — Deposits | ₹50 UTR request approved with a confirmation dialog → balance credited instantly |
| Wallet Console — Withdrawals | ₹60 payout approved with UTR `556677889900` → winning balance returned to ₹0 |
| Wallet Console — Online | Demo banner, Today/Total summary (₹910 • 6 paid), status filters, per-row "Check with gateway" |
| Player Management | 11 players, search by phone/UID works (1 result), **ban → BANNED badge → unban** both confirmed |
| Staff Management | 3 staff, permission switch on/off saved ("Permissions updated ✓", badge updated) and reverted |
| App Settings | Collecting UPI, payee name, WhatsApp, min add-cash, theme, auth methods |
| Daily Settlement | Real day numbers: collections ₹60 (deposits ₹50 + fees ₹10), payouts ₹120 (withdrawals ₹60 + prizes ₹60), margin −₹50, 10% cut |

Player app, screen by screen: match feed shows the new match with the right money, join charges ₹10
(₹960 → ₹950), wallet "Recent top-ups" + ledger list, UTR add-cash with the in-app warning
"Money is credited only after staff verify", prize ₹60 lands in the winning balance, withdrawal
request, and the ledger reads: +₹50 → −₹10 → +₹60 → −₹60 with `Bal:` after every row.

One UX note found while testing (not a bug): the UTR top-up is visible in the **Transactions** ledger
but not in "Recent top-ups", which only lists gateway orders. Merging them (or labelling the section
"Online top-ups") would make the manual flow easier to follow.

### Spectator Scorer — two real bugs found on device, both fixed ✅

1. **The console crashed the app.** `GET /tournaments/:id/slots` always answers with all 48 seats,
   and empty seats come back as `player: null`. The roster mapped those to `userId = ""` and the
   Compose list used `key = { it.userId }`, so 46 rows shared the key `""` →
   `IllegalArgumentException: Key "" was already used` the moment a match was opened. The Admin app
   closed instantly (nothing in the UI said why). Fix: new framework-free `scorerRoster()` in
   `ScorerRoster.kt` keeps booked seats only, sorts by seat, ranks 1..n, and falls back to
   `slot-<n>` for a blank id; the list now keys on `slotNumber`. 7 unit tests.
2. **The "Distribute Prize & Complete Match" button was invisible.** The participant list used
   `fillMaxSize()` inside a `Column`, so it ate all the height and pushed the sticky payout bar off
   screen — a match could never be paid from this console. Fix: `weight(1f)`, plus a clear
   "Nobody has booked a seat yet" line when a match has no players.

Verified live on the Realme P3 after the fix: opened *Bermuda Squad #1* (2/48 booked), set kills,
toggled the hacker flag (reason field appeared), un-toggled it, tapped payout →
`Total paid ₹1650 • Players paid 2 • Match status COMPLETED`, and the DB agrees:
`ywywy` rank1 2 kills `₹1050`, `ggggg` rank2 `₹600` (pool ₹2000 → 50% + 2×₹25, 30%), both
`isApproved = true`. Winning balances: ₹1050 and ₹600.

Also fixed while there: the scorer used to keep a stale *Network error* state forever when it was
opened again — it now reloads unless it already has data.

### Create Match refused to open a second time, and the keyboard hid the button ✅

Reported: "ek match create karne ke baad dusra banane gaya to section me ghusne hi nahi diya".

Root cause: `AdminViewModel.createUi` stayed `AdminUi.Success` after a successful create. `CreateTournamentScreen` has
`LaunchedEffect(uiState) { is Success -> onCreated() }`, so the *next* visit to the form ran that effect on the stale
success and called `popBackStack()` immediately — the screen opened and closed in the same frame, which reads as
"the button does nothing". Fix: `clearCreateState()` is called before leaving, so the state is consumed exactly once.

Second, smaller defect found while verifying: the numeric keyboard covered the bottom "Create Tournament" button, so a
scroll could not reach it. The form now uses `imePadding()`.

Verified on device: create → back to dashboard → *Create Match* opens again with a blank form → created
`#16 (₹30 / ₹300)` and `#17 (₹40 / ₹400)` back to back, both listed correctly in Manage Matches under *Upcoming*,
then cancelled (`₹0 refunded to 0 players`) to leave the demo data clean.

### Create Match is match-only now; room timing lives only in Publish Room ID ✅

Owner feedback: "create match me sirf match ki setting rakho, room ID ki cheez room section me hi rakho".

- Removed from **Create Match**: the `🔑 Room ID & Password Reveal` block (5m…24h chips, the
  "reveal this many minutes before start" field, the reveal-time preview card) and its validation.
  The payload no longer sends `roomRevealMinutes`; the API default (15 min) applies.
- In its place the form shows one line: *"🔑 Room ID & Password — not part of match creation.
  After saving this match, open Publish Room ID …"*.
- Create Match is now exactly: game mode, match type, map, entry fee, prize pool, per-kill,
  schedule (date + time + quick chips), player-list visibility.
- Fixed while verifying: changing the reveal window in **Publish Room ID** left the old value on
  screen, because that screen renders from `publishTargetsUi` and only the matches/ops lists were
  refreshed. `updateRoomReveal` now reloads publish targets too.

Device-verified: created `#18` with the new match-only form (₹25 / ₹250), then in Publish Room ID
tapped `30m` → card became "Room Reveal — 30 min before start", row label "reveal 30 min",
message "✅ Saved — players see the room 30 min before start", then set it back to 15m.

### Room ID is published, never scheduled — plus the 1-minute join cutoff ✅ (`957e3c3`, `9fd3a57`)

Owner rules (all implemented and device-verified): players get the Room ID **only** when an
admin/sub-admin publishes it; the room must be **editable** after publishing; joining must stop
**1 minute before kickoff** ("6:00 PM match → no joining from 5:59 PM") instead of only hiding the
room; at kickoff the match must move to **LIVE** by itself; and a match must be cancellable
**from the Room ID section**.

Backend
- `roomReveal.ts`: `isRoomUnlocked()` is `Boolean(roomRevealedAt)` only, `secondsUntilRoomReveal()`
  is always `0`, `roomRevealMeta()` reports `roomRevealsAt: null`. `roomRevealAt()` is deprecated.
- `matchSweep.service.ts`: the whole auto-reveal step (window, status flip, FCM push) is gone.
  The sweep now only does `DRAFT/UPCOMING/OPEN/SLOTS_FULL/ROOM_REVEALED → LIVE` at kickoff
  (published or not) and `LIVE → UNDER_REVIEW` after 2 h.
- `result.service.ts`: publishing **is** the reveal — `updateRoomCredentials` always stamps
  `roomRevealedAt` and `status: ROOM_REVEALED`, announces the room only the first time
  (re-publishing edits it silently); `getRoomCredentials` gates on `isRoomUnlocked` and says
  "Room ID & Password are not published yet".
- `tournament.service.ts`: `JOIN_CUTOFF_MS = 60_000` → `409 Entry closed — joining stops 1 minute
  before the match starts` for the money path.
- Tests rewritten for the new rule (`roomReveal`, `matchSweep`, `resultLifecycle`) plus a new
  cutoff case in `joinTournament` → **284 pass**.

Android
- `Tournament.isRoomUnlockedNow()` no longer falls back to `matchTime - roomRevealMinutes`; that
  local fallback was the real reason the code leaked before publishing. Added `isJoinClosed()`.
- Player feed: `🔑 Get Room ID & Password` only when published, otherwise
  `✅ Joined • Waiting for Room ID`; the join button turns into a **disabled**
  "⏱ Entry closed — joining stops 1 min before start" in the final minute.
- `RoomScreen`: no countdown and no auto-unlock — "Room ID not published yet", a
  *🔄 Check again* button and a 15 s silent re-poll.
- Admin `PublishRoomScreen`: dropped the timing chips and "reveal now" switch; the card states
  ✅ Published / 🕒 Saved but not published / 🔒 Not published yet, the saved code is **prefilled
  for editing**, publishing always means "players can see it now", a **🚫 Cancel this match &
  refund players** button lives in the section, the picker has a 🔄 Refresh, and cancel feedback
  is shown above the picker (the cancelled match leaves the list immediately).
- New `TournamentRoomTest` (6 tests) → **79 Kotlin tests green**.

Device evidence (realme P3 5G, real backend)
- Published `#23` from the admin app → player card flipped to "🔑 Get Room ID & Password" →
  room sheet showed `55221199 / ffnew1`.
- Edited the published room to `ffedited9` → the player sheet showed the new password (no timer).
- Tried joining at 65 s left (allowed) and again at <60 s → `409 Entry closed …`.
- Cancelled `#24`/`#25` from the Room ID section → "✅ Match cancelled — ₹0.00 refunded to 0
  player(s)", row gone from the list; cancelling `#23` with a booked seat → DB `CANCELLED`,
  ledger `CREDIT ₹10 REFUND "Refund for cancelled tournament: Match cancelled by organiser"`,
  balance back to ₹900.
- `#20`, `#21`, `#22` (never published) flipped to **LIVE** on their own at kickoff.

Sonar gate re-verified: **GATE OK**, new coverage 93.0 %, 0 issues, 0 duplication, hotspots 100 %
(one reliability bug the scan caught — a dead ternary in `roomReveal.ts` — was fixed in `9fd3a57`).
