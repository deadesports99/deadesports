# Phase 0 — Infrastructure setup (Firebase project provisioning)

> **Why this phase exists:** Phases 1–5 were fully coded and tested, but the Firebase
> project `deadesports-865d2` had **no Firestore database at all**, no deployed rules,
> no indexes and no service account. Every phase was therefore a no-op in the real world.
> Phase 0 is the infra that must exist *before* `npm run verify:firebase` can ever be green.
>
> **Owner:** Jay Kumar · **Started/updated:** 2026-11-14

---

## Status board

| Item | State | Evidence |
| --- | --- | --- |
| Firebase CLI login | ✅ `deadesports99@gmail.com` | `firebase login:list` |
| Project | ✅ `deadesports-865d2` (number 116392399100) | `firebase projects:list` |
| **Firestore database** | ✅ **created** `(default)` · `asia-south1` · standard edition | `firebase firestore:databases:list` → 1 database |
| **Firestore rules** | ✅ deployed (deny-all for clients) | `firebase deploy --only firestore:rules` → `released rules … to cloud.firestore` |
| **Firestore indexes** | ✅ 4 composite indexes deployed (`live_events`) | `firestore:indexes` → 4 entries |
| Index build finished | ⏳ state `CREATING` at deploy time (few minutes) | `firebase firestore:indexes` |
| `.firebaserc` | ✅ added (`firebase/.firebaserc`, default → deadesports-865d2) | file in repo |
| Firestore write/read round-trip | ✅ proven via Firebase MCP (doc created, read back, deleted) | `_verify/mcp-setup-check`, then collection list → `{}` |
| **Firebase Storage bucket** | ❌ **not set up** — console "Get Started" required (needs Blaze) | `firebase deploy --only storage` → "Firebase Storage has not been set up on project" |
| **Storage rules** | ❌ blocked by the line above | `get_security_rules storage` → no active rules |
| **Service account** | ✅ **provisioned** 2026-11-14 (key in `backend/.env` as `FCM_CREDENTIALS_JSON`) | `verify:firebase` → `PASS Setup — service account · f***@deadesports-865d2.iam.gserviceaccount.com` |
| **`verify:firebase` result** | 🟢 **5 PASS · 1 FAIL (Storage only) · 1 SKIP** | see “Activation run” below |
| **Phase 1 mirror** | ✅ **enabled locally** + real document proven | `live_events` doc with `expireAt` written by `npm run verify:mirror` → `written:1, failedBatches:0` |
| **Phase 2 feed** | ✅ **enabled locally**, read path proven | `PASS Phase 2 — live feed read + budget` |
| **Phase 5 stats** | ✅ proven (`stats/<tenantId>_<date>` written, left in place on purpose) | `PASS Phase 5` |
| **TTL policy** (`live_events.expireAt`) | ❌ **blocked — project billing is disabled** · ⚠️ **replaced by an in-app purge** ✅ | TTL API → `403 "Project … has billing disabled. Please enable it."`; `billingInfo` → `billingEnabled: false` |
| **Free TTL replacement** — `liveMirrorService.purgeExpired()` + 30-min scheduler | ✅ **shipped and proven on the real project** | temp probe: wrote 1 expired + 1 fresh doc → `purge deleted: 1` · `expired doc still exists? false` · `fresh doc still exists? true`; server log: `🧹 live mirror purge every 30 min` |
| **Firebase Storage** | ❌ **blocked — needs the Blaze plan** (owner will not add a card) → **deferred** | `firebase deploy --only storage` → “has not been set up”; Storage requires billing on new projects. Nothing in the app reads `logoUrl` today, so no feature is missing |
| `gcloud` (alternative key path) | ❌ auth expired `invalid_grant`, and the logged-in account is not the project owner | `gcloud projects describe` |
| Android apps registered | ✅ 4 (Player/Admin × Tourney/Thunder eSports) | `firebase apps:list` |
| `firebaseUid` backfill | 🟡 5 of 9 local users linked | SQL count on `User` |
| FCM device tokens | ❌ 0 rows → push never exercised | SQL count on `User.fcmToken` |

**Net result:** Firestore is real and writable, **Phases 1 + 2 are enabled and proven end-to-end**
from the backend itself. Phase 4 (Storage) is the only thing still blocked, and it needs one
console click. Phase 5 runs on its 24 h scheduler; only the TTL policy is left to set
by hand.

---

## Billing reality (checked 2026-11-14) — the one thing that cannot be automated

```
GET https://cloudbilling.googleapis.com/v1/projects/deadesports-865d2/billingInfo
{ "projectId": "deadesports-865d2", "billingAccountName": "", "billingEnabled": false }
```

So, on the free **Spark** plan:

| Feature | Free plan? | Our answer |
| --- | --- | --- |
| Firestore database + rules + indexes | ✅ yes | done, mirror/feed live |
| Firestore **TTL policy** | ❌ no (`billing disabled`) | replaced by `liveMirrorService.purgeExpired()` every 30 min (`FIREBASE_LIVE_MIRROR_PURGE_MINUTES`, 0 = off) — same outcome, no card |
| **Firebase Storage** | ❌ no | deferred: no screen reads `logoUrl`/`screenshotUrl` yet. When one does, either paste an external URL or revisit Storage after billing |
| FCM push | ✅ free | still to be exercised (see the FCM row) |
| Auth (phone/Google) | ✅ free | already in use |

Rule for the future: **never let a phase depend on a billed Firebase feature.** If it needs one, ship a
self-hosted equivalent (as the purge does) or leave it off.

---

## Activation run — 2026-11-14

```
✔ PASS Setup — service account         project deadesports-865d2
✔ PASS Setup — Firestore round-trip    wrote + read + deleted _verify/…
✔ PASS Phase 1 — live mirror write     document … in "live_events" · expireAt set (TTL)
✔ PASS Phase 2 — live feed read+budget
✖ FAIL Phase 4 — Storage upload        (bucket not provisioned — console)
✔ PASS Phase 5 — stats snapshot        stats/53a09545-…_2026-11-14 · INR · 6 counts
– SKIP All — security rules            Admin SDK bypasses rules; console check only
✖ 1 of 7 check(s) FAILED
```

Enabled afterwards (`.env`, restart only): `FIREBASE_LIVE_MIRROR=true`,
`LIVE_FEED_ENABLED=true`. `MEDIA_UPLOAD_ENABLED` / `STATS_EXPORT_ENABLED` stay `false`.

### Two real bugs the activation run exposed (both fixed)

| # | Bug | Why unit tests missed it | Fix |
| --- | --- | --- | --- |
| 1 | **Phase 2 feed was dead on real Firestore**: `buildQueries()` wrapped the `USER`-batch query in `fresh()`, which added a *second* `orderBy('serverTimeMs')` → `3 INVALID_ARGUMENT: order by clause cannot contain duplicate fields serverTimeMs` → the whole feed returned `source="error"` | the fake Firestore in `tests/liveFeed.test.ts` accepts duplicate `orderBy` calls happily | removed the wrapper in `services/liveFeed.service.ts`; 10/10 feed tests still pass |
| 2 | **Phase 1 proof needed an index we never shipped** (`type` + `createdAt` composite); the check failed with `9 FAILED_PRECONDITION: The query requires an index` | the harness was only ever run with the *in-memory* counter | `scripts/verifyFirebase.ts` now reads back with an equality filter only (single-field index) and picks the newest doc in code — no extra index to deploy or wait for |

Both fixes: `npx tsc --noEmit` clean, `tests/liveFeed.test.ts` 10/10.

### Still console-only (cannot be automated from here)

1. ~~TTL policy~~ → replaced by the 30-minute purge sweep, verified above. Nothing to click.
2. ~~Storage “Get Started”~~ → needs the Blaze plan (billing disabled). Deferred on purpose; revisit only when a screen actually renders an uploaded image.

---

## What was run (copy-paste record)

```bash
# 1. Firestore database — location is PERMANENT, asia-south1 (Mumbai) chosen for India
firebase firestore:databases:create "(default)" \
  --location asia-south1 --edition standard \
  --delete-protection DISABLED --project deadesports-865d2

# 2. Project pin so later deploys need no --project flag
#    firebase/.firebaserc → { "projects": { "default": "deadesports-865d2" } }

# 3. Rules + the four composite indexes the Phase 2 feed needs
cd firebase && firebase deploy --only firestore:rules,firestore:indexes

# 4. Storage — BLOCKED, see below
cd firebase && firebase deploy --only storage
# → Error: Firebase Storage has not been set up on project 'deadesports-865d2'
```

Notes that matter later:

- **`delete-protection DISABLED`** — deliberate: this database holds only
  `live_events` (24 h TTL) and `stats` (one doc/tenant/day). Deleting and re-creating it
  costs nothing, so the escape hatch stays open. Re-enable it after the first tenant goes
  live if we ever store something we cannot rebuild.
- **Location `asia-south1` cannot be changed** after creation. Moving later = new project.
- Rules deployed are the repo's deny-all: clients can never read `live_events` or `stats`
  directly. The backend Admin SDK bypasses rules, which is the design (see README §9).

---

## Two things only a human can finish

### A. Service account JSON — ✅ DONE (2026-11-14)

The key `deadesports-865d2-firebase-adminsdk-fbsvc-…json` was flattened into one line and
appended to `backend/.env` as `FCM_CREDENTIALS_JSON=` (2366 chars, `firebase-adminsdk-fbsvc@deadesports-865d2.iam.gserviceaccount.com`).
`.env` is gitignored, so it never lands in the repo — but it is **also** still sitting in
`~/Downloads`; delete that copy once Render has its own value.

For production, the same one-liner goes into the Render dashboard (`FCM_CREDENTIALS_JSON`,
`sync: false` — already declared in `render.yaml`).

Acceptance re-check, any time: `cd backend && npm run verify:firebase` → 5 pass / 1 fail
(Storage) / 1 skip until Storage is set up; after that 6 pass / 1 skip.

### B. Firebase Storage (blocks Phase 4)

Console → https://console.firebase.google.com/project/deadesports-865d2/storage
→ **Get Started** → production mode → location `asia-south1`.
Firebase Storage requires the **Blaze** (pay-as-you-go) plan; the 5 MiB-per-upload cap in
Phase 4 keeps it inside the free monthly quota.

Then re-run `cd firebase && firebase deploy --only storage` and expect
`released rules storage.rules`.

---

## The order the rest of the work runs in

| Step | Action | Gate before moving on |
| --- | --- | --- |
| 0.1 | ✅ Firestore + rules + indexes + `.firebaserc` | `firestore:databases:list` shows `(default)`; MCP collection list works |
| 0.2 | ✅ Service account into `backend/.env` | `npm run verify:firebase` → 5 pass / 1 fail (Storage) / 1 skip |
| 1 | ✅ `FIREBASE_LIVE_MIRROR=true`, restart | `live_events` got a real doc (`verify:mirror` → `written:1`) |
| 1b | ✅ Free TTL replacement: `FIREBASE_LIVE_MIRROR_PURGE_MINUTES=30` (no console, no billing) | `🧹 live mirror purge every 30 min`; probe deleted 1 expired doc, kept the fresh one |
| 2 | ✅ `LIVE_FEED_ENABLED=true`, restart | `GET /api/v1/live/events` returns events; `/live/budget` stays low |
| 0.3 | ⏸️ Storage **deferred** (needs Blaze, no consumer yet) | nothing renders `logoUrl` today |

---

## End-to-end match proof — 2026-11-15

**A. API + money (`scripts/e2eMatchFlow.ts`, patched for local):** the script was hard-wired to the
old hosted tenant (`a3c11cd0…`) and forced SSL. Now `E2E_TENANT` (default local `53a09545…`) and
SSL only for `supabase|render|amazonaws` hosts; it also tops the auto-created bots to ₹200 before
joining (the join/payout money path itself is untouched).

```
match 9 created → 48 joined, 0 failed → SLOTS_FULL 48/48
JOIN_FEE 48 rows ₹480.00 · a wallet ₹200.00 → ₹190.00
room published + revealed · seated player reads 77112233 / fire123
prizes ₹345.00 == rank share + kills × ₹5 · double payout → 409, no extra money
scoreboard 48 rows
ALL 14 CHECKS PASSED ✅
```

**B. Phone UI:** match 10 (₹10, Bermuda Squad) appeared in the app as `0/48` → tapped
**Join • ₹10** → confirm sheet (saved IGN, entry fee, balance) → **Confirm & Join Slot**:

```
TournamentSlot rows for match 10   → 1
WalletLedger JOIN_FEE                → ₹10.00  (referenceId = match 10)
wallet 9999900003                   → ₹2,145 → ₹2,135
card after reopen                   → "Joined ✓", 1/48
```

**C. Mirror:** Firestore `live_events` holds the whole run — `SLOT_BOOKED×48`, `WALLET_UPDATED×48`,
`MATCH_CREATED`, `ROOM_CREDENTIALS_REVEALED×2`, `MATCH_STATUS_CHANGED×2`; a match-scoped query
(`where data.tournamentId == match10`) returns `SLOT_BOOKED` + `MATCH_CREATED` with
`audience: TENANT` and `expireAt` — single-field query, no composite index, no billing.
`GET /api/v1/live/events` returns the same events to an authenticated player.

Screenshots: `tmp_screens/e2e_match_visible.png`, `tmp_screens/e2e_final.png`.


---

## FCM token bug found while activating (fixed in code)

`User.fcmToken` was empty for every user, so no push could be addressed. Cause: the only sender
was `TourneyMessagingService.onNewToken`, which Firebase fires on **first app start** — before
the player logs in — so `POST /auth/fcm-token` answered **401** and the token was never retried.

| File | Change |
| --- | --- |
| `android/core/.../fcm/FcmTokenSync.kt` (new) | if a session exists: read the FCM token, cache it in DataStore, `POST /auth/fcm-token`. Never throws (white-label builds without `google-services.json` are unaffected) |
| `PlayerApplication` | sync on app start when already logged in |
| `PlayerViewModel` | sync right after every `persistLogin(...)` (4 call sites: phone, Google, email OTP, register) |

APK built (`android/app-player/build/outputs/apk/debug/app-player-debug.apk`, 27.6 MB, `BUILD SUCCESSFUL`).

**Verified 2026-11-15** (phone reconnected):

```
adb install -r …app-player-debug.apk          → Success
POST /api/v1/auth/fcm-token                    → 200 OK (27ms)
logcat  FcmTokenSync: FCM token synced to backend
User.fcmToken count                            → 1  (9999900003)
sendEachForMulticast                           → successCount: 1, failureCount: 0
dumpsys notification                           → channel=ff_room_alerts, heads-up shown
```

So push was broken end-to-end (no token) and is now proven end-to-end (token → delivery →
notification with deep-link intent). Nothing here needs billing.

| 4 | `MEDIA_UPLOAD_ENABLED=true`, restart | `/api/v1/media/config` → `enabled: true`; one real upload returns a fetchable URL |
| 4b | admin-web file input → `POST /api/v1/media/upload` → `logoUrl` | upload a logo from the console, image renders |
| 5 | `STATS_EXPORT_ENABLED=true`, restart | next morning `stats/<tenantId>_<date>` exists |
| FCM | register a device token from the Android app | `User.fcmToken` count > 0, then one test push arrives |
| 6 | chat / device telemetry dual-write | **only after** 0.2–0.3 are green |

Every step is reversible with one env flag + restart (README §8). No step requires a
client release; `/ws` and every REST route keep working with Firebase fully switched off.
