# 🖥️ Admin Web — Master Plan (Browser Dashboard for Owner + Sub-Admin)

> **Goal (boss demand):** Admin app jo abhi Android me hai, wahi kaam **browser** me ho.
> Vite + DB se connected, UI/UX bilkul player app jaisa. Login **email + OTP**, sirf
> DB allowlist emails. Sub-admin **admin ka email + permission key** se login kare, OTP
> admin ke mail pe aaye. Admin app abhi rahega, baad me remove kar sakte hain.
>
> **Location:** `admin-web/` (naya), `backend/` (auth + schema), `plan/admin-web/`
> **Status:** 🟢 IN PROGRESS — Phase 1–5 ✅ done (backend auth, `admin-web/` shell,
> login, dashboard, match operations, money/players/staff/settings). Phase 6–7 next.

---

## 📍 Current Checkpoint — Resume Kahan Se Hoga

### ✅ Ho gaya (Phase 1–2)
- Supabase me naye tables: `StaffAccessKey`, `AdminAuditLog`; `EmailOtp` me
  `codeHash/attempts/usedAt`; `User` me `lastLoginAt/lastLoginIp`.
- 24-char permission key generator (HMAC + `ACCESS_KEY_PEPPER`).
- Owner seeded: **deadesports99@gmail.com** (tenant `apex-ff`, role ADMIN).
- Working admin-auth API:
  - `POST /api/v1/auth/admin/otp/request` (`email`, optional `accessKey`)
  - `POST /api/v1/auth/admin/otp/verify` → httpOnly `admin_session` cookie (12h)
  - `POST /api/v1/auth/admin/logout`
  - `GET|POST /api/v1/admin/access`, `POST /:id/revoke`, `POST /:id/regenerate`
- CSRF origin gate, OTP attempts lock, rate limits, revoke = instant 401, audit rows.

### ✅ Phase 3 bhi ho gaya
- `admin-web/` Vite + React + TS + Tailwind app (`:5174`, `/api` + `/ws` proxy).
- Login UI (Owner | Staff tabs → email → 24-char key → 6-box OTP), cookie session
  bootstrap, global 401 → login, sign-out confirm.
- Shell: desktop sidebar / tablet icon rail / phone bottom nav + drawer, IST clock,
  realtime dot, refresh, dark + light theme.
- Dashboard: permission-aware "Aaj ka kaam" KPIs, module cards, match-day panel,
  skeleton/error states, realtime refetch.
- Route guards + honest Phase 4/5 placeholders (no fake screens), README, robots
  Disallow + `noindex`.

### ⬜ Baaki (Phase 6–7)
- Real email provider (`EMAIL_PROVIDER=console` today), deploy + ops hardening (Phase 6).
- Real email provider (abhi `EMAIL_PROVIDER=console`, OTP backend log me) (Phase 6).
- Tailscale / Cloudflare Access gate + production deploy (Phase 6).
- Permission matrix + security/handover verification (Phase 7).

### 🔁 Resume karne se pehle
1. `.env` me `ACCESS_KEY_PEPPER` production value confirm karo.
2. `cd backend && npm run dev` + `npm test` (426/426 expected).
3. `cd admin-web && npm run dev` → `http://localhost:5174` (port fix — CSRF origin).
4. Owner login test: dev me OTP screen ka dashed "DEV" chip (backend `debugOtp`).

---

## ✅ Confirmed Decisions (Boss)

1. Admin panel **browser me** chalega (Vite SPA), backend ke existing `/api/v1/admin/*`
   endpoints hi use karega. DB wahi Supabase/Postgres.
2. **Login = email + OTP.** Sirf wahi email login kar sakta hai jo DB me
   `User.email` ke saath `role = ADMIN | SUB_ADMIN` hai (allowlist).
3. **Owner (ADMIN):** apna email daalega → OTP usi email pe → login. Code ki zaroorat nahi.
4. **Sub-admin (SUB_ADMIN):**
   - URL kholega → **admin (owner) ka email** daalega
   - + **permission key** daalega (jo owner ne generate karke di hai)
   - OTP **owner ke email pe** aayega (owner se lega)
   - OTP verify → sub-admin **us key wali identity** me login, permissions DB se live.
5. **Permission key:** 24-char (A–Z, a–z, 0–9), `crypto` se random, DB me **hash**,
   hint (last 4) only, revoke/regenerate, **har sub-admin login pe zaroori** (API key jaisa).
6. **Access gate:** pehle **Tailscale** (sirf apne devices), client handover pe
   **Cloudflare Access** (email OTP gate). Sirf secret URL par nahi depend karna.
7. **Design:** player app ka demo dark esports look — crest, map art, glass cards,
   IST time, Hinglish labels. Mobile = bottom nav, desktop = left sidebar.

---

## 🔐 Auth Flow (final)

```
OWNER
  email (allowlist ADMIN)  ──►  OTP (owner ke mail)  ──►  session (ADMIN)

SUB-ADMIN
  admin ka email (allowlist ADMIN)
        + permission key (24-char)
  ──►  key valid? (hash match, not revoked, not expired, same tenant)
  ──►  OTP owner ke mail pe
  ──►  OTP + key verify  ──►  session (SUB_ADMIN, permissions User row se live)

KEY GENERATION (owner only, Staff Access screen)
  name + email + phone + 4 permission toggles
  ──►  SUB_ADMIN user create/update
  ──►  key generate → DB me hash (plain sirf ek baar screen pe)
  ──►  copy / WhatsApp share + revoke / regenerate
```

**Kyun key har login pe?** Key hi batati hai ki kaun sub-admin login kar raha hai
(owner email sabhi ke liye same hai). Key revoke = turant access band.

**Permission edits:** permissions `User` row pe rehti hain, key sirf identity deti hai.
Isliye admin permission badalte hi `invalidateAuthCache(userId)` se next request pe
effect — key dobara generate karne ki zaroorat nahi.

---

## 🧱 Architecture

```
admin-web/                # Vite + React + TS + Tailwind
  src/
    screens/auth/         # AdminLoginScreen (email → key → OTP)
    screens/dashboard/    # aaj ka kaam + module cards
    screens/matches/      # create, publish, live scorer, manage, roster
    screens/wallet/       # withdrawals, deposits, online, settlement
    screens/players/      # search, detail, ban, watchlist, devices, suspicious
    screens/staff/        # staff + access keys
    screens/settings/     # UPI, support, min deposit, auth toggles
    components/           # GlassCard, Crest, Ambient, TopBar, Sidebar, BottomNav, Toast
    lib/                  # api.ts (cookies), realtime.ts, formatters.ts, permissions.ts
    types/

backend/
  prisma/schema.prisma    # + StaffAccessKey, AdminAuditLog, EmailOtp.codeHash/attempts
  src/utils/accessKey.ts  # generate + hash
  src/services/email.service.ts   # console | smtp | resend | brevo
  src/controllers/adminAuth.controller.ts
  src/middlewares/adminSession.middleware.ts
  src/routes/adminAccess.routes.ts
```

- **DB:** same Postgres (Supabase). Koi alag DB nahi.
- **Session:** `admin_session` **httpOnly cookie** (12h, SameSite=Strict, Secure in prod).
  Android apps ka Bearer JWT flow **bilkul untouched** rahega.
- **CSRF:** non-GET requests pe `Origin`/`Referer` strict check + SameSite=Strict.
- **Realtime:** existing `/ws?tenantId=…` (admin web bhi subscribe karega).

---

## 🛡️ Security Non-Negotiables

- [x] Permission key + OTP **hash** at rest; plain kabhi log nahi.
- [x] Login generic error (`Invalid email, permission key or code`) — enumeration band.
- [x] Rate limit: OTP request 3/10min, key+OTP verify 5/15min; OTP attempts 5 → 429.
- [x] OTP 6-digit, 10 min expiry, max 5 attempts, single use.
- [x] Key: 24-char, 90-day expiry (renewable), revoke/regenerate instant (session 401).
- [x] `AdminAuditLog`: login, key generate/revoke/regenerate (baaki actions Phase 4–5).
- [x] Admin session **httpOnly cookie** (JS se read nahi hoti), CSRF origin gate.
- [ ] Production me `CORS_ORIGIN` exact admin origin (abhi dev list hai).
- [x] Admin web prod build: **no source maps**, `noindex`, robots.txt Disallow.
- [ ] Player app / player site se admin URL ka **koi link nahi** (Phase 6 verify).
- [ ] Access gate bahar se: Tailscale ya Cloudflare Access (Phase 6).
- [ ] Bank/payout actions pe double-click guard + server-side idempotency (already hai
      backend me; web UI guard Phase 4).

---

## 📋 Phases (chhote steps)

| Phase | Kaam | Folder | Status |
|---|---|---|---|
| 1 | DB models + API-key style generator + OTP hashing + owner seed | `1_Database_and_Access_Key/` | ✅ |
| 2 | Admin auth endpoints + cookie session + lockout + audit + tests | `2_Admin_Auth_and_Sessions/` | ✅ |
| 3 | Vite shell + login UI + dashboard + design system + permissions | `3_Web_Shell_and_Design/` | ✅ |
| 4 | Match operations: create / publish / reveal / scorer+roster / manage | `4_Match_Operations/` | ⏭ Next |
| 5 | Money + players + staff access keys + settings + settlement | `5_Money_Players_and_Staff/` | ⏸ |
| 6 | Real email provider + Tailscale/Cloudflare Access + deploy | `6_Email_Access_and_Deploy/` | ⏸ |
| 7 | Verification: permission matrix, security checklist, handover | `7_Verification_and_Handover/` | ⏸ |

**Rule:** ek phase complete → build/test green → tab next phase. Har phase ke end pe
`PLAN.md` me `[x]` ticks + verification line update karni hai.

---

## 📈 Progress Log

- **Phase 1 ✅ (done):** `StaffAccessKey` + `AdminAuditLog` models, 24-char permission
  key generator (HMAC + pepper), OTP hashing (`codeHash`/`attempts`), owner seeded as
  `deadesports99@gmail.com` on tenant `apex-ff`. Backend build clean, **326/326 tests**,
  Supabase schema synced.
- **Phase 2 ✅ (done):** owner email+OTP login, sub-admin owner-email+key+OTP login,
  httpOnly `admin_session` cookie (12h), CSRF origin gate, revocation kills the session,
  OTP/key rate limits, audit rows, owner-only `/admin/access` (issue/list/revoke/
  regenerate). Build clean, **343/343 tests**, live cookie + revoke smoke passed.
- **Phase 3 ✅ (done):** `admin-web/` Vite app — player-app design tokens, 3-step login
  (owner/staff), cookie session bootstrap (`/auth/me`), desktop sidebar / tablet rail /
  mobile bottom nav, dark+light, IST formatting, permission model, permission-aware
  dashboard (KPIs + modules + match day), realtime refetch, route guards, Phase 4–5
  placeholders. Build clean (tsc strict + Vite). Live verified: owner login, staff key
  login with only Wallet+Matches, `/staff` redirect + toast, key revoke → instant 401.
  Screenshots 390/820/1280/1440.
- **Phase 4 ✅ (done):** match operations in the browser — create (IST picker +
  visibility window + live preview), publish room (publish = reveal, copy/WhatsApp),
  matches list (LIVE/UPCOMING/HISTORY, search, visibility/clone/cancel+refund dialogs,
  sweep), canonical roster/scorer (rank/kills/DQ, prize preview, ban, CSV,
  save-only vs save-&-complete, room strip), scorer picker. No backend changes.
  Live-verified the full chain (create → publish → payout ₹1,100 → COMPLETED,
  save-only ₹405, clone #8, cancel+refund, sweep, CSV, visibility toggle).
  Build clean (tsc strict + Vite).
- **Phase 5 ✅ (done):** wallet console (withdrawals/deposits/online), daily
  settlement + CSV, players/anti-cheat (search, profile, ban, suspicious score,
  device groups, watchlist), staff permission keys (generate → one-time reveal →
  staff login → revoke), tenant settings. Live-verified: deposit approve credits
  ₹150, withdrawal UTR stored, staff key → `SUB_ADMIN` blocked from every owner
  route (403), settings round-trip. Backend fixes: profile-device accounts now
  join device groups and watchlist summaries (+3 tests, **426/426**). Theme root
  cause fixed (`body` no longer forces `text-white`). Build clean
  (417 kB / 116 kB gzip). Next: Phase 6 (email provider + deploy).

---

## 💻 Local Dev Setup (Phase 3 ke baad)

```bash
# 1. Backend (:5000)
cd backend && npm run dev

# 2. Admin web (:5174) — port fix, CSRF gate isi origin par hai
cd admin-web && npm run dev   # open http://localhost:5174

# 3. Database (sirf local DB chahiye to — production Supabase already connected)
cd backend && docker compose -f docker-compose.dev.yml up -d
```

### 2b. Fully local DB (current default)
```bash
# Docker Desktop chalu hona chahiye
cd backend
docker compose -f docker-compose.dev.yml up -d   # Postgres :5433, Redis :6379
npx prisma db push
npm run seed
npm run seed:owner
```
- Root me `start-local.bat` / `stop-local.bat` — ek click me poori local stack.
- Local tenant id: `53a09545-e6e2-4cf5-a5c2-7ef18b276a52` (seed data: 2 demo matches).
- Hosted Supabase wapas chahiye: `backend/.env.supabase.bak` → `.env`, restart backend,
  aur `admin-web/.env` ka `VITE_TENANT_ID` Supabase tenant par set karo
  (`a3c11cd0-...`). Local Docker volume delete nahi hota.
- `src/config/prisma.ts` ab SSL sirf remote host par lagata hai, isliye local
  Postgres (no TLS) seed/runtime dono par chalta hai.
- **Tenant id mismatch fix (Nov 12):** `android/app-player` client config purane
  Supabase tenant par tha isliye local backend "Tenant not found" deta tha — ab
  `53a09545-...` set hai aur dono APKs rebuild/install ho chuke hain. Detail:
  root `LOCAL_DEV.md`.

Local `.env` (admin-web, already committed):
```
VITE_API_URL=/api/v1        # same-origin via the Vite proxy
VITE_TENANT_ID=53a09545-e6e2-4cf5-a5c2-7ef18b276a52   # local DB tenant
```

Production URL **plan me fix nahi** — Phase 6 me Tailscale/Cloudflare ke saath decide.

---

## 🧪 Definition of Done (har phase)

- Backend `npm run build` clean + `npm test` green.
- Admin web `npm run build` clean + console error free.
- Naya endpoint/flow ka test (happy + failure + permission-denied).
- Player app / Android admin app me koi regression nahi (build check).
- Security checklist items us phase ke tick ho gaye.
