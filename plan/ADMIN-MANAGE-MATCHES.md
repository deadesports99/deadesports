# Admin Web — Manage Matches (single control room)

Status: planned, then built in the same session.
Owner: admin web (`localhost:5174`), backend `:5000`, tournament domain.

## 1. What the admin needs

One screen where a match can be taken from "open for joins" to "money paid",
without hopping between four screens. Everything visible per match, in rows,
live.

Lifecycle in one place:

```
OPEN (joins coming in)
  ├─ see every joined player: IGN, Free Fire UID, slot, wallet state
  ├─ ban a player            → stays in list, marked banned, never paid
  ├─ refund one player       → seat freed, money back, pool drops
  ├─ publish Room ID + pass  → players see credentials
  ├─ go LIVE                 → scoreboard unlocked
  ├─ cancel whole match      → every seat refunded, no payout
  └─ final submit            → pays kills x per-kill, banned get nothing
```

## 2. Information architecture

New nav entry **Manage Matches** → `/manage` (existing `/matches` list and
`/matches/:id` control screen stay as they are).

Layout, top to bottom:

1. **Search bar** — one input, matches by: match title, match number,
   player IGN, player FF UID, player phone. Typing filters the match rows
   in place (debounced 250 ms).
2. **Filter tabs** — `Live`, `Upcoming`, `All`. Counts shown per tab.
3. **Match rows** (list, not cards). Each row is one line:
   `#12 · Bermuda Solo · LIVE · 7/50 seats · pool ₹280 · starts in 42m`
   Row is clickable and expands in place (accordion), page never navigates.
4. **Expanded panel** — three stacked blocks:
   - **Room & kickoff**: Room ID, password, "Publish" (writes and reveals),
     "Go live now" (only before live), "Cancel match & refund all" (danger).
   - **Players** (only joined players): one row per player:
     `slot · IGN · FF UID · phone · kills stepper · [Done] · [Ban] · [Refund]`.
     Live matches sort alive-first by kills desc, done players sink to the
     bottom under a "Finished" divider.
   - **Final submit**: total kills, total payout preview, duplicates the
     server guard (kills ≤ seats-1, payout ≤ pool). Confirm dialog, then
     pay. Banned players are shown struck-through and never paid.

## 3. Live scoring model

Reasoning: payout already works off `kills x perKill`. Live control needs a
per-seat scoreboard that survives refreshes and reaches other admins/players
in real time.

Data (migration `manage_match_live_scoring`):

| column | type | meaning |
| --- | --- | --- |
| `liveKills` | Int default 0 | kills entered during the match |
| `isEliminated` | Boolean default false | player is done, cannot score more |
| `eliminatedAt` | DateTime? | when Done was pressed |

Rules:
- `liveKills` may only rise/fall between 0 and `seats - 1` (same ceiling the
  payout guard uses, so the board can never create an unpayable match).
- `Done` requires the match to be LIVE and the player not already done;
  it freezes kills for that player. `Undo done` allowed until final submit.
- Final submit reads `liveKills` from the board, ignores banned seats,
  then calls the existing payout path (`completeMatch: true`).
- `Refund` on a live match is refused after any kill exists — money already
  committed to a scoreboard is not silently clawed back. Before that it
  refunds the seat's own join fee to the ledger it was debited from.

## 4. API (all under the admin auth middleware)

| method | path | purpose |
| --- | --- | --- |
| GET | `/admin/matches/manage?filter=&q=` | match rows + counts, search server-side |
| GET | `/admin/matches/:id/live-board` | players with kills/eliminated/banned |
| PATCH | `/admin/matches/:id/participants/:userId/kills` | `{ kills }` set absolute count |
| POST | `/admin/matches/:id/participants/:userId/done` | `{ done: boolean }` |
| POST | `/admin/matches/:id/participants/:userId/refund` | refund one seat |
| POST | `/admin/matches/:id/payout` | unchanged, now fed by the board |
| PATCH | `/:id/room` + `/:id/room-reveal` | unchanged |
| PATCH | `/:id/go-live`, POST `/:id/cancel` | unchanged |

Realtime: every board mutation broadcasts `LIVE_BOARD_UPDATED`
`{ tournamentId, userId, kills, isEliminated, aliveCount }` to the tenant so
other admins and the player app update without a refresh.

## 5. Permissions and safety

- `canUpdateRoomId` for room publish, `canDistributePrize` for payout and
  refunds, `canCreateMatch` for cancel/go-live — matches existing routes.
- Every money movement writes a `WalletLedger` row with a reason.
- Refund and cancel both re-derive `prizePool` from the seats left.
- Final submit is idempotent on the server (`MatchResult` unique per
  match+player), so a double click cannot pay twice.

## 6. Edge cases to handle in the UI

- Zero players: room publish disabled, cancel still allowed.
- Match already COMPLETED/CANCELLED: row shows read-only, no actions.
- Ban then final submit: banned row struck through, contributes ₹0.
- Player refunded after being banned: refund wins, seat disappears.
- Kill stepper at 0/ceiling: buttons disabled.
- Network error: row keeps its last numbers, toast explains, no silent wipe.
- Two admins at once: realtime event wins, local edit state resets from server.

## 7. Phases

1. **DB + service** — migration, `manageMatch.service.ts`, routes, realtime event.
2. **API client** — typed calls in `admin-web/src/lib/api.ts` + types.
3. **Screen** — search, tabs, accordion rows, room block, player rows,
   final submit, confirm dialogs, toasts.
4. **Verify** — API tests (kills, done, ban, refund, cancel, payout),
   Playwright pass on the web page, then a real phone join + live kill run.

## 8. Test checklist

- [ ] Create 20-seat match, join 5 → rows show 5 players with IGN/UID.
- [ ] Kills 3/2/1 → board reorders, pool unchanged, payout preview 60.
- [ ] Done on the 3-kill player → sinks below "Finished", stepper locked.
- [ ] Ban a player → struck through, excluded from payout.
- [ ] Refund a player → seat removed, pool drops by fee share, ledger row.
- [ ] Cancel match → all seats refunded exactly once.
- [ ] Final submit → wallets credited kills x perKill, banned get nothing.
- [ ] Phone sees kills live (realtime) without refresh.
- [ ] Search by IGN/UID/phone filters the rows.

## 9. Delivered (same session)

- `TournamentSlot.liveKills / isEliminated / eliminatedAt` (migration
  `20261117022213_manage_match_live_scoring`).
- `manageMatch.service.ts` + `manageMatch.controller.ts` + routes under
  `/api/v1/admin/matches` (control router mounted before the roster router).
- Realtime event `LIVE_BOARD_UPDATED`.
- Admin web: `src/screens/manage/ManageMatchesScreen.tsx` (search, tabs, rows)
  and `ManageMatchPanel.tsx` (room, players, submit), nav entry
  "Manage Matches" → `/manage`.
- Verified on the running stack: publish room → go live → kills → done
  (sinks to "Finished") → ban (pays 0) → refund (seat gone, pool shrinks) →
  final submit (wallets credited, match COMPLETED).
