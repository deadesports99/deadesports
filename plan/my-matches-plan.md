# Plan — "My Matches" section (Player app)

Status: **implemented (Phase 1–3) and verified** on the Android emulator and in the web preview.

Shipped:

| Layer | Files |
|---|---|
| Backend | `src/services/playerMatches.service.ts`, `GET /api/v1/players/me/matches` (controller + route), `tests/myMatches.test.ts` (10 tests), `tests/helpers/fakePrisma.ts` (tournament relation support) |
| Android | `core/model/MyMatch.kt`, `TourneyApi.myMatches()`, `PlayerViewModel` (`myMatchesUi`, `selectMyMatchesBucket`, `refreshMyMatches`, `loadMoreMyMatches`), `ui/matches/MyMatchesScreen.kt`, `ui/matches/MyMatchCard.kt`, 4th tab in `DemoBottomBar` + `PlayerNav`, `core/src/test/.../MyMatchTest.kt` |
| player-web | `screens/MyMatchesScreen.tsx`, `components/myMatches/{MyMatchCard,MyMatchesSummary,RoomCodeSheet,ResultSheet}.tsx`, `types`, `api.player.matches()`, `api.tournaments.results()`, `mappers` helpers, 4th tab in `BottomNav`, App wiring + realtime + load-more |

Also fixed: `getPlayerStats` is now tenant-scoped (a seat in another organiser's
match can no longer inflate this tenant's career numbers). No Prisma migration was
needed — every number is derived from `TournamentSlot` + `MatchResult` + `WalletLedger`.

Copy is proper English (no Hinglish) on both platforms, and each open seat shows a
countdown line instead of repeating its slot number: `in 2h 28m` / `starting now` /
`in progress` (`myMatchTiming` on Android, `matchTiming` on web — both pure and
unit-tested). Empty and error states are a title + hint + "Browse tournaments" CTA.

---

## 1. Why a new section is needed

Today the player can only see matches that are still going on:

- `GET /api/v1/tournaments` (player feed) filters out `COMPLETED` and `CANCELLED`, and drops anything older than 3 hours (`PLAYER_FEED_GRACE_MS`).
- Once a match ends, the player has **no screen at all** to see: which match it was, which slot they took, how many kills, what rank, how much prize money came in, or that a cancelled match was refunded.
- The only history that exists is the wallet ledger (money only, no match context) and `GET /players/me/stats` (totals only, no per-match rows).

So a real "history" read path is missing. This section fills it: **every match the player has ever joined, with its result and money outcome, and a status instead of a Join button.**

---

## 2. Section name — research + decision

| Candidate | Feel | Problem |
|---|---|---|
| **My Matches** ✅ | Free Fire community actually says "mere matches" | — |
| Match History | Sounds like a log/receipt | Long for a 10sp bottom-nav label |
| My Battles | Very gamer | "Battle" is BGMI/CODM vocabulary, FF says "match" |
| My Performance | Implies analytics only | Hides the room/result actions the player needs |
| My Stats | Same as above | Overlaps the existing Profile stats |

**Decision:** bottom-nav tab **"My Matches"**, screen header **"My Matches"**, subtitle **"Career record • Results • Payouts"**.

- Symmetric with the existing **Tournaments** tab (both talk about "matches").
- 10 characters → fits the existing `Text(fontSize = 10.sp)` nav label next to "Tournaments", "Wallet", "Settings".
- The summary strip inside already covers the "my stats / my performance" need, so no second tab is required.

Bottom nav becomes 4 tabs: **Tournaments · My Matches · Wallet · Settings**
(Android `Icons.Filled.EmojiEvents`-style trophy/history icon; web `History` or `Swords` from lucide — final icon picked when building.)

---

## 3. Card / screen design (matches the Tournaments look)

```
┌──────────────────────────────────────────────┐
│ 🏆 MY MATCHES          Career • Results      │  ← header (existing AppHeader / top bar)
├──────────────────────────────────────────────┤
│  [ 12 Played ][ 3 Booyah ][ 41 Kills ][ ₹860 ]│  ← summary strip (MyMatchSummary)
├──────────────────────────────────────────────┤
│ (All) (Upcoming) (Live) (Completed) (Cancelled)│ ← filter chips (same chip style as feed)
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │
│ │ BERMUDA · SQUAD            #12   [LIVE]  │ │
│ │ Bermuda Squad #12                        │ │
│ │ 12 Nov, 08:00 PM · Slot 07 · Entry ₹20   │ │
│ │ ──────────────────────────────────────── │ │
│ │ [ Room Ready ]  →  View Room ID          │ │  ← status instead of Join
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ KALAHARI · SOLO            #09  [RESULT] │ │
│ │ Kalahari Solo #09                        │ │
│ │ 10 Nov, 07:30 PM · Slot 12 · Entry ₹20   │ │
│ │ 🥇 Booyah · Rank #1 · 6 Kills · +₹70     │ │
│ │ [ View Scoreboard ]                      │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

Card anatomy (same visual language as `MatchCard` — map/mode chip, match number, time, slot count replaced by slot number + entry fee):

1. **Top row** — map + mode chip, `#matchNumber`, right-side **status pill**.
2. **Title** — `Bermuda Squad #12` (same auto title the feed shows).
3. **Meta row** — kickoff in IST, `Slot 07`, `Entry ₹20`.
4. **Result row** (only when a result exists) — rank badge (**BOOYAH** for rank 1), verified kills, `+₹prize`, net `prize − entry` (green/red).
5. **Action row** — status-based, **never "Join"**:
   - `Joined • Slot 07` (upcoming, room not revealed)
   - `View Room` (ROOM_REVEALED / LIVE, opens the existing room sheet)
   - `Result Awaited` (match LIVE / UNDER_REVIEW, disabled)
   - `View Scoreboard` (COMPLETED, has result)
   - `Result Pending` (COMPLETED, no `MatchResult` row yet)
   - `Refunded ₹20` (CANCELLED)
   - `Disqualified` (DQ reason on tap)
   - `Banned from this match` (slot-level ban)

---

## 4. Status vocabulary (single source of truth in both UIs)

| Tournament status | Slot/result condition | Chip | Colour |
|---|---|---|---|
| UPCOMING / OPEN / SLOTS_FULL | has slot, room locked | `JOINED` | cyan |
| ROOM_REVEALED | has slot | `ROOM READY` | amber |
| LIVE | has slot | `LIVE` | red + pulse |
| LIVE / UNDER_REVIEW | — | `IN PLAY` | red |
| COMPLETED | result.isDisqualified | `DISQUALIFIED` | red |
| COMPLETED | result.rank === 1 | `BOOYAH` | gold |
| COMPLETED | result.rank !== null | `RANK #N` | emerald |
| COMPLETED | result null | `RESULT PENDING` | slate |
| CANCELLED | refund ledger found | `REFUNDED` | slate |
| any | slot.isBanned | `BANNED` | red |

---

## 5. Backend work (no DB migration needed — pure read)

### 5.1 Route

`backend/src/routes/player.routes.ts`

```
GET /api/v1/players/me/matches?bucket=all|upcoming|live|completed|cancelled&page=1&limit=20
  authenticate (USER)  →  playerController.getMyMatches
```

Chosen over `GET /tournaments/my` because it is the player's own record (same family as `/players/me/stats`), and because `/tournaments/:id` already owns that path segment.

### 5.2 Controller

`backend/src/controllers/player.controller.ts`

```ts
const myMatchesQuerySchema = z.object({
  bucket: z.enum(['all', 'upcoming', 'live', 'completed', 'cancelled']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export async function getMyMatches(req, res, next)
```

### 5.3 Service — new file `backend/src/services/playerMatches.service.ts`

```ts
export type MyMatchBucket = 'all' | 'upcoming' | 'live' | 'completed' | 'cancelled';

export interface MyMatchItem {
  id, matchNumber, title, gameMode, matchType, mapType,
  matchTime, status, entryFee, prizePool, perKillPrize,
  slotNumber, joinedAt, inGameNameSnapshot, inGameUidSnapshot,
  isBannedFromMatch, banReason,
  roomUnlocked, room: { roomId, roomPassword } | null,   // only when unlocked + creds exist
  result: { rank, verifiedKills, prizeWon, isApproved, isDisqualified, disqualifyReason } | null,
  refunded: boolean, refundAmount: number | null,
  net: number,                                            // prizeWon - entryFee (or +refund)
}

export async function getMyMatches(userId, tenantId, { bucket, page, limit })
export async function getMyMatchesSummary(userId, tenantId)   // strip + tab badge
```

Functions to write inside it:

- `statusesForBucket(bucket)` — one map, so UI and API can never disagree.
- `roomForPlayer(t, nowMs)` — reuse `isRoomUnlocked` + `hasCreds` from `roomReveal.ts` (same gating as `listTournaments`), so a player never sees a room code they are not entitled to.
- `decorateMyMatch(slot, tournament, result, refund, nowMs)` — builds one `MyMatchItem`.
- `sortMyMatches(items)` — upcoming soonest-first, then past newest-first.
- `pagedAcrossBuckets(...)` — for `bucket=all`, page over "upcoming" then "past" so a future match never jumps above today's result.

Queries (all batched, no N+1):

1. `tournamentSlot.findMany({ where: { userId, tournament: { tenantId, status: { in: statuses } } }, include: { tournament: { include: { _count: { select: { slots: true } } } } } })`
2. `matchResult.findMany({ where: { userId, tournamentId: { in: ids } } })`
3. `walletLedger.findMany({ where: { userId, category: 'REFUND', referenceId: { in: ids } }, select: { referenceId, amount } })`

Summary reuses `getPlayerStats(userId, tenantId)` (already built: played, booyahs, kills, winnings, best rank) + 2 cheap counts (`upcoming`, `live`).

### 5.4 Realtime

No backend change: `MATCH_STATUS_CHANGED` / `PRIZE_WON` / `SLOT_BOOKED` are already broadcast tenant-wide; both clients re-fetch on those events (already wired in `App.tsx` and `PlayerViewModel.observeRealtimeEvents`). Just add the new fetch to the same debounce.

### 5.5 Tests — `backend/tests/myMatches.test.ts` (node:test, fake Prisma like `joinTournament.test.ts`)

- only the caller's own slots are returned (never another player's)
- `bucket` filter maps to the right statuses
- room credentials hidden when locked / shown when revealed (same rule as feed)
- cancelled match shows refund amount from the ledger, `refunded: true`
- COMPLETED without a `MatchResult` row → `result: null`, not a crash
- pagination + summary counters
- 401 without a token

---

## 6. Android work (`android/app-player`, `android/core`)

New files:

- `core/model/MyMatch.kt` — `MyMatchItem`, `MyMatchResult`, `MyMatchSummary`, `MyMatchesResponse`
- `core/network/TourneyApi.kt` — `@GET("players/me/matches") suspend fun myMatches(...)`
- `app-player/ui/matches/MyMatchesScreen.kt` — header, summary strip, chips, `LazyColumn`, empty/loading/error states
- `app-player/ui/matches/MyMatchCard.kt` — card from §3, reusing `DemoChip`, `DemoColors`, `DemoRadius`
- `app-player/ui/matches/MyMatchSummaryStrip.kt`

Edits:

- `PlayerViewModel.kt` — `myMatchesState: StateFlow<UiState<MyMatchesResponse>>`, `myMatchesFilter: StateFlow<MyMatchBucket>`, `loadMyMatches(forceLoading, silent)`, `setMyMatchesFilter(bucket)`; refresh inside `observeRealtimeEvents` and `onAppResumed`; cache to disk like `saveFeedCache`.
- `ui/nav/DemoBottomBar.kt` — add `MY_MATCHES("my-matches", "My Matches", icon)` after `MATCHES`.
- `PlayerNav.kt` — `composable("my-matches") { MyMatchesScreen(...) }`; keep bottom bar visible for the new route (it is a top-level tab); push targets already handle `room/$id` and `scoreboard/$id`.
- `MainActivity` header/title map — add "My Matches" title for the new route.

Pure helpers (unit-testable, no Compose): `statusChipFor(item)`, `canOpenRoom(item)`, `primaryActionFor(item)`, `filterMyMatches(items, bucket)` — mirror tests in `core/src/test` (e.g. `MyMatchCardLogicTest.kt` next to `TournamentRoomTest.kt`).

Interaction: tapping a card opens the **existing** `RoomDetailsSheet` (room ready / live) or `ScoreboardScreen` (completed) — no new push screens, no join flow.

---

## 7. player-web work (`player-web`)

New files:

- `src/screens/MyMatchesScreen.tsx` (summary strip + chips + list + empty state)
- `src/components/myMatches/MyMatchCard.tsx`
- `src/components/myMatches/MyMatchesSummary.tsx`

Edits:

- `src/types/index.ts` — `NavTab` gains `'matches'`; add `MyMatchItem`, `MyMatchResult`, `MyMatchSummary`, `MyMatchBucket`
- `src/lib/api.ts` — `player.matches({ bucket, page, limit })` + response types
- `src/lib/mappers.ts` — `toMyMatch()`, `statusPillFor()`, `primaryActionFor()` (same vocabulary as Android)
- `src/App.tsx` — load on tab open + inside the existing realtime debounce (`PRIZE_WON` added), `AppHeader` title/subtitle for the tab, open room sheet (`openMatchSheet`) for joined upcoming matches
- `src/components/navigation/BottomNav.tsx` — 4th tab (icon `History` / `Swords`) and the `max-w-md` spacing check

No result sheet needed on web: the result row lives on the card, and "View Scoreboard" can open the existing `MatchSheet`/room flow only for live matches.

---

## 8. Edge cases to handle (both UIs)

- Match joined while `visibleFrom` was in the future, later hidden by the admin → still listed in My Matches (history is not feed-gated).
- Duo/Squad: show `teamId`/teammates later; v1 shows own slot only.
- Slot-level ban and account-level DQ → chip + reason, never prize amount.
- Cancelled match with a refund ledger row but the match row is old → still listed.
- `UNDER_REVIEW` → "Result awaited", no prize claim.
- Timezone always IST (`Asia/Kolkata`), like the feed.
- Long history → paging with "Load more" (limit 20).
- Fresh install / cached session: My Matches is lazy-loaded on first tab open, cached for instant paint.

---

## 9. Rollout phases

| Phase | Work | Done when |
|---|---|---|
| **1** | Backend endpoint + service + tests | `npm test` green, curl returns own matches with result/refund/room gating |
| **2** | player-web screen + nav | Browser: join a match → see it with `JOINED`, cancel it → `REFUNDED` |
| **3** | Android screen + nav + realtime | Phone: same three states, room code opens from the card |
| **4** | Polish | summary strip, empty/loading skeletons, DQ/ban copy, load-more, notification deep-link to the card |

Nothing here needs a Prisma migration — the whole section is derived from `TournamentSlot` + `MatchResult` + `WalletLedger`.

---

## 10. Open points for Jay (answer when we start building)

1. Summary strip me **4 tiles** (Played / Booyah / Kills / Winnings) theek hai, ya sirf 3?
2. Har card pe **net profit** (`prize − entry`) dikhana hai?
3. Squad match me **teammates ke naam** bhi dikhane hain (abhi sirf apna slot)?
4. History kitni purani dikhani hai — 20 + Load more, ya 50 + Load more?
