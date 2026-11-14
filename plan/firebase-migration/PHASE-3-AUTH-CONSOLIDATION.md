# Phase 3 — Auth consolidation: stable identity + production auth guards

> **Goal (two parts, one of them urgent):**
> 1. Give every Firebase-authenticated account a **stable external identity**
>    (`User.firebaseUid`) instead of re-identifying people by phone/email strings.
> 2. Close a **real production auth hole**: today `PHONE_OTP_BYPASS=true` only prints a
>    warning on boot, so a live deployment with that flag accepts *any phone + any OTP*.
>
> **Guarantee:** no login flow, response shape, or existing token changes. A deployment
> that lands before the column exists still lets players log in.

---

## 1. What was wrong

| Problem | Consequence |
| --- | --- |
| Firebase verified a UID on every login and then **threw it away** | No way to link "the same person" across phone OTP, Google, and email; every login re-derives identity from a phone number or email string |
| Identity was keyed on mutable fields (`phoneNumber`, `email`) | A changed number looks like a different person; a deleted row cannot be re-matched to the Firebase account |
| `PHONE_OTP_BYPASS=true` in production was a **warning, not a refusal** | One forgotten flag = every player account is open to anyone with any 10-digit number |

The third row is the important one. It is a live auth bypass sitting behind a log line.

---

## 2. What changed

### 2.1 `User.firebaseUid` (nullable, additive)

```prisma
firebaseUid    String?     // verified Firebase Auth UID (phone OTP / Google)
@@unique([tenantId, firebaseUid])
```

**Per tenant, not global** — on purpose. The same human can legitimately hold an
account in two tenants (two organisers), and both accounts are backed by the same
Firebase UID. A global unique constraint would block the second registration. Postgres
allows many `NULL`s in a unique index, so every pre-existing row stays valid.

DDL that will run (`prisma migrate diff`, dry-run against the live DB):

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firebaseUid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_firebaseUid_key" ON "User"("tenantId", "firebaseUid");
```

### 2.2 UID linking, best-effort by design

`linkFirebaseUid(userId, uid, currentUid?)` in `auth.service.ts`:

| Situation | Behaviour |
| --- | --- |
| No UID (email/password login) | returns immediately |
| UID already matches | **no UPDATE at all** (no extra write per login) |
| UID differs / is null | one `UPDATE User SET firebaseUid = …` |
| UPDATE fails (column missing, unique clash) | warned **once**, login continues |

Called after successful auth in three places: phone registration, Google
login/registration, phone login. To prevent a duplicate-UID clash from ever blocking a
login, nothing is written at `create()` time — only this optional follow-up update.

### 2.3 Production guard

`assertDevAuthConfig()` now refuses to boot a production process with **either** escape
hatch on:

```
DEV_FAKE_FIREBASE=true   → dev_otp_<phone> / dev_google_<uid> tokens accepted
PHONE_OTP_BYPASS=true    → ANY 10-digit phone + ANY 6-digit OTP accepted
```

Both remain available in `NODE_ENV=development` (the boot warning in `server.ts` is
unchanged), so local demo work is unaffected.

---

## 3. Deploy order — **mandatory**, not optional

> This section was corrected after an HTTP smoke test caught a real failure. The
> original wording claimed "either order is safe". It is not, and the reason matters.

**Prisma selects every scalar field by default.** So the moment the generated client
knows about `firebaseUid`, *every* read of `User` — `authenticate`, admin OTP, player
profile, everything — fails against a database that does not have the column yet:

```
[Prisma Unknown Error] code=P2022
Invalid `prisma.user.findUnique()` invocation in src/middlewares/auth.middleware.ts:85:32
The column `User.firebaseUid` does not exist in the current database.
```

Consequence: the whole API returns `500 Database operation failed` for every
authenticated route until the column exists. The `try/catch` around the linking write
does nothing here — the failure happens in *reads*, not in that write.

**Why the unit tests did not catch it:** `FakePrisma` ignores `select`, so a missing
column is invisible to them. It was caught by the Phase 4 HTTP smoke test against the
real database — which is exactly why these phases are verified over real HTTP too.

### The order that must be followed

```bash
cd backend
npm run prisma:push          # adds the column + unique index
# only now deploy / restart the API
```

### What was applied to the live database

Applied surgically (two statements only, **not** `prisma db push`, which would also
force unrelated drift to match the schema):

```sql
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;
CREATE UNIQUE INDEX "User_tenantId_firebaseUid_key" ON "User"("tenantId", "firebaseUid");
```

Both are additive and reversible:

```sql
ALTER TABLE "User" DROP COLUMN "firebaseUid";   -- undo (rollback path)
```

---

## 4. Verification

- [x] `npx tsc --noEmit` — clean (after `prisma generate` picked up the new field)
- [x] `npm test` — **382 tests, 382 pass, 0 fail** (10 new in `tests/authFirebaseUid.test.ts`)
- [x] phone registration stores `mock_9820011122` as the UID — exactly one UPDATE
- [x] new Google player stores the verified Google UID
- [x] `firebaseUid` is **not** present in the API payload (`sanitizeUser` untouched)
- [x] legacy row (`firebaseUid: null`) is backfilled on its next phone login
- [x] already-correct UID → **zero** UPDATE calls
- [x] UPDATE forced to throw (simulating the missing column) → login still returns a token
- [x] `PHONE_OTP_BYPASS=true` + `NODE_ENV=production` → `assertDevAuthConfig()` throws
- [x] `DEV_FAKE_FIREBASE=true` + production → still throws (unchanged)
- [x] development with both flags → no throw
- [x] `prisma migrate diff` dry-run shows only the two additive statements above
- [x] **Applied to the live database** — column + unique index created surgically;
      4 existing rows remain readable with `firebaseUid = NULL`
- [x] Post-DDL HTTP smoke: `401` without a token, `403` for a player on an admin
      route, `200` for an admin — no more `P2022` on any `User` read
- [x] Rollback = `ALTER TABLE "User" DROP COLUMN "firebaseUid";` (one line)

---

## 5. Rollback

```bash
# code: nothing to do — it tolerates a missing column
# database (optional):
ALTER TABLE "User" DROP COLUMN "firebaseUid";
```

No client change, no token change, no response-shape change.

---

## 6. Files touched

| File | Change |
| --- | --- |
| `backend/prisma/schema.prisma` | `firebaseUid String?` + `@@unique([tenantId, firebaseUid])` |
| `backend/src/services/auth.service.ts` | `linkFirebaseUid()` + 3 call sites (after successful auth only) |
| `backend/src/services/firebase.service.ts` | `assertDevAuthConfig()` now also refuses `PHONE_OTP_BYPASS=true` in production |
| `backend/tests/authFirebaseUid.test.ts` | **new** — 10 tests |
| `backend/src/generated/prisma/**` | regenerated (`prisma generate`) |

**Not touched:** `server.ts` (the dev warning stays), all routes/controllers, Android,
player-web, admin-web, and every existing login response.

---

## 7. Deliberately out of scope

- No rewrite of the login flows — they keep working exactly as today.
- No forced "Firebase-only" identity: email + password accounts remain first-class.
- No client changes: the app never sees `firebaseUid`.
- No Firebase custom claims yet — those only become necessary if a future phase wants
  direct client reads of Firestore (see Phase 2 §3 for why we avoided that).

Next: **Phase 4 — Firebase Storage** for tournament banners / tenant logos (no DB
change, no auth change). See `README.md` §5.
