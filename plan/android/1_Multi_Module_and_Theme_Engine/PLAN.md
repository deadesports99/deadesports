# 📱 Android Phase 1: Multi-Module Architecture & White-Label Theming Engine

> **Target Goal:** Multi-Module Android Setup (`:app-player`, `:app-admin`, `:core`) with Centralized Dynamic White-Label Design System  
> **Location:** `C:\Free Fire turnament\android\`  
> **Status:** ✅ COMPLETED (verified: debug APKs + R8 release APKs, build-clean)
> **Audited By:** Antigravity Architect  
> **Delivery Model:** Turnkey Standalone Model (10-Minute Client Rebranding & Zero Data Liability)

---

## 📋 Phase 1 Step-by-Step Checklist (Order-Wise)

### 🔹 Stage 1: Multi-Module Project Architecture & Gradle Configuration
- [x] **1.1 Root `settings.gradle.kts`:** Include `:app-player`, `:app-admin`, and `:core` with centralized dependency resolution management (Google + MavenCentral via version catalog `gradle/libs.versions.toml`).
- [x] **1.2 Root `build.gradle.kts`:** AGP 8.10.1 + Kotlin 2.1.20 + Compose Compiler plugin declared (apply false per module). Google-Services plugin reserved for Supabase/Firebase Phase 2 (not yet needed).
- [x] **1.3 Shared `:core/build.gradle.kts`:**
  - Android library, compileSdk 36 / minSdk 24 / Java 17.
  - Jetpack Compose Material 3 (BOM 2024.12.01), Foundation, UI, Tooling.
  - Jetpack DataStore Preferences (session), Kotlin Coroutines.
  - Moshi (JSON) + Retrofit/OkHttp (client) + `org.json` for `client_config.json`.
  - **IMPORTANT (AGP 8.4+):** library `release` uses `isMinifyEnabled = false` + `consumerProguardFiles` — library must NOT self-minify or R8 strips app-used classes ("Missing classes detected"). The app's R8 minifies app+library together.
- [x] **1.4 `:app-player/build.gradle.kts`:** applicationId + app label read at build-time from `src/main/assets/client_config.json` (JsonSlurper) → per-client package identity.
- [x] **1.5 `:app-admin/build.gradle.kts`:** same dynamic applicationId mechanism, admin identity.
- [x] **1.6 `gradle.properties`:** AndroidX enabled, R8 full-mode (AGP 8 default), parallel builds, build cache, non-transitive R class.

---

### 🔹 Stage 2: Centralized White-Label Design System & Tokens (`:core`)
- [x] **2.1 `client_config.json` Specification:** packaged in BOTH apps — `client_name`, `application_id`, `app_name`, `primary_color`, `button_color`, `accent_color`, `corner_radius_dp` (4 Sharp / 12 Rounded / 999 Pill), `font_style`, `enable_dark_mode`, `api_base_url`, `supabase_url`, `supabase_anon_key`.
- [x] **2.2 `ClientConfig.kt` Parser:** `ClientConfig.load(context)` reads asset with org.json, `DEFAULT` fallback (Thunder eSports, #FF5722, 12dp).
- [x] **2.3 Dynamic Theme & Color Tokens (`Theme.kt`):** dynamic Material 3 `ColorScheme` from client hexes; OLED Deep-Dark + Light schemes honouring `enableDarkMode`; `CompositionLocal`s `LocalClientConfig` / `LocalCardShape` / `LocalButtonShape`. (Color tokens live in Theme.kt; a separate Color.kt not required.)
- [x] **2.4 Shape & Typography Hierarchy:** corner radius mapping (Sharp/Rounded/Pill) to card+button shapes; typography mapping (rajdhani/orbitron/poppins/inter) → SansSerif stub until Google Fonts land in Android Phase 2.

---

### 🔹 Stage 3: Shared Core Models & Local Session DataStore (`:core`)
- [x] **3.1 Domain Models:**
  - `User.kt`: `id`, `phoneNumber`, `inGameName`, `inGameUid`, `role` (`ADMIN`/`SUB_ADMIN`/`USER`), permission booleans `canCreateMatch`/`canUpdateRoomId`/`canDistributePrize`/`canManageWallet`, tenantId, adminId, isBanned + `can(perm)` helper.
  - `Tournament.kt`: `id`, `title`, `gameMode`, `matchType`, `mapType`, `entryFee`, `prizePool`, `perKillPrize`, `totalSlots` (48), `matchTime`, `status`, `slotsBooked`, `mySlot` + helpers (`entryFeeValue`, `secondsUntilRoomReveal` = T-15 min countdown); `SlotEntry`/`MySlot`/`RoomCredentials` included.
  - `Scoreboard.kt`: Official Spectator Scorecard model (`rank`, `playerName`, `inGameUid`, `verifiedKills`, `prizeWon`, `isDisqualified`) + PayoutEntry.
- [x] **3.2 Jetpack DataStore Session Manager (`SessionManager.kt`):**
  - `Flow<SessionState>` (JWT, userId, tenantId, role, permissions) — zero-delay offline dashboard rendering.
  - `saveSession(...)` / `clearSession()` / `current()`.
  - NOTE: plain Preferences DataStore for Phase 1 (not yet EncryptedSharedPreferences — AndroidX security-crypto upgrade deferred).

---

### 🔹 Stage 4: Reusable Dynamic UI Components (`:core`)
- [x] **4.1 `AppButton.kt`:** brand-color button (auto shape from `localButtonShape`), haptic click feedback. (Loading/spinner state → Phase 2 async screens.)
- [x] **4.2 `GlassCard.kt`:** glassmorphic card — translucent surfaceVariant bg, 1dp outline stroke, client corner radius, shadow.
- [ ] **4.3 `AppTopBar.kt`:** Phase 2 — brand title, wallet balance chip, back actions.
- [ ] **4.4 `StatusBadge.kt`:** Phase 2 — lifecycle color chips (OPEN/SLOTS_FULL/ROOM_REVEALED/LIVE/COMPLETED).

---

### 🔹 Stage 5: Verification & Anti-Fraud Architecture Alignment
- [x] **5.1 Zero Screenshot Policy Check:** verified — `grep screenshot|pickImage|ActivityResultContracts|MediaStore` in `:app-player` returns ZERO hits; no image-picker/screenshot UI anywhere.
- [x] **5.2 Spectator Workflow Readiness:** `:app-admin` comes with a permission-driven dynamic dashboard (ADMIN = all 4 cards; SUB_ADMIN = only granted cards; USER = blocked). Staff Spectator Console screen lands in Phase 2.
- [x] **5.3 10-Minute Rebranding Verification:** PROVEN — edited only `app-player/.../client_config.json` (name/package/color/radius) → 19s incremental rebuild → `aapt2 dump badging` shows `com.rajff.player` / label `Raj FF Club`. Reverted to `com.thunderesports.player`.

---

## ✅ Verified Build Artifacts (Gradle 8.11.1 + AGP 8.10.1 + Kotlin 2.1.20, offline-cache)

| Artifact | Size | Notes |
| --- | --- | --- |
| `android/app-player/build/outputs/apk/debug/app-player-debug.apk` | ~18.5 MB | install-on-device demo build |
| `android/app-admin/build/outputs/apk/debug/app-admin-debug.apk` | ~18.5 MB | install-on-device demo build |
| `android/app-player/build/outputs/apk/release/app-player-release-unsigned.apk` | ~1.4 MB | R8 shrink+obfuscate (debug 18.5 MB → release 1.4 MB) |
| `android/app-admin/build/outputs/apk/release/app-admin-release-unsigned.apk` | ~1.4 MB | R8 shrink+obfuscate |

**Toolchain gotchas recorded:** library modules must keep `isMinifyEnabled = false` (AGP 8.4+ R8 "Missing classes" bug); SDK path via `android/local.properties` (`sdk.dir=C:/Users/Jay Kumar/AppData/Local/Android/Sdk`).

---

## 📌 Progress Tracker & History Log

| Date | Step | Action Taken | Status |
| :--- | :--- | :--- | :--- |
| 01-Nov-2026 | Plan Setup | Android Phase 1 plan created with complete multi-module checklist | ✅ Done |
| 01-Nov-2026 | Execution | All 14 files of Gradle build system + `:core` (theme/models/session/UI) + 2 app shells written | ✅ Done |
| 01-Nov-2026 | Build Fix | `sdk.dir` local.properties added; Theme.kt `CornerBasedShape` type fix; admin imports fixed | ✅ Done |
| 01-Nov-2026 | Release Fix | library self-minify disabled (`isMinifyEnabled=false` + consumer rules) — R8 "Missing classes" resolved | ✅ Done |
| 01-Nov-2026 | Verification | Debug + Release APKs built for both apps; rebranding proven live (19s, com.rajff.player) | ✅ Done |
