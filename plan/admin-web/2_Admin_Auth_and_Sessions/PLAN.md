# 🔐 Phase 2 — Admin Auth (Email + OTP + Permission Key) & Cookie Sessions

> **Goal:** Owner = email + OTP. Sub-admin = owner ka email + permission key + OTP
> (owner ke mail pe). Session httpOnly cookie. Android apps ka Bearer flow untouched.
>
> **Location:** `backend/src/controllers/adminAuth.controller.ts`,
> `backend/src/services/adminAuth.service.ts`, `backend/src/routes/adminAuth.routes.ts`,
> `backend/src/middlewares/auth.middleware.ts`, `backend/src/services/email.service.ts`
> **Status:** ✅ COMPLETE — build clean · **343/343 tests** · live cookie smoke passed

---

## 📋 Checklist

### 🔹 Stage 1: Endpoints
- [x] **1.1 `POST /api/v1/auth/admin/otp/request`** `{ email, accessKey?, tenantId? }`
      - allowlist: `role in (ADMIN, SUB_ADMIN)`, not banned, tenant active
      - unknown email → **generic 200** ("If this email has access…"), no OTP row
      - sub-admin email without key → `400 A permission key is required for staff accounts`
      - key + owner email (same tenant) → OTP; wrong/revoked/expired/other-tenant key → generic 401
      - OTP 6-digit CSPRNG → only `codeHash` stored, `attempts = 0`, 10 min TTL,
        previous codes deleted; `debugOtp` only outside production
- [x] **1.2 `POST /api/v1/auth/admin/otp/verify`** `{ email, otp, accessKey? }`
      - constant-time hash verify, single use, attempts capped at 5 (then 429)
      - identity = key's sub-admin, else the ADMIN matching the email
      - `lastLoginAt/Ip`, key `lastUsedAt`, `ADMIN_LOGIN` audit
      - JWT 12h (`ADMIN_SESSION_TTL_HOURS`) → **`admin_session` httpOnly cookie**
        (`Secure` in prod, `SameSite=Strict`, host-only, `Max-Age` 12h);
        token **never** in the JSON body
- [x] **1.3 `POST /api/v1/auth/admin/logout`** → cookie cleared + audit
- [x] **1.4 `GET /api/v1/auth/me`** works with cookie **and** Bearer
- [x] **1.5 Owner-only `/api/v1/admin/access`**
      - `GET /` → keys + staff + status (ACTIVE / EXPIRED / REVOKED) + last used
      - `POST /` → create/re-invite sub-admin + **plain key once** (`{6}-{6}-{6}-{6}`)
      - `POST /:id/revoke` → `revokedAt`, session dies immediately
      - `POST /:id/regenerate` → old revoked + fresh key once
      - plain key kabhi list/reveal nahi hota

### 🔹 Stage 2: Session middleware
- [x] **2.1** `authenticate` token source: `Authorization: Bearer` → else cookie
- [x] **2.2** cookie session pe `accessKeyId` claim verify → key revoked/expired = 401
      (30s cache + instant invalidation on revoke)
- [x] **2.3** **CSRF**: cookie + non-GET → `Origin`/`Referer` must match
      `ADMIN_WEB_ORIGIN`/`CORS_ORIGIN` (dev `*` allowed); mismatch 403
- [x] **2.4** rate limits: OTP request 3/10 min, verify 5/15 min (email+IP)
- [x] **2.5** audit: OTP request, login, logout, key issue/revoke/regenerate

### 🔹 Stage 3: Tests (`tests/adminAuth.test.ts` — 17 tests)
- [x] owner request/verify + ADMIN role; plain OTP never stored; code single-use
- [x] wrong OTP ×5 → attempts=5 → correct code rejected with 429
- [x] unknown email → generic message, zero OTP rows
- [x] staff email without key → 400
- [x] sub-admin login → SUB_ADMIN identity + key-bound `accessKeyId` + live permissions
- [x] revoked / expired / other-tenant key rejected; malformed key rejected
- [x] issue key → 24 chars, hash stored (not plain), permissions saved
- [x] owner email cannot be shadowed
- [x] revoke → session 401 + `assertAccessKeyUsable` fails
- [x] regenerate → old key dead, new key works
- [x] list statuses + audit rows written

### 🔹 Stage 4: Docs + verification
- [x] `.env` / `.env.example`: `ACCESS_KEY_PEPPER`, `ADMIN_SESSION_TTL_HOURS`,
      `ADMIN_WEB_ORIGIN`, `EMAIL_PROVIDER`, `EMAIL_FROM`; dev CORS adds `:5174`
- [x] backend build 0 errors; full suite **343/343**
- [x] **live smoke (real Supabase + :5000):**
      owner OTP → verify (ADMIN) → `/auth/me` 200 → logout ·
      owner issues key → sub-admin login (SUB_ADMIN + permissions) →
      revoke → sub-admin `/auth/me` **401** · test staff rows cleaned up
- [x] Master phase table updated

---

## 🎯 Acceptance (met)

- Owner `deadesports99@gmail.com` OTP se login (cookie session) — verified live.
- Sub-admin owner email + key + OTP se login, permissions DB se live — verified live.
- Revoke ke baad turant 401; token localStorage/JSON me nahi.
- Android Bearer JWT suite untouched (343 tests green).
- Email delivery abhi `console` provider (real SMTP/Resend = Phase 6) — dev me
  `debugOtp` se testing possible.
