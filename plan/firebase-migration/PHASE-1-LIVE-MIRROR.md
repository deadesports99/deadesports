# Phase 1 — Firestore Live Mirror

> **Goal:** every event the WebSocket gateway already broadcasts is *also* written to
> Firestore, so clients (Android now, web later) can subscribe with the Firebase SDK
> and receive updates even when the socket is closed (background / offline / cold start).
>
> **Guarantee:** the existing `/ws` gateway keeps working exactly as before. The mirror
> is fire-and-forget, bounded, and off by default.

---

## 1. Why start here

| | |
| --- | --- |
| Boss's real need | "real-time whatever happens, in Firebase" |
| What this gives | a real Firestore live feed, written by the backend |
| Risk | near zero — one new file, one additive hook, one env flag |
| Reversible | `FIREBASE_LIVE_MIRROR=false` + restart |
| Touches money code | none |

This was deliberately chosen as Phase 1 because it satisfies the boss's visible
requirement while we buy time to argue about (and avoid) a ledger migration.

---

## 2. What gets mirrored

Every call already made in the codebase flows through four gateway methods. We hook
all four, after the WebSocket send, so socket latency is never affected:

| Gateway call | Who receives | Firestore scope written |
| --- | --- | --- |
| `broadcast(type, data)` | everyone | `audience: 'ALL'` |
| `broadcastToTenant(tenantId, …)` | that tenant | `audience: 'TENANT'`, `tenantId` |
| `sendToUser(userId, …)` | one player | `audience: 'USER'`, `userId` |
| `sendToUsers(userIds, …)` | a list | `audience: 'USERS'`, `userIds[]` |

Event types already emitted by the app (`SLOT_BOOKED`, `MATCH_CREATED`,
`MATCH_STATUS_CHANGED`, `WALLET_UPDATED`, `ROOM_CREDENTIALS_REVEALED`,
`DEPOSIT_APPROVED`, `PRIZE_WON`) need no changes — they are mirrored as-is.

---

## 3. Firestore document shape

Collection: `live_events` (name configurable).

```jsonc
{
  "type": "SLOT_BOOKED",
  "data": { "tournamentId": "…", "slotNumber": 7, "userId": "…" },

  "audience": "TENANT",     // ALL | TENANT | USER | USERS
  "tenantId": "…",          // present for TENANT
  "userId": "…",            // present for USER
  "userIds": ["…", "…"],    // present for USERS

  "timestamp": "2026-02-11T09:15:22.104Z",
  "serverTimeMs": 1770000000000,
  "serverTimeIst": "2026-02-11T14:45:22.104Z",

  "createdAt": "<server timestamp>",
  "expireAt": "<timestamp>"   // enables a Firestore TTL policy, see §6
}
```

Deliberately **not** included: wallet balances, phone numbers, tokens, room
credentials beyond what the event payload already carries to players. The mirror is a
delivery channel, not a second database.

Client read pattern (Phase 2):

```ts
onSnapshot(
  query(
    collection(db, 'live_events'),
    where('tenantId', '==', tenantId),
    orderBy('serverTimeMs', 'desc'),
    limit(1),
  ),
  (snap) => handleEvent(snap.docs[0]?.data()),
);
```

---

## 4. Safety design

1. **Off by default.** `FIREBASE_LIVE_MIRROR` defaults to `false`. Production behaviour
   today is byte-identical.
2. **Never throws.** Every mirror operation is inside `try/catch`; a Firestore outage
   produces a rate-limited warning, never a 500 to a player.
3. **Never awaited by a request.** `publish()` only pushes onto an in-memory queue and
   returns immediately. Socket and HTTP latency are unchanged.
4. **Bounded queue.** At most `FIREBASE_LIVE_MIRROR_MAX_QUEUE` events (default 500) are
   held. Beyond that, new events are dropped and counted — a Firebase outage can never
   grow the process heap or OOM a 512 MB Render instance.
5. **Batched writes.** Flushed every 250 ms or at 100 docs, whichever comes first, using
   Firestore batch writes. This is what keeps the bill and the request count low.
6. **No credentials → disabled.** Without `FCM_CREDENTIALS_JSON`, the existing
   `getFirebaseApp()` returns a project-ID-only app and the mirror stays disabled with a
   single startup log line.
7. **Flush on shutdown.** `SIGINT`/`SIGTERM` already call `realtimeService.shutdown()`;
   the mirror flushes pending events best-effort before exit.

---

## 5. Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `FIREBASE_LIVE_MIRROR` | `false` | Master switch. `true` = mirror events to Firestore |
| `FIREBASE_LIVE_MIRROR_COLLECTION` | `live_events` | Target collection name |
| `FIREBASE_LIVE_MIRROR_TTL_HOURS` | `24` | Value written to `expireAt`; `0` = never expire |
| `FIREBASE_LIVE_MIRROR_MAX_QUEUE` | `500` | In-memory queue cap before dropping |
| `FIREBASE_LIVE_MIRROR_BATCH_SIZE` | `100` | Docs per batch write (max 400) |

All optional with safe defaults, so no existing deployment breaks on boot.

---

## 6. Enabling it (runbook)

```bash
# 1. backend/.env  (Render → Environment)
FIREBASE_LIVE_MIRROR=true
FCM_CREDENTIALS_JSON='{"type":"service_account", ... }'   # required, already used for FCM

# 2. restart the service
# 3. expected boot log
#    ⚡ Realtime WebSocket Gateway mounted at /ws
#    🔥 Firestore live mirror ON → collection "live_events" (batch 100, queue 500)

# 4. Firebase console → Firestore → TTL policy
#    collection: live_events   field: expireAt   → keeps the collection small
```

**Cost note:** one document write per event. A busy evening of ~20,000 events is
~20,000 writes — a few cents. The queue cap is what prevents an incident from turning
into a bill.

---

## 7. Verification checklist

Run on this machine (2026-02, local backend):

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — **362 tests, 362 pass, 0 fail** (19 of them new in
      `tests/liveMirror.test.ts`); every pre-existing suite untouched
- [x] Boot with `FIREBASE_LIVE_MIRROR=false` — logs identical to before, no extra lines
- [x] Boot with `FIREBASE_LIVE_MIRROR=true` and no service account — safe warning,
      mirror stays OFF, server boots normally
- [x] `npm run verify:mirror` — reports the disabled state correctly
- [ ] **Not verifiable locally:** a real Firestore write. This machine has no
      `FCM_CREDENTIALS_JSON`, so the actual SDK write must be proven on the server:
      set the two variables, run `npm run verify:mirror`, expect
      `✔ Write accepted by Firestore` and a `MIRROR_PING` document
- [ ] Manual: join a tournament with the flag on, confirm a `SLOT_BOOKED` document
      appears within ~250 ms
- [ ] Manual: block the server's egress to Firestore, confirm `/ws` clients still
      receive events and `/health` still answers

### Known prerequisite

`FCM_CREDENTIALS_JSON` is **not** present in the local `backend/.env` — only
`FIREBASE_PROJECT_ID` is. A project id alone cannot write to Firestore, so Phase 1
cannot be switched on until a service account JSON with the **Cloud Datastore User**
role is added to the server environment. The mirror refuses to enable without it
rather than silently dropping events.

---

## 8. Rollback

```
FIREBASE_LIVE_MIRROR=false   →  restart  →  done
```

No data migration, no schema change, no client change. Old `live_events` documents can
be left to the TTL policy or deleted with one console click.

---

## 9. Files touched

| File | Change |
| --- | --- |
| `backend/src/services/liveMirror.service.ts` | **new** — bounded queue, batch writer, never-throws |
| `backend/src/scripts/verifyLiveMirror.ts` | **new** — `npm run verify:mirror`, one-shot write proof |
| `backend/src/services/realtime.service.ts` | additive hook only — message object built once, mirror notified after the WS fan-out |
| `backend/src/config/env.ts` | 5 new optional variables with defaults |
| `backend/src/server.ts` | init + flush-on-shutdown wiring |
| `backend/.env.example` | documented variables |
| `backend/tests/liveMirror.test.ts` | **new** — no Firebase credentials needed |
| `backend/package.json` | one new script: `verify:mirror` |

Nothing else in the repository is modified in Phase 1.
