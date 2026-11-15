# Activation checklist — Phases 1–5 on the real Firebase project

> Everything below runs on the machine that holds the service account (Render, or your
> laptop if you put the JSON in `backend/.env`).
>
> **Updated 2026-11-14:** step 1 is **partly done** — the Firestore database `(default)`
> (`asia-south1`), its deny-all rules and the 4 composite indexes are deployed, and
> `.firebaserc` is pinned. What is still missing is the **service account JSON** (step 2)
> and **Firebase Storage setup in the console** (step 1b). Full record:
> `PHASE-0-INFRA-SETUP.md`.
>
> Before 2026-11-14 this laptop could not prove any Firebase write because the project had
> no Firestore database at all and no `FCM_CREDENTIALS_JSON`. The database now exists and
> accepts writes (proven through the Firebase MCP), but our backend still cannot write
> until step 2 is done.

---

## 1. Deploy the Firebase project files

```bash
cd "C:/Free Fire turnament"
firebase deploy --only firestore:rules,firestore:indexes,storage --project deadesports-865d2
```

**Status:** `firestore:rules` + `firestore:indexes` ✅ deployed 2026-11-14
(`firebase/.firebaserc` now pins the project, so `--project` is optional when you run it
from `firebase/`). `storage` ❌ still refuses:

```
Error: Firebase Storage has not been set up on project 'deadesports-865d2'.
Go to https://console.firebase.google.com/project/deadesports-865d2/storage and click 'Get Started'
```

### 1b. Firebase Storage (one console click, needs the Blaze plan)

Console → Storage → **Get Started** → production mode → location `asia-south1`, then:

```bash
cd firebase && firebase deploy --only storage
```

What it does:

| File | Effect |
| --- | --- |
| `firebase/firestore.rules` | denies **all** client access to `live_events` and `stats` |
| `firebase/firestore.indexes.json` | 4 composite indexes the Phase 2 feed needs |
| `firebase/storage.rules` | denies all client access to the bucket (token URLs still work) |

Indexes take a few minutes to build. A Phase 2 failure with *"requires an index"* means
"wait longer", not "broken code".

**Console checks afterwards:** Firestore → Rules shows a publish timestamp; Storage →
Rules likewise. If either page shows the default *test mode* rules, the deploy did not
apply — stop and fix it, because test-mode rules are a public write hole.

---

## 2. Prove it with one command (do this BEFORE enabling anything)

```bash
cd backend
npm run verify:firebase
```

It writes only throwaway documents (`_verify/*`, one `MIRROR_PING` event, one 1×1 PNG),
verifies them, and **deletes them again**. It never touches player data, never emits a
player-visible event, and never edits your `.env`.

Expected healthy output:

```
  ✔ PASS Setup — service account (1ms)
         project deadesports-865d2 · f***@deadesports-865d2.iam.gserviceaccount.com
  ✔ PASS Setup — Firestore round-trip
  ✔ PASS Phase 1 — live mirror write
         document <id> in "live_events" · tenantId … · expireAt set (TTL)
  ✔ PASS Phase 2 — live feed read + budget
         1 event(s) read for tenant … · budget 1/500000 this month
  ✔ PASS Phase 4 — Storage upload + public URL
         media/…/match-screenshot/…png in "…firebasestorage.app" · 70 bytes served as image/png
  ✔ PASS Phase 5 — stats snapshot document
         1 snapshot(s) → stats/<tenantId>_<date> · currency INR · 6 counts
  – SKIP All — security rules (manual)

✔ 6 check(s) passed, 1 skipped
```

`Phase 1` and `Phase 2` only run when `FIREBASE_LIVE_MIRROR=true` / `LIVE_FEED_ENABLED=true`.
You can set them to `true` temporarily just for this command — the script itself is
read-only to your environment.

**Read the verdict literally.** `⚠ Nothing was verified … this is NOT a pass` and
`exit 1` mean the tool proved nothing; do not enable a phase on that output.

Every failure prints the fix inline (API disabled / missing role / missing index /
wrong bucket name / invalid private key).

---

## 3. Enable, in this order, one phase at a time

Flip one variable, restart, watch for a few minutes, then the next.

| Order | Env | What to look for |
| --- | --- | --- |
| 1 | `FIREBASE_LIVE_MIRROR=true` | Firestore console → `live_events` gets documents as slots/rooms change |
| 2 | `LIVE_FEED_ENABLED=true` | `GET /api/v1/live/events` returns events; `/live/budget` stays low |
| 4 | `MEDIA_UPLOAD_ENABLED=true` | `/api/v1/media/config` says `enabled: true`, then upload a logo |
| 5 | `STATS_EXPORT_ENABLED=true` | next morning, `stats/<tenantId>_<yesterday>` exists |

Always required: `FCM_CREDENTIALS_JSON` (one line), and `FIREBASE_PROJECT_ID=deadesports-865d2`.

Phase 3 has **no flag** — it is already live (the `firebaseUid` column is applied and
production now refuses `PHONE_OTP_BYPASS=true`).

### One-time after Phase 1 is live

Firestore console → Firestore → TTL → create a policy on collection `live_events`,
field `expireAt`. Without it the mirror grows forever. **This is the only "$ bill" risk
in the whole programme** and the TTL is what removes it.

---

## 4. Rollback (any phase, any time)

```
FIREBASE_LIVE_MIRROR=false
LIVE_FEED_ENABLED=false
MEDIA_UPLOAD_ENABLED=false
STATS_EXPORT_ENABLED=false
```

Restart. No deploy, no migration, no client change, no data loss. The `/ws` gateway and
every REST route behave exactly as before Firebase existed.

---

## 5. Cost after activation (stated in advance, as promised)

| Phase | Volume | Monthly cost estimate |
| --- | --- | --- |
| 1 mirror | 1 write per broadcast, batched, TTL 24h | free tier covers it at this scale |
| 2 feed | 1 read per client catch-up, capped by `LIVE_FEED_MONTHLY_READ_BUDGET` | capped by design |
| 4 storage | 1 object per uploaded image | pennies (5 MiB cap per file) |
| 5 stats | 1 doc per tenant per day | ~90 writes/month |

The budget guard in Phase 2 is the hard stop: once the monthly read budget is spent the
endpoint answers `429 budget_exhausted` and clients fall back to `/ws` — the platform
keeps working, the bill does not run.
