# 🤖 Master Prompt for Kimi K3.1 Pro (FreePI)
## Android Phase 1: Kotlin + Jetpack Compose Multi-Module Architecture & White-Label Theming Engine

> **Architectural Decision (Spectator Model):** Player screenshot upload has been COMPLETELY REMOVED. In real Free Fire tournaments, client staff sits in the **Custom Room Spectator Slot** to watch the match live, catch hackers, and record official results. 
> - **Player App:** NO screenshot upload screen. Players view match details, pick slots, see the 15-min countdown Room ID, and view the **Official Spectator Scoreboard**.
> - **Admin/Staff App:** Includes the **Spectator Match Scorer Console** (Staff inputs Booyah rank, verified kills, flags disqualified hackers, and hits 1-Click Payout).

---

```text
You are an Elite Principal Android Architect specializing in Kotlin, Jetpack Compose, Material 3, and White-Label Android Architecture.

The Node.js/TypeScript backend (Auth, Sub-Admin Staff, Tournaments, Redis Atomic Lock, Room ID T-15 lock, and Spectator Payouts) is 100% complete and passing with zero build errors.
Now we are building the Native Android client applications adhering to our Turnkey White-Label Delivery Engine (Zero Data Liability Model).

### CORE ARCHITECTURAL DIRECTIVES:
1. Multi-Module Project Structure:
   - `:app-player`: The Player/Gamer application (Tournament Feed, Interactive 48-Slot Picker, Timed Room ID Modal with countdown, Wallet, Official Match Scoreboard). NO screenshot upload screens.
   - `:app-admin`: The Client Owner & Staff application. Dynamic Jetpack Compose dashboard:
     * If user is `ADMIN`: Shows full analytics, match creation, staff management, wallet approvals.
     * If user is `SUB_ADMIN`: Checks granular permissions (`canCreateMatch`, `canUpdateRoomId`, `canDistributePrize`, `canManageWallet`) and renders ONLY permitted feature cards.
     * Includes **Spectator Scorecard Console** for Staff to enter official kills and ranks directly from the game.
   - `:core`: Shared Kotlin data classes, Retrofit/Ktor API client, DataStore session manager, and the White-Label Design System.

2. 10-Minute Re-Branding Engine (Play Store Safe):
   - A centralized `client_config.json` and Kotlin `ClientThemeConfig` that dynamically configures:
     * App Name & Application ID (`com.clientname.player` / `com.clientname.admin`)
     * Primary Color, Button Color, Accent Color, and Corner Radius (Sharp 4dp, Rounded 12dp, Pill 999dp)
     * Supabase URL & Anon Key
     * Firebase `google-services.json`
   - Play Store compliant naming (e.g. "Thunder eSports - Battle Royale Tournaments").

---

### YOUR MISSION FOR ANDROID PHASE 1:
Generate the production-ready Gradle build scripts, Multi-Module settings, and Core White-Label Design System in Kotlin.

#### 1. Root & Module Gradle Configuration:
- `settings.gradle.kts`: Includes `:app-player`, `:app-admin`, `:core`.
- `build.gradle.kts` (Root): Kotlin 2.x, Android Gradle Plugin, Compose compiler plugin, Google Services plugin.
- `core/build.gradle.kts`: Jetpack Compose, Material 3, DataStore, Retrofit/Moshi or Ktor, Coroutines.
- `app-player/build.gradle.kts` & `app-admin/build.gradle.kts`: Dependencies on `:core`.

#### 2. `:core` White-Label Design System & Tokens:
- `core/src/main/java/com/tourney/core/theme/ClientConfig.kt`:
  - Data class parsing `client_config.json` (appName, primaryColorHex, buttonColorHex, cornerRadiusDp, fontStyle).
- `core/src/main/java/com/tourney/core/theme/Theme.kt`:
  - Dynamic Material 3 `ColorScheme` generated from `ClientConfig`.
  - Dual OLED Deep Dark Theme & Clean Apple-style Light Theme support.
  - Custom CompositionLocals: `LocalClientConfig`, `LocalCardShape`, `LocalButtonShape`.

#### 3. `:core` Shared Models & Session Management:
- `core/src/main/java/com/tourney/core/model/User.kt` (id, phoneNumber, inGameName, inGameUid, role: ADMIN | SUB_ADMIN | USER, permissions).
- `core/src/main/java/com/tourney/core/model/Tournament.kt` (id, title, matchType, mapType, entryFee, prizePool, totalSlots, status, roomCredentials).
- `core/src/main/java/com/tourney/core/model/Scoreboard.kt` (rank, playerName, inGameUid, verifiedKills, prizeWon, isDisqualified).
- `core/src/main/java/com/tourney/core/datastore/SessionManager.kt`:
  - Jetpack DataStore saving JWT token, user role, and staff permission flags locally for instant offline/zero-delay dashboard rendering.

#### 4. Reusable Dynamic UI Components:
- `core/src/main/java/com/tourney/core/ui/AppButton.kt`: Primary action button that automatically applies client's color and corner radius with haptic click feedback.
- `core/src/main/java/com/tourney/core/ui/GlassCard.kt`: iOS-style glassmorphic card with subtle border and elevation.

---

### OUTPUT FORMAT:
Provide the file name clearly for each file, followed by the complete, typed Kotlin / Gradle Kotlin DSL code block with zero placeholders.
```
