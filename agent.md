# 🤖 AGENT KICKOFF & SYSTEM WORKFLOW SPECIFICATION
## Free Fire Tournament Platform (Turnkey White-Label eSports SaaS)

> **Document Purpose:** Yeh file naye AI Agents aur new chat sessions ke liye single source of truth hai. Nayi chat me aate hi is file ko read karke agent instantly pura architecture, completed kaam, aur active tasks samajh jayega.
> **Project Author:** Jay Kumar  
> **Preferred Communication:** Hinglish (Hindi + English)


## 🏛️ 1. Core Business Model & Non-Negotiable Rules

1. **Turnkey Standalone Model (Zero Data Liability):**
   - Hum (Jay & Boss) client ka data ya players ka paisa apne paas nahi rakhte.
   - Har client (Tournament Owner) apna **Supabase PostgreSQL** database aur **Firebase project** connect karta hai.
   - Client backend aur app handover hone ke baad unka data unke cloud par rehta hai.

2. **⚡ 10-Minute Rebranding Engine (Play Store Compliant):**
   - Single config file: `src/main/assets/client_config.json`.
   - **Build Time:** Gradle ke andar `JsonSlurper` se `client_config.json` padhkar dynamically `applicationId` aur launcher label (`resValue "string", "app_name"`) set ho jate hain.
   - **Runtime:** `ClientConfig.kt` aur `Theme.kt` client ke hex colors (#FF5722), button color, aur corner radius (Sharp 4dp / Rounded 12dp / Pill 999dp) ko dynamically Material 3 tokens me convert karte hain.
   - **Zero Kotlin code changes** needed when rebranding for a new client.

3. **🛡️ Anti-Fraud Rule (The Spectator Model):**
   - **NO PLAYER SCREENSHOT UPLOADS:** `:app-player` me koi bhi screenshot upload, image picker, ya file selector nahi hoga. Fake/AI-generated screenshot disputes jad se khatam.
   - Client ka staff khud Free Fire Custom Room ke **Spectator Slot** me baith kar live match dekhta hai, hackers pakadta hai, aur **Staff Spectator Console** me verified kills aur rank daalkar **1-Click Payout** karta hai.

---

## 📂 2. Project Directory Tree & Key Locations

```text
C:\Free Fire turnament\
├── agent.md                                # 📌 Yeh master workflow guide
├── prompt.md                               # 🤖 Active master prompt for DeepSeek v4 Flash / Kimi
├── backend\                                # 🔙 Node.js + Express + TypeScript + Prisma + Redis
│   ├── src\
│   │   ├── config\                         # env.ts, prisma.ts, redis.ts
│   │   ├── controllers\                    # auth, tournament, result, wallet controllers
│   │   ├── middlewares\                    # auth.middleware.ts (RBAC), errorHandler.ts
│   │   ├── routes\                         # auth, tournament (+/sweep/states), result,
│   │   │                                  # wallet (deposit), adminWallet (deposits/withdrawals)
│   │   ├── services\                       # auth, tournament, slotLock (Lua), payout services
│   │   ├── types\                          # auth, tournament, express types
│   │   ├── utils\                          # ApiError.ts, ApiResponse.ts
│   │   ├── app.ts                          # Express application pipeline
│   │   └── server.ts                       # Server entry & graceful shutdown
│   ├── prisma\
│   │   ├── schema.prisma                   # Multi-tenant PostgreSQL schema
│   │   └── seed.ts                         # Demo tenant, Admin, Sub-Admin, Players
│   ├── docker-compose.dev.yml              # Local Postgres (5433) + Redis (6379)
│   └── package.json                        # Scripts: dev, build (0 errors passing)
│
├── android\                                # 📱 Native Android (Kotlin + Compose Multi-Module)
│   ├── build.gradle.kts                    # Root build script (Kotlin 2.1.20, AGP 8.10.1)
│   ├── settings.gradle.kts                 # Includes :core, :app-player, :app-admin
│   ├── gradle\libs.versions.toml           # Version catalog (Compose BOM 2024.12.01)
│   │
│   ├── core\                               # 🧩 Shared Library Module
│   │   ├── datastore\                      # SessionManager.kt (DataStore JWT + role + permissions)
│   │   ├── model\                          # User, Tournament, Scoreboard, Wallet, ApiEnvelope
│   │   ├── network\                        # TourneyApi.kt (~20 endpoints), AuthInterceptor, ApiClient
│   │   ├── theme\                          # ClientConfig.kt, Theme.kt (Dynamic Material 3)
│   │   ├── ui\                             # AppButton, GlassCard, AppTopBar, CountdownText, StatusBadge
│   │   │                                  # TournamentArt (map/mode art), UpiQr (UPI deep link + QR)
│   │   └── res\drawable\                    # Official FF maps (webp), mode badges, currency icons
│   │
│   ├── app-player\                         # 🎮 Player APK Module (Gamers)
│   │   ├── assets\client_config.json       # Branding configuration
│   │   └── java\com\tourney\player\        # LoginRegisterScreen, TournamentFeedScreen, SlotPickerScreen,
│   │                                       # RoomScreen (T-15 countdown), ScoreboardScreen, WalletScreen
│   │
│   ├── app-admin\                          # 🛡️ Admin/Staff APK Module
│   │   ├── assets\client_config.json       # Admin branding configuration
│   │   └── java\com\tourney\admin\         # AdminDashboardScreen (permission-gated), CreateTournamentScreen,
│   │                                       # PublishRoomScreen, SpectatorScorerScreen (1-Click Payout)
│   │
│   └── build\outputs\apk\                  # Verified APKs (Debug ~18 MB, R8 Release 846 KB)
│
├── git demo repo\                          # 📦 Reference Open Source Repositories
│   ├── tournify\                           # Push notifications & tournament queries
│   ├── battle-zone\                        # Wallet balance deduction & withdrawal queue
│   ├── ui-ux\Cloudy\                       # Jetpack Compose native glassmorphic blur
│   └── node-redlock\                       # Distributed Redis mutex concurrency locking
│
└── plan\                                   # 📋 Comprehensive Checklists & Roadmap
    ├── ROADMAP.md                          # Master Architecture Roadmap
    ├── PLAYSTORE_WHITELABEL_RESEARCH.md    # Play Store policy, trademark & Indian gaming law research
    ├── backend\                            # Backend Phases 1-4 (All Completed)
    └── android\                            # Android Phases 1-4 (All Done)
```

---

## 📊 3. Completed Phases Audit (100% Verified)

### 🔹 Backend Phases (Complete & Build Passing):
- **Phase 1 (Scaffolding):** Express, TypeScript NodeNext, Zod env validation, Redis retry singleton, Prisma 7 adapter.
- **Phase 2 (Auth & RBAC):** Hierarchy: `ADMIN` (Owner), `SUB_ADMIN` (Staff with granular boolean flags: `canCreateMatch`, `canUpdateRoomId`, `canDistributePrize`, `canManageWallet`), `USER` (Gamers with Free Fire UID). Real-time DB JWT sync for instant bans.
- **Phase 3 (Tournament Engine):** Redis Atomic Lua Mutex (`RESERVE_SCRIPT`) allocating 48 slots without race conditions, team codes for Duos/Squads, double-entry `WalletLedger`.
- **Phase 4 (Room Security & Spectator Payout):** T-15 min Room credentials countdown lock (`GET /tournaments/:id/room`), Official Spectator Scoreboard (`GET /tournaments/:id/results`), and 1-Click Serializable Payout (`POST /tournaments/:id/payout`).
- **Build Status:** `npm run build` compiles cleanly with 0 errors.

### 🔹 Android Phases (Complete & Build Passing):
- **Phase 1 (Multi-Module & Dynamic Theming):** `:core`, `:app-player`, `:app-admin` setup. 10-minute dynamic rebranding via `client_config.json`, OLED dark & light themes, DataStore `SessionManager.kt`.
- **Phase 2 (Full UI Flows & Retrofit API):**
  - `:core`: `TourneyApi.kt` (12 endpoints), `AuthInterceptor.kt` (auto Bearer token), `ApiClient.kt` (dynamic base URL from config).
  - `:app-player`: `LoginRegisterScreen.kt`, `TournamentFeedScreen.kt`, `SlotPickerScreen.kt` (interactive 48-slot picker with squad codes), `RoomScreen.kt` (T-15 min real-time countdown), `ScoreboardScreen.kt` (hacker flags), `WalletScreen.kt`.
  - `:app-admin`: `AdminDashboardScreen.kt` (dynamic role/permission filtered cards), `CreateTournamentScreen.kt`, `PublishRoomScreen.kt`, and `SpectatorScorerScreen.kt` (live kills steppers, hacker disqualify toggle, 1-click payout).
- **Build Status:** `./gradlew assembleDebug` (18 MB) and `assembleRelease` (846 KB) pass with 0 errors.

- **Phase 3 (FCM, Wallet Withdrawals & Realtime State):**
  - Backend: `WithdrawalRequest` queue (`/wallet/withdraw`, `/admin/wallet/withdrawals[+/approve|/reject]`), FCM notification engine (`fcm.service.ts` with auto push on room reveal, payout, match cancel).
  - Android: `TourneyMessagingService.kt` with channels, `WithdrawalModal.kt` with UPI regex & fraud signals, `AdminWalletScreen.kt` with UTR approval / refund dialogs, 5s lifecycle slot polling + `GlowProgressBar`, and iOS-grade `SlideToJoinButton.kt`.
  - Builds: Debug 18.3 MB & R8 Release 1.15 MB passing cleanly.

- **Phase 4 (Deposit UPI Flow, Lifecycle Sweep & High-Res Assets) — ✅ Done:**
  - Backend: `DepositRequest` + `DepositStatus` model; `POST /wallet/deposit` (12-char UTR → PENDING),
    `GET /wallet/deposits`, `GET /admin/wallet/deposits`, `POST /admin/wallet/deposits/:id/approve|reject`
    (approve credits `depositBalance` + `ADD_MONEY/CREDIT/DEPOSIT` ledger, double-approve blocked by a
    conditional status flip). `matchSweep.service.ts` auto-advances `OPEN/SLOTS_FULL → ROOM_REVEALED (T-15) → LIVE`
    every 60s (plus manual `POST /tournaments/sweep/states`). Cancel endpoint now guarded by `canCreateMatch`
    and refunds every booked slot in one serializable transaction (verified).
  - Fixed: pg v9 treats `sslmode=require` as `verify-full` and ignored the pool's `ssl` options → the runtime
    Prisma client could not reach Supabase. `config/prisma.ts` now strips only the URL flag (TLS stays on).
  - Android: official FF map/mode artwork in `:core/res/drawable` (files are WebP — correct `.webp` extension),
    `TournamentArt.kt` mapping, map banners + mode badges on `TournamentCard`, diamond/gold-coin icons in
    `WalletScreen`, `DepositModal.kt` (quick chips, dynamic `upi://pay` QR via zxing, GPay/PhonePe intent,
    12-char UTR validation + pending list), `AdminWalletScreen.kt` Withdrawals/Deposits tabs, and
    `PullToRefreshBox` on feed, wallet and admin dashboard + empty states.
  - Verification: backend `npm run build` clean; 19/19 deposit+refund API checks and 6/6 sweep checks passed;
    Debug (23.3/23.0 MB) and R8 Release (5.27/2.13 MB) builds passing.

---

## 🎯 4. Milestone Status: Phase 4 ✅ COMPLETE

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/4_Deposit_StateSweep_and_AssetIntegration/PLAN.md)

1. **Free Fire High-Res Asset Injection** — done (`TournamentArt.kt`, `:core/res/drawable`).
2. **Player UPI Deposit / Add Cash** — done (`DepositModal.kt`, `upi://pay` QR + intent, UTR flow).
3. **Admin Deposit Approvals Console** — done (`AdminWalletScreen.kt` Withdrawals | Deposits tabs).
4. **Match Lifecycle Auto-Sweep & Auto-Refund** — done (`matchSweep.service.ts` + refund cancellation).
5. **Pull-to-Refresh & Empty/Error States** — done (feed, wallet, admin dashboard).

## 🎯 4b. Milestone Status: Phase 5 ✅ COMPLETE

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/5_Scoreboard_and_WhiteLabel_Handover/PLAN.md)
Manual: [HANDOVER_MANUAL.md](file:///C:/Free%20Fire%20turnament/HANDOVER_MANUAL.md)

1. **Staff / Sub-Admin console** — backend `GET | POST | PATCH | DELETE /auth/admin/staff` (`requireRole('ADMIN')`),
   permission changes call `invalidateAuthCache` (instant effect), removal is a **soft deactivate** so
   `reviewedBy` / ledger audit rows survive. Android `AdminStaffScreen.kt` (cards, ACTIVE/REMOVED pills,
   permission chips, Hire/Edit dialog with 4 toggles, re-activate), route `"staff"`, dashboard card for ADMIN only.
2. **Spectator scorer polish** — rank clamped 1..48, mandatory disqualification reason field, typed reason sent
   with `POST /tournaments/:id/payout`.
3. **Official player scoreboard** — `ScoreboardScreen.kt` rewritten: map hero banner, prize pool / per-kill /
   match time, golden **Booyah** banner, **Top Fragger** card, red DQ banner, medals, "prize voided" hacker rows.
   Backend `getTournamentResults` now returns `gameMode / matchType / mapType / matchTime`.
4. **1-click payout** — verified atomic: rank1 ₹50 + 3 kills ₹15 = ₹65 → `WINNING_PRIZE` ledger → `COMPLETED`.
5. **10-minute white-label handover** — `clients/_template` + `clients/sample_client`, `package_client.bat` →
   `tools/package_client.mjs` (config validation, branded config/colors/icon injection, APK build + `dist/<slug>/`
   + `build-info.json` SHA-256, auto-restore), `HANDOVER_MANUAL.md` (Supabase/Firebase, Play compliance,
   Garena disclaimer, zero-liability model).
6. **Push auto-enable** — both app modules apply `com.google.gms.google-services` only when `google-services.json`
   exists; `android/gradle/verification-metadata.xml` extended for the plugin **and** for the 26 lint/annotation artifacts
   that `extractReleaseAnnotations` pulls in (release builds now verify clean). `google-services.json`, keystores and `dist/` are git-ignored.

**Verification:** backend `npm run build` 0 errors · both APKs `assembleDebug` ✅ (28.34/28.29 MB) and `assembleRelease` (R8) ✅ (5.03/2.06 MB) ·
`scripts_lifecycle.ts` **33/33 checks passed** (staff hire/permissions/deactivate, deposit→UTR→credit,
match→join→room→payout→scoreboard, withdrawal→approval, ledger trail) with automatic cleanup.

## 🎯 4c. Milestone Status: Phase 6 ✅ COMPLETE

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/6_Profile_ThemeSwitch_and_AdminSettings/PLAN.md)

1. **Player Profile tab** — `ProfileScreen.kt`: identity card (IGN / FF UID / phone with copy buttons),
   career stats grid (matches, played, Booyahs, kills, winnings, best rank) fed by the new
   `GET /players/me/stats`, WhatsApp support, logout dialog + disk-cache wipe.
2. **Dual theme switcher (Boss demand)** — `ThemeMode` (SYSTEM / DARK / LIGHT) persisted in `SessionManager`
   (kept across logout + restart), applied in both apps' `MainActivity` via `ClientTheme(darkTheme = mode.isDark(systemDark))`.
   Verified live on device: dark → light instant, survives force-stop.
3. **Feed filters + history** — `[Active & Live | Completed]` tabs and `[All | Solo | Duo | Squad]` chips; completed cards
   open the official scoreboard at any time (`GET /tournaments?status=COMPLETED`).
4. **Admin Match Operations** — `AdminMatchManagerScreen.kt`: ⚡ Sweep Lifecycle Now + 🛑 Cancel & Refund with a
   mandatory reason dialog (backend requires >= 5 chars). Verified end-to-end: cancel → ₹10 refunded, ledger `REFUND`,
   badge CANCELLED, wallet back to ₹500.
5. **Runtime Admin Settings** — `Tenant` gained `upiName / supportWhatsapp / minDeposit`; new
   `GET /tenant/settings`, `GET|PATCH /admin/tenant/settings` (ADMIN). `AdminSettingsScreen.kt` edits them with
   validation; the Player Add-Cash QR/payee/minimum and the support link now read from the database —
   **no APK rebuild to change the UPI ID**. Deposit flow enforces the tenant minimum.

**Verification:** backend `npm run build` 0 errors · `scripts_phase6.ts` **16/16** · debug ✅ (22.60/22.55 MB) ·
release R8 ✅ (5.06/2.08 MB) · device walkthrough on a physical 1080×2400 phone with screenshots in `screenshots/`.

## 🎯 4d. Milestone Status: Phase 7A (Phone-First Auth & Just-In-Time Game ID) ✅ COMPLETE

1. **Phone-First Fast Registration (Zero-Friction Onboarding):**
   - Registration now only requires phone number (+ optional display name).
   - IGN and Free Fire UID are no longer mandatory at signup.
   - Reduced onboarding friction by ~50%; users can explore the app immediately.
2. **Just-In-Time In-Game ID Input on Match Join (`SlotPickerScreen.kt`):**
   - When tapping an available slot, the confirmation bottom sheet dynamically checks whether the player has a Free Fire ID configured:
     - If already configured: displays "Playing as: [IGN] (UID: [UID])" with an inline `[Change]` toggle.
     - If not configured: smoothly presents In-Game Name & 6-12 digit UID input fields with a `[✔] Save as default Free Fire ID` checkbox.
     - `SlideToJoinButton` & Quick Join buttons only activate when a valid IGN and UID are present.
3. **Player Profile Game ID Editor (`ProfileScreen.kt`):**
   - Added `[✏️ Edit Game Profile]` button on the Profile identity card.
   - Opens a dialog allowing players to update their Free Fire IGN and UID anytime.
   - Syncs seamlessly via new backend endpoint `PATCH /players/me/game-profile` and updates offline DataStore cache.
4. **Backend Architecture Updates:**
   - Auth: `registerPlayer` now treats `inGameName` and `inGameUid` as optional.
   - Player Profile: added `PATCH /players/me/game-profile` with validation and tenant-wide UID conflict prevention.
   - Tournament Join: `POST /tournaments/:id/join` accepts optional `inGameName`, `inGameUid`, and `saveAsDefault`.

### Suggested next milestone (Phase 7B ideas)
- Daily settlement report: CSV export of deposits, withdrawals, prizes and net profit (owner console).
- Season leaderboard screen (aggregate kills/Booyahs across matches with a player rank card).
- Admin "Create Match" template presets (clone last week's schedule in one tap).
- Room-credential share sheet (WhatsApp/Telegram) + per-match reminder push at T-30.
- Player profile edit (change IGN/FF UID) with staff approval queue.

### 🔹 Milestone Status: Phase 7 ✅ COMPLETE

- Daily settlement API + owner-only CSV export implemented and wired to `AdminSettlementScreen.kt`.
- Admin dashboard now includes date-based KPI report and secure Android share flow for CSV.
- Tournament clone API now creates a fresh `UPCOMING` match; Manage Matches has `+1 Hour`, `Tomorrow`, and clone actions.
- `scripts_stress_test.ts` verified the complete 48-player money/tournament lifecycle: **24/24 passed** with automatic cleanup.
- Play Store pre-flight strings, disclaimer placeholder and handover checklist added.
- Verification: backend build clean; debug and R8 release APK builds clean.

### 🎯 4e. Milestone Status: Phase 8 ✅ COMPLETE — Player-Feed Visibility Window + IST Scheduling

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/8_Match_Visibility_Window_and_IST_Scheduling/PLAN.md)

1. **Admin-controlled listing window (boss demand)** — new `Tournament.visibilityHours` (`Int?`) +
   `visibleFrom` (`DateTime?`, = `matchTime - visibilityHours`). `POST /tournaments` accepts
   `visibilityHours` (1–336 or null); `PATCH /tournaments/:id/visibility` edits it later
   (`canCreateMatch`). Player feed (`GET /tournaments`) filters in SQL:
   non-staff only receive `visibleFrom IS NULL OR visibleFrom <= now` (plus matches they already
   joined); admin/staff lists always show every match. Hidden match details → 404 for players and
   join → 409 with an IST "Registration opens from …" message. Clones inherit the window,
   re-anchored to the new match time. Payload now includes `visibilityHours`, `visibleFrom`,
   `isListedNow`, `secondsUntilListed`.
2. **Admin Create Match — Indian schedule UI** (`CreateTournamentScreen.kt`): read-only date field
   `Wed, 05 Nov 2026`, Material3 `TimePicker` with **AM/PM** (always IST, not device TZ), live
   preview `05 Nov 2026, 08:00 PM IST` + "starts in 2h 15m", +1h/+3h/+6h/+12h/+24h quick chips.
3. **Player List Visibility control in Create Match:** `Always visible` vs `Only near start`,
   hours field (1–336) with 2h/6h/10h/12h/24h presets and a live preview of the exact IST time
   players will start seeing the match. Same editor is available per-match in Manage Matches
   (`👁️ Player Visibility Window`) and each card shows `👁️ Listed` / `🕒 Hidden — lists at …`.
4. **Player feed** (`TournamentFeedScreen.kt`): honours the window with the server-authoritative
   ticking clock, silently auto-refreshes every 60 s so a match appears the moment its window
   opens (no pull-to-refresh), never hides already-joined matches, and cards show IST time +
   relative countdown (`05 Nov, 08:00 PM • starts in 2h 15m`).
5. **Verification:** backend `npm run build` clean · `scripts_phase8_visibility.ts` **36/36 passed**
   (12h match + 10h window hidden → 13h window listed, details 404→200, join 409 IST message,
   0h/500h rejected, player 403, immediate listing, clone inheritance, 2h window on 12h match →
   `secondsUntilListed = 36000`, joined player keeps a match after the window is tightened,
   auto-cleanup) · `:app-admin` + `:app-player` `assembleDebug` ✅ ·
   **physical-device walkthrough** (RMX5070 via adb, screenshots in `screenshots/phase8_*.png`):
   admin created a match 12h ahead with a 10h window (player feed = 0 matches, card showed
   `🕒 Hidden — lists to players at 12:15 PM`), then changed it to 13h through the
   `👁️ Player Visibility Window` dialog → player feed showed the match with
   `05 Nov, 10:15 PM • starts in 12h 6m`; zero app crashes in logcat.

### 🎯 4f. Milestone Status: Phase 9 ✅ COMPLETE — Admin-Controlled Room ID / Password Reveal

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/9_Admin_Controlled_Room_Reveal/PLAN.md)

1. **Admin decides WHEN players see the custom room code (boss demand)** — new
   `Tournament.roomRevealMinutes Int @default(15)` (auto-reveal N minutes before start) + the
   existing `roomRevealedAt` (set when reveal actually happens). One shared rule in
   `backend/src/services/roomReveal.ts` (`isRoomUnlocked`) used by the feed, details, room endpoint
   and the lifecycle sweep. `POST /tournaments` accepts `roomRevealMinutes` (1–10080, default 15);
   clone inherits it. Payload gains `roomRevealMinutes`, `roomRevealsAt`, `roomUnlocked`,
   `secondsUntilRoomReveal`.
2. **Reveal Now / edit later** — `PATCH /tournaments/:id/room` now accepts `revealNow: true`
   (publish + show immediately); new `PATCH /tournaments/:id/room-reveal` (`canUpdateRoomId`)
   edits the auto window and/or reveals instantly. The 60s sweep reveals each match at its own
   `matchTime - roomRevealMinutes`; the room endpoint's 403 quotes the admin's window.
3. **Admin app** — Create Match has a new `🔑 Room ID & Password Reveal` section (5m/15m/30m/1h/2h/6h/12h/24h
   presets + custom minutes + IST preview). Publish Room shows the reveal state, tap-to-change timing,
   a "Reveal to players immediately" switch and a "Reveal to players now" action; Manage Matches cards
   show `🔑 Room ID: hidden — reveals at 11:45 AM (15 min before start)` / `visible to players now` /
   `not published yet` plus a `🔑 Reveal Room ID to Players Now` quick action. Device-testing caught &
   fixed: staff always receive the `room` payload, so "unlocked" must use the server `roomUnlocked`
   flag, never `room != null`.
   **Publish Room picker fix:** it used to list every match, including yesterday's LIVE/COMPLETED
   leftovers while the player app showed none. Backend now supports
   `GET /tournaments?publishable=true` (only UPCOMING/OPEN/SLOTS_FULL/ROOM_REVEALED, 1-hour kickoff
   grace); the screen uses that dedicated list (`publishTargetsUi`) with a client-side guard and a
   clear empty state ("No active or upcoming matches right now" + Refresh).
4. **Player app** — dynamic messaging (`roomRevealLabel()`), locked card shows
   `✅ Joined • Room in 1h 22m`, after the reveal it becomes `🔑 Get Room ID & Password`, and the
   Room screen countdown/messages follow the admin window (no hardcoded T-15).
5. **Verification:** backend `npm run build` clean · `scripts_phase9_room_reveal.ts` **44/44 passed**
   (create 30-min window, early publish stays locked, player 403 + window message, Reveal Now → 200,
   list/payload flags, window edit + 0/20000 validation, player 403, sweep auto-reveal per-match
   window, clone inheritance, cleanup) · both debug APKs build ✅ · **physical-device walkthrough**
   (RMX5070 via adb, screenshots in `screenshots/phase9_*.png`): created ₹0 match at 12:00 PM IST
   with reveal 11:45 AM, joined from the player app, published `ROOM-7788 / pass7788` (player card
   `Joined • Room in 1h 22m`, admin card `Hidden — reveals at 05 Nov, 11:45 AM`), pressed
   `🔑 Reveal Room ID to Players Now` → admin `ROOM OUT`, player saw `Get Room ID & Password` and the
   dialog showed `ROOM-7788 / pass7788`; zero crashes, test match removed afterwards.
   **Post-fix re-verification:** `scripts_phase8_visibility.ts` **36/36** + `scripts_phase9_room_reveal.ts`
   **44/44** pass; Publish Room picker with 11 stale matches → `publishable=0` + empty state, and with
   one fresh upcoming match → `publishable=1` (only that match listed); player app feed 0 matches
   (consistent). Server also needed a schema↔DB sync (concurrent concurrent schema edits had added
   `Tenant.allowPhoneAuth/allowDirectNumber/allowGoogleAuth/allowEmailAuth` + `EmailOtp` without a
   `db push`, and a duplicate `EmailOtp` model blocked `prisma validate` — now synced/repaired).

### 🎯 4g. Milestone Status: Phase 10 ✅ COMPLETE — Online Payments, Email Auth & Auth Toggles

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/10_Payments_and_Email_Auth/PLAN.md) ·
Gateway doc: [PAYMENT_GATEWAY.md](file:///C:/Free%20Fire%20turnament/docs/PAYMENT_GATEWAY.md)

1. **Online wallet top-up (mock in dev, Razorpay in production)** — `PaymentOrder` model
   (paise), order create/poll/verify/sync endpoints, HMAC-verified public webhook, mock
   `/demo/checkout` + `/demo/pay`, idempotent settlement into the double-entry ledger, and a
   stale-order expiry sweep in `server.ts`. Config: `PAYMENT_PROVIDER=mock|razorpay`,
   `PAYMENT_MIN/MAX_AMOUNT_PAISE`, `PAYMENT_ORDER_TTL_SECONDS`, `PAYMENT_MOCK_AUTO_CAPTURE`,
   `PUBLIC_BASE_URL`, `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET` (documented in `backend/.env.example`).
2. **Player Add Money sheet** (`AddMoneySheet.kt`) — chips/custom amount, DEMO-MODE banner,
   "Continue to demo checkout" (browser tab), UPI+UTR fallback, live "₹100 added" confirmation.
3. **Admin Wallet Console → Online tab** — today's collected ₹, paid/pending/failed counts,
   DEMO banner, order list (player, amount, status, payment id, sync).
4. **Email + password + OTP auth** — `POST /auth/player/email/send-otp` (+ `debugOtp` in dev) and
   `/email/verify-otp`; per-tenant `allowPhoneAuth / allowGoogleAuth / allowEmailAuth`; admin
   **App Settings → Player Authentication Methods** toggles (at least one must stay on).
   Phone/Google login now require a real Firebase idToken (production hardening).
5. **Audit fixes in this session** — repaired schema↔DB drift (`PaymentOrder`, `EmailOtp`,
   auth flags; removed a duplicate `EmailOtp` model that broke `prisma validate`), dropped the
   unused `allowDirectNumber`, restored `allowPhoneAuth/allowGoogleAuth=true` (they were left off,
   locking out phone logins), updated `scripts_phase8/9` to sign JWTs directly (phone-only login
   no longer exists), and documented all payment env vars in `backend/.env.example`.
6. **Verification** — payment smoke **19/19** (`src/scripts/testPaymentFlow.ts`), Phase 8 **36/36**,
   Phase 9 **44/44**, both APKs build. Device walkthrough (RMX5070): Add Money → mock checkout in
   Chrome → "Payment captured and wallet credited" → app balance **₹710 → ₹810**; admin Online
   tab `Today ₹810 · 5 paid orders`; auth toggles saved and reflected by the API; no crashes.

### 🎯 4h. Milestone Status: Phase 11 ✅ COMPLETE — Match Lifecycle: Player Feed Cleanup & Admin History

Plan file: [PLAN.md](file:///C:/Free%20Fire%20turnament/plan/android/11_Match_Lifecycle_History/PLAN.md)

1. **Problem:** finished matches stayed in the player app's Live tab forever (4 Nov matches
   showing "Live In-Progress" on 5 Nov) and ate the feed pagination; the admin had no clear
   history view.
2. **Backend** — player feed (non-staff, no status filter) now only returns matches within the
   last **3 hours** of kickoff and hides COMPLETED/CANCELLED; the lifecycle sweep got a new
   **Step 3**: LIVE → **UNDER_REVIEW** automatically after **2 hours** (`movedToReview` in the
   sweep result + realtime broadcast); room-reveal timing edits are rejected after kickoff.
3. **Player app** — both tabs drop a match 3h after kick-off (server + client), Live empty state
   explains the window.
4. **Admin app** — Manage Matches now has **⚡ Active & Upcoming** / **🧾 Match History** tabs;
   history keeps every match with IST date/time, status (REVIEW/COMPLETED/CANCELLED), seats,
   entry and settlement notes, newest first. Cancel/visibility/reveal actions are limited to
   pre-match statuses (Clone still available in history).
5. **Verification** — API: stale + 4h-past match → player feed **0**, admin **12**, sweep
   `{revealed:1, live:1, toReview:1}`, admin history `{UNDER_REVIEW:11, COMPLETED:1}`; device:
   player Live tab `(0)` with 3h note, admin History shows 11 ended matches with dates, Active
   tab empty state; suites **36/36 + 44/44 + 19/19**, build clean, no crashes.

### 🆔 4i. Milestone Status: Phase 12 ✅ COMPLETE — Auto IDs, One-Click Match Finish & Player Ban

1. **Auto Player ID** — every new account (OTP / Google / email / staff) gets a readable
   `playerCode` like `APE-0215` (3-char tenant prefix + sequence, unique per tenant). Existing
   users were backfilled by `src/scripts/backfillIdentity.ts` (214 users, 0 nulls). The player
   app shows a copyable **Player ID** row on the Profile screen.
2. **Auto Match Number & Title** — the admin no longer types a title. `createTournament` allocates
   `matchNumber = max + 1` (retries on the `[tenantId, matchNumber]` unique clash) and stores
   `"Bermuda Solo #12"`. Clone allocates a fresh number too; all 11 existing matches were
   backfilled (0 nulls). Cards render `#N Map • Mode` via `Tournament.displayName`.
3. **Player-facing title cleanup** — feed cards, join success dialog, joined-details dialog, room
   credentials dialog and map banner now use `displayName` (map + Solo/Duo/Squad), never an
   arbitrary tournament title.
4. **End Match & Pay Winner by UID** — `POST /tournaments/:id/finish` (permission
   `canDistributePrize`) takes `{ winnerUid, winnerKills? }`, finds the booked participant whose
   Free Fire UID matches, then in a serializable `FOR UPDATE` transaction credits rank-1 prize
   (50% pool + kills × per-kill) to Winning Balance, writes a `WINNING_PRIZE` ledger row,
   upserts the approved `MatchResult`, marks the match `COMPLETED`, clears Redis and pushes FCM.
   A second finish is rejected (`already completed`) — no double payout.
5. **Admin match console** — Manage Matches is now one section with **LIVE / UPCOMING / HISTORY**
   tabs; each card shows auto `#N`, map/mode, IST time, seats, entry, visibility window and
   **Room ID/Pass status** (set / hidden / revealed), plus Cancel & Refund, Clone and
   **End Match & Pay Winner (UID)** actions.
6. **Player Management + ban** — owner-only `GET /admin/players?search=` (Player ID / phone /
   name / IGN / FF UID) and `PATCH /admin/players/:id/ban` with instant auth-cache invalidation
   (banned JWT dies on the next request). Admin dashboard has a Player Management card and a
   full search/ban/unban screen.
7. **Verification** — backend `npm run build` clean, Android `:core + :app-admin + :app-player`
   compile clean, backend unit suite **40/40**. Live Supabase E2E (temporary rows removed after):
   auto code `APE-0215`, auto match `#12 Bermuda Solo #12`, player search, ban/unban, finish with
   UID paid **₹70** (₹50 rank + 2×₹10 kills), ledger + result written, second finish rejected.
8. **Physical-device walkthrough (RMX5070, Phase 12)** — `adb reverse tcp:5000 tcp:5000`, both debug
   APKs installed. Verified: Create Match screen has no title field (auto `#N` note), player feed
   shows `#12 Bermuda • Solo`, join sheet captures IGN/UID and joins, admin **LIVE / UPCOMING /
   HISTORY** tabs show `Match #12` + ID/Pass status, End Match & Pay dialog paid winner
   `APE-0214` **₹10**, player Wallet showed the `WINNING_PRIZE` ledger, ban showed
   "Your account has been banned" on the next player request, and unban restored access.
   Screenshots in `screenshots/phase12_*.png`; the temporary match/slot/ledger were cleaned up
   afterwards (player Winning Balance back to ₹0).

### Suggested next milestone (Phase 6 ideas)
- Admin "Sweep now" + "Cancel & refund match" buttons on match cards (backend endpoints already exist).
- Deposit/withdrawal CSV export + daily reconciliation totals.
- Tenant UPI ID editable from the admin app (withdrawal + deposit QR follow it) instead of `client_config.json`.
- Leaderboard/season ranking screen for players (aggregate kills + Booyahs across matches).
- Light theme pass (Boss asked for light + dark mode in `boss demand/WP.txt`).

---

## 🛠️ 5. Standard Operating Protocol for Next Agent

When continuing from this file in a new chat:
1. Greet the user in **Hinglish**.
2. Acknowledge that Backend + Android Phases 1-12 are **100% completed & verified**.
3. Backend + Android Phases 1-9 are complete; Phase 12 (auto Player ID / auto match number,
   one-click End Match & Pay by UID, admin player ban) is complete; next work starts from the
   "Suggested next milestone" ideas above.
4. Always leverage the reference repos in `git demo repo\` when generating code or prompts.
5. Keep all checklist files in `plan/` updated.
6. Match schedule, visibility & room reveal rules (Phases 8–9 — do not regress):
   - Every match time is stored as UTC ISO but **entered/displayed in IST (Asia/Kolkata) with 12-hour AM/PM**.
   - `Tournament.visibilityHours` / `visibleFrom` control when players can list & join a match.
     Backend hides outside-window matches from `GET /tournaments` for players only; admins see everything.
   - `Tournament.roomRevealMinutes` / `roomRevealedAt` control when joined players see Room ID & Password.
     Admins can Reveal Now any time (`PATCH /tournaments/:id/room-reveal { revealNow: true }`).
   - Never hide an already-joined player's match, and never let a hidden match be joined.
7. Identity & finish rules (Phase 12 — do not regress):
   - Never ask the admin to type a tournament title; the backend auto-generates
     `matchNumber` + `"<Map> <Mode> #N"`. Player UI shows map + Solo/Duo/Squad via `displayName`.
   - `playerCode` and `matchNumber` are unique per tenant; new registration paths must call
     `allocatePlayerCode`, new tournaments go through `createTournament` (never raw insert).
   - Payouts must stay atomic: lock the tournament row, write `WINNING_PRIZE` ledger, upsert the
     approved result, then set COMPLETED. Never allow a second payout on a completed match.
   - Ban/unban is owner-only and must call `invalidateAuthCache(userId)`.
