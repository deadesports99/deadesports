# TourneyFF — Android Multi-Module (Kotlin + Jetpack Compose)

White-label Free Fire tournament platform — native Android client apps built on the
100% complete Node/TS backend (`../backend`).

## Modules

| Module | App | Purpose |
| --- | --- | --- |
| `:app-player` | Player APK | Tournament Feed, 48-slot picker, T-15 min Room ID countdown, wallet, Official Spectator Scoreboard (Phase 2 screens) |
| `:app-admin` | Owner/Staff APK | Permission-driven dynamic dashboard (ADMIN = all, SUB_ADMIN = granted cards); Spectator Scorecard Console (Phase 2) |
| `:core` | Shared library | White-label theming (`ClientConfig`/`Theme`), domain models, DataStore `SessionManager`, `AppButton`/`GlassCard` UI kit |

## Toolchain (verified builds)

- Gradle **8.11.1** (wrapper included) · AGP **8.10.1** · Kotlin **2.1.20** · Compose BOM **2024.12.01**
- compileSdk 36 · minSdk 24 · Java 17 (OpenJDK 21 runs Gradle)
- SDK path: `android/local.properties` → `sdk.dir=C:/Users/Jay Kumar/AppData/Local/Android/Sdk`

## Build

```bash
cd android
./gradlew :app-player:assembleDebug :app-admin:assembleDebug    # demo APKs
./gradlew :app-player:assembleRelease :app-admin:assembleRelease # R8 release (unsigned)
```

Artifacts: `app-player/build/outputs/apk/{debug,release}/`, same for `app-admin`.
Debug ≈ 18.5 MB; R8 release ≈ 1.4 MB (shrink + obfuscate).

## ⚡ 10-Minute Client Rebranding (proven: 19 s rebuild)

Every client gets the same 3 files edited — **zero Kotlin changes**:

1. `app-player/src/main/assets/client_config.json`
2. `app-admin/src/main/assets/client_config.json`
3. Client logo → `res/mipmap/` (optional)

`client_config.json` drives EVERYTHING at build time (applicationId + app label via
`JsonSlurper` → `resValue`) and at runtime (colors, shapes, dark mode via `ClientConfig`).

```jsonc
{
  "client_name": "Thunder eSports",      // tenant branding
  "application_id": "com.thunderesports.player", // unique Play identity per client
  "app_name": "Thunder eSports",         // launcher label
  "primary_color": "#FF5722",            // theme primary
  "button_color": "#FF7043",
  "accent_color": "#FFB300",
  "corner_radius_dp": 12,                // 4 = Sharp · 12 = Rounded · 999 = Pill
  "font_style": "default",               // rajdhani | orbitron | poppins | inter
  "enable_dark_mode": true,
  "api_base_url": "http://10.0.2.2:5000/api/v1" // emulator → host backend
}
```

Live proof from Phase 1: changed only the player config → 19 s incremental rebuild →
`aapt2 dump badging` showed package `com.rajff.player` + label `Raj FF Club`.

## Anti-fraud architecture alignment (boss demand)

- **Zero screenshot policy:** `:app-player` contains NO screenshot/image-picker/upload
  UI (grep-verified) — results come from the official **Staff Spectator Scoreboard**.
- **Dynamic role dashboards:** `SessionManager` caches JWT + role + permission booleans
  in DataStore → admin app renders the exact cards a SUB_ADMIN is allowed, instantly,
  offline, cold-start.
- **Per-client Play identity:** distinct package names per account = decentralized Play
  Console accounts (see `../plan/PLAYSTORE_WHITELABEL_RESEARCH.md`); "Free Fire" never
  appears in app names — Garena trademark.

## Gotchas on record

- AGP 8.4+ minifies *local library* deps inside the app's R8 run — a library module must
  keep `isMinifyEnabled = false` (+ `consumerProguardFiles`) or R8 fails with
  `Missing classes ... com.tourney.core.*` ("Missing classes detected while running R8").
- `minSdk 24` needs the plain-vector launcher icon fallback in `res/mipmap/` alongside
  `mipmap-anydpi-v26` adaptive icons.
- Production APKs use the HTTPS API URL from `client_config.json`.
- Override it without editing branding files:
  `./gradlew :app-player:assembleDebug :app-admin:assembleDebug -PapiBaseUrl=https://api.example.com/api/v1`.
- Local emulator development can use `10.0.2.2:5000` through a local/debug
  override; production Android traffic remains HTTPS-only.

## Phase 2 (Done) — Full UI Flows + Retrofit API Layer

- `:core` networking: `TourneyApi` (12 endpoints), `AuthInterceptor` (Bearer from DataStore cache), `ApiClient` singleton (base URL + tenant from `client_config.json`), Moshi **codegen** DTOs (R8-safe, zero reflection), generic `ApiEnvelope<T>` + `ApiException` (parses `secondsUntilReveal` from the room-lock 403).
- `:app-player` screens: Login/Register (phone + IGN + UID), Tournament Feed (map/type badges, slot progress), 48-Seat Slot Picker (squad team-code create/join, leader code share + copy), Timed Room ID (T-15 countdown → copy creds), Official Spectator Scoreboard (hacker red banners), Wallet (deposit/winning + ledger history).
- `:app-admin` screens: login, permission-gated Dashboard (ADMIN all / SUB_ADMIN granted), Create Match (canCreateMatch), Publish Room (canUpdateRoomId), **Spectator Scorer Console** (canDistributePrize — kills steppers, ranks, hack flags, 1-click payout + confirm + summary).
- Backend addition: `GET /api/v1/wallet` (balances + double-entry ledger) to serve the WalletScreen.
- Builds verified: debug 18.0 MB both apps, R8 release 846 KB both apps, zero errors.

## Phase 3 (Done) — FCM Push + UPI Withdrawals + Realtime

- **FCM engine** (`:core/fcm/TourneyMessagingService`): high-priority channels for `ROOM_REVEALED` / `PRIZE_WON` / `MATCH_CANCELLED`; `onNewToken` syncs to `POST /auth/fcm-token`; notification tap deep-links to Room/Scoreboard. Backend `fcm.service.ts` (firebase-admin, graceful no-creds) fires alerts on room publish, payout, cancel.
- **Player withdrawals**: `WithdrawalModal` (UPI `handle@bank` regex, min ₹50, ≤ winning balance, `deviceId` fraud signal) → `POST /wallet/withdraw`; pending/approved/rejected shown in the ledger.
- **Admin approvals**: `AdminWalletScreen` gated by `canManageWallet` — list (IGN/UID/phone/amount/UPI), Approve (UTR) / Reject & auto-refund.
- **Realtime slots**: 5s lifecycle-aware polling in `SlotPickerScreen` + `GlowProgressBar` pulsing when ≥ 40/48 full.
- **`SlideToJoinButton`**: drag thumb, 80% threshold, haptic ticks + success buzz, shimmer prompt, auto-reset.
- Backend: `WithdrawalRequest` model + 5 endpoints, e2e-verified (withdraw/approve/reject/refund math exact, 403s correct).
- Builds verified: debug 18.3 MB both, R8 release 1.15-1.17 MB (firebase adds ~300 KB), zero errors.

## Phase 4 (next)

Per-client Firebase wiring for production push (per white-label client: `google-services.json` + backend `FCM_CREDENTIALS_JSON`), OTP auth, withdrawal list refresh on pull, deposit top-up via UPI/Razorpay, and the `UPCOMING → ROOM_OPEN → LIVE → VERIFICATION → COMPLETED` state-machine sweep.
