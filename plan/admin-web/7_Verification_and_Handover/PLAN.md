# ✅ Phase 7 — Verification Matrix, Security Audit & Handover

> **Goal:** Sab kuch end-to-end verify — owner/staff permissions, money safety,
> security checklist, browser matrix, handover docs.
>
> **Status:** 🟡 IN PROGRESS — Stage 1 matrix **documented + verified against the live API**
> (`docs/ADMIN_WEB_ACCESS.md`, `docs/ADMIN_WEB_AUTH.md`, `docs/GO_LIVE_CHECKLIST.md`).
> Stage 2/3 ke browser-matrix tests deploy ke baad (Render URL pe) honge — accounts pending.

---

## 📋 Checklist

### 🔹 Stage 1: Permission matrix (har role/flag)
| Login | Expected |
|---|---|
| Owner (ADMIN) | Sab routes + owner-only (staff, settings, settlement, ban) |
| SUB_ADMIN no flags | Dashboard read-only, sab actions locked |
| `canCreateMatch` | Create/Manage/Clone/Cancel visible; room/payout/wallet locked |
| `canUpdateRoomId` | Publish Room + reveal controls |
| `canDistributePrize` | Scorer/Roster payout |
| `canManageWallet` | Wallet console |
| Banned/revoked | Login blocked / session 401 |
| USER role email | Login rejected |

- [x] Har row ke liye UI + server dono verify (UI hide + API 403).
      → Matrix code se nikala: `docs/ADMIN_WEB_ACCESS.md` §3 (UI) + §4 (API).
      → Live API proof (2026-11-14, local :5000): no cookie **401** · owner wallet **200** ·
        owner settlement **200** · staff(bina `canManageWallet`) **403** ·
        staff owner-only settlement **403** · CSRF evil Origin **403 Blocked cross-site request**.
      → DB me do staff rows alag flags ke saath mile (`staff@apexff.com` w=false r=true,
        `walletops@example.com` w=true) — matlab toggles asli hain, sirf UI story nahi.
- [x] Permission live change: toggle off → next fetch pe action gayab
      (server har request pe DB flags padhta hai; 30s auth-cache ki limit
      `docs/ADMIN_WEB_AUTH.md` §7 me documented).

### 🔹 Stage 2: Auth & session security tests
- [ ] OTP: expiry (10 min), single use, 5 attempts, resend rate limit.
- [ ] Key: wrong, expired, revoked, dusre tenant, owner email ke saath key
      (should be rejected), 24-char validation.
- [ ] Cookie: httpOnly + Secure + SameSite visible in DevTools; JS se read nahi hota.
- [ ] CSRF: cross-origin POST → 403.
- [ ] Logout → cookie clear + session dead.
- [ ] 401 handling: auto login screen, koi retry loop nahi.
- [ ] No token/OTP/key in URL, localStorage, console logs, error messages.
- [ ] Email enumeration: unknown vs known email ka response time/message same.

### 🔹 Stage 3: Money safety E2E
- [ ] Deposit approve → balance + ledger; double approve blocked.
- [ ] Withdrawal approve → UTR + ledger; reject → restore.
- [ ] Roster payout → `WINNING_PRIZE` + COMPLETED; second attempt blocked.
- [ ] Prize budget exceeded → clean error, koi partial credit nahi.
- [ ] Settlement CSV totals = ledger day totals.
- [ ] Fast double-click on Approve/Pay → ek hi transaction.

### 🔹 Stage 4: Browser & device matrix
- [ ] Chrome desktop 1440, Chrome Android 360/412, Safari iOS (agar available).
- [ ] Keyboard-only navigation, focus rings, 44px touch targets.
- [ ] Light + dark theme screenshots.
- [ ] Slow 3G throttle: skeletons, koi blank screen nahi.
- [ ] Refresh mid-action: no duplicate money operation.

### 🔹 Stage 5: Handover docs
- [ ] `docs/ADMIN_WEB_AUTH.md` — flow, endpoints, error table, key rotation.
- [ ] `docs/ADMIN_WEB_ACCESS.md` — Tailscale/Cloudflare steps, owner email add/change.
- [ ] `HANDOVER_MANUAL.md` me naya section: "Admin web access + staff onboarding".
- [ ] `agent.md` me Phase 13 (Admin Web) summary + "do not regress" rules:
      - Admin web = cookie session; Android = Bearer. Dono kaam karte rahenge.
      - Sub-admin login = owner email + access key + owner OTP.
      - Key plain sirf generate/regenerate pe; DB me hash.
      - Canonical payout = match roster.
- [ ] Plan files ke saare `[x]` + master phase table updated.

### 🔹 Stage 6: Final gate
- [ ] Backend `npm run build` 0 errors + `npm test` green.
- [ ] `admin-web` build clean; `npm audit` high/critical 0.
- [ ] Android player + admin app builds green (no regression).
- [ ] Security checklist (master plan) 100% tick.
- [ ] Boss walkthrough: owner + sub-admin real login, ek deposit approve,
      ek match create → publish → roster payout, key revoke.

---

## 🎯 Acceptance

- Har permission combination verified (UI + API).
- Money operations idempotent aur ledger-verified.
- Security checklist complete, koi secret frontend me nahi.
- Handover docs se naya admin/staff 10 minute me onboard ho sake.

---

## ✅ Stage 2 — live verification on https://spartan-arena.onrender.com (15 Nov 2026)

Deploy ho gaya, to saare guards **asli production** pe chala ke dekhe gaye
(mock nahi, real Render + real Neon + real cookies).

### Permission matrix (minted SUB_ADMIN tokens + real owner cookie)

| Endpoint | Guard | ADMIN | walletops | roomonly | prizeops |
|---|---|---|---|---|---|
| `GET /admin/wallet/deposits` | `canManageWallet` | **200** | **200** | 403 | 403 |
| `GET /admin/wallet/settlement` | `canManageWallet` + `ADMIN` | **200** | 403 | 403 | 403 |
| `GET /admin/players` | `ADMIN` | **200** | 403 | 403 | 403 |
| `GET /auth/admin/staff` | `ADMIN` | **200** | 403 | 403 | 403 |
| `GET /admin/access` | `ADMIN` | **200** | 403 | 403 | 403 |
| `GET /tournaments/:id/participants` | `canDistributePrize` | 404 | 403 | 403 | **404** |

`404` = guard pass ho gaya, resource nahi mila (fake id) — yahi expected proof hai.
No-token control: **401**. `walletops` ke paas `canManageWallet` hai par `ADMIN` nahi,
isliye settlement pe **403** — owner-only rule sach me lagu hai.

### Session + CSRF

| Check | Result |
|---|---|
| `POST /auth/admin/otp/request` (owner) | **200** + Brevo mail delivered |
| `POST /auth/admin/otp/verify` sahi code | **200**, `admin_session` cookie (`HttpOnly; Strict`) |
| galat code | **400** |
| bina cookie `/admin/access` | **401** |
| cookie + `Origin: https://evil.example` (POST) | **403** `Blocked cross-site request` |
| cookie POST bina Origin/Referer | **403** (yahi asli CSRF shape) |
| Bearer token (Android path) + evil Origin | **200** — gate sirf cookie pe |

### Staff key lifecycle (asli OTP ke saath)

| Step | Result |
|---|---|
| Owner `POST /admin/access` → staff + 24-char key | **201**, key ek baar dikhti hai |
| `otp/request` owner email + key | **200** `requiresKey: true` |
| `otp/verify` + key | **200**, token me `accessKeyId` claim |
| staff → `wallet/deposits` (perm nahi) | **403** |
| staff → `tournaments/:id/room` (perm hai) | **404** (guard pass) |
| owner key **revoke** → same cookie | **401** `Your permission key is no longer active` |

> Note: revoke ka asar **30 s** ke andar dikhta hai (`keyStateCache` TTL) — turant
> nahi. Isi window me purani cache valid rehti hai. Test 32 s wait ke baad kiya gaya.

### Do cheezein jo test se pata chali (docs me daali gayi)

1. `regenerate` **naya key row** banata hai aur purana revoke karta hai — purane key-id
   pe revoke call karna no-op hai (`if (key.revokedAt) return;`). UI hamesha list ka
   **latest ACTIVE** key dikhaye, isi liye theek hai.
2. `POST /admin/access` body: `{name, email, phoneNumber, permissions}` — sirf `userId`
   bhejne pe `400 Validation failed`. Staff ka login email = **owner ka email + key**,
   staff ka apna email nahi (schema comment ke mutabik).

### Android path

| Check | Result |
|---|---|
| Bearer token (no cookie) `GET /api/v1/tournaments` | **200**, 2 tournaments |
| `client_config.json` (player + admin) | `https://spartan-arena.onrender.com/api/v1` |

### Test data cleanup

Test ke liye banaye 4 staff (walletops/roomonly/prizeops/Revoke Test) → `DELETE` se
deactivate (**200**), saare keys revoke → **0 active keys** bache.
