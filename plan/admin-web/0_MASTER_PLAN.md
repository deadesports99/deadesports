# 🖥️ Admin Web — Master Plan (Browser Dashboard for Owner + Sub-Admin)

> **Goal (boss demand):** Admin app jo abhi Android me hai, wahi kaam **browser** me ho.
> Vite + DB se connected, UI/UX bilkul player app jaisa. Login **email + OTP**, sirf
> DB allowlist emails. Sub-admin **admin ka email + permission key** se login kare, OTP
> admin ke mail pe aaye. Admin app abhi rahega, baad me remove kar sakte hain.
>
> **Location:** `admin-web/` (naya), `backend/` (auth + schema), `plan/admin-web/`
> **Status:** 🟡 PAUSED — Phase 1–2 ✅ done (backend auth ready). Phase 3–7
> **baad me** banenge (boss ne abhi pause kiya hai). Admin web UI abhi exist nahi karta.

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

### ⬜ Baaki (Phase 3–7, paused)
- `admin-web/` Vite app — **koi UI nahi bana abhi** (login screen bhi nahi).
- Match / wallet / players / staff / settings screens.
- Real email provider (abhi `EMAIL_PROVIDER=console`, OTP backend log me).
- Tailscale / Cloudflare Access gate + production deploy.
- Permission matrix + security/handover verification.

### 🔁 Resume karne se pehle
1. `.env` me `ACCESS_KEY_PEPPER` production value set karo (dev default allowed only in dev).
2. `cd backend && npm run dev` + `npm test` (343/343 expected).
3. Phase 3 se shuru: `admin-web/` banao (folder abhi nahi hai).
4. Owner login test: `/auth/admin/otp/request` response ka `debugOtp` (dev only) use karo.

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
- [ ] Admin web prod build: **no source maps**, `noindex`, robots.txt Disallow.
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
| 3 | Vite shell + login UI + dashboard + design system + permissions | `3_Web_Shell_and_Design/` | ⏸ Paused |
| 4 | Match operations: create / publish / reveal / scorer+roster / manage | `4_Match_Operations/` | ⏸ Paused |
| 5 | Money + players + staff access keys + settings + settlement | `5_Money_Players_and_Staff/` | ⏸ Paused |
| 6 | Real email provider + Tailscale/Cloudflare Access + deploy | `6_Email_Access_and_Deploy/` | ⏸ Paused |
| 7 | Verification: permission matrix, security checklist, handover | `7_Verification_and_Handover/` | ⏸ Paused |

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
  Next: Phase 3 (Vite admin web shell + login UI + dashboard).

---

## 💻 Local Dev Setup (Phase 3 ke baad)

```bash
# 1. Backend (:5000) — abhi se chalta hai
cd backend && npm run dev

# 2. Admin web (:5174) — Phase 3 me banega, tab ye command chalegi
cd admin-web && npm run dev   # open http://localhost:5174

# 3. Database (sirf local DB chahiye to — production Supabase already connected)
cd backend && docker compose -f docker-compose.dev.yml up -d
```

Local `.env` (admin-web, Phase 3 me):
```
VITE_API_URL=http://localhost:5000/api/v1
VITE_TENANT_ID=a3c11cd0-324e-4886-b27c-9667fd7f59dc
```

Production URL **plan me fix nahi** — Phase 6 me Tailscale/Cloudflare ke saath decide.

---

## 🧪 Definition of Done (har phase)

- Backend `npm run build` clean + `npm test` green.
- Admin web `npm run build` clean + console error free.
- Naya endpoint/flow ka test (happy + failure + permission-denied).
- Player app / Android admin app me koi regression nahi (build check).
- Security checklist items us phase ke tick ho gaye.
