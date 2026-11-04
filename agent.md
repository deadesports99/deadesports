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
2. Acknowledge that Backend + Android Phases 1-6 are **100% completed & verified**.
3. Backend + Android Phases 1-6 are complete; next work starts from the Phase 7 ideas above.
4. Always leverage the reference repos in `git demo repo\` when generating code or prompts.
5. Keep all checklist files in `plan/` updated.
