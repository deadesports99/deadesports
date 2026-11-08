## Phase 12.10 — Player app: dedicated LIVE tab

### Boss requirement (Hinglish original)
> "All, Solo, Duo wagera ke jahan button hai na, wahan last me ek **LIVE** ka section add kar do.
> Jitne bhi live match hone wo wahan chale jayenge. Aur All wagera jitne bhi section hai usme se
> gayab ho jayega. Aur ye dekh lena ki match suru hote hi LIVE me jayega ya nahi — asia logic hai
> ya nahi, dekh lena."

### What changes
1. **New chip `🔴 LIVE` — placed LAST** in `FEED_FILTERS`
   (`All Matches | Solo | Duo | Squad | Clash Squad (CS) | 🔴 LIVE`).
2. A `LIVE` match is **removed from every other tab** (All / Solo / Duo / Squad / CS) and shows
   **only** in the LIVE tab. Implemented by partitioning the feed once:

   ```kotlin
   val liveMatches    = tournaments.filter { it.status == TournamentStatus.LIVE }
   val lobbyMatches   = tournaments.filter { it.status != TournamentStatus.LIVE }
   ```

   Every non-LIVE filter now filters `lobbyMatches`; the LIVE filter uses `liveMatches`.
3. Chip shows the live count: `🔴 LIVE (2)` — chip hidden/disabled-looking when zero so the
   row does not look broken, but still tappable (shows the empty state).
4. List header reads `LIVE MATCHES (N)` when the LIVE tab is active.

### Why this matches the real flow
The lifecycle is already correct on the backend and does **not** need a fix:

```
UPCOMING / OPEN / SLOTS_FULL / ROOM_REVEALED ──(kickoff or admin ▶️ Go LIVE)──► LIVE ──(2h)──► UNDER_REVIEW
```

`matchSweep.service.ts` runs every 60s and flips every pre-match status to `LIVE` the moment
`matchTime <= now`, plus the new manual `PATCH /tournaments/:id/go-live`. The player app's
`isLobbyMatch()` already accepts `LIVE`, so the match **does** appear — it was simply mixed in
with the joinable ones, which is what confused the boss.

So the only bug is **placement**, not detection.

### Joining a LIVE match
`isEntryClosed()` already blocks a join once kickoff is within 60s, and the backend's
`joinTournament` enforces the same rule. A LIVE match therefore renders with the room pill
instead of "Join" — exactly the behaviour the boss wants ("jo chhoot gaya so chhoot gaya").

### Verified
See the chat log / screenshots: `tmp_screens/live_tab_*.png`.

---

## ✅ Verified live on the emulator

### Tab order (chips scroll horizontally)
`All Matches | Solo | Duo | Squad | Clash Squad (CS) | 🔴 LIVE (N)`

### Test 1 — LIVE match leaves the joinable tabs
Match **848** (45/48 booked) set LIVE:

| Screen | Header | Cards |
|---|---|---|
| All Matches | `MATCHES (1)` | only 859 — **848 gone** |
| Solo | `MATCHES (1)` | only 859 — **848 gone** |
| 🔴 LIVE | `LIVE MATCHES (1)` | **848**, action button reads **"Watch live"** |

The action button flipping to **"Watch live"** proves joining is already closed
(`isEntryClosed` + backend `joinTournament`), so a LIVE match can only be watched —
exactly the boss's rule ("jo chhoot gaya so chhoot gaya").

### Test 2 — empty state
848 restored to `ROOM_REVEALED` → LIVE tab shows `🔴 LIVE (0)`, `LIVE MATCHES (0)`, and
*"No match is LIVE right now. A match moves here the moment it kicks off…"*
All Matches returns to `MATCHES (2)`.

### Test 3 — "does a match really go LIVE on its own at kickoff?"
This was the boss's explicit question. Proven twice **without touching the UI**:

1. Set match 851 kickoff 1 minute in the past → `POST /tournaments/sweep/states`
   → `wentLive: ['851 | Bermuda Solo']`.
2. Player app left sitting on **All Matches**. Set match 849 kickoff 1 minute in the past,
   ran the sweep, then **did not touch the app**:

   | | before | after (automatic) |
   |---|---|---|
   | counter | `0 Live • 2 Upcoming` | **`1 Live • 1 Upcoming`** |
   | All Matches header | `MATCHES (2)` | **`MATCHES (1)`** |
   | 849 in All Matches | yes | **gone** |

   The backend broadcast `MATCH_STATUS_CHANGED`, `PlayerViewModel` patched the feed item's
   status in place, and because the screen partitions on `status` the card moved to the LIVE
   tab by itself. **No manual refresh needed.**

### Conclusion on the logic
The existing lifecycle was already correct and needed **no backend change**:

```
UPCOMING / OPEN / SLOTS_FULL / ROOM_REVEALED
        │  matchTime <= now (sweep, every 60s)  or  admin ▶️ Go LIVE Now
        ▼
      LIVE  ──2h after kickoff──►  UNDER_REVIEW
```

Only the **placement** in the player app was wrong. Fixed.

**296/296 backend tests pass**, `tsc --noEmit` clean, both APKs build and install.
Test state restored: 848 → `ROOM_REVEALED` @ 21:42, 849 → `OPEN` @ 17:05.

Screenshots: `tmp_screens/live_tab_all.png`, `live_tab_selected.png`, `live_tab_solo.png`,
`auto_live_update.png`.
