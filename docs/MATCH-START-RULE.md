# Match start rule — the clock never starts a match

Old behaviour (bug): the background sweep moved a match to `LIVE` the moment
`matchTime` arrived — even when the organiser had published no Room ID /
Password. Players saw "LIVE NOW" with nothing to join, and the admin lost the
ability to say "the lobby is open now".

New behaviour:

```
DRAFT / UPCOMING / OPEN / SLOTS_FULL / ROOM_REVEALED
        │  matchTime reached (sweep, every 60s)
        ▼
   STARTING_SOON          ← players see "Starting shortly — please wait"
        │  admin presses "Start match now"  (PATCH /tournaments/:id/go-live)
        ▼
      LIVE               ← players see "LIVE NOW"
        │  2h after kickoff (auto)
        ▼
   UNDER_REVIEW          ← results / payout queue
```

## Rules

1. **Only the organiser starts a match.** `forceMatchLive` is the single path to
   `LIVE`; `sweepMatchStates` can only produce `STARTING_SOON`.
2. **Joining still closes 60s before kickoff** (`JOIN_CUTOFF_MS`), so nobody can
   buy a seat in a match that is already waiting to start.
3. **Publishing a room never rewinds the status.** `updateRoomCredentials` keeps
   `STARTING_SOON` / `LIVE` / `UNDER_REVIEW` as-is; only pre-kickoff matches flip
   to `ROOM_REVEALED`.
4. **A waiting match is still cancellable** (refund path) — the admin is never
   stuck with a match that can neither start nor be refunded.
5. **Payout/scoring work from `STARTING_SOON` too**, so an organiser who forgot
   to press "Go live" can still settle the match.

## Where players see it

- Android `MatchCard`: countdown area becomes `MATCH STATUS / STARTING SHORTLY`
  (amber, pulsing) plus an inline notice; CTA reads "Please wait".
- Android `MyMatchCard`: pill `STARTING SOON`, action "Please wait", line
  "Starting shortly — please wait…".
- `RoomDetailsSheet`: locked state now explains that the organiser is starting
  the match and that it keeps re-checking.
- player-web mirrors all of the above (`MatchCard`, `MyMatchCard`, mappers).

## Where the admin sees it

- `ManageMatchPanel` (Manage Matches): amber banner "Kickoff time passed —
  players are waiting" and the button changes to **Start match now**.
- `ManageMatchesScreen` row shows `STARTING SOON` and "no room published yet"
  when the lobby was never set up.
- `MatchesScreen` sweep toast reports how many matches are waiting vs. moved to
  review.

## Tests

- `backend/tests/matchSweep.test.ts` — kickoff parks the match in `STARTING_SOON`,
  never `LIVE`; `forceMatchLive` is the only path to `LIVE`; finished matches are
  never resurrected.
- `android/core/.../MyMatchTest.kt` — a past kickoff reads "starting shortly".
