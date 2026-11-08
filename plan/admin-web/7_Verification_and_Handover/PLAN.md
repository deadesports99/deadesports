# ✅ Phase 7 — Verification Matrix, Security Audit & Handover

> **Goal:** Sab kuch end-to-end verify — owner/staff permissions, money safety,
> security checklist, browser matrix, handover docs.
>
> **Status:** PAUSED — Phase 3–7 baad me (Phase 1–2 auth already done & verified)

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

- [ ] Har row ke liye UI + server dono verify (UI hide + API 403).
- [ ] Permission live change: toggle off → next fetch pe action gayab.

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
