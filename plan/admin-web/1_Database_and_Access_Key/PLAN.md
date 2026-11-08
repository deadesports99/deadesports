# 🗄️ Phase 1 — Database Models + Permission Key Generator

> **Goal:** Sub-admin ke liye API-key jaisa **permission key** (24 chars, mixed case +
> digits), DB me hash, revoke/expire; OTP hash storage; owner admin ka email seed.
>
> **Location:** `backend/prisma/schema.prisma`, `backend/src/utils/accessKey.ts`,
> `backend/src/services/auth.service.ts`, `backend/src/scripts/seedOwnerAdmin.ts`
> **Status:** ✅ COMPLETE — build clean · 326/326 backend tests · DB synced · owner seeded

---

## 📋 Checklist

### 🔹 Stage 1: Schema
- [x] **1.1 `StaffAccessKey` model** — `keyHash @unique`, `keyHint`, `permissions Json?`
      (audit snapshot), `expiresAt`, `lastUsedAt`, `revokedAt`, `createdBy`; relations to
      `Tenant` + `User`, indexes `(tenantId,userId)` + `(userId,revokedAt)`.
- [x] **1.2 `AdminAuditLog` model** — `tenantId, actorId, actorRole, action, targetType,
      targetId, meta Json?, ip, userAgent, createdAt` + 3 indexes. Append-only, no FK.
- [x] **1.3 `EmailOtp` hashing** — `code` **removed**, `codeHash` required,
      `attempts Int @default(0)`, `usedAt DateTime?` added.
- [x] **1.4 `User` pe `lastLoginAt` + `lastLoginIp`**.
- [x] **1.5 `prisma validate` + `db push --accept-data-loss` + `generate`** clean.
      (Old OTP rows were ephemeral 10-min codes — no real data loss.)

### 🔹 Stage 2: Key generator (`backend/src/utils/accessKey.ts`)
- [x] **2.1 Alphabet 62 chars**, `crypto.randomInt` (no modulo bias, never Math.random).
- [x] **2.2 Length 24** → ~143 bits entropy.
- [x] **2.3 Display `K7pQ2x-9mR4tL-8vN3sW-5cB6dE`**, paste-friendly normalization
      (dashes/spaces stripped), 24-char validation.
- [x] **2.4 `HMAC-SHA256(ACCESS_KEY_PEPPER, key)`**, `timingSafeEqual` verify,
      `keyHint` = last 4 chars. Malformed hash → `false`, never throws.
- [x] **2.5 Env `ACCESS_KEY_PEPPER`** (min 32) + production guard: dev default pe boot
      **refuse**. `.env` + `.env.example` updated.
- [x] **2.6 18 unit tests** (`tests/accessKey.test.ts`): 24 length, mixed case used,
      1000 unique keys, format/normalize, hash determinism, plain key never stored,
      wrong key rejected, hint, OTP 6-digit + hash/verify + padding + malformed hash.

### 🔹 Stage 3: Owner seed
- [x] **3.1 `src/scripts/seedOwnerAdmin.ts`** + `npm run seed:owner`
      (`--email`, `--name`, `--tenant`, `--phone`), idempotent (existing ADMIN update).
- [x] **3.2 Real owner seeded:** `deadesports99@gmail.com` (ADMIN, tenant `apex-ff`).
- [x] **3.3 Output me sirf email/role/ids — koi key/OTP/secret print nahi.**

### 🔹 Stage 4: OTP service alignment (build green)
- [x] **4.1 `auth.service.ts`** email OTP now stores `codeHash`, constant-time verify,
      wrong code bumps `attempts`. Player email login behaviour unchanged.
- [x] **4.2 `tests/authFlows.test.ts`** fixtures updated to `codeHash` + added assertion
      that the plain `code` column no longer exists.

### 🔹 Stage 5: Verification
- [x] `npm run build` — 0 errors.
- [x] `npm test` — **326/326 pass** (targeted accessKey 18/18, authFlows 17/17).
- [x] Supabase live check: `StaffAccessKey` + `AdminAuditLog` tables present,
      `EmailOtp` has `codeHash/attempts/usedAt`, owner row `deadesports99@gmail.com`.
- [x] Master phase table updated.

---

## 🎯 Acceptance (met)

- Key 24 chars, mixed case + digits, DB me sirf hash; plain key sirf generate time.
- Owner admin email DB me seeded (real gmail), no second owner row.
- Backend build + full test suite green, Android untouched.
