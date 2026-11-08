# 🧑‍🤝‍🧑 Phase 12: Match Participants — Reward, Cheat-Flag & Ban (Admin)

> **Boss requirement:**
> "User ko proper reward admin de sake, user dhundhne me dikkat na ho aur ban bhi aaram se
> kar sake — Match Manage me hi daal do. Match number pe click karte hi saari user list aa
> jaaye, kisko kitna dena hai, aur ban ka option bhi mile. Card bada na ho, UI simple ho."
>
> **Status:** ✅ COMPLETE — backend + admin app shipped & verified on device (7 Nov)
> (285/285 backend tests pass · APK built · roster/pay/ban flow verified on emulator)

---

## 0. Aaj ka sach (code + live Supabase audit — 7 Nov)

Audit live DB pe kiya gaya (`aws-0-eu-west-2.pooler.supabase.com`):

| Cheez | Aaj |
|---|---|
| `TournamentSlot` columns | `id, tournamentId, userId, slotNumber, teamId, joinedAt` — bas |
| Match me kaun hai | `TournamentSlot.userId` → `User` **live join** (IGN/UID snapshot nahi) |
| Admin app me participant list | ❌ nahi hai (`Manage Matches` card me sirf seats count) |
| Reward dene ka tarika | `POST /tournaments/:id/finish` — **winner FF UID type karke**, ek hi winner, rank-1 = 50% pool |
| Per-player reward/rank edit UI | ❌ sirf Spectator Scorer screen me |
| Ban | `PATCH /admin/players/:id/ban` → **poore account** ka ban. Match-scoped ban nahi |
| Cheat signals | ❌ kahin surface nahi |
| Live data | 27 matches · 20 joins · 19 users · 4 match results · 0 disqualified |
| 🚨 Signal #1 | `deviceId 1d24b2b7de7dafdb` = **7 accounts** (multi-account farming) |
| 🚨 Signal #2 | 4 players ka FF UID **khaali** (inhe prize paid nahi ho sakta) |
| 🚨 Signal #3 | UID join ke waqt lock nahi hota → baad me IGN/UID badal ke identity chhupai ja sakti hai |

**Nateeja:** reward today-UID se hota hai jo player badal sakta hai. Dispute me proof nahi
bachega. Ye phase in teeno gaps ko band karta hai.

---

## 1. Design decisions (boss ke words se)

1. **"Match Manage me hi"** → koi naya nav tab nahi. `Manage Matches` list me **match number
   pe click** → full-screen participant sheet khul jaaye.
2. **"Card bada na ho"** → existing `MatchOpsCard` ko chhota kiya jaaye: compact header
   (match # · map · mode · time · seats) + ek `👥 Players (12)` line. Heavy actions
   (Cancel/Clone/Visibility) ek `⋮` overflow me. Participant per detail card **nahi**, one-line row.
3. **"Kisko kitna dena hai"** → row pe tap → ek chhota reward sheet: Rank / Kills / Auto prize
   preview / ✅ Pay.
4. **"Ban aaram se"** → har row pe 🚫 icon. Long-press ya sheet me do option:
   `🚫 Ban from this match` vs `⛔ Ban account (all matches)`.
5. **Search hamesha** → sheet ke top pe ek search box: Player ID / IGN / FF UID / phone / slot #.

---

## 2. Data model changes (Supabase / Prisma)

`backend/prisma/schema.prisma` — `TournamentSlot` me 3 snapshot columns:

```prisma
model TournamentSlot {
  // ... existing
  /** Join-time identity snapshot — immune to later profile edits (anti-cheat proof). */
  inGameNameSnapshot String?
  inGameUidSnapshot  String?
  deviceIdSnapshot   String?

  // Match-scoped ban (account stays active for other matches)
  isBanned    Boolean   @default(false)
  banReason   String?
  bannedAt    DateTime?
  bannedBy    String?   // admin/staff user id

  @@index([tournamentId, isBanned])
}
```

**Rules**
- Join ke waqt `inGameNameSnapshot` / `inGameUidSnapshot` / `deviceIdSnapshot` bhare jaayein
  (`joinTournament`, `tournament.service.ts` ~line 476 ke profile-sync block me).
- **Purane rows** ke liye ek backfill script chalao (SQL update from `User`), warna history
  me snapshot khaali dikhega.
- `isBanned = true` wala slot: reward paid nahi ho sakta, result me DISQUALIFIED treat hoga.

---

## 3. Backend — 3 endpoints (sab `canDistributePrize` guarded)

Naya file: `backend/src/routes/adminMatch.routes.ts` + `services/matchRoster.service.ts`
(mount: `app.use('/api/v1/admin/matches', adminMatchRouter)`).

### 3.1 `GET /api/v1/admin/matches/:id/participants`
Query: `search?`, `flagsOnly?` (`banned|noUid|sameDevice`), `limit` (default 100)

Response per participant (schema already 95% mojood hai `getTournamentSlots` me):
```json
{
  "match": { "id": "...", "matchNumber": 837, "status": "UNDER_REVIEW", "prizePool": "500",
             "perKillPrize": "5", "totalSlots": 48, "slotsBooked": 12 },
  "prizeRules": { "rank1": 0.5, "rank2": 0.3, "rank3": 0.2 },
  "participants": [{
    "slotId": "...", "slotNumber": 2, "teamId": "...",
    "userId": "...", "playerCode": "APE-0211",
    "name": "Tata Aoto",
    "inGameName": "AndroidProfile",      // snapshot ?? live
    "inGameUid": "123456789",
    "phoneNumber": "9876543210",
    "joinedAt": "2026-11-06T10:32:55Z",
    "isBanned": false, "allMatchesBanned": false,
    "result": { "rank": null, "verifiedKills": 0, "prizeWon": "0", "isApproved": false,
                "isDisqualified": false, "disqualifyReason": null },
    "flags": [{ "code": "SAME_DEVICE", "detail": "7 accounts on this device" },
              { "code": "NO_FF_UID" },
              { "code": "UID_MISMATCH", "detail": "joined with 123456789, now 999999999" }]
  }],
  "summary": { "total": 12, "flagged": 3, "noUid": 1, "sameDeviceGroups": 1,
               "totalEntryCollected": "60", "totalPrizeDefined": "300" }
}
```

Flag rules (server-side, ek hi query loop):
| Flag | Rule |
|---|---|
| `NO_FF_UID` | `inGameUid` khaali → reward block |
| `UID_MISMATCH` | snapshot ≠ live UID → "profile changed after joining" |
| `SAME_DEVICE` | same `deviceIdSnapshot` pe ≥2 accounts **is match me** |
| `SAME_DEVICE_CROSS` | same device ke accounts **doosre matches** me bhi joined (farm) |
| `ACCOUNT_BANNED` | `User.isBanned` |
| `DISQUALIFIED` | result `isDisqualified` |

### 3.2 `POST /api/v1/admin/matches/:id/payout`
Naya aur **safe** — existing `finishMatchAndPayWinner` (UID type karke) ko replace nahi karta.

```json
{ "awards": [
    { "userId": "...", "rank": 1, "kills": 8, "amount": 260, "note": "Booyah" },
    { "userId": "...", "rank": 2, "kills": 3, "amount": 165, "isDisqualified": false }
  ],
  "completeMatch": true }
```
- `amount` optional → server auto-calc kare `RANK_PRIZE_SHARE[rank] * pool + kills * perKill`
  (already `result.service.ts` line 26: `{1:0.5, 2:0.3, 3:0.2}`).
- Validation hard rules:
  - participant hona zaroori (existing `distributeTournamentPrizes` jaisa check),
  - **`slot.isBanned` ya `user.isBanned` → payout REJECT**,
  - `isApproved` already true → skip (idempotent, no double pay),
  - **total paid ≤ prizePool** guard (extra money accidentally na jaye).
- Ek hi `Serializable` transaction: ledger CREDIT `WINNING_PRIZE` + `MatchResult` upsert +
  optional `status = COMPLETED`. Row lock on `Tournament` (already pattern mojood hai).

### 3.3 `PATCH /api/v1/admin/matches/:id/participants/:userId/ban`
```json
{ "isBanned": true, "reason": "Teaming with squad 3", "banAccount": false }
```
- `banAccount: false` → sirf `TournamentSlot.isBanned` (match-scoped, refund nahi).
- `banAccount: true` → existing `setPlayerBanned` call (auth cache invalidate → instant logout).
- Unban: `isBanned: false`.

**Refund policy (decide karke likha gaya):** match-scoped ban pe entry fee **refund nahi**
hoti (match chal chuka / slot block tha). Agar boss chahe to `banAccount: false + refund: true`
flagship baad me add ho sakta hai — abhi scope me nahi.

---

## 4. Admin app (Kotlin) — UI plan

### 4.1 `AdminMatchManagerScreen.kt` — card chhota karo
Abhi card me 6 buttons + 4 status lines hain (bada). Naya compact card:

```
┌─────────────────────────────────────────────┐
│ #837 Purgatory • Duo            [UNDER_REVIEW]│  ← match number = clickable chip
│ ⏰ Today 8:30 PM • Seats 12/48 • ₹5 entry     │
│ 👥 Players (12)   🚨 3 flagged        [⋮]     │  ← tap → participants sheet
└─────────────────────────────────────────────┘
```
- Match number / `👥 Players (N)` row → `onOpenRoster(match)`.
- `⏳ ⚡ 📑 👁️ 🔑 🏁` sab `⋮` overflow menu me (bottom sheet, simple list).
- Existing cancel/clone/visibility/room-reveal dialogs waise hi rahenge — sirf entry point badlega.

### 4.2 New file `AdminMatchRosterScreen.kt` (~350 lines)
Top bar: `#837 Players` + back. Uske neeche:
- Summary strip: `12 players · ₹60 collected · 🚨 3 flags`
- Search `OutlinedTextField`: "Player ID / IGN / UID / phone / slot"
- Filter chips: `All · 🚨 Flagged · 🎁 Unpaid · 🚫 Banned`
- `LazyColumn` of one-line rows (fixed 56dp height — "card bada" nahi):

```
[#2] APE-0211 AndroidProfile   UID 123456789  🚨⚠   [ ₹260 ✓ ]  [⋮]
```
- Row tap → **Reward sheet** (ModalBottomSheet):
  `Rank (1/2/3/custom)` · `Kills` · auto `₹` preview (live calc) · `✅ Pay ₹260` button ·
  `🚫 Ban from this match` · `⛔ Ban account` · `🎮 Game ID: …`
- 🚨 badge tap → flag explain sheet ("Is device pe 7 accounts").
- Search client-side filter + server fallback (`search` query) — 48 slots se zyada nahi hote
  to client-side hi kaafi hai, par API me bhi support rakha hai.

### 4.3 New file `core/model/MatchRoster.kt`
`MatchRosterResponse`, `MatchParticipant`, `ParticipantFlag`, `ParticipantResult`,
`PayoutAwardsRequest`, `ParticipantBanRequest`.

### 4.4 `TourneyApi.kt`
```kotlin
@GET("admin/matches/{id}/participants") suspend fun matchParticipants(...)
@POST("admin/matches/{id}/payout")      suspend fun payoutAwards(...)
@PATCH("admin/matches/{id}/participants/{userId}/ban") suspend fun banParticipant(...)
```

### 4.5 `AdminViewModel.kt` (naya section, ~180 lines)
- `rosterUi: AdminUi<MatchRosterResponse>`, `rosterSearch`, `rosterFilter`,
  `rosterBusyUserId`, `rosterMessage`, `rosterError`
- `openRoster(tournamentId)` / `loadRoster(search)` / `payAward(userId, rank, kills, amount)`
  / `banParticipant(userId, banAccount, reason)` → success pe roster + matchOps dono reload.
- Prize preview helper: `expectedPrize(rank, kills, pool, perKill)` — **same formula** as backend,
  aur ek unit test (`PrizeMathTest.kt`) taaki UI aur server kabhi mismatch na karein.

### 4.6 `ScorerRoster.kt` ka future
Aaj Spectator Scorer alag screen hai jo roster type karke banata hai. Phase 12 ke baad roster
server-provided hoga → `ScorerRoster.kt` ko `MatchParticipant` se feed karo (duplicate logic hatao).

---

## 5. Implementation order (6 steps, har step separately testable)

| # | Kaam | Files | Verify |
|---|---|---|---|
| 1 ✅ | Schema: 5 naye slot columns + backfill script | `schema.prisma`, `scripts/backfill_slot_snapshots.ts` | `prisma db push` OK, backfill wrote 20/20 |
| 2 ✅ | Join pe snapshot save | `tournament.service.ts` | live join karke DB row check |
| 3 ✅ | Roster service + flags + 3 endpoints | `matchRoster.service.ts`, `adminMatch.routes.ts`, `app.ts` | curl: participants 20 joins pe, flags device 7-account group |
| 4 ✅ | Payout + ban endpoints (transaction + guards) | `matchRoster.service.ts` | test: banned participant → 409; double pay → skip; total ≤ pool |
| 5 ✅ | Admin app: model + api + viewmodel | `MatchRoster.kt`, `TourneyApi.kt`, `AdminViewModel.kt` | compile + `--no-daemon assembleDebug` |
| 6 ✅ | UI: compact match card + roster screen + sheets | `AdminMatchManagerScreen.kt`, `AdminMatchRosterScreen.kt` | emulator pe: match # tap → list, search, reward, ban |

---

## 6. Test plan

**Backend (`backend/tests/matchRoster.e2e.test.ts`)**
1. Roster returns all 20 existing joins with playerCode/IGN/UID/phone.
2. Search "APE-0211" → 1 result; search "9876543210" (phone) → 1 result.
3. Device `1d24b2b7de7dafdb` wale 7 accounts → `SAME_DEVICE` flag dikhe.
4. `NO_FF_UID` flag un 4 players pe jinka UID null hai.
5. Payout rank 1 + 8 kills → `0.5*pool + 8*perKill` credited, ledger row `WINNING_PRIZE`.
6. Same payload dobara → **no double credit**.
7. Banned participant pe payout → 409.
8. Match-scoped ban → sirf us match me blocked, doosre match me join kar sakta hai.
9. `banAccount: true` → next API call 401 (cache invalidated).
10. Total award > prizePool → 400.

**Android**
- `PrizeMathTest` (rank/kills formula parity).
- Manual: 7-step walkthrough emulator pe, screenshot `tmp_screens/roster_*.png`.

---

## 7. Non-goals (is phase me nahi)

- Auto cheat-detection ML / replay analysis — nahi.
- Player-facing "your reward" screen — player app already result dikhata hai.
- Refund-on-ban — abhi nahi (policy §3.3).
- Web admin panel — admin Android app hi primary hai.

---

## 8. Open questions for boss (2 min me decide)

1. **Match-scoped ban pe entry fee refund** karein ya nahi? (default: nahi)
2. Rank 1/2/3 ke alawa **custom amount** allow karein? (default: haan, `amount` field se)
3. `⋮` overflow me actions chhupane se boss ko dikkat hogi? (default: nahi, card chhota rahega)

---

## 9. Addendum — Phase 12.1: Match Number Identity & Search (✅ COMPLETE)

Boss feedback after Phase 12: *"Match number hona zaruri hai — `#` nahi lagana,
`50 | Bermuda . Solo` aise kar ke. Match Manage me bhi number ke saath dikhaye,
search bar bhi ho. Publish Room ID me bhi waise hi."*

**Findings**
- Numbers were being generated (`nextMatchNumber`) but **2 legacy matches** had
  `matchNumber = NULL` → rendered as "Match" with no identity.
- The number was only ever printed as `#841` and inside the DB `title`
  (`"Bermuda Solo #841"`), so the Publish Room screen showed the ugly raw title.

**Changes**
| Area | Change |
|---|---|
| `core/model/Tournament.kt` | `displayName` → `"50 \| Bermuda • Solo"` (number first, `\|` separator, no `#`) |
| `identity.service.ts` | `autoMatchTitle` → `"50 \| Bermuda Solo"`; still per-tenant sequential |
| `scripts/backfill_match_numbers.ts` | new, idempotent; assigned `#840`, `#841` to the NULL rows |
| `AdminMatchManagerScreen.kt` | search field (number / map / mode / title) applies to all 3 tabs; card header shows bold number + `\|` + map • mode |
| `PublishRoomScreen.kt` | `TournamentRow` flattened: `838 \| Bermuda • Squad` + time / seats / 🔒 state |
| `MatchCard.kt` (player) | number chip before the map chip |
| tests | `identity.test.ts` + `adminApi.e2e.test.ts` updated to the new format |

**Verified**: 285/285 backend tests, both APKs compile, emulator shows
`841 | Purgatory • Solo` (Manage Matches), `840 | Bermuda • Squad` (history search),
`838 | Bermuda • Squad` / `839 | Bermuda • Solo` (Publish Room).

**Not done (deliberately)**: rank-based automatic payout. Boss confirmed prizes are not
rank-driven, so the Pay sheet keeps manual Rank + Kills input with an editable amount.

---

## 10. Addendum — Phase 12.2: Roster CSV Export (✅ COMPLETE)

**Goal:** one file per match that answers "who was in match 50, which FF UID, what did they get,
who was flagged" — usable as dispute evidence or a plain record.

**Backend**
- `GET /api/v1/admin/matches/:id/participants/export.csv` (guarded by `canDistributePrize`)
- `buildRosterCsv()` in `matchRoster.service.ts`, two blocks:
  1. **Header** — match identity, status, IST kickoff, entry fee, prize pool, per-kill,
     seats, entry collected, prizes paid, flagged/banned counts.
  2. **Table** — `Slot, Player ID, Player Name, In-Game Name, Free Fire UID, Phone,
     Joined At (IST), Rank, Kills, Prize Paid, Paid?, Disqualified, Banned (match),
     Banned (account), Ban Reason, Flags`
- All identity fields read the **join-time snapshot** (`inGameUidSnapshot` etc.), never the
  live profile, so the export stays truthful after a profile edit.
- `Content-Disposition: attachment; filename="roster-match-841.csv"`.

**Android**
- `TourneyApi.exportMatchRosterCsv(id): ResponseBody` (`@Streaming`)
- `AdminViewModel.exportRosterCsv(matchId, label, onResult)` → writes `cache/exports/roster-<n>.csv`
- Roster screen shows `⬇ Share / Download CSV` (hidden while the match has 0 seats) and opens the
  system share sheet via `FileProvider` — identical path to the settlement CSV, so no new plumbing.

**Verified on device**
- Tapped the button on match `#841` → share sheet showed **`roster-841.csv`**.
- `run-as ... cat cache/exports/roster-841.csv` returned the full header + both player rows
  (APE-0211 with `SAME_DEVICE_CROSS`, APE-0218 clean).
- 285/285 backend tests still green.

---

## 11. Addendum — Phase 12.3: Player 360° Detail (✅ COMPLETE)

**Question this screen answers:** "Ye banda clean hai ya repeat cheater?"
Owner ko ek jagah chahiye: kitna paisa andar/baahar, kaun kaun se match khele, kitna jeeta,
aur uske device pe kitne aur account hain.

**Backend** — `GET /api/v1/admin/players/:id` → `playerAdmin.service.getPlayerDetail()`
| Block | Contents |
|---|---|
| `player` | ID, IGN, FF UID, phone, deviceId, account age (days), balances, `totalDeposited`, `totalWithdrawn`, `totalWinnings`, `totalSpentOnEntries` |
| `history.matches[]` | per match: number, map, mode, status, slot, join time, **IGN/UID at join time**, rank, kills, prize, paid?, DQ?, match-ban?, **sharedDeviceInMatch** |
| `history.summary` | totalMatches, completedMatches, totalKills, totalWon, booyahs, disqualifications, matchBans, sharedDeviceMatches, avgKills, winRatePct |
| `linkedAccounts[]` | every other user with a slot from the same `deviceIdSnapshot`, with shared-match count |

- Money figures come from `walletLedger` aggregates (`ADD_MONEY`, `WITHDRAWAL`, `WINNING_PRIZE`,
  `JOIN_FEE`) — never from a cached balance, so the numbers always reconcile with the ledger.
- Identity comes from slot **snapshots**, so a player who later edits their IGN/UID cannot rewrite
  their history.
- `linkedAccounts` is capped at 20 and sorted by shared-match count.

**Android** — `AdminPlayerDetailScreen.kt`
- `AdminPlayersScreen` card tap → `viewModel.openPlayerDetail(id)` → `player_detail` route
  (id lives in the ViewModel, so no nav argument needed).
- Cards: Identity (+ Ban/Unban with confirm dialog), Money (net in/out), Playing record (red
  cheat alerts), Linked accounts, Match history.
- History filters: `All / ✅ Paid / 🏆 Won / 🚨 Flagged`; tapping a row opens that match's roster.

**Verified on device (APE-0211)**
- 7 matches, 1 booyah, 14.29% win rate, 5 kills, ₹1,137.50 won.
- Money: added ₹410, withdrew ₹1,050, net **+₹640** (red — takes out more than puts in).
- Linked accounts: APE-0006 (2), APE-0008 (2), APE-0007 (1), APE-0009 (1).
- `Won` filter → 1 match (`10 | Bermuda • Solo`, rank 1, ₹1,137.50).
  `Flagged` filter → 1 match (`841 | Purgatory • Solo`, same-device).
- Ban dialog copy verified; 296/296 backend tests green.

---

## 12. Addendum — Phase 12.4: Suspicious Players "Cheat Radar" (✅ COMPLETE)

**Question:** "Mujhe 400 profiles kholne ka time nahi. Kaun sa banda problem hai, seedha bata."

**Backend** — `GET /api/v1/admin/players/suspicious?minScore=30&limit=20`
→ `suspicion.service.ts: listSuspiciousPlayers()`

Scans **every** player in the tenant with 4 bulk queries (no N+1) and scores each on
signals that are provable from the database:

| Code | Weight | Fires when |
|---|---|---|
| `DEVICE_SHARED` | 25 / match (cap 50) | Two accounts from one device joined the **same match** — the strongest team-up / prize-splitting proof we have |
| `DEVICE_FARM` | 15 × (accounts−1), cap 45 | 3+ accounts have played from one device |
| `NET_POSITIVE` | 10–30 | Withdrew more than they added **and** actually won prize money |
| `HIGH_WIN_RATE` | 15–25 | 60%+ wins over 5+ completed matches |
| `KILL_SPIKE` | 20 | Recent avg kills ≥ 3× their own earlier average (min 3 matches each side) |
| `DQ_HISTORY` | 20 | Any disqualification or match-ban on record |
| `NO_FF_UID` | 8–15 | Joined matches without a Free Fire UID (unpayable filler account) |

- Score is capped at 100 and used **only for sorting**. Nothing auto-bans.
- Route order matters: `/suspicious` is registered **before** `/:id`, otherwise Express
  would treat "suspicious" as a player id.
- Response also carries `scannedUsers` so the UI can say "5 flagged of 16 scanned".

**Android** — `AdminSuspiciousPlayersScreen.kt` (route `suspicious_players`)
- Entry: `🚨 Suspicious Players` button at the top of Player Management.
- Rows: score badge (red 70+/amber 40-69/grey below), name, `matches • win% • net`,
  then the top 3 signals in plain language (`7 accounts, 1 device`).
- Filter chips: `🔴 High (70+) / 🟠 Medium (40+) / 🟡 All (30+) / Everything (0)`.
- Tap a row → opens that player's full **360° detail**, whose red alert already explains
  the device collision. One loop: radar → proof → ban.

**Verified on device**
- `5 flagged of 16 players scanned · 4 need action`, thresholds re-filter live
  (High → 4 rows, Everything → 6 rows).
- `APE-0006` score **100**: 2 matches with its own account + 7 accounts on device + net +₹100.
- Row tap → `APE-0006` 360 view showing `2 match(es) with another account on the same device`
  and 4 linked accounts.

---

## 13. Addendum — Phase 12.5: Device Groups (one phone, many accounts) (✅ COMPLETE)

**Question:** "Is device pe kaun kaun se account hain, aur ek saath dekh ke ek saath ban kar dun."

**Backend** — `deviceGroup.service.ts`
| Endpoint | Returns |
|---|---|
| `GET /admin/players/devices?minAccounts=2` | every device with 2+ accounts: headcount, **matches where they met each other**, total winnings, net out, banned count, account codes |
| `GET /admin/players/devices/:deviceId` | every account (matches, collided matches, UID, won, net out, join date, last played) + **`sharedMatches[]`** (number, map•mode, status, which accounts were in it) + totals |
| `PATCH /admin/players/devices/:deviceId/ban` | `{isBanned}` → bans/unbans **every** account on the device, returns the codes touched |

- Devices are discovered from **slot snapshots and profiles both**, so an account that played
  from the device and later edited its profile still shows up.
- "Played together" = count of matches where **2+ accounts of that device** hold a slot — the
  cleanest proof of collusion we can derive.
- `banDeviceAccounts` also **invalidates every auth cache entry**, so all sessions die on the
  next request instead of waiting for the TTL.
- Route order: `/devices` and `/devices/:deviceId` are registered **before** `/:id`.

**Android** — `AdminDeviceGroupsScreen.kt` + `AdminDeviceGroupDetailScreen.kt`
- Entry: `📱 Devices` button beside `🚨 Suspicious` in Player Management.
- List card: account-count badge, short device id, `⚔️ played together in N match(es)`,
  total won, and all account codes on one line. Red when they actually met in a match.
- Detail screen: totals row (accounts / played together / banned / won / added / withdrew),
  red "took out ₹X more than it paid in" warning, **one `🚫 Ban all N accounts` button**,
  every account row (tap → that player's 360), and the `⚔️ Matches they played together` list.
- Ban confirm dialog spells out **every account code** before doing anything.

**Verified on device**
- List: `1 device with 2+ accounts`, `5 accounts on one device`, `⚔️ played together in 2 match(es)`,
  `won ₹2,987.50`.
- Detail: 7 accounts (APE-0006/7/8/9/0211/0005/0213), totals ₹3,387.50 won, added ₹1,410,
  withdrew ₹1,450, `⚠️ took out ₹40 more than it paid in`.
- Shared matches: `2 | Purgatory • Solo — APE-0006, APE-0007, APE-0008, APE-0009` and
  `1 | Bermuda • Squad — APE-0006, APE-0008`.
- **Ban-all round-trip tested live**: `7 account(s) banned` → `7 account(s) unbanned`,
  final state verified `banned: 0`. 296/296 backend tests pass.

---

## 14. Addendum — Phase 12.6: Device CSV + Watchlist (✅ COMPLETE)

### A. Device CSV
`GET /api/v1/admin/players/devices/:deviceId/export.csv` → `buildDeviceCsv()`
Three blocks, `\r\n`, `csvEscape` applied:
1. **Summary** — device id, accounts, banned, matches played together, winnings, added,
   withdrawn, **net out**
2. **Account table** — Player ID, IGN, name, FF UID, phone, banned, matches, played together,
   winnings, added, withdrawn, net out, created (IST), last played (IST)
3. **Shared matches** — match number, map, mode, status, account codes

Android: `⬇ CSV` beside `🔭 Watch` on the device detail screen; writes
`cache/exports/device-accounts-<id>.csv` and opens the share sheet (same FileProvider path).

### B. Watchlist (early warning)
New model `DeviceWatch` (`tenantId`, `deviceId`, `note`, `alertCount`, `lastSeenAt`, `isActive`),
unique per `(tenantId, deviceId)`, pushed to Supabase + Prisma client regenerated.

| Endpoint | Purpose |
|---|---|
| `GET /admin/players/watchlist` | watched devices + live stats (accounts, banned, played-together, winnings) + `totalAlerts` |
| `POST /admin/players/watchlist` | `{deviceId, note?}` — idempotent |
| `DELETE /admin/players/watchlist/:deviceId` | stop watching |
| `PATCH /admin/players/watchlist/:deviceId/ack` | admin reviewed, reset `alertCount` |

**The trigger:** `joinTournament` calls `noteDeviceActivity()` (fire-and-forget, errors swallowed).
If the slot's device snapshot is on an active watch and this is the account's **first ever** slot
from that device, `alertCount` increments and `lastSeenAt` updates. A banned farmer returning on a
fresh account is therefore caught on his **first** match, not his twentieth.

Android: `🔭 Watchlist` screen — red card with `🚨 N new`, `✅ Seen / Open / 🗑 Remove`, plus an
explainer when the list is empty.

**Verified**
- CSV: `HTTP 200`, 1135 bytes on device, share sheet opened with `device-accounts-1d24b2b7de7dafdb.csv`.
- Watchlist CRUD: watch → list → ack → unwatch → re-watch all returned the right counts.
- **Alert trigger proven live**: created a throwaway account (APE-0320), put it on the watched
  device, funded ₹500, joined match `842` → `totalAlerts: 1`, `lastSeenAt` set, and the app showed
  `1 device(s) watched · 🚨 1 new alert(s)` with a red row.
- Test account, its slot and ledger row were deleted afterwards; `alertCount` reset to 0.
- 296/296 backend tests pass, `tsc --noEmit` clean.

---

## 15. Addendum — Phase 12.7: Dashboard alert badge (✅ COMPLETE)

**Why:** the owner should not have to walk into Player Management to find out that something
happened. The dashboard now carries the count.

**Changes** — `AdminDashboardScreen.kt` only, no backend work:
- `AdminFeature` gained two optional fields: `badge: Int` and `notice: String?`.
- When the dashboard mounts (owner only) it calls `loadWatchlist()` and `loadSuspiciousPlayers()`
  once, so both counters arrive with the first paint.
- The **Player Management** card renders:
  - a red circular badge with the pending device-alert count on the right
  - a red line under the description: `🚨 N new device alert(s)  ·  ⚠️ M suspicious account(s)`
  - either half hides itself when its count is zero, so a clean tenant shows a clean card.

**Verified on device** — set `alertCount = 2` on the watched device, restarted the app:
- Card badge showed **2** in a red circle
- Red line read `2 new device alert(s) · ⚠️ 5 suspicious account(s)`
- `alertCount` reset to 0 afterwards; 296/296 backend tests pass.
