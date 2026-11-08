# 🎨 Phase 3 — Vite Shell, Login UI, Dashboard & Design System

> **Goal:** `admin-web/` app khade karo — player app jaisa design, login flow,
> permission-gated routing, aaj-ka-kaam dashboard, realtime. Screens Phase 4–5 me.
>
> **Location:** `admin-web/`
> **Status:** PAUSED — Phase 3–7 baad me (Phase 1–2 auth already done & verified)

---

## 📋 Checklist

### 🔹 Stage 1: Project setup
- [ ] **1.1 `npm create vite@latest admin-web -- --template react-ts`**, port **5174**.
- [ ] **1.2 Deps:** `tailwindcss`, `clsx`, `tailwind-merge`, `lucide-react`,
      `react-router-dom` (ya simple state router), `ws` (realtime, dev only).
- [ ] **1.3 `vite.config.ts`:** proxy `/api` → `http://localhost:5000`,
      `/ws` → `ws://localhost:5000` (`ws: true`).
- [ ] **1.4 `.env`:**
      ```
      VITE_API_URL=http://localhost:5000/api/v1
      VITE_TENANT_ID=<tenant uuid>
      ```
      Prod me same-origin `/api` use hoga.
- [ ] **1.5 `npm run build` clean baseline + `.gitignore` (dist, env.local).**

### 🔹 Stage 2: Design system (player app 1:1)
- [ ] **2.1 Tokens:** dark navy bg `#050B14`, panel `#0B1526`/`#0F1E36`, glass border
      `white/10`, accent white + cyan + amber + red, radius 12/16, font weights
      player app jaisa. Light theme bhi.
- [ ] **2.2 Components copy/port from `player-web`:** `Ambient`, `GlassCard`, `Crest`,
      `Toast`, `AppHeader` (balance ki jagah role chip + refresh),
      `BottomNav` (mobile), **naya `Sidebar`** (desktop ≥1024px).
- [ ] **2.3 Shared UI:** `AppButton`, `StatPill`, `SectionHeader`, `EmptyState`,
      `LoadingState`, `ConfirmDialog`, `CopyField`, `StatusBadge`.
- [ ] **2.4 IST formatters:** date/time always `Asia/Kolkata`, 12-hour AM/PM
      (`05 Nov 2026, 08:00 PM IST`), relative countdown (`starts in 2h 15m`).
- [ ] **2.5 Emoji icons hatao — lucide icons use karo** (phosphor/emoji mix nahi).

### 🔹 Stage 3: Login flow UI (`screens/auth/AdminLoginScreen.tsx`)
- [ ] **3.1 Step 1 email:** input + "Continue". Error inline, generic message.
- [ ] **3.2 Step 2 key (sub-admin only):** server response `requiresKey` pe 24-char
      key input (grouped, paste-friendly, show/hide).
- [ ] **3.3 Step 3 OTP:** 6 boxes, paste support, 60s resend timer,
      "OTP owner ke email pe bheja gaya hai" note + "Owner se OTP lo".
- [ ] **3.4 States:** loading, wrong OTP (attempts left), lockout countdown,
      network error, back buttons.
- [ ] **3.5 `lib/api.ts`:** `fetch(..., { credentials: 'include' })`,
      `X-Requested-With: XMLHttpRequest`, 401 → auto logout + login screen.
- [ ] **3.6 Session bootstrap:** `GET /auth/me` on load → route guard.

### 🔹 Stage 4: App shell
- [ ] **4.1 Routes (permission-gated):** `/`, `/matches`, `/matches/create`,
      `/matches/publish`, `/scorer`, `/roster`, `/wallet`, `/settlement`,
      `/players`, `/players/:id`, `/watchlist`, `/devices`, `/suspicious`,
      `/staff`, `/settings`.
- [ ] **4.2 `permissions.ts`:** `can(perm)` + `RequirePermission` wrapper;
      unauthorized route → dashboard pe redirect + toast.
- [ ] **4.3 `Sidebar`/`BottomNav`:** sirf allowed items; OWNER badge (ADMIN) vs
      STAFF badge (SUB_ADMIN) + active route highlight.
- [ ] **4.4 Header:** brand crest, role chip, IST clock, refresh, logout.
- [ ] **4.5 Realtime:** existing WS subscribe → debounced refetch
      (MATCH_CREATED, SLOT_BOOKED, status changes, room reveal, wallet events).
- [ ] **4.6 Responsive:** 360px–1440px; koi horizontal scroll nahi; touch targets 44px+.

### 🔹 Stage 5: Dashboard (`screens/dashboard/DashboardScreen.tsx`)
- [ ] **5.1 "Aaj ka kaam" top strip:** Live matches, Pending deposits, Pending
      withdrawals, Today collected ₹, Alerts (watchlist/suspicious) — tappable.
- [ ] **5.2 Module cards (permission-gated):** Create Match, Publish Room,
      Live Scorer, Manage Matches, Wallet, Player Management, Staff & Access,
      App Settings, Settlement.
- [ ] **5.3 Owner-only cards clearly grouped** ("Owner controls") vs staff cards.
- [ ] **5.4 Pull/refresh button + skeleton loading + error state with retry.**

### 🔹 Stage 6: Verification
- [ ] `npm run build` clean, console error free.
- [ ] Login (owner + sub-admin) real backend se manually verify.
- [ ] Light/dark dono screenshots, mobile + desktop.
- [ ] Plan ticks + master table update.

---

## 🎯 Acceptance

- Owner login → dashboard; sub-admin login (key + OTP) → sirf allowed cards.
- Permission hatane pe card + route dono gayab.
- 401 aane pe seedha login screen, koi infinite loop nahi.
- UI player app se match karta hai (colors, cards, IST formatting, icons).
