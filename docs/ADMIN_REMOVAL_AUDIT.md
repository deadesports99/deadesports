# Admin Removal Audit — Review Before Deleting Anything

> **Status: READ-ONLY AUDIT. Nothing has been deleted.**
> Date: 2026-11-16 · Repo HEAD at audit time: `9fe4876` (+ uncommitted UI work)

---

## 1. What "admin" means in this repo

There are **two separate admin clients** sharing one backend:

| Client | Path | Size | LOC | Built/shipped by |
|---|---|---|---|---|
| Admin **Web** (browser console) | `admin-web/` | 141 MB (incl. node_modules) | ~11,000 | `Dockerfile` → `admin-web/dist` baked into image |
| Admin **Android** (owner app) | `android/app-admin/` | 335 MB (incl. build) | ~9,343 | `.github/workflows/android.yml` → APK artifact |

Both talk to the same Express API. `android/app-player` is the **player** app and never calls `/admin/*` endpoints (verified).

---

## 2. Dependency map (what is safe vs. dangerous)

### 2.1 Android — `:app-admin` module

**Depends on** `:core` (59 Kotlin files). 32 core symbols are shared with the player app.
**72 core symbols are admin-only.**

If `:app-admin` is deleted, these core symbols become dead code but **harmless**:

```
model/Auth.kt        → AdminDeposit, AdminDepositsResponse, AdminPaymentOrder,
                       AdminPaymentsResponse, AdminPlayer, AdminPlayerDetailPlayer,
                       AdminPlayersResponse, AdminWithdrawal, ApproveWithdrawalRequest,
                       AwardRequest, BanPlayerRequest, CancelMatchRequest,
                       CancelMatchResult, CloneTournamentRequest, CreateStaffRequest,
                       CreateTournamentRequest, DailySettlement, DeviceAccount,
                       DeviceBanRequest, DeviceGroup, DeviceGroupDetail,
                       DeviceGroupsResponse, DeviceSharedMatch, FinishMatchRequest,
                       FinishMatchResult, GoLiveResult, LinkedAccount, MatchParticipant,
                       MatchRosterResponse, ParticipantBanRequest, ParticipantFlag,
                       PaymentMoneySummary, PayoutAwardsRequest, PayoutRequest,
                       PayoutResponse, PayoutResultInput, PlayerDetailResponse,
                       PlayerHistorySummary, PlayerMatchHistory, PublishRoomRequest,
                       ReconcilePaymentResponse, RejectWithdrawalRequest, RoomRevealRequest,
                       StaffListResponse, StaffMember, StaffPermissions, SuspicionSignal,
                       SuspiciousPlayer, SuspiciousPlayersResponse, SweepResult,
                       UpdateStaffRequest, UpdateTenantSettingsRequest,
                       UpdateVisibilityRequest, WatchDeviceRequest, WatchedDevice,
                       WatchlistResponse, WithdrawalsResponse
ui/Formatters.kt     → formatDurationShort, formatIstDateTime,
                       formatIstDateWithWeekday, formatIstFullDateTime,
                       formatIstTimeOfDay, istEpochMs   ✅ VERIFIED admin-only
```

⚠️ **Must NOT delete from `:core`** (player uses them):

```
SessionState, ApiException, LoginRequest, MatchType, RoomCredentials, SlotEntry,
SlotsResponse, TenantSettings, Tournament, TournamentListResponse, TournamentStatus,
User, ApiClient, RealtimeEvent, TourneyRealtimeClient, apiCall, ClientConfig,
ClientTheme, ThemeMode, AppButton, AppTopBar, ErrorState, GlassCard, LoadingState,
StatusBadge, AuthAmbient, AuthLoginScreen, AuthOtpScreen, formatMatchTime, formatMoney,
TimeAuthority
```

⚠️ **Role enum must stay**: `Role.ADMIN` / `Role.SUB_ADMIN` are in `core/model/User.kt`
and the player app's `can()` logic depends on them.

### 2.2 Backend admin routes

| Mount | Router file | Safe to delete? |
|---|---|---|
| `/api/v1/auth/admin` | `adminAuth.routes.ts` | ✅ Yes — web login only |
| `/api/v1/admin/access` | `adminAuth.routes.ts` (adminAccessRouter) | ✅ Yes — staff keys |
| `/api/v1/admin/wallet` | `adminWallet.routes.ts` | ✅ Yes |
| `/api/v1/admin/tenant` | `tenant.routes.ts` (adminTenantRouter) | ✅ Yes (keep player `tenantRouter`) |
| `/api/v1/admin/players` | `adminPlayer.routes.ts` | ✅ Yes |
| `/api/v1/admin/matches` | `adminMatch.routes.ts` | ✅ Yes |

**Delete outright:**
- `src/services/adminAuth.service.ts` (580 LOC) — only used by adminAuth/adminAccess controllers + auth middleware staff-key check
- `src/controllers/adminAuth.controller.ts`, `adminAccess.controller.ts`
- `src/services/audit.service.ts` — only consumer is `adminAuth.service.ts`

### 2.3 ⚠️ MIXED FILES — deleting these breaks the player app

| File | Contains | Action |
|---|---|---|
| `src/routes/tournament.routes.ts` | player join/list **AND** admin create/clone/cancel/go-live/sweep/visibility | **Surgically remove admin routes only**, keep player routes |
| `src/routes/wallet.routes.ts` | player wallet **AND** admin deposit/withdrawal handlers | **Surgical** |
| `src/routes/media.routes.ts` | `requireRole('ADMIN','SUB_ADMIN')` on `/media/config` + `/media/upload` | **Surgical** — ✅ verified: no Android caller, admin-web only |
| `src/routes/tenant.routes.ts` | `tenantRouter` (player) + `adminTenantRouter` | Delete only `adminTenantRouter` |
| `src/controllers/deposit.controller.ts` | used by both wallet + adminWallet | **KEEP** |
| `src/controllers/withdrawal.controller.ts` | used by both | **KEEP** |
| `src/middlewares/auth.middleware.ts` | `requirePermission`, `requireRole`, staff-key check | **KEEP** (player routes use `requirePermission`) |
| `src/utils/cookies.ts` | `ADMIN_SESSION_COOKIE` | Remove only the admin cookie helper |

### 2.4 Database (Prisma)

| Model | Decision |
|---|---|
| `StaffAccessKey` | Admin-only — **can drop** (needs migration + data decision) |
| `AdminAuditLog` | Admin-only — **can drop** |
| Everything else | Used by player app — **keep** |

> ⚠️ Dropping tables is irreversible. Recommend: stop writing first, keep the tables for
> 30 days, then drop. Migrations live in `backend/prisma/migrations/`.

### 2.5 Env vars (`.env.example`, `render.yaml`)

Admin-only, removable:
```
ADMIN_SESSION_TTL_HOURS, ADMIN_WEB_ORIGIN, SERVE_ADMIN_WEB, ADMIN_WEB_DIST, ADMIN_OTP_DAILY_CAP
```
`ADMIN_OTP_DAILY_CAP` is **admin-only** (✅ verified: only `adminAuth.service.ts` reads it),
so it is safe to remove together with admin auth.
`ADMIN_SESSION_TTL_HOURS`, `ADMIN_WEB_ORIGIN`, `SERVE_ADMIN_WEB`, `ADMIN_WEB_DIST` — also admin-only.

### 2.6 Build / deploy / CI

| File | Admin reference | Action |
|---|---|---|
| `Dockerfile` | Stage 1 builds `admin-web`, copies to `/app/admin-web/dist`, sets `SERVE_ADMIN_WEB` | Remove stage 1 + env |
| `render.yaml` | `ADMIN_WEB_DIST=/app/admin-web/dist` | Remove |
| `.github/workflows/android.yml` | `:app-admin:assembleDebug`, `:app-admin:lintDebug`, APK + lint artifact uploads | Remove those lines |
| `android/settings.gradle.kts` | `include(":app-admin")` | Remove line |
| `backend/src/app.ts` | imports + mounts + static serving + SPA fallback | Remove those blocks |

### 2.7 Tests

44 test files total. Admin-specific:
```
tests/adminApi.e2e.test.ts     ← delete
tests/adminAuth.test.ts        ← delete
tests/accessKey.test.ts        ← delete (staff keys)
```
Partial admin coverage inside shared tests (keep, adjust instead of delete):
`api.e2e.test.ts`, `authFlows.test.ts`, `authService.test.ts`, `cancelRefund.test.ts`,
`csrfOriginGate.test.ts`, `csvExport.test.ts`, `depositService.test.ts`, `emailProvider.test.ts`

### 2.8 Docs & tooling

Files mentioning admin (delete or archive):
`docs/ADMIN_WEB_ACCESS.md`, `docs/ADMIN_WEB_AUTH.md`, `docs/DEV-CONSOLE.md`,
`plan/admin-web/*` (5 files), `HANDOVER_MANUAL.md`, `DEPLOYMENT.md`, `LOCAL_DEV.md`,
`README.md`, `agent.md`, `android/README.md`, `clients/_template/README.md`,
`render.yaml`, `Dockerfile`, `START-DEV-CONSOLE.bat`, `admin-web/README.md`

---

## 3. THE BIG QUESTION (blocking)

**Web admin console is the only working admin UI right now.**

- Android `:app-admin` exists but you said you're moving to the web console.
- If you delete **both** admin clients, **nobody can create matches, approve withdrawals,
  pay prizes, ban players, or change tenant settings** — those API endpoints would be
  unreachable and the product cannot be operated.

So a decision is required:

| Option | What gets deleted | Result | Risk |
|---|---|---|---|
| **A. Delete Android `:app-admin` only** | `android/app-admin/`, gradle include, CI admin lines, admin-only core models | Web console stays the admin tool | Low ✅ |
| **B. Delete `admin-web` only** | `admin-web/`, Docker stage 1, SERVE_ADMIN_WEB, static serving | Android owner app stays | Low-Med |
| **C. Delete both + keep API** | Both UIs, all admin routes | **No admin UI exists** | ⚠️ Product inoperable |
| **D. Delete both + player gets admin features** | Both UIs + admin routes | Requires building admin into player app first — **not done today** | ⚠️ Large new work |

---

## 4. Recommended safe sequence (once option chosen)

1. **Freeze**: stop deploying the client(s) being removed.
2. Remove the **UI client** first (lowest risk). Verify player app build + backend tests still pass.
3. Remove **backend admin routes** one router at a time; run the test suite after each.
4. Leave DB tables + audit logs untouched for 30 days.
5. Remove **env vars / Docker / CI** references.
6. Archive docs into `docs/archive/`.
7. Final: `npm test` (backend), `./gradlew :app-player:assembleDebug` (Android), `docker build`.

---

## 5. Verification commands (run before/after each step)

```bash
# Backend still compiles and tests pass
cd backend && npx tsc --noEmit && npm test

# Player app still builds
cd android && ./gradlew :app-player:assembleDebug

# No dangling imports
grep -rn "app-admin" android/ --include=*.kts --include=*.gradle
grep -rn "admin-web\|SERVE_ADMIN_WEB" --include=*.ts --include=Dockerfile .
```

---

## 6. Open risks

1. **`tournament.routes.ts` is mixed** — careless deletion breaks `POST /tournaments/:id/join`.
2. **`deposit`/`withdrawal` controllers are shared** — keep them.
3. **`Role.ADMIN` in `core/model/User.kt`** — player code references it; do not remove the enum.
4. **DB tables** — dropping is irreversible; keep data 30 days.
5. **`.env` `ADMIN_OTP_DAILY_CAP`** — ✅ verified admin-only; safe to remove with admin auth.
6. **`media.routes.ts`** admin-gated uploads — ✅ verified admin-web only; player does not call them.
