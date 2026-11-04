# 📱 Phase 5: Scoreboard, Staff Management Console & 10-Minute White-Label Handover

> **Target Goal:** Staff/Sub-Admin Role Console (`:app-admin`), Official Spectator Scoreboard & Leaderboard Verification (`:app-player`), 1-Click Winner Payout Engine Verification, and 10-Minute Turnkey White-Label Handover Automation (Boss Demand).  
> **Location:** `C:\Free Fire turnament\android\` & `C:\Free Fire turnament\backend\`  
> **Status:** ✅ COMPLETE (verified 02 Nov 2026)  
> **Audited By:** Antigravity Architect  
> **Reference Directives:** Boss WhatsApp Directives (`boss demand/WP.txt` & `plan/ROADMAP.md`)

---

## 📋 Phase 5 Step-by-Step Checklist

### 🔹 Stage 1: Sub-Admin & Staff Management Console (`:app-admin` & Backend)
- [x] **1.1 Backend Staff Endpoints (`backend/src/routes/auth.routes.ts` & `auth.service.ts`):**  _(phone-number login instead of password — no secrets to leak; removal is a soft-deactivate so `reviewedBy` audit rows survive)_
  - `GET /api/v1/auth/admin/staff` -> Lists all staff members for the current tenant (guarded by `requireRole('ADMIN')`).
  - `POST /api/v1/auth/admin/staff` -> Creates new staff member with phone number, name, password, and granular permissions (`canCreateMatch`, `canUpdateRoomId`, `canDistributePrize`, `canManageWallet`).
  - `PATCH /api/v1/auth/admin/staff/:id` -> Updates existing staff member's permissions dynamically.
  - `DELETE /api/v1/auth/admin/staff/:id` -> Deactivates/removes staff member.
- [x] **1.2 Admin Staff Management Screen (`AdminStaffScreen.kt` in `:app-admin`):**
  - List of all hired staff with their name, phone number, and active permission chips.
  - "Hire Staff" button opening dialog/bottom sheet with 4 permission toggles:
    - 🎮 Can Create Match
    - 🔑 Can Update Room ID/Password
    - 🏆 Can Distribute Prize (Spectator Scorer)
    - 💳 Can Manage Wallet (Deposits & Withdrawals)
  - 1-Click permission update dialog & "Remove Staff" confirmation.
- [x] **1.3 Dashboard & Navigation Wiring:**
  - Add "Staff Management" feature card in `AdminDashboardScreen.kt` (visible only if `session.role == Role.ADMIN`).
  - Wire `"staff"` route in `AdminNav.kt`.

---

### 🔹 Stage 2: Spectator Scorer & Official Scoreboard Verification
- [x] **2.1 Spectator Scorer Screen Polish (`SpectatorScorerScreen.kt` in `:app-admin`):**
  - Verify loading of all 48 tournament slots.
  - Quick-entry controls for Kills count, Rank (1 to 48), and Hacker Disqualification toggle with reason.
  - 1-Click "💰 Distribute Prize & Complete Match" calling `POST /api/v1/tournaments/:id/payout`.
  - Verify atomic double-entry ledger credit to winners' `winningBalance` (`WINNING_PRIZE`).
  - Verify tournament status transition to `COMPLETED` and automatic Redis cache wipe.
- [x] **2.2 Official Player Scoreboard Screen (`ScoreboardScreen.kt` in `:app-player`):**
  - Ensure deep-link and navigation from completed match card in `TournamentFeedScreen.kt`.
  - Highlight Booyah #1 winner with golden badge and total earnings.
  - Highlight Top Fragger (Most Kills).
  - Complete ranking list (Rank 1 to 48) with IGN, UID, verified kills, and prize won.
  - Disqualification banner for flagged players.

---

### 🔹 Stage 3: 10-Minute Turnkey White-Label Handover Tooling (Boss Demand)
- [x] **3.1 Centralized Client Config Template:**
  - Standardize `client_config.json` schema supporting:
    - `client_name`, `app_name`, `application_id`, `version_name`, `version_code`
    - `theme`: `primary_color`, `button_color`, `accent_color`, `corner_radius_dp`
    - `backend`: `api_base_url`, `supabase_url`, `supabase_anon_key`, `tenant_id`
    - `payments`: `upi_id`, `upi_name`, `min_deposit`, `support_whatsapp`
- [x] **3.2 Automated White-Label CLI / Batch Script (`package_client.bat`):**
  - One-click script that takes a client configuration folder (e.g. `clients/alpha_esports/`):
    1. Injects `client_config.json` into both `:app-player` and `:app-admin`.
    2. Updates client app icons and logos in `res/mipmap/`.
    3. Runs Gradle build to generate branded `Player.apk` and `Admin.apk` with unique application IDs.
    4. Outputs clean APKs into `dist/{client_name}/`.
- [x] **3.3 Turnkey Handover Manual (`HANDOVER_MANUAL.md`):**
  - Complete, step-by-step documentation for Boss:
    - 2-Minute Supabase & Firebase setup guide (Zero Data Liability Model).
    - 10-Minute automated branding and APK generation.
    - Google Play Store compliance guidelines (avoiding repetitive content spam policy, decentralized account model, mandatory Free Fire trademark disclaimers).

---

### 🔹 Stage 4: Multi-Module Compilation & Full System Smoke Test
- [x] **4.1 Backend compilation test:** `npm run build` passing with 0 TypeScript errors.
- [x] **4.2 Android compilation test:** `./gradlew :app-player:assembleDebug :app-admin:assembleDebug` passing with 0 errors.
- [x] **4.3 Complete Tournament Lifecycle Smoke Test:**
  - Schedule Match → Player Top-Up (Add Cash) → Admin Approve Deposit → Join Match & Select Slot → Timed Room Credentials Release → Kickoff Live → Spectator Score Entry → 1-Click Winner Payout → Leaderboard Display → Cash Withdrawal Request → Admin Approve Withdrawal.

---

## ✅ Verification Log (02 Nov 2026)

### Backend — `npm run build` → 0 TypeScript errors
- New staff console API: `GET | POST | PATCH | DELETE /api/v1/auth/admin/staff` (all `authenticate` + `requireRole('ADMIN')`).
- `createStaffMember` → returns `{ user, token }`; `updateStaffMember` / `removeStaffMember` → `{ staff }`.
- `PATCH` accepts `name | email | permissions | isActive`; permission changes call `invalidateAuthCache` so a granted permission works on the very next request.
- `DELETE` = soft deactivate (`isBanned = true`, all 4 permissions false) — ledger/`reviewedBy` history preserved, login blocked.
- `getTournamentResults` now returns `gameMode`, `matchType`, `mapType`, `matchTime` so the player scoreboard can render the map banner + mode badge.

### Android — `assembleDebug` ✅ (28.34 / 28.29 MB) and `assembleRelease` R8 ✅ (5.03 / 2.06 MB)
- `:app-admin` → `AdminStaffScreen.kt` (staff cards + ACTIVE/REMOVED pills + permission chips + Hire/Edit dialog with 4 toggles + remove confirm + re-activate), route `"staff"` in `AdminNav.kt`, "Staff Management" dashboard card shown only for `Role.ADMIN`.
- `SpectatorScorerScreen.kt` → rank clamped 1..48, disqualification reason field, typed reason sent with the payout payload.
- `:app-player` → `ScoreboardScreen.kt` rewritten: map hero banner, prize pool/per-kill/time, golden **Booyah** banner, **Top Fragger** card, red disqualification banner, medals for 1/2/3, hacker rows crossed out with "prize voided".
- `WalletScreen.kt` → WhatsApp support row (`https://wa.me/<digits>`) fed by `payments.support_whatsapp`.

### White-label handover
- `clients/_template/` (nested schema v2 + field reference) and `clients/sample_client/` (Thunder eSports + 512² icon).
- `package_client.bat` → `tools/package_client.mjs`: validates config → backs up + injects `client_config.json`, themed `colors.xml`, brand icon (all mipmap densities + adaptive icon) → optionally builds → copies `dist/<slug>/Player.apk` + `Admin.apk` + `build-info.json` (SHA-256) → restores the repo unless `--keep`.
- Verified end-to-end: `node tools/package_client.mjs sample_client` → Player 28.34 MB / Admin 28.29 MB, repo restored clean; `package_client.bat sample_client --no-build` → config validated, injection tested, restored.
- `HANDOVER_MANUAL.md` at repo root: Supabase/Firebase setup, 10-minute branding, Play Store compliance + Garena trademark disclaimer, zero-liability rules, troubleshooting, handover checklist.
- Release builds needed 26 lint/annotation artifacts (`lint-31.10.1`, `intellij-core`, `uast`, `groovy-3.0.22`, …) added to
  `android/gradle/verification-metadata.xml` (dependency verification was previously debug-only, so `extractReleaseAnnotations` failed).
  The file now verifies clean for both `assembleDebug` and `assembleRelease`.
- FCM now turns on automatically: both app modules apply the `com.google.gms.google-services` plugin **only when** `google-services.json` exists (dependency-verification metadata extended for `com.google.gms:google-services:4.4.2`). `google-services.json`, `*.jks`, `*.keystore` and `dist/` are git-ignored.

### Full tournament lifecycle smoke test — `scripts_lifecycle.ts` → **33 / 33 passed**
| Flow | Result |
| --- | --- |
| Staff list as owner / blocked for player (403) | ✅ |
| Hire staff → 201 SUB_ADMIN, duplicate phone → 409 | ✅ |
| Staff login (phone) → permission denied 403 before grant | ✅ |
| Grant `canManageWallet` → next request 200 (cache invalidated) | ✅ |
| Staff cannot manage staff (403) | ✅ |
| Deposit ₹100 + UTR → duplicate UTR 409 → approve → credit → double-approve 409 | ✅ |
| Create match (T-10) → 48 slots → join #7 → duplicate join 409 → balance −10 | ✅ |
| Publish room → ROOM_REVEALED → player reads creds inside T-15 window | ✅ |
| 1-click payout rank1 ₹50 + 3 kills ₹15 = ₹65 → COMPLETED | ✅ |
| `WINNING_PRIZE` ledger row + official scoreboard (rank/kills/prize + map & mode header) | ✅ |
| Completed match rejects new joins (409) | ✅ |
| Withdraw ₹50 (held) → admin queue → approve with UTR | ✅ |
| Ledger trail ADD_MONEY → JOIN_FEE → WINNING_PRIZE → WITHDRAWAL | ✅ |
| Deactivate staff → token rejected → cannot log in again | ✅ |

> Run it with: `cd backend && npx tsx scripts_lifecycle.ts` (requires the API on `:5000`). It creates its own staff/match/deposit/withdrawal rows and **deletes them + restores the player's balances** at the end.
