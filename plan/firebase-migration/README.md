# Firebase Migration — Master Plan & Delivery Record

> **Status:** Phases 1–5 **implemented**; **Phases 1 + 2 are switched ON and proven against the
> real project** (2026-11-14). Free (Spark) plan only: Firestore `(default)` in `asia-south1`,
> deny-all rules + 4 composite indexes deployed, service account in `backend/.env`,
> `verify:firebase` = **5 PASS / 1 FAIL / 1 SKIP**. Because **billing is disabled**, the console
> TTL policy is replaced by `liveMirrorService.purgeExpired()` (30-min sweep, proven) and Phase 4
> **Storage is deferred** (needs Blaze; nothing renders `logoUrl` yet). See `PHASE-0-INFRA-SETUP.md`.
> **Owner:** Jay Kumar · **Rule of the whole programme: nothing that works today may stop working.**
> **Last updated:** 2026-11-14 · `tsc` clean · **439/439 tests pass**

---

## 1. The ask

The boss wants "all our data in Firebase, including whatever happens in real time,
done safely."

Translated into engineering terms, that is two different asks bundled together:

| Ask | What it actually means | Where Firebase is good |
| --- | --- | --- |
| "Data in Firebase" | Store our records in a Firebase database | ❌ weak — we are a relational, money-moving system |
| "Real time in Firebase" | Live updates delivered by Firebase instead of our own socket server | ✅ strong — this is exactly what Firebase is built for |

The plan below gives the boss the part where Firebase genuinely wins (real time,
push, auth, file storage, cheap aggregates) **without** moving the ledger off PostgreSQL.

---

## 2. What we have today (measured, not guessed)

```
backend/prisma/schema.prisma  13 models, 443 lines
                              13 UNIQUE constraints
45 source files               import the Prisma client
10 call sites                 prisma.$transaction (interactive, multi-row)
src/services/slotLock.service.ts  289 lines of Redis Lua seat-race protection
src/services/realtime.service.ts  own WebSocket gateway at /ws
firebase-admin                already installed — Auth token verify + FCM push
```

Money is moved inside transactions that touch several tables at once
(`WalletLedger` + `TournamentSlot` + `User` balance). That is the single
hardest thing to reproduce on Firestore, and it is the one thing we must not
get wrong.

---

## 3. Hard constraints

1. **No behaviour change** for existing clients (`/ws`, all REST routes, admin-web,
   Android, player-web).
2. **Every phase is switchable off** by an environment variable + a restart — no
   deploy, no data migration, no forced downtime.
3. **Money tables never leave PostgreSQL.** If a phase ever proposes moving
   `WalletLedger`, `DepositRequest`, `WithdrawalRequest`, `PaymentOrder` — reject it.
4. **Firebase failures are never fatal.** If Firebase is down, the API and the
   WebSocket gateway keep serving exactly as today.
5. **Cost guardrail.** Firestore bills per document read/write. Each phase states its
   write volume and the cap that protects us from a runaway bill.

---

## 4. Target architecture (end state of this programme)

```
                    ┌──────────────────────────┐
   Android / Web ──▶│ Express API (Render)     │
        │           │  └─ Prisma ──▶ PostgreSQL │  ← source of truth: money, slots, users
        │           │  └─ Redis  (seat races)   │
        │           │  └─ WebSocket /ws         │  ← unchanged, still primary
        │           │  └─ GET /live/events      │  ← Phase 2 catch-up (budgeted)
        │           │  └─ POST /media/upload    │  ← Phase 4 (admins only)
        │           └──────────┬───────────────┘
        │                      │ mirror (fire & forget, additive)
        │                      ▼
        └────────────▶  Firebase
                          ├─ Auth        (identity, already live)  ← Phase 3 links accounts
                          ├─ Firestore   (live_events feed, clients denied by rules)
                          ├─ FCM         (push, already live)
                          ├─ Storage     (logos, banners, screenshots) — Phase 4
                          └─ stats/*     (one aggregate doc per tenant per day) — Phase 5
```

PostgreSQL stays the referee. Firebase becomes the **delivery layer**: it tells
clients what changed and who they are. If the Firestore mirror is switched off,
clients fall back to the existing WebSocket and nothing is lost except
background/offline delivery.

---

## 5. Phases

| # | Phase | Risk | Breaks nothing? | Status |
| --- | --- | --- | --- | --- |
| 0 | **Infra** — Firestore database, rules, indexes, `.firebaserc` | none | ✅ nothing touches our data | 🟡 **Firestore done · Storage + service account pending** → `PHASE-0-INFRA-SETUP.md` |
| 1 | **Live mirror** — every WebSocket broadcast is also written to Firestore | Very low | ✅ additive + env-flagged | ✅ **done** · enabled locally · real doc proven |
| 2 | **Live reader** — `GET /api/v1/live/events` catch-up feed, server-mediated, with a read-cost budget guard | Low | ✅ new read path only | ✅ **done** · enabled locally · read proven on real Firestore |
| 3 | **Auth consolidation** — `firebaseUid` mapped on `User`, dev auth bypasses refused in production | Low | ⚠️ additive column + index (**already applied**) | ✅ **done** |
| 4 | **Storage** — admin uploads for tenant logos / banners / screenshots, permanent tokenised URLs | Very low | ✅ new endpoint only | ✅ **done** |
| 5 | **Stats snapshots** — one aggregate document per tenant per day (counts + money totals, no player data) | Very low | ✅ new collection only | ✅ **done** |
| 6 | **Non-money high-churn data** — chat, device-watch telemetry, live-event audit trail | Medium | ⚠️ dual-write first, then read-cutover | ⏳ proposed — **blocked on real verification** |
| — | **Full DB migration to Firestore** | **Very high** | ❌ no | ❌ **not recommended** — see §9 |

Phase 6 is deliberately **not started**: five phases of Firebase code have not yet been
proven against the real project, and adding a sixth risk on top of unverified ones is
how a "safe" migration stops being safe.

---

## 6. Delivery record — what actually shipped

Every phase below is in the working tree, compiles clean, and is covered by tests.
"Verified by" is deliberately narrow: unit tests cannot prove a Firestore write, and
this document does not pretend otherwise.

### Phase 1 — Firestore live mirror ✅

| | |
| --- | --- |
| New | `services/liveMirror.service.ts`, `scripts/verifyLiveMirror.ts`, `tests/liveMirror.test.ts` (19 tests) |
| Changed | `services/realtime.service.ts` (additive `setMirror`/`notifyMirror` hook, `buildMessage` helper), `config/env.ts`, `server.ts` (init + flush on shutdown), `.env.example`, `package.json` (`verify:mirror`) |
| Flag | `FIREBASE_LIVE_MIRROR=false` |
| Other vars | `FIREBASE_LIVE_MIRROR_COLLECTION=live_events`, `…_TTL_HOURS=24`, `…_MAX_QUEUE=500`, `…_BATCH_SIZE=100` |
| Design | bounded in-memory queue + batched writer, never throws, drops oldest when full, `expireAt` field for a Firestore TTL policy |
| Verified by | 19 unit tests + `npm run verify:mirror` (needs the server) |
| Not verified | a real document in `live_events` |

### Phase 2 — Live feed reader ✅

| | |
| --- | --- |
| New | `services/liveFeed.service.ts`, `controllers/live.controller.ts`, `routes/live.routes.ts`, `tests/liveFeed.test.ts` (10), `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `firebase/firebase.json` |
| Changed | `app.ts` (mount `/api/v1/live`), `config/env.ts`, `.env.example` |
| Flag | `LIVE_FEED_ENABLED=false` |
| Other vars | `LIVE_FEED_MAX_LIMIT=50`, `LIVE_FEED_DEFAULT_LIMIT=25`, `LIVE_FEED_MONTHLY_READ_BUDGET=500000` |
| API | `GET /api/v1/live/events?since=&limit=` · `GET /api/v1/live/budget` — JWT-scoped, server-mediated |
| Design | the client never talks to Firestore (it holds our JWT, not Firebase claims; direct access would leak cross-tenant `WALLET_UPDATED`). Redis counter `ff:livefeed:<YYYY-MM>:<tenantId>` (40-day TTL) stops reads at the budget → `429 budget_exhausted` |
| Verified by | 10 unit tests + **real HTTP**: 401 no-auth, 200 disabled, 429 when budget is 0 (zero Firestore calls) |
| Not verified | a real Firestore query (also proves the 4 composite indexes) |

### Phase 3 — Auth consolidation ✅ (+ a production security hole closed)

| | |
| --- | --- |
| New | `tests/authFirebaseUid.test.ts` (10) |
| Changed | `prisma/schema.prisma` (`User.firebaseUid String?` + `@@unique([tenantId, firebaseUid])`), `services/auth.service.ts` (`linkFirebaseUid()`, called at phone-register / Google-login / phone-login), `services/firebase.service.ts` (`assertDevAuthConfig()` now **refuses to boot production** with `PHONE_OTP_BYPASS=true`) |
| Flag | none — this one is live |
| Verified by | 10 unit tests + **real production-mode boot refusal** (`❌ PHONE_OTP_BYPASS=true is not allowed in production`) |
| DB state | **APPLIED** (see §7) |

### Phase 4 — Firebase Storage ✅

| | |
| --- | --- |
| New | `services/mediaStorage.service.ts`, `controllers/media.controller.ts`, `routes/media.routes.ts`, `tests/mediaUpload.test.ts` (16), `firebase/storage.rules` |
| Changed | `app.ts` (mount `/api/v1/media`), `config/env.ts`, `.env.example`, `firebase/firebase.json` (storage block) |
| Flag | `MEDIA_UPLOAD_ENABLED=false` |
| Other vars | `FIREBASE_STORAGE_BUCKET` (empty ⇒ `<projectId>.firebasestorage.app`), `MEDIA_MAX_UPLOAD_BYTES=5242880` |
| API | `POST /api/v1/media/upload?purpose=tenant-logo\|tournament-banner\|match-screenshot` (raw image bytes) · `GET /api/v1/media/config` |
| Design | **zero new dependencies** (raw body, no multer, no client filename). Type from magic bytes, not header. Path `media/<tenantId>/<purpose>/<uuid>.<ext>`. Permanent URL via Firebase download token (not a signed URL that expires). ADMIN/SUB_ADMIN only, 10 uploads/min, bucket denies all client access |
| Verified by | 16 unit tests + **real HTTP**: 401 / 403 (player) / 200 (admin config) / 400 (no body) / 403 with a readable reason when disabled, and a normal JSON route still returns 200 (no parser regression) |
| Not verified | a real object in the bucket + its public URL |

### Phase 5 — Daily stats snapshots ✅

| | |
| --- | --- |
| New | `services/statsExport.service.ts`, `scripts/exportStats.ts`, `tests/statsExport.test.ts` (13) |
| Changed | `config/env.ts`, `server.ts` (start/stop scheduler), `.env.example`, `package.json` (`export:stats`) |
| Flag | `STATS_EXPORT_ENABLED=false` |
| Other vars | `STATS_EXPORT_INTERVAL_HOURS=24`, `STATS_EXPORT_DAYS=3`, `STATS_EXPORT_COLLECTION=stats` |
| Writes | `stats/<tenantId>_<YYYY-MM-DD>` — money totals + counts, **no phone/name/user id/balance** |
| Design | reuses `getDailySettlement()` (the owner's P&L service) so the snapshot can never disagree with the report. Deterministic ids ⇒ idempotent. Recomputes the last 3 days every run ⇒ a missed night heals itself. ~3 writes/day for one tenant |
| Verified by | 13 unit tests + a **real-PostgreSQL run** (injected sink, no Firestore writes): 2 documents, correct ids, real counts |
| Not verified | a real document in `stats` |

### Verification harness ✅ (the tool that closes the gap above)

| | |
| --- | --- |
| New | `scripts/verifyFirebase.ts`, `services/verifyReport.ts`, `tests/verifyReport.test.ts` (12), `ACTIVATION-CHECKLIST.md` |
| Changed | `package.json` (`verify:firebase`) |
| Checks | service account usable · Firestore round-trip · Phase 1 mirror write (read back from Firestore, not just an in-memory counter) · Phase 2 feed `source === "firestore"` (catches missing indexes) · Phase 4 upload + public URL fetch · Phase 5 snapshot read-back · rules (manual) |
| Honesty rule | **skipped is not passed** — if every check skips, the command exits `1` with "this is NOT a pass" |
| Safety | writes only `_verify/*`, one `MIRROR_PING`, one 1×1 PNG — all deleted afterwards; never edits `.env`; never touches player data |
| Errors | each known Google error is mapped to its fix (API disabled / missing role / missing index / wrong bucket / invalid private key) |

---

## 6b. Supabase decommissioning ✅ (2026-11-14)

The app already had **zero runtime dependency** on Supabase (no `@supabase/supabase-js`, no SDK,
local Docker Postgres as source of truth). This sweep removed the leftovers so nobody
re-introduces them by copy-paste:

| Removed / changed | Why it was safe |
| --- | --- |
| `supabase_url` + `supabase_anon_key` from all 4 `client_config.json` (player APK, admin APK, `clients/_template`, `clients/sample_client`) | no Kotlin/TS file ever read them — the field was dead config, and an empty `anon_key` invites someone to paste a real one into a git-tracked asset |
| `backend/src/scripts/enableRealtime.ts` (deleted) | it only added tables to the `supabase_realtime` publication; nothing referenced it, and realtime is our own `/ws` gateway + Firestore mirror |
| `supabase` and `supabase-remote` MCP servers from `mcp_config.json` and `.agents/mcp_config.json` | tooling only; Firebase MCP stays |
| Supabase wording in `env.ts`, `prisma.ts`, `tournament.service.ts`, `time.routes.ts`, `checkTime.ts`, `setupTimeSync.ts`, `testMatchLifecycle.ts` | comments/logs now say PostgreSQL; `/api/v1/time` answers `source: "postgres"` instead of `"supabase_postgres"` |
| `get_server_time()` created in the local Postgres | `/api/v1/time` was silently falling back to `source: "server_clock"`; it now reads the database clock as designed |
| `backend/.env.supabase.bak` kept (gitignored) | it is the only copy of the hosted data pointer — delete it once nobody needs the old tenant `a3c11cd0…` |

Docs updated: `LOCAL_DEV.md` now says the Supabase section is *data recovery only*, and
`start-local.bat` starts all three servers + `adb reverse`.

Final state: `tsc` clean, **439/439** tests pass, `/api/v1/time` → `source: "postgres"`.

---

## 7. Evidence ledger

| Claim | Evidence |
| --- | --- |
| Compiles | `npx tsc --noEmit` clean after every phase |
| No regressions | **439/439** tests pass (up from 423 at handover; 80 of them were written for this programme — 19 + 10 + 10 + 16 + 13 + 12) |
| Phase 2 works over HTTP | 401 no token · 200 while disabled · **429 `budget_exhausted` with zero Firestore calls** |
| Phase 4 works over HTTP | 401 / 403 player / 200 admin config / 400 empty body / clear 403 when disabled |
| Phase 3 guard works | `❌ PHONE_OTP_BYPASS=true is not allowed in production`, process refuses to boot |
| Phase 5 works on real Postgres | 2 snapshots built from the live DB (`matchesScheduled: 2`, `newPlayers: 2`), no PII in the payload |
| `verify:firebase` behaves honestly | local run with no service account → `1 of 7 FAILED`, `exit=1` |
| **Firestore exists and accepts writes** | 2026-11-14: `firestore:databases:create` → `Successfully created … databases/(default)`; a doc written through the Firebase MCP into `_verify/mcp-setup-check`, read back, then deleted → root collection list = `{}` |
| Firestore rules live | `firebase deploy --only firestore:rules` → `released rules firestore.rules to cloud.firestore`; `get_security_rules` returns the repo's deny-all file |
| Firestore indexes live | `firestore:indexes` → 4 entries on `live_events` (`audience+serverTimeMs`, `+tenantId`, `+userId`, `+userIds CONTAINS`), state `CREATING` right after deploy |
| Firestore empty before enabling | MCP `firestore_list_collections` on the root → `{}` (no stray test data left behind) |
| **Backend really writes to Firestore** | 2026-11-14 `npm run verify:mirror` → `stats: {"written":1,"failedBatches":0}`; MCP read of `live_events` shows the doc with `expireAt` (TTL field set) and `serverTimeMs` |
| **`verify:firebase` on the real project** | `PASS Setup (service account)` · `PASS Setup (round-trip)` · `PASS Phase 1 mirror` · `PASS Phase 2 feed` · `PASS Phase 5 stats` · `FAIL Phase 4 (no bucket)` · `SKIP rules` |
| Two production bugs the activation run caught | (a) Phase 2 feed died on real Firestore — duplicate `orderBy('serverTimeMs')` from a double `fresh()` wrapper → `INVALID_ARGUMENT`; wrapper removed. (b) Phase 1 proof demanded a `type+createdAt` index we never shipped; the probe now uses an equality filter and picks the newest doc in code. Details: `PHASE-0-INFRA-SETUP.md` |
| **FCM push proven end-to-end** (2026-11-15) | `POST /auth/fcm-token` → `200`, `FcmTokenSync: FCM token synced`, `User.fcmToken` = 1, `sendEachForMulticast` → `successCount: 1`, device `dumpsys notification` → `channel=ff_room_alerts`, heads-up shown |
| **Real match E2E, API + money** (2026-11-15) | `scripts/e2eMatchFlow.ts` → **ALL 14 CHECKS PASSED**: 48/48 seats, `SLOTS_FULL`, ₹480 fees once per seat, room reveal readable by a seated player, ₹345 prizes (rank share + kills), double payout → `409`, scoreboard 48 rows |
| **Real match E2E, phone UI** (2026-11-15) | Match 10 shown on device → tapped Join → slot row + `JOIN_FEE ₹10` ledger + wallet ₹2,145 → ₹2,135 + card flips to **Joined ✓ 1/48** |
| **Mirror carries a real match** (2026-11-15) | Firestore `live_events` after the E2E run: `SLOT_BOOKED×48`, `WALLET_UPDATED×48`, `MATCH_CREATED×1`, `ROOM_CREDENTIALS_REVEALED×2`, `MATCH_STATUS_CHANGED×2`; match-10 query returns `SLOT_BOOKED` + `MATCH_CREATED`, `audience: TENANT`, `expireAt` set; `/live/events` feed returns 50 events with real types |
| **NOT proven** | one real Storage object (needs the Blaze plan; Phase 4 deferred) |
| TTL without billing | console TTL refuses (`billing disabled`) → `purgeExpired()` + `FIREBASE_LIVE_MIRROR_PURGE_MINUTES=30` deletes expired `live_events` docs; probe: `purge deleted: 1`, fresh doc kept, log `🧹 live mirror purge every 30 min` |

### Database change actually applied (Phase 3)

Applied surgically, **not** via `prisma db push` (which would also have "fixed"
unrelated drift in a live money database):

```sql
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;
CREATE UNIQUE INDEX "User_tenantId_firebaseUid_key" ON "User"("tenantId", "firebaseUid");
```

Verification: 4 existing rows readable, `firebaseUid = NULL`. Rollback:
`ALTER TABLE "User" DROP COLUMN "firebaseUid";`

### Incident found and fixed during Phase 4 verification

Prisma selects every scalar column by default, so the moment `firebaseUid` existed in
the schema but not in the database, **every `User` read** failed with
`P2022: The column User.firebaseUid does not exist` — which broke auth middleware, admin
OTP and every authenticated route. Unit tests could never catch it (`FakePrisma` ignores
`select`), which is why each phase gets a real-HTTP smoke test. The column + index were
applied immediately, and `PHASE-3-AUTH-CONSOLIDATION.md` was corrected: the DDL is now
documented as a **mandatory prerequisite**, not as "either deploy order is safe".

---

## 8. Rollback, always

```
FIREBASE_LIVE_MIRROR=false     # phase 1 — stop writing to Firestore
LIVE_FEED_ENABLED=false        # phase 2 — stop reading from Firestore
MEDIA_UPLOAD_ENABLED=false     # phase 4 — stop accepting uploads
STATS_EXPORT_ENABLED=false     # phase 5 — stop writing daily snapshots
```

Restart, done. Phase 3 is the only database touch and it is tolerated both ways — see §7.
No data migration, no forced downtime, and no client depends on Firebase for correctness.

---

## 9. Why a full Firestore migration is refused (for the boss)

Say this in one sentence: **"Firebase real-time ke liye best hai, ledger ke liye galat."**

| Our code needs | Firestore gives |
| --- | --- |
| `prisma.$transaction` — wallet debit + slot insert + ledger row, all or nothing | Transactions capped at 500 docs, optimistic retries, no joins; must be hand-written and re-tested |
| `@@unique([tournamentId, slotNumber])` — hard duplicate protection | No unique constraints; needs deterministic doc-IDs + `create()` expectations everywhere |
| Redis Lua seat race (100 players → 2 seats, one round trip) | No atomic "insert if count < N"; needs a counter doc + contention retries |
| SQL joins for admin/report screens | Full denormalisation; duplication and drift bugs |
| `count()`, `orderBy` + cursor pagination over the ledger | Poor fit; needs an external export |

Plus cost: Firestore charges **per document read**. A live feed with 1,000 clients
re-reading on every slot change is hundreds of thousands of reads per match. Our
current WebSocket + Redis fan-out is flat-cost. Migration would raise the bill, not
lower it.

Realistic estimate for a full rewrite: **3–6 weeks, with a shipping freeze, and a
rewrite of the money tests.** That is why it is marked refused above.

---

## 10. Folder contents

```
plan/firebase-migration/
├─ README.md                       ← this file (master plan + delivery record)
├─ PHASE-0-INFRA-SETUP.md          ← infra provisioning record + who is blocked on what
├─ PHASE-1-LIVE-MIRROR.md          ← write path: websocket events → Firestore
├─ PHASE-2-LIVE-READER.md          ← read path: catch-up feed + read-cost budget guard
├─ PHASE-3-AUTH-CONSOLIDATION.md   ← stable identity + production auth guards + DDL
├─ PHASE-4-FIREBASE-STORAGE.md     ← media uploads + permanent URLs
├─ PHASE-5-STATS-EXPORT.md         ← daily aggregate snapshots (no player data)
└─ ACTIVATION-CHECKLIST.md         ← deploy → verify:firebase → enable one by one
```

Related repo files: `firebase/` — `firestore.rules` (deny-all for clients),
`firestore.indexes.json` (the four composite indexes the feed needs), `storage.rules`
(deny-all), `firebase.json`. Deploy with:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project deadesports-865d2
```

---

## 11. Next steps, in priority order

0. ✅ **Infra (Phase 0)** — Firestore database + rules + indexes + `.firebaserc` are live.
   Remaining, both human-only: **service account JSON** into `backend/.env`, and
   **Storage „Get Started”** in the console. Details: `PHASE-0-INFRA-SETUP.md`.
1. **Prove it on the real project** — `ACTIVATION-CHECKLIST.md` §2:
   `cd backend && npm run verify:firebase`. Nothing gets enabled before that run is green.
2. **Enable one phase at a time** (`FIREBASE_LIVE_MIRROR` → `LIVE_FEED_ENABLED` →
   `MEDIA_UPLOAD_ENABLED` → `STATS_EXPORT_ENABLED`), restart + watch after each.
3. **Firestore TTL policy** on `live_events.expireAt` — the only unbounded-growth risk
   in the programme.
4. **Admin UI upload button** — Phase 4's API exists but admin-web still only accepts a
   pasted URL; wiring `<input type="file">` → `/media/upload` → `logoUrl` is a small,
   separate change.
5. **Only then Phase 6** (chat / device telemetry), starting with dual-write.
