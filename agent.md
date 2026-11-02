# 🤖 AGENT KICKOFF & SYSTEM WORKFLOW SPECIFICATION
## Free Fire Tournament Platform (Turnkey White-Label eSports SaaS)

> **Document Purpose:** Yeh file naye AI Agents aur new chat sessions ke liye single source of truth hai. Nayi chat me aate hi is file ko read karke agent instantly pura architecture, completed kaam, aur active tasks samajh jayega.
> **Project Author:** Jay Kumar  
> **Preferred Communication:** Hinglish (Hindi + English)

---

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

### Suggested next milestone (Phase 5 ideas)
- Staff "Sweep now" + match-cancel buttons in the admin app (backend endpoints already exist).
- Deposit/withdrawal CSV export + daily reconciliation totals for the admin.
- Room-creds countdown push scheduling + WhatsApp/Telegram share of room ID.
- Configurable tenant UPI ID from the admin app instead of `client_config.json`.

---

## 🛠️ 5. Standard Operating Protocol for Next Agent

When continuing from this file in a new chat:
1. Greet the user in **Hinglish**.
2. Acknowledge that Backend Phases 1-4 and Android Phases 1-2 are **100% completed & verified**.
3. Backend + Android Phases 1-4 are complete; next work starts from the Phase 5 ideas above.
4. Always leverage the reference repos in `git demo repo\` when generating code or prompts.
5. Keep all checklist files in `plan/` updated.
