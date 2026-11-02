# 📱 Android & Backend Phase 4: Deposit Top-Up, State-Machine Sweep & High-Res Asset Integration

> **Target Goal:** Add Cash / UPI Deposit Flow (Dynamic QR & UTR), Match Lifecycle Auto-Sweep (UPCOMING → ROOM_REVEALED → LIVE → UNDER_REVIEW → COMPLETED/REFUND), High-Res Free Fire Asset Injection, and Pull-to-Refresh  
> **Location:** `C:\Free Fire turnament\android\` & `C:\Free Fire turnament\backend\`  
> **Status:** ✅ COMPLETED & VERIFIED (build + API smoke test passing)  
> **Audited By:** Antigravity Architect  
> **Source Assets:** `C:\Free Fire turnament\ui-ux demo\free fire assests\`

---

## 📋 Phase 4 Step-by-Step Checklist

### 🔹 Stage 1: Free Fire High-Res Asset Injection (`:core` & `:app-player`)
- [x] **1.1 Map Banners Mapping (`TournamentGlassCard`):**
  - Match cards par dynamic map thumbnail load karna according to `mapType`:
    - `BERMUDA` → `bermuda_map_overview.jpeg` / `bermuda_app_splash.jpg`
    - `PURGATORY` → `purgatory_map_overview.png`
    - `KALAHARI` → `kalahari_map_overview.png`
    - `ALPINE` → `alpine_map_overview.jpeg`
    - `NEXTERRA` → `nexterra_map_overview.jpeg`
- [x] **1.2 Mode Banner Badges:**
  - `CLASH_SQUAD` matches par Clash Squad mode badge banner (`clash_squad_mode_splash.png`).
  - `BATTLE_ROYALE` par Ranked mode badge (`ranked_mode_splash.png`).
- [x] **1.3 Currency Icons (`WalletScreen`):**
  - Rupee symbol ke sath official Free Fire Diamond (`diamond_currency.png`) aur Gold Coin (`golden_coin.png`) micro-icons inline display.

---

### 🔹 Stage 2: Player Deposit Flow (Add Cash via UPI)
- [x] **2.1 Backend Deposit Endpoints:**
  - `model DepositRequest` in `prisma/schema.prisma` (`id, tenantId, userId, amount, utrNumber, status: PENDING/APPROVED/REJECTED, createdAt`).
  - `POST /api/v1/wallet/deposit` (Player submits amount + 12-digit UTR).
  - `GET /api/v1/admin/wallet/deposits` (Staff lists pending deposits, gated by `canManageWallet`).
  - `POST /api/v1/admin/wallet/deposits/:id/approve` (Credits player's `depositBalance` via double-entry ledger category `ADD_MONEY`).
  - `POST /api/v1/admin/wallet/deposits/:id/reject` (Rejects request with optional reason).
- [x] **2.2 Player Deposit Modal (`DepositModal.kt` in `:app-player`):**
  - Quick amount selector chips (+₹50, +₹100, +₹200, +₹500).
  - Dynamic UPI QR Code display (Generated using client's UPI ID from `client_config.json`).
  - Deep-link button: "Pay via UPI App" (`upi://pay?pa=...&pn=...&am=...&cu=INR`) opening GPay/PhonePe/Paytm.
  - 12-digit UTR input field + validation + "Submit for Verification".
- [x] **2.3 Admin Deposit Approval Tab (`AdminWalletScreen.kt` in `:app-admin`):**
  - Secondary tab "Deposits" alongside "Withdrawals".
  - Shows player IGN, UID, Phone, Amount, and UTR number.
  - 1-Click "Approve & Credit Balance" and "Reject".

---

### 🔹 Stage 3: Match State-Machine Sweep & Auto-Refund Engine
- [x] **3.1 Match State Sweep Worker (`matchSweep.service.ts` in `backend`):**
  - Scheduled or trigger-based state sweep:
    - If `currentTime >= matchTime - 15min` and `status == OPEN/SLOTS_FULL` → `ROOM_REVEALED` (sends FCM alert).
    - If `currentTime >= matchTime` and `status == ROOM_REVEALED` → `LIVE`.
- [x] **3.2 Match Cancellation & Auto-Refund (`POST /api/v1/tournaments/:id/cancel`):**
  - Admin/Manager can cancel match.
  - Automatically iterates over all booked slots and refunds `entryFee` back to `depositBalance` of all joined players in a single database transaction.
  - Sends FCM notification `MATCH_CANCELLED` to all participants.

---

### 🔹 Stage 4: Pull-to-Refresh & Network Reliability
- [x] **4.1 Swipe Pull-to-Refresh:**
  - Compose `PullToRefreshBox` in `TournamentFeedScreen`, `WalletScreen`, and `AdminDashboardScreen`.
- [x] **4.2 Empty & Error States:**
  - Cupertino-grade empty cards when no matches are scheduled ("No matches found. Pull down to refresh").

---

### 🔹 Stage 5: Multi-Module Compilation & Verification
- [x] **5.1 Backend build test:** `npm run build` passing with 0 TypeScript errors.
- [x] **5.2 Android build test:** `./gradlew assembleDebug` and `assembleRelease` passing.

---

## ✅ Phase 4 Verification Log (executed)

**Backend**
- `npm run build` → 0 TypeScript errors.
- `npx prisma db push` → `DepositRequest` table + `DepositStatus` enum live in Supabase.
- Live API smoke test (19/19 passed): submit deposit → PENDING, 12-char UTR validation,
  min ₹10 guard, duplicate-UTR 409, player blocked from admin queue (403), admin approve
  credits `depositBalance` + writes `ADD_MONEY / CREDIT / DEPOSIT` ledger row, double-approve
  blocked (409, no double credit), reject path stores reason and credits nothing.
- Match sweep smoke test (6/6 passed): T-15 window → `ROOM_REVEALED` (+`roomRevealedAt`),
  kickoff → `LIVE`, second sweep is a no-op (idempotent), player blocked from sweep (403).
- Cancel + auto-refund: entry fee returned to the exact balance it was debited from.

**Android**
- `./gradlew :app-player:assembleDebug :app-admin:assembleDebug` → BUILD SUCCESSFUL
  (player 23.3 MB / admin 23.0 MB).
- `./gradlew :app-player:assembleRelease :app-admin:assembleRelease` (R8 + shrink) →
  BUILD SUCCESSFUL (player 5.27 MB / admin 2.13 MB).
- Note: the source artwork in `ui-ux demo/free fire assests/` is WebP data with `.png/.jpeg`
  extensions; files were copied into `:core/res/drawable` with the correct `.webp` extension
  (AAPT2 rejects mismatched signatures in release builds).

**New endpoints**
| Method | Path | Guard |
| --- | --- | --- |
| POST | `/api/v1/wallet/deposit` | player (amount + 12-char UTR → PENDING) |
| GET | `/api/v1/wallet/deposits` | player (own request history) |
| GET | `/api/v1/admin/wallet/deposits` | `canManageWallet` |
| POST | `/api/v1/admin/wallet/deposits/:id/approve` | `canManageWallet` (credits balance) |
| POST | `/api/v1/admin/wallet/deposits/:id/reject` | `canManageWallet` |
| POST | `/api/v1/tournaments/sweep/states` | `canCreateMatch` (manual sweep trigger) |

> In-process sweep scheduler runs every 60s from `server.ts` (`matchSweep.service.ts`), so the
> lifecycle advances even when no client is polling.
