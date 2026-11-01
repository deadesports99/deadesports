# 📱 Android Phase 2: Auth Screens, Tournament Lifecycle & Spectator Console

> **Target Goal:** Production-Ready Player App Screens (Auth, Feed, 48-Slot Picker, Timed Room ID, Spectator Scoreboard, Wallet) + Admin Staff Console  
> **Location:** `C:\Free Fire turnament\android\`  
> **Status:** ⏳ PENDING / READY FOR PROMPT  
> **Audited By:** Antigravity Architect  
> **Core Anti-Fraud:** Zero Screenshot Uploads (Spectator Console + 1-Click Payout)

---

## 📋 Phase 2 Step-by-Step Checklist (Order-Wise)

### 🔹 Stage 1: Networking & Retrofit API Service (`:core`)
- [ ] **1.1 Retrofit API Interface (`TourneyApi.kt`):**
  - Auth: `POST /auth/player/register`, `POST /auth/player/login`, `POST /auth/admin/staff`, `GET /auth/me`.
  - Tournaments: `GET /tournaments`, `GET /tournaments/:id`, `GET /tournaments/:id/slots`, `POST /tournaments/:id/join`, `POST /tournaments` (admin), `POST /tournaments/:id/cancel` (admin).
  - Room & Results: `PATCH /tournaments/:id/room`, `GET /tournaments/:id/room`, `GET /tournaments/:id/results`, `POST /tournaments/:id/payout`.
- [ ] **1.2 Auth Token Interceptor (`AuthInterceptor.kt`):**
  - Reads JWT token from `SessionManager` and automatically attaches `Authorization: Bearer <token>`.
- [ ] **1.3 Dynamic Base URL Provider (`ApiClient.kt`):**
  - Reads `api_base_url` from `client_config.json` (e.g. `http://10.0.2.2:5000/api/v1` for emulator or production URL).

---

### 🔹 Stage 2: Player Authentication Screens (`:app-player`)
- [ ] **2.1 Player Login Screen (`LoginScreen.kt`):**
  - Phone Number input with country code picker (+91).
  - Dynamic branding: Client Logo, App Name, Branded Button.
- [ ] **2.2 Player Registration Screen (`RegisterScreen.kt`):**
  - Full Name, Phone Number.
  - Free Fire In-Game Name (IGN) & Numeric Free Fire UID (6-12 digits validation).
  - Anti-Fraud info banner: "Ensure your Free Fire UID is 100% accurate; wrong UID forfeits slot."

---

### 🔹 Stage 3: Player Tournament Experience (`:app-player`)
- [ ] **3.1 Tournament Feed Screen (`TournamentFeedScreen.kt`):**
  - Tabs: Upcoming / Live / Completed.
  - Tournament Card with Game Mode badge, Map name, Prize Pool, Entry Fee, and Slots remaining progress bar (e.g., 34/48 booked).
- [ ] **3.2 Interactive 48-Slot Picker Screen (`SlotPickerScreen.kt`):**
  - Visual 48-seat grid (12 rows x 4 columns for Squads or 24 pairs for Duos).
  - Booked seats: Red/Disabled with Player IGN.
  - Selected seat: Accent glowing border.
  - Squad/Duo Team Code join or create modal.
  - 1-Click "Join Match" button checking wallet balance before confirmation.
- [ ] **3.3 Timed Room ID & Password Modal (`RoomDetailsModal.kt`):**
  - Real-time countdown timer ticking down to T-15 minutes (`secondsUntilRoomReveal`).
  - When locked: Glowing lock icon with "Credentials unlock in MM:SS".
  - When unlocked: Tap-to-copy Custom Room ID and Room Password with haptic toast feedback.
- [ ] **3.4 Official Spectator Scoreboard (`ScoreboardScreen.kt`):**
  - Displays match results certified by staff spectator.
  - Rank 1 (Booyah), Kills, Prize won. Disqualified hackers highlighted in red with "Banned/Disqualified" tag.
  - **Zero Screenshot Upload UI.**
- [ ] **3.5 Player Wallet Screen (`WalletScreen.kt`):**
  - Clean card showing Deposit Balance & Winning Balance.
  - Transaction history ledger (Entry Fee debits, Winning credits, Refunds).

---

### 🔹 Stage 4: Admin & Staff Spectator Console (`:app-admin`)
- [ ] **4.1 Admin Login Screen (`AdminLoginScreen.kt`):**
  - Phone login with role detection (Admin vs Sub-Admin).
- [ ] **4.2 Tournament Creator Screen (`CreateTournamentScreen.kt`):**
  - Guarded by `canCreateMatch`.
  - Title, Game Mode, Map (Bermuda/Purgatory/etc.), Match Schedule, Entry Fee, Prize Pool, Per-Kill Prize.
- [ ] **4.3 Room ID Publisher Sheet (`PublishRoomSheet.kt`):**
  - Guarded by `canUpdateRoomId`.
  - Inputs Custom Room ID & Password -> Calls `PATCH /tournaments/:id/room`.
- [ ] **4.4 Spectator Match Scorer Console (`SpectatorScorerScreen.kt`):**
  - Guarded by `canDistributePrize`.
  - Staff selects match, lists participants.
  - Live kill counter per player (`+` / `-`).
  - Rank assignment (Rank 1 to 48).
  - Disqualification checkbox for suspected hackers.
  - 1-Click "Confirm & Disburse Payouts" button calling `POST /tournaments/:id/payout`.

---

### 🔹 Stage 5: Navigation & End-to-End Build Verification
- [ ] **5.1 Jetpack Compose Navigation Setup:**
  - Navigation graphs in `:app-player` and `:app-admin`.
- [ ] **5.2 Gradle Compilation:**
  - Run `./gradlew :app-player:assembleDebug :app-admin:assembleDebug` with 0 errors.

---

## 📌 Progress Tracker & History Log

| Date | Step | Action Taken | Status |
| :--- | :--- | :--- | :--- |
| 01-Nov-2026 | Plan Setup | Android Phase 2 plan created with complete screen specifications | ⏳ In Progress |
