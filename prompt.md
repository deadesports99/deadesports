# 🎯 Master Engineering & UI/UX Research Prompts

> **Project:** Free Fire Tournament Multi-Tenant White-Label Platform  
> **Lead Developer:** Jay Kumar  
> **Target UX:** Modern Apple iOS / CRED Grade (OLED Dark Mode, 24px Glassmorphic Blur, 120 FPS Spring Physics, Zero "AI-Generated" Vibe)

---

## 📑 Index
1. [PROMPT 1: Elite Esports UI/UX Design System & Micro-Interactions Master Prompt](#-prompt-1-elite-esports-uiux-design-system--micro-interactions-master-prompt)
2. [PROMPT 2: Android Phase 2 Full Implementation Prompt (Compose Screens & Retrofit Layer)](#-prompt-2-android-phase-2-full-implementation-prompt)

---

## 🎨 PROMPT 1: Elite Esports UI/UX Design System & Micro-Interactions Master Prompt

*Aap is prompt ko **Claude 3.7 Sonnet, Gemini Pro, ya Perplexity** me copy-paste karke ultra-deep UI/UX design tokens, layout wireframes, aur animation specifications nikal sakte hain:*

```text
You are a Principal Mobile UI/UX Product Designer and Design Systems Architect specializing in high-stakes esports tournament applications (similar to Gamerji, Tournafest, and Battlemania, combined with the ultra-luxury design aesthetics of CRED and Apple iOS Human Interface Guidelines).

I am designing a modern, white-label Free Fire & Free Fire MAX Tournament mobile application (supporting both Android Jetpack Compose and React Native). 
The UI must NOT look like generic, flat, AI-generated designs. It must look human-crafted, tactile, high-end, and deeply immersive for hardcore gamers.

Provide a comprehensive, production-grade UI/UX Design Blueprint covering:

1. COLOR PALETTE & DESIGN TOKENS:
   - Deep OLED Dark Mode palette (Base dark surfaces #0B0E14, elevated card layers #151922, 1px border stroke opacity with gradient reflections).
   - High-contrast Gaming Accents (Booyah Gold #FFB800, Crimson Battle Red #FF3838, Kill Counter Neon #00F0FF, Victory Green #2ED573).
   - Clean Apple Light Mode counterpart that retains high-tech esports vibes without looking like a bland enterprise dashboard.

2. TOURNAMENT FEED CARD ARCHITECTURE:
   - Wireframe layout for a Free Fire Match Card (Bermuda Solo/Squad, Entry Fee, Per-Kill Bounty, Total Prize Pool).
   - Real-time animated slot filling progress bar (e.g., "38/48 Slots Joined") with pulse animation when near full.
   - 15-Minute Urgency Countdown Timer with animated badge when Room ID/Password is about to reveal.

3. THE 48-SLOT INTERACTIVE ROSTER PICKER:
   - Visual specification for an interactive 48-slot picker (Solo, Duo 24 teams, Squad 12 teams of 4).
   - Visual states: Empty Available (translucent gray outline), Selected by User (golden border glow), Locked by Other Player (muted crimson disabled), Reserved for Teammate (team color strip).
   - How haptic feedback (light impact) and spring micro-interactions should behave when tapping slots.

4. THE TIMED ROOM ID & PASSWORD MODAL:
   - Apple Cupertino-style glassmorphic bottom sheet design (frosted blur backdrop).
   - High-contrast 1-Tap Copy buttons with temporary "Copied!" checkmark animation.
   - Direct deep-link button: "Launch Free Fire & Join Room".

5. SLIDE-TO-CONFIRM ENTRY COMPONENT:
   - An iOS-grade "Slide to Join ₹20" swipe gesture component specification to prevent accidental joins.

6. MICRO-INTERACTIONS & SKELETON LOADERS:
   - Skeleton shimmer layout for match cards during network loading.
   - Haptic vibration patterns for button clicks, slot selection, match joined, and error states.
```

---

## 🤖 PROMPT 2: Android Phase 2 Full Implementation Prompt

*Aap is prompt ko **DeepSeek v4 Flash, Kimi K3.1 Pro, ya Claude** me run karke direct production Kotlin code generate karwa sakte hain:*

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
- NO SCREENSHOT UPLOAD SCREENS. (Match verification is done by Staff in Spectator Slot).
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
