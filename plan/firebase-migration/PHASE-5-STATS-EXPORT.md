# Phase 5 — Daily stats snapshots → Firestore

> **The boss's actual ask was "company ka data Firebase mein hona chahiye."**
> This phase delivers exactly that, in the only form that is both cheap and safe:
> **aggregated business numbers, one document per tenant per day**, while the ledger
> and every player identity stay in PostgreSQL.
>
> Off by default, idempotent, never throws, and it reuses the P&L report the owner
> already trusts — so the numbers can never disagree with the admin screen.

---

## 1. What it writes

`stats/<tenantId>_<YYYY-MM-DD>` — the id is deterministic, so a re-run **overwrites**
rather than duplicating. One document per tenant per day.

```jsonc
{
  "tenantId": "53a09545-…",
  "tenantSubdomain": "apex-ff",
  "date": "2026-11-12",
  "money": {
    "deposits": 0,
    "withdrawals": 0,
    "entryFeesCollected": 0,
    "prizesPaid": 0,
    "netOrganizerProfit": 0,
    "platformCut": 0,
    "commissionRate": 10,
    "currency": "INR"
  },
  "counts": {
    "depositCount": 0, "withdrawalCount": 0, "prizeCount": 0,
    "matchesScheduled": 2, "slotsBooked": 0, "newPlayers": 2
  },
  "computedAt": "2026-11-12T09:50:35.730Z",
  "source": "postgres",
  "version": 1
}
```

**What is deliberately absent:** phone numbers, player names, in-game names, user ids,
per-player balances, UTRs, screenshots, any row-level ledger data.

That is not laziness — it is the whole point:

| Concern | Why aggregates only |
| --- | --- |
| DPDP / privacy | a copy of every player's phone number and balance in another vendor's database is a liability with zero business value |
| Firestore cost | row-level mirroring of the ledger would be ~1 write per transaction forever; aggregates are 1 write per tenant per day |
| Correctness | a second copy of the ledger invites "which one is true?" during a dispute. Aggregates are derived, timestamped and disposable |

The row-level ledger export already exists and stays where it belongs: the owner's CSV
(`GET /api/v1/admin/wallet/settlement/export.csv`).

---

## 2. How the numbers are produced

`buildSnapshot()` calls **`getDailySettlement(tenantId, date)`** — the same function
behind the Phase 7 daily profit & loss screen (`settlement.service.ts`) — and adds three
operational counts. No second, parallel definition of "revenue" exists anywhere.

| Field | Source |
| --- | --- |
| `deposits` / `depositCount` | `DepositRequest` APPROVED by `reviewedAt` |
| `withdrawals` / `withdrawalCount` | `WithdrawalRequest` APPROVED by `reviewedAt` |
| `entryFeesCollected` | `WalletLedger` JOIN_FEE DEBIT for matches scheduled that day |
| `prizesPaid` / `prizeCount` | `WalletLedger` WINNING_PRIZE CREDIT posted that day |
| `netOrganizerProfit` | revenue − prizes |
| `platformCut` | `Tenant.commissionRate` × net profit |
| `matchesScheduled` | `Tournament.matchTime` in the day |
| `slotsBooked` | `TournamentSlot.joinedAt` in the day (tenant-scoped) |
| `newPlayers` | `User` role USER created in the day |

**Day boundary is UTC**, matching the existing settlement report exactly. (A future
change to IST days must change `settlement.service.ts` and this together — they are
deliberately not two different definitions.)

---

## 3. When it runs

| Trigger | Command |
| --- | --- |
| In-process scheduler (default 24h, min 1h) | `STATS_EXPORT_ENABLED=true` |
| Manual / backfill | `npm run export:stats -- --days=30` |
| Dry run (no DB, no writes) | `npm run export:stats -- --days=7 --dry` |

Every run recomputes the **last `STATS_EXPORT_DAYS` days (default 3)**, not just
yesterday. Because ids are deterministic, that is free idempotency and it means a
skipped night — deploy, crash, restart — heals itself on the next run instead of
leaving a permanent hole. The scheduler also fires once 60 s after boot for the same
reason.

The CLI runs even when `STATS_EXPORT_ENABLED=false`, so `force: true` is how a one-off
Render job or a laptop backfill works without turning the scheduler on in production.

---

## 4. Cost

| Item | Volume |
| --- | --- |
| Writes | `tenants × days` per run → **1 tenant × 3 days = 3 writes/day** |
| Monthly writes | ~90 for one tenant, ~900 for ten |
| Admin dashboard read | 30 days × N tenants → hundreds of reads |

Firestore's free tier is 20 000 writes/day. This phase cannot meaningfully cost money
at this platform's scale. (Phase 1's live mirror was the expensive one — that is why it
has a bounded queue and TTL.)

---

## 5. Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `STATS_EXPORT_ENABLED` | `false` | Master switch for the scheduler |
| `STATS_EXPORT_INTERVAL_HOURS` | `24` | Cadence, 1–168 |
| `STATS_EXPORT_DAYS` | `3` | Rolling window recomputed each run, 1–31 |
| `STATS_EXPORT_COLLECTION` | `stats` | Target collection |
| `FCM_CREDENTIALS_JSON` | — | Required (service account with Cloud Datastore User) |

---

## 6. Verification

- [x] `npx tsc --noEmit` — clean
- [x] `npm test` — **411 tests, 411 pass, 0 fail** (13 new in `tests/statsExport.test.ts`)
- [x] Numbers equal the P&L report: ₹100 deposit, ₹20 join fee, ₹15 prize →
      `netOrganizerProfit = 5`, `commissionRate = 10`
- [x] **No PII in the document** — asserted by scanning the serialised snapshot for
      `phoneNumber`, the actual phone value, `email`, `userId`
- [x] Idempotent: two runs produce byte-identical ids, 1 doc (overwrite, not duplicate)
- [x] `tenants × days` rows for the whole window; **inactive tenants are skipped**
- [x] Flag off → `enabled:false` + reason, zero writes; `force:true` still works (CLI path)
- [x] No credentials → refuses with a clear reason (never a fake success)
- [x] Failing batch write → counted in `failed`, **no throw** (`assert` on no-rejection)
- [x] **Real PostgreSQL run** (temp script, injected sink, no Firestore writes) —
      2 documents, correct ids, real counts (`matchesScheduled: 2`, `newPlayers: 2`)
- [x] CLI `--dry` lists the exact dates; CLI without credentials exits `1` with a
      readable message
- [ ] **Not verified locally:** a document actually landing in Firestore — needs the
      service account (see §7)

---

## 7. Enabling it (runbook)

```bash
# 1. backend env
STATS_EXPORT_ENABLED=true
FCM_CREDENTIALS_JSON={...service account, Cloud Datastore User...}

# 2. restart, then backfill history once
cd backend && npm run export:stats -- --days=30

# 3. expect
#    ✔ 30 snapshot(s) written for 1 tenant(s)
```

If `--days=30` reports `written: 0` with a reason, the credentials are the problem, not
the query — the aggregation itself already ran against the real database.

---

## 8. Rollback

```
STATS_EXPORT_ENABLED=false   →  restart  →  done
```

No schema change, no client change, no data migration. Existing `stats/*` documents are
harmless derived data; delete the collection if you want them gone.

---

## 9. Files touched

| File | Change |
| --- | --- |
| `backend/src/services/statsExport.service.ts` | **new** — snapshot builder, idempotent ids, scheduler, injectable sink |
| `backend/src/scripts/exportStats.ts` | **new** — `npm run export:stats` |
| `backend/src/config/env.ts` | 4 optional variables |
| `backend/src/server.ts` | start scheduler + stop on shutdown (2 lines) |
| `backend/.env.example` | documented |
| `backend/package.json` | `export:stats` script |
| `backend/tests/statsExport.test.ts` | **new** — 13 tests |

No database schema change. No client app touched.

---

## 10. What this phase deliberately does *not* do

- **No read API yet.** The snapshots are write-only from the backend's point of view.
  When a dashboard needs them, add `GET /api/v1/admin/stats?from=&to=` through the same
  server-mediated + budgeted pattern as Phase 2 — never let the browser talk to
  Firestore directly (`firestore.rules` denies all client access, and that stays true).
- **No BigQuery.** Aggregates this small fit in Firestore; a warehouse is only worth it
  once someone actually needs ad-hoc SQL over years of data.
- **No row-level export.** See §1.
