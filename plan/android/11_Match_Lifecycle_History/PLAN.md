# 🗂️ Phase 11: Match Lifecycle — Player Feed Cleanup & Admin Match History

> **Boss requirement:** "Match khatam hone ke baad wo dikhte rehte hain — main app me
> match na rahe, lekin admin ke paas proper record rahe ki kaunsa match kab hua."
> **Status:** ✅ COMPLETE — backend lifecycle + player/admin UI verified on device;
> regression suites 36/36, 44/44, 19/19.

---

## Problem
Finished matches stayed in the **player app's Live tab forever** (e.g. 4 Nov
matches showing "Live In-Progress" on 5 Nov) because the lifecycle sweep moved
`ROOM_REVEALED → LIVE` but never moved old LIVE matches on, and the client only
filtered `COMPLETED/CANCELLED`. Stale matches also wasted the player feed's
pagination (oldest-first), and the admin had no clear "history" view.

## Fix

### Backend
- **Player feed freshness (`tournament.service.ts`):** for non-staff viewers with
  no explicit status filter, the feed only returns matches whose kickoff is within
  the last **3 hours**, excluding `COMPLETED/CANCELLED`. Admin/staff see everything.
- **Lifecycle sweep (`matchSweep.service.ts`):** new **Step 3** —
  `LIVE` matches older than **2 hours** automatically become `UNDER_REVIEW`
  ("match ended, results/payout pending"), with a realtime status broadcast.
  `SweepResult` now includes `movedToReview` (client summary updated too).
- **Room-reveal guard (`result.service.ts`):** reveal timing can only be changed
  before kick-off (DRAFT/UPCOMING/OPEN/SLOTS_FULL/ROOM_REVEALED) — an ended match
  can never be flipped back to ROOM_REVEALED from the history list.

### Player app (`TournamentFeedScreen.kt`)
- Finished matches disappear from both tabs **3 hours after kick-off**
  (server + client double filter). Live-tab empty copy explains the window.

### Admin app (`AdminMatchManagerScreen.kt`)
- New tabs: **⚡ Active & Upcoming** (default) and **🧾 Match History**
  (completed/ended, newest first) — history keeps *which match happened when*
  with IST date/time, status badge, seats, entry and settlement notes.
- History cards show `🚀 Match ended — results & payout pending (use Spectator
  Scorer)` for `UNDER_REVIEW` or `✅ Completed — official results published &
  payouts done` for `COMPLETED`.
- Cancel & Refund / visibility / reveal actions only appear for **pre-match**
  statuses (matching backend rules); Clone stays available for history.
- Sweep description now explains the 2h review + 3h player-feed window;
  match ops list limit raised to 50.

## Verification
- API: old LIVE matches + a simulated 4h-past match → player feed total **0**,
  admin list **12**; one sweep run reported
  `{ revealed: 1, live: 1, toReview: 1 }`; admin history statuses
  `{ UNDER_REVIEW: 11, COMPLETED: 1 }`.
- Device (RMX5070): player Live tab now `Live Matches (0)` with the 3-hour note
  (before: 4 Nov matches listed); admin Manage Matches → Match History shows 11
  ended matches with dates/status, Active tab shows the empty state.
- Regression: `scripts_phase8_visibility.ts` **36/36**,
  `scripts_phase9_room_reveal.ts` **44/44**, `src/scripts/testPaymentFlow.ts` **19/19**,
  backend build clean, no app crashes in logcat.
