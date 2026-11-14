# Phase 2 — Live Feed Reader (server-mediated) + cost guard

> **Goal:** a client that lost its websocket (app backgrounded, dead network, cold
> start, phone reboot) can ask for the events it missed, instead of silently showing
> stale slots until the next full refresh.
>
> **Guarantee:** `/ws` stays the primary channel. This endpoint is additive, off by
> default, and can never return a 500 or delay a socket event.

---

## 1. The problem it solves

Phase 1 writes every event to Firestore. But a client can only *use* that if it can
read the collection. Two options existed:

| Option | Verdict |
| --- | --- |
| **A.** Client SDK `onSnapshot()` directly on Firestore | ❌ rejected — needs Firebase custom claims per tenant, exposes cross-tenant risk, and leaves read spend invisible to us |
| **B.** Backend reads Firestore and returns a page of events | ✅ **chosen** — authorisation from our own JWT, every read metered, no new client auth |

Option B keeps the "Firebase real-time" box ticked for the boss (the data really is
in Firestore and delivered in near real time) while keeping the security and the bill
under our control.

---

## 2. Endpoint contract

```
GET /api/v1/live/events?since=<epochMs>&limit=<n>
Authorization: Bearer <player JWT>
```

| Param | Meaning |
| --- | --- |
| `since` | Cursor in epoch ms. Send the `nextCursorMs` from the previous response. First call: `Date.now() - 60000` (or `0`). |
| `limit` | Page size. Clamped to `LIVE_FEED_MAX_LIMIT` (default 50). Default 25. |

Response `data`:

```jsonc
{
  "source": "firestore",       // firestore | disabled | error | budget_exhausted
  "enabled": true,
  "events": [
    {
      "id": "Xk3R…",
      "type": "SLOT_BOOKED",
      "data": { "tournamentId": "…", "slotNumber": 7 },
      "audience": "TENANT",
      "timestamp": "2026-02-11T09:15:22.104Z",
      "serverTimeMs": 1770000000000
    }
  ],
  "nextCursorMs": 1770000000000,
  "readsCharged": 4,
  "budget": { "monthlyLimit": 500000, "used": 1234, "remaining": 498766 }
}
```

`source` is the whole error-handling contract — clients never need to parse an error:

| `source` | HTTP | Client behaviour |
| --- | --- | --- |
| `firestore` | 200 | apply the events, store `nextCursorMs` |
| `disabled` | 200 | feature off / not configured — keep using the socket, retry in ~30 s |
| `error` | 200 | Firestore trouble — keep using the socket, retry with backoff |
| `budget_exhausted` | 429 + `Retry-After: 3600` | stop polling until the next month; socket still works |

Also `GET /api/v1/live/budget` for ops visibility (no Firestore reads spent).

### Client loop (recommended)

```
onSocketReconnect()  → GET /live/events?since=lastCursorMs
                     → apply, lastCursorMs = nextCursorMs
                     → if source != firestore: keep going, no error UI
```

Poll on *reconnect only*, not on a timer. Every poll costs Firestore reads.

---

## 3. Authorisation: the part that matters

The scope filter is **never** taken from the request. It is built from the verified
JWT (`req.user.userId`, `req.user.tenantId`) and becomes four Firestore queries:

| Query | What it can return |
| --- | --- |
| `audience == 'ALL'` | public feed (match created / status changes) |
| `audience == 'TENANT'` + `tenantId == mine` | this tenant's slot/room events |
| `audience == 'USER'` + `userId == me` | my wallet, my prize |
| `audience == 'USERS'` + `userIds array-contains me` | batches I am part of |

A player cannot widen this by editing the query string — there is nothing to edit.
`firebase/firestore.rules` blocks *all* direct client access to the collection, so
there is no second path to the same data.

---

## 4. Cost guard (the reason this design exists)

Four queries per call, each capped at `limit`, so the worst case per call is
`4 × limit` document reads (default `4 × 25 = 100`).

Counter: `ff:livefeed:<YYYY-MM>:<tenantId>` in Redis (`INCRBY`), with an in-memory
fallback if Redis is unreachable so an outage cannot make the guard disappear.

- Budget: `LIVE_FEED_MONTHLY_READ_BUDGET`, default **500,000 reads / tenant / month**.
- Before querying: if `used >= budget` → `429`, **zero Firestore calls** (proven by test).
- After querying: charge exactly the documents returned.

At a Firestore list price on the order of a few US cents per 100k document reads, the
default budget caps a tenant's feed cost at a few cents per month — while a runaway
client polling loop is stopped at the budget line instead of at the invoice.

Raise it with the env var; reset it by deleting the Redis key (or let the month roll
over — the key is per calendar month and expires after 40 days).

---

## 5. Enabling it (runbook)

```bash
# 1. Firestore rules + composite indexes (once, from repo root)
firebase deploy --only firestore:rules,firestore:indexes --project deadesports-865d2

# 2. backend env
FIREBASE_LIVE_MIRROR=true        # Phase 1 (writes)
LIVE_FEED_ENABLED=true           # Phase 2 (reads)
LIVE_FEED_MONTHLY_READ_BUDGET=500000

# 3. restart, then confirm
curl -H "Authorization: Bearer <jwt>" \
  "https://<api>/api/v1/live/events?since=0&limit=5"
# expect: 200, source: "firestore", X-Live-Feed-Source: firestore
```

The endpoint reports `disabled` (not an error) when the mirror is off, credentials are
missing, or `LIVE_FEED_ENABLED` is false — so it is safe to deploy before enabling.

---

## 6. Verification (run locally)

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — **372 tests, 372 pass, 0 fail** (10 new in `tests/liveFeed.test.ts`)
- [x] Unit: scope filtering — another tenant's and another player's events are excluded
- [x] Unit: cursor excludes `<= since`, advances to the newest returned event, and stays
      put when nothing is new
- [x] Unit: `limit` clamped to `LIVE_FEED_MAX_LIMIT`
- [x] Unit: budget exhausted → **zero** Firestore `collection()` calls
- [x] Unit: charges exactly the documents returned
- [x] Unit: Firestore throwing → `source: "error"`, no exception
- [x] HTTP smoke (real app + real JWT + real DB):
      - no token → `401`
      - flag off → `200`, `X-Live-Feed-Source: disabled`, budget in payload
      - `LIVE_FEED_MONTHLY_READ_BUDGET=0` → `429`, `source: budget_exhausted`,
        `used: 0` (guard fired before any read)
      - `GET /live/budget` → `200`
- [ ] **Not verified locally:** a real Firestore read. Needs `FCM_CREDENTIALS_JSON` on
      the server — then `source: "firestore"` with real events is confirmable with the
      curl above.

---

## 7. Rollback

```
LIVE_FEED_ENABLED=false   →  restart  →  done
```

Clients receive `source: "disabled"` and fall back to the websocket. No data migration,
no schema change. The Firestore documents from Phase 1 can be left to their TTL policy.

---

## 8. Files touched

| File | Change |
| --- | --- |
| `backend/src/services/liveFeed.service.ts` | **new** — scoped queries, cursor, budget guard, never-throws |
| `backend/src/controllers/live.controller.ts` | **new** — param validation, 429 + `Retry-After` |
| `backend/src/routes/live.routes.ts` | **new** — auth + 60/min limiter |
| `backend/src/app.ts` | one mount line: `/api/v1/live` |
| `backend/src/config/env.ts`, `.env.example` | 4 new optional variables |
| `backend/tests/liveFeed.test.ts` | **new** — 10 tests, no credentials needed |
| `firebase/firebase.json`, `firestore.rules`, `firestore.indexes.json` | **new** — deny-all client access + composite indexes |

No existing route, service, or client file was modified.

---

## 9. What is deliberately *not* in Phase 2

- No client code changes (Android / player-web) — the contract is documented above so
  the app team can wire it when they choose.
- No direct client Firestore listeners — that is what rules + the budget guard prevent.
- No history/archival reads — this endpoint is for the recent gap, not for reporting.

Next: **Phase 3 — auth consolidation** (`firebaseUid` mapping, single identity source,
dev fallbacks locked down in production). See `README.md` §5.
