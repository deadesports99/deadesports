# Spartan Arena — Admin Console (`admin-web/`)

Private browser console for the owner (`ADMIN`) and staff (`SUB_ADMIN`). Same data,
same design language as the player app — dark navy, Spartan crest, gold primary
actions, IST timestamps, mobile bottom nav / desktop sidebar.

**Status: Phase 3 done** (shell + login + dashboard + permissions + realtime).
Phase 4–5 screens are linked as honest "Phase N" placeholders.

---

## Run it (fully local)

> Poora local setup, tenant ids aur Android APK steps: [`../LOCAL_DEV.md`](../LOCAL_DEV.md).

From the repo root, one command starts everything:

```bat
start-local.bat        :: Postgres + Redis (Docker) → backend :5000 → admin :5174
stop-local.bat         :: stops the Postgres/Redis containers
```

Or by hand:

```bash
# 0. Local DB (Postgres :5433, Redis :6379, Docker)
cd backend
docker compose -f docker-compose.dev.yml up -d
npx prisma db push     # first time
npm run seed           # demo tenant + players + 2 matches
npm run seed:owner     # deadesports99@gmail.com as ADMIN
npm run dev            # http://localhost:5000

# 1. Admin console
cd admin-web
npm install
npm run dev            # http://localhost:5174
```

> `backend/.env` currently points at the **local** Postgres
> (`postgresql://postgres:postgres@localhost:5433/freefire_tournament`).
> The previous hosted-Supabase env is preserved at `backend/.env.supabase.bak` —
> copy it back over `.env` and restart the backend to use the hosted DB.
> The frontend tenant id differs per DB, so update `VITE_TENANT_ID` too:
> local `53a09545-e6e2-4cf5-a5c2-7ef18b276a52`, Supabase
> `a3c11cd0-324e-4886-b27c-9667fd7f59dc`.

The dev server **must** stay on port `5174`: the backend CSRF gate allows
`ADMIN_WEB_ORIGIN` (default `http://localhost:5174`). Requests go through the Vite
proxy (`/api`, `/ws`) so the browser only ever talks to one origin — the
`admin_session` cookie stays host-only and no token exists in JS.

`.env` (already committed as `.env.example`):

```
VITE_API_URL=/api/v1
VITE_TENANT_ID=53a09545-e6e2-4cf5-a5c2-7ef18b276a52   # local Docker DB
```

Production build:

```bash
npm run build          # tsc --noEmit + vite build → dist/
npm run preview        # serve dist/ on :5174
```

Set `ADMIN_WEB_ORIGIN` (backend) to the deployed console origin in production.

---

## Login flow

| Who | Steps |
|---|---|
| **Owner (ADMIN)** | Owner tab → email → 6-digit OTP on that inbox → session |
| **Staff (SUB_ADMIN)** | Staff tab → **owner email** + 24-char permission key → OTP on the owner inbox → session |

- Backend contract: `POST /api/v1/auth/admin/otp/request` → `POST /auth/admin/otp/verify`
  (sets the httpOnly cookie) → `GET /api/v1/auth/me` on boot.
- Sign out: `POST /api/v1/auth/admin/logout` clears the cookie server-side.
- Any `401` anywhere fires `admin:unauthorized` → the console drops to the login screen.
- Revoking a staff key kills an active session on the very next request (verified).
- In development the OTP is shown in a dashed "DEV" chip (backend `debugOtp`);
  with `EMAIL_PROVIDER=console` it is also printed in the backend window;
  production returns no code and real email lands in Phase 6.

---

## Permissions

Four live booleans on `User` (`canCreateMatch`, `canUpdateRoomId`,
`canDistributePrize`, `canManageWallet`). `ADMIN` bypasses all of them, matching the
server (`requirePermission`).

- `src/lib/permissions.ts` holds the single source of truth: nav items, route access
  and `can(user, key)`.
- Nav, dashboard modules and route guards all read the same map — turning a
  permission off hides the card **and** redirects the URL on the next session refresh.
- The dashboard only calls wallet endpoints when `canManageWallet`, so read-only staff
  sessions produce no 403 spam and never display money queues.

---

## Layout / responsiveness

| Width | Navigation | Notes |
|---|---|---|
| < 768px | bottom nav (4 permitted + More drawer) | KPI tiles 2-up, alerts tile full width, 44px touch targets |
| 768–1023px | 80px icon rail (labels on hover via `title`) | KPI tiles 3-up |
| ≥ 1024px | 264px sidebar with groups + owner section | KPI tiles 5-up, two-column dashboard |

Theme is dark by default with a full light theme (persisted in localStorage).
All timestamps are `Asia/Kolkata`, 12-hour (`05 Nov 2026, 08:00 PM IST`).

---

## Structure

```
admin-web/
  src/
    components/common/      Ambient, GlassCard, Crest, Toast, AppButton, StatPill,
                            StatusBadge, SectionHeader, EmptyState, LoadingState,
                            ConfirmDialog, CopyField, RoleBadge, ThemeToggle,
                            ErrorBoundary
    components/navigation/  Sidebar (rail + full), BottomNav, TopBar, AppShell
    context/                SessionContext (cookie bootstrap), RealtimeContext
    lib/                    api.ts, realtime.ts, permissions.ts, format.ts, theme.ts
    screens/auth/           AdminLoginScreen (email → key → OTP)
    screens/dashboard/      DashboardScreen (KPIs + modules + match day)
    screens/                PlaceholderScreen (Phase 4–5 copy)
    types/                  API-shaped types
  public/assets/            crest logos + background artwork
```

### API client
- `credentials: 'include'` on every call, `X-Requested-With: XMLHttpRequest`.
- Standard envelope `{ success, message, data, statusCode }` unwrapped to `data`.
- `ApiError` keeps the server message so login/queue errors can be shown verbatim.

### Realtime
- One socket per session: `/ws?tenantId=…` (Vite proxies `/ws`).
- Messages only bump a debounced `version` (800ms); screens refetch instead of
  trusting payloads.
- Top bar dot shows the socket state; manual refresh is always available.

---

## Verified in Phase 3

- `npm run build` — clean (tsc strict + Vite).
- Owner login through the Vite proxy → cookie → `/auth/me` → dashboard with real data.
- Staff login with a temporary key: only Wallet + Matches visible, owner screens
  hidden, `/staff` redirects to the dashboard with a toast.
- Key revoke → immediate `401` → login screen (verified live).
- Desktop 1440/1280, tablet 820, phone 390 screenshots; light + dark themes.
- Console has no errors; `noindex` meta + `robots.txt` Disallow shipped.
- Local Docker stack: `prisma db push` + seed + owner seed, owner login through the
  proxy with a fresh OTP, dashboard + realtime socket on the local tenant,
  backend `build` clean and `npm test` 372/372.

---

## Next (from `plan/admin-web/`)

- **Phase 4:** create / publish / reveal / scorer+roster / manage matches.
- **Phase 5:** wallet queues, settlement, players & anti-cheat, staff keys, settings.
- **Phase 6:** real email provider (SMTP/Resend), Tailscale or Cloudflare Access, deploy.
- **Phase 7:** permission matrix, security audit, handover docs.
