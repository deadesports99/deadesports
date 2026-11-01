# 🤖 Master Prompt for DeepSeek v4 Flash / Kimi K3.1 Pro (FreePI)
## Android Phase 2: Full UI Flows (Player App, 48-Slot Picker, Timed Room ID, Spectator Scorer Console & Retrofit API)

> **Context:** Android Phase 1 is 100% complete and built cleanly (Debug APKs: 17.6 MB, R8 Release APKs: 1.3 MB).
> Backend Node.js/TypeScript is running on `http://10.0.2.2:5000/api/v1` with full database & Redis support.
> 
> **Zero Screenshot Rule:** Player App must NOT contain any screenshot/image upload screen. Match verification is done by Staff sitting in the **Spectator Slot** inside Free Fire.

---

```text
You are an Elite Principal Android Architect specializing in Kotlin, Jetpack Compose, Material 3, and White-Label Android Architecture.

Phase 1 (Multi-Module Gradle setup, :core theming engine, DataStore SessionManager, and APK generation) is 100% verified and compiled cleanly.
Now we are implementing Android Phase 2: The complete interactive UI screens for both :app-player and :app-admin, backed by a production-ready Retrofit network layer in :core.

### CORE ARCHITECTURAL SPECIFICATIONS:

#### 1. `:core` Networking Layer:
- Create `core/src/main/java/com/tourney/core/network/TourneyApi.kt`:
  - `POST /auth/player/login` -> returns token, user, tenantId
  - `POST /auth/player/register` -> registers phone, IGN, Free Fire numeric UID
  - `POST /auth/admin/login` or phone login
  - `GET /auth/me` -> fetches profile, balances, staff permissions
  - `GET /tournaments` -> lists matches
  - `GET /tournaments/{id}` -> match details
  - `GET /tournaments/{id}/slots` -> 48 slots grid with occupied seat info
  - `POST /tournaments/{id}/join` -> joins with slotNumber and optional teamCode
  - `GET /tournaments/{id}/room` -> timed room credentials (returns secondsUntilReveal if locked)
  - `GET /tournaments/{id}/results` -> official spectator scoreboard
  - Admin/Staff endpoints:
    * `POST /tournaments` -> create match (requires canCreateMatch)
    * `PATCH /tournaments/{id}/room` -> publish Room ID/Pass (requires canUpdateRoomId)
    * `POST /tournaments/{id}/payout` -> submit verified kills & trigger 1-click payout (requires canDistributePrize)
- Create `core/src/main/java/com/tourney/core/network/AuthInterceptor.kt`:
  - OkHttp Interceptor reading JWT from `SessionManager` and appending `Authorization: Bearer <token>`.
- Create `core/src/main/java/com/tourney/core/network/ApiClient.kt`:
  - Singleton OkHttp + Retrofit builder configured with Moshi and dynamic base URL from `client_config.json`.

---

#### 2. `:app-player` Screens (Gamers/Players Experience):
- NO SCREENSHOT UPLOAD SCREENS.
- `LoginRegisterScreen.kt`:
  - Tabbed or switchable Login / Registration flow.
  - Fields for registration: Phone Number, In-Game Name (IGN), and numeric Free Fire UID (6-12 digits).
  - Uses `AppButton` and `GlassCard`.
- `TournamentFeedScreen.kt`:
  - List of active/upcoming matches with Map badges (Bermuda, Purgatory), Match Type (Solo, Duo, Squad), Entry Fee, Prize Pool, and Slots Progress (e.g. 38/48 booked).
- `SlotPickerScreen.kt`:
  - Visual 48-Seat Grid (12 rows x 4 columns).
  - Booked slots shown disabled/red with player IGN; open slots clickable.
  - Squad/Duo support: Enter or generate 6-digit Team Code.
  - "Join Tournament" button deducting balance and confirming slot.
- `TimedRoomModal.kt` (or BottomSheet):
  - Displays match status.
  - If `secondsUntilReveal > 0`: Active real-time countdown timer ("Room credentials reveal in 14:32").
  - When unlocked: Displays Room ID and Password with 1-tap "Copy to Clipboard" button and tactile feedback.
- `ScoreboardScreen.kt`:
  - Official Spectator Scoreboard showing Booyah Rank 1-48, IGN, Verified Kills, and Cash Prize.
  - Hacker/Disqualified players flagged with red warning banner.
- `WalletScreen.kt`:
  - Shows Deposit Balance, Winning Balance, and transaction history cards.

---

#### 3. `:app-admin` Screens (Owner & Staff Experience):
- `AdminLoginScreen.kt`:
  - Staff / Admin phone authentication.
- `CreateTournamentScreen.kt` (Guarded: `canCreateMatch`):
  - Form: Title, Game Mode, Map dropdown, Match Schedule picker, Entry Fee, Prize Pool, Per-Kill Prize.
- `PublishRoomSheet.kt` (Guarded: `canUpdateRoomId`):
  - Input Room ID and Password to unlock match for players.
- `SpectatorScorerScreen.kt` (Guarded: `canDistributePrize`):
  - Staff Spectator Console:
    * Lists all 48 players who participated.
    * Stepper / Input for Verified Kills per player.
    * Rank assignment (1 = Booyah, 2, 3...).
    * "Disqualify Hacker" toggle (flags user, voids prize).
    * Sticky bottom button: "Distribute Prize & Complete Match" (Calls `POST /tournaments/{id}/payout` with 1-click confirmation dialog).

---

### OUTPUT FORMAT:
Provide the file name clearly for each file, followed by the complete, production-ready Kotlin code block with zero placeholders.
```
