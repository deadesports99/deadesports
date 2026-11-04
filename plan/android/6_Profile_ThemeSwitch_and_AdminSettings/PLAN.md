# 📱 Phase 6: Security Hardening, Player Profile, Dual-Theme & Admin Settings

> **Target Goal:** Implement Security Hardening from Roadmap (Multi-Account Device Lock, Rate Limiting, Emulator Detection), Player Profile Screen (FF UID/IGN/Stats), Dual-Theme Switcher (Boss Demand: "Light mode dark mode rakhna"), Feed Filters, Admin Match Cancel & Refund, and Runtime Settings Console.  
> **Location:** `C:\Free Fire turnament\android\` & `C:\Free Fire turnament\backend\`  
> **Status:** ✅ COMPLETE (verified on a physical device, 02 Nov 2026)  
> **Audited By:** Antigravity Architect  

---

## 📋 Phase 6 Step-by-Step Checklist

### 🔹 Stage 1: Security Hardening & Anti-Fraud Engine (Roadmap Pillar)
- [x] **1.1 Anti-Multi-Account Device Lock (`backend/src/services/auth.service.ts`):**
  - Check `deviceId` (Android ID) on player registration.
  - Strict Rule: Maximum 1 account allowed per physical device per tenant (`403 Forbidden: Tournament security policy allows only 1 account per physical device`).
  - Prevents collusion, kill-feeding, and fake account seat-blocking.
- [x] **1.2 Rate Limiting on Sensitive Endpoints (`backend/src/middlewares/rateLimiter.ts`):**
  - Express/in-memory or Redis sliding window rate-limiter:
    - Auth Login / Register: Max 5 requests / min per IP.
    - UTR Deposit Submission: Max 3 requests / min per user.
    - Slot Booking: Max 10 requests / min per user.
    - Withdrawal Requests: Max 2 requests / min per user.
- [x] **1.3 Android Emulator & Root Detection (`com.tourney.core.security.SecurityChecker`):**
  - Checks `Build.FINGERPRINT`, `Build.HARDWARE`, `Build.MANUFACTURER` (detecting BlueStacks, Nox, LDPlayer, Genymotion, QEMU).
  - Displays "Emulator Blocked: Tournaments must be played on physical mobile devices for fair competition".
  - Basic root detection (presence of `su` binary in `/system/bin` or test-keys).

---

### 🔹 Stage 2: Player Profile Screen & Dual Theme Switcher (`:app-player`)
- [x] **2.1 Dedicated Player Profile Tab (`ProfileScreen.kt` in `:app-player`):**
  - Add 3rd bottom navigation tab: `[ Matches | Wallet | Profile ]`.
  - Player Identity Card:
    - Free Fire In-Game Name (IGN) with quick-copy icon.
    - Free Fire UID with quick-copy icon.
    - Registered Phone number.
    - Device Trust Badge ("Verified Mobile Device").
  - Career Statistics Grid:
    - Matches Joined / Played count.
    - Total Winnings Won (₹).
    - Total Kills count.
  - Quick Actions:
    - 💬 WhatsApp Customer Support (`https://wa.me/<number>`) button.
    - 🌓 **In-App Theme Switcher:** `[ 🌙 OLED Dark | ☀️ Clean Light ]` toggle (Persists in `DataStore` and instantly switches without app restart).
    - 🚪 Logout Action (with confirmation dialog + disk cache wipe).

---

### 🔹 Stage 3: Tournament Feed Category Filters & History (`:app-player`)
- [x] **3.1 Feed Filter Chips (`TournamentFeedScreen.kt`):**
  - Mode selector chips: `[ All | Solo | Duo | Squad ]`.
  - Status tabs: `[ Active & Live | Completed History ]`.
  - Completed tab allows players to browse past tournaments and inspect past Official Scoreboards anytime.

---

### 🔹 Stage 4: Admin Match Operations & 1-Click Cancellation (`:app-admin`)
- [x] **4.1 Match Operations in Admin Dashboard (`AdminMatchManagerScreen.kt`):**
  - View all scheduled/live matches with their slot fill count.
  - 🔄 **"⚡ Sweep Lifecycle Now"** button (triggers backend state sweep manually).
  - 🛑 **"Cancel Match & Refund All"** button:
    - Calls `POST /api/v1/tournaments/:id/cancel`.
    - Shows confirmation dialog ("This will refund all 48 player entry fees atomically").
    - Updates match status to `CANCELLED` and broadcasts `MATCH_CANCELLED` push.

---

### 🔹 Stage 5: Admin Settings Console (Runtime UPI & Support Update)
- [x] **5.1 Backend Tenant Settings Endpoint:**
  - `GET /api/v1/admin/tenant/settings` -> Returns current tenant details (`brandName, upiId, upiName, supportWhatsapp, minDeposit`).
  - `PATCH /api/v1/admin/tenant/settings` -> Guarded by `requireRole('ADMIN')`. Allows Organizer to update UPI ID, UPI Name, and WhatsApp support number at runtime.
- [x] **5.2 Admin Settings Screen (`AdminSettingsScreen.kt` in `:app-admin`):**
  - Dashboard card: "⚙️ App Settings (Owner Only)".
  - Form to update:
    - Official UPI ID (e.g. `client@okaxis`) — updates Deposit QR code instantly without APK recompile!
    - Official UPI Payee Name.
    - WhatsApp Support Number.
  - Save Changes button with instant feedback.

---

### 🔹 Stage 6: Compilation & Verification
- [x] **6.1 Backend compilation test:** `npm run build` passing with 0 TypeScript errors.
- [x] **6.2 Android compilation test:** `./gradlew :app-player:assembleDebug :app-admin:assembleDebug` passing with 0 errors.
- [x] **6.3 End-to-End Verification:**
  - Test device lock (attempt registering 2nd account with same deviceId -> 403).
  - Test rate limiting on login and deposit endpoints.
  - Toggle Light/Dark mode in Player app.
  - Cancel a test match from Admin app and verify automatic wallet refund.
  - Update UPI ID in Admin Settings and verify Deposit QR reflects new UPI ID.

---

## ✅ Verification Log (02 Nov 2026)

### Backend — `npm run build` → 0 TypeScript errors
- `prisma/schema.prisma`: `Tenant` gained `upiName`, `supportWhatsapp`, `minDeposit` (default ₹10); `prisma db push` synced.
- **New** `services/tenant.service.ts` + `controllers/tenant.controller.ts` + `routes/tenant.routes.ts`:
  - `GET /api/v1/tenant/settings` — any logged-in user (drives the player QR / support / min deposit).
  - `GET /api/v1/admin/tenant/settings` — ADMIN.
  - `PATCH /api/v1/admin/tenant/settings` — ADMIN, validates UPI (`name@bank`), payee name 2-60 chars, WhatsApp 10-15 digits (empty = clear), min deposit ₹10-₹10 000.
- **New** `services/player.service.ts` + `routes/player.routes.ts`: `GET /api/v1/players/me/stats` → `{ matchesJoined, matchesPlayed, booyahs, totalKills, totalWinnings, bestRank }`, all derived live from slots + verified results.
- `services/deposit.service.ts` now enforces the **tenant** minimum deposit (`resolveMinDeposit`) instead of a hardcoded ₹10.
- `app.ts` mounts `/api/v1/tenant`, `/api/v1/admin/tenant`, `/api/v1/players`.

### Android — `assembleDebug` ✅ and `assembleRelease` (R8) ✅ for both apps
- `:core`: `ThemeMode` (SYSTEM/DARK/LIGHT) persisted in `SessionManager` (survives logout + restart), `TenantSettings` / `PlayerStats` / `SweepResult` / `CancelMatchResult` / `CancelMatchRequest` models, 7 new Retrofit endpoints.
- `:app-player`: **Profile tab** (`ProfileScreen.kt`) — identity card with copy-to-clipboard IGN/UID/phone, career stats grid, 🌙/☀️/🔄 appearance switcher, WhatsApp support, logout dialog + cache wipe. Feed gained `[🔥 Active & Live | 🏁 Completed]` tabs plus `[All | Solo | Duo | Squad]` chips; completed cards open the official scoreboard. Add-Cash modal reads the **live** UPI/payee/minimum and derives its quick chips from the tenant minimum. Theme is applied at `MainActivity` level (`ClientTheme(darkTheme = mode.isDark(systemDark))`).
- `:app-admin`: **Manage Matches** (`AdminMatchManagerScreen.kt`) with ⚡ Sweep Lifecycle Now, per-match seat fill, 🛑 Cancel & Refund (reason dialog → `POST /tournaments/:id/cancel`) and refund feedback; **App Settings** (`AdminSettingsScreen.kt`) for UPI ID / payee / WhatsApp / min deposit + the shared appearance switch. Dashboard cards added for both (Manage Matches gated by `canCreateMatch`, App Settings owner-only) and the whole card is now clickable.

### Device verification (physical Android 1080×2400, `adb reverse tcp:5000`)
| Check | Result |
| --- | --- |
| Feed tabs + mode chips render, bottom nav has 3 tabs | ✅ |
| Profile: IGN/UID/phone copy rows, career stats (Matches 1, live from API) | ✅ |
| 🌙 Dark → ☀️ Light switch applies instantly, no restart | ✅ |
| Light mode survives force-stop + relaunch | ✅ |
| Admin dashboard shows 7 cards incl. Manage Matches + App Settings | ✅ |
| App Settings prefill from DB (upi/payee/WhatsApp/min ₹10) | ✅ |
| Change min deposit → Save → “✅ Saved — the Player app QR & support link update instantly.” | ✅ |
| DB updated (`minDeposit 100`) and Player Add-Cash modal immediately showed ₹100 + chips +QR | ✅ |
| Cancel flow: dialog with reason → “✅ Match cancelled — ₹10.00 refunded to 1 player(s)”, badge CANCELLED, button disabled | ✅ |
| Wallet after cancel: deposit balance back to ₹500, ledger row `REFUND 10.00` | ✅ |
| ⚡ Sweep now → “✅ Nothing due — all matches already up to date.” | ✅ |
| 🏁 Completed tab → “Completed (0)” empty state with Refresh History | ✅ |

`scripts_phase6.ts` → **16/16 API checks passed** (settings read/write + role guards + validation, player stats, sweep/cancel route guards), and it restores the tenant settings at the end.
