# Phase 12.8 — Spectator Scorer: LIVE-only, zero defaults, Done flow

> **Boss ka complaint:** "Spectator scorer me live match bas aane chahiye jo live chal rahe hain.
> Waha demo/test data dikh raha hai. Rank 0 se shuru karo, kills 0. Upar ek setting do jisse
> ON karte hi Done ka button aaye — player pehle mar gaya to uski final kill dekh ke Done kar de.
> Done karte hi wo player neeche chala jaye, jeetne wale upar rahen. Jaise hi Save karo, user side
> live section se match gayab ho jaye, aur wahi data ban/paise wale me chala jaye."

---

## 1. Problem (verified on live DB)

31 matches, status breakdown:

| Status | Count | Should appear in Scorer? |
|---|---|---|
| `OPEN` | 2 | ❌ not started |
| `UNDER_REVIEW` | 21 | ⚠️ only if genuinely in progress |
| `COMPLETED` | 3 | ❌ done |
| `CANCELLED` | 5 | ❌ dead |

The selector currently accepts `ROOM_REVEALED, LIVE, UNDER_REVIEW, OPEN, SLOTS_FULL`, so it lists
**23 matches**, of which 21 are stale `UNDER_REVIEW` leftovers from earlier days (some with 0 slots).
That is the "demo data" the boss is seeing.

**Fix:** default the selector to `LIVE` only, with an explicit toggle for `UNDER_REVIEW`
(the "match khatam ho gaya par score nahi kiya" backlog). Everything else is hidden.

## 2. Scoring model changes

| Field | Today | New |
|---|---|---|
| `rank` | auto `index + 1` (so everyone starts ranked) | **0 = unranked** everywhere; only the spectator assigns a rank |
| `verifiedKills` | 0 | 0 (unchanged, already correct) |
| `isDone` | — | **new** — player finished; row drops to the bottom section |

Server side `PayoutResultInput.rank` already accepts `null`; the request simply omits rank when 0,
so unranked players are paid kills-only. **No schema or API change needed.**

## 3. Sections

```
┌ Running (N) ────────────────────────┐
│  slot  name  kills[- 0 +]  rank[   ] │  ← actively being scored
│                                    │  [ Done ]  ← sends to Finished
└────────────────────────────────────┘

┌ Finished (M) ───────────────────────┐
│  #3  name  rank 2  8 kills   [↩]   │  ← locked, top rank floats up
└────────────────────────────────────┘
```

- Inside **Finished**, rows sort by rank ascending → **winners stay at the top**, unranked/0 last.
- Inside **Running**, original slot order (stable while typing).
- `↩` (undo) puts a finished player back to Running, in case of a mis-tap.

## 4. "Done mode" toggle (top bar)

A single `Switch` labelled **"Done buttons"**, off by default.

- OFF → the console stays compact, no Done buttons anywhere (the current simple flow).
- ON → every Running row shows `✓ Done`.

Boss's reasoning: the spectator only needs Done for players who died early, so it should be a
*choice*, not permanent clutter.

## 5. Save → everything settles at once

`Distribute Prize & Complete Match` (bottom) stays the single save action, and it now also:

1. Marks the tournament `COMPLETED` (already does).
2. Emits the existing realtime `MATCH_UPDATED` / status broadcast → the **user app's Live section
   drops the match immediately**.
3. Writes `MatchResult` rows → the same rows the **ban & reward** screens read, so the roster/pay
   sheet sees the final kills + rank right away.

The label changes to **`💾 Save Results & Complete Match (N finished)`** so it is obvious what is
being written.

---

## 6. Implementation checklist

- [ ] `TournamentSelector` → `LIVE` only + `UNDER_REVIEW` toggle, badge counts, newest-first.
- [ ] `scorerRoster` → `rank = 0`, add `isDone = false`.
- [ ] `ScorerPlayer.isDone` + VM actions `markDone / markRunning / updateKillsFor`.
- [ ] Console: `doneMode` switch in the top bar, two sections (Running / Finished).
- [ ] Finished section sorts by rank asc (winners top), then slot.
- [ ] Save button label + count; result payload omits rank when 0.
- [ ] Verify the match disappears from the player app Live list after save.
- [ ] Verify the roster/pay screen shows the kills+rank just saved.

## 7. Out of scope

- No new DB columns (uses existing `MatchResult`).
- No change to prize math (`RANK_PRIZE_SHARE` / per-kill) — boss already confirmed prizes are not
  rank-driven, so rank 0 simply means "no rank prize, kills only".

---

## ✅ Implementation complete (verified on emulator)

### 1. Match picker — LIVE only
`LIVE_STATUSES = setOf("LIVE")`, `REVIEW_STATUSES = setOf("UNDER_REVIEW")`.
Two chips: `🔴 LIVE` (default) and `🕓 Unscored backlog` (opt-in, requires `slotsBooked > 0`).
Sorted newest match number first.

Observed before: 23 matches listed (21 stale `UNDER_REVIEW` with 0 slots) — the "demo data".
Observed after: only `841 | Purgatory • Solo`.

### 2. Nothing pre-ranked
`ScorerRoster.kt` — `mapIndexed` → `map`, `rank = 0`, `verifiedKills = 0`, `isDone = false`.
`AdminViewModel.updateRank()` treats `<= 0` as clear. Rank field renders an empty `—` placeholder.

### 3. Done mode
`Switch` in the toolbar, off by default. ON → `✓ Done — player finished` under every running row.
Moves the player to **✅ Finished** (bottom). Finished rows are locked, show `#rank`, kills, slot,
DQ marker, and `↩` to undo.

Finished sort: `compareBy(rankedFirst, rank, slotNumber)` — winners on top.

### 4. Save
`💾 Save Results & Complete Match (N finished)`.
Confirm dialog: `🎯 N ranked • ❔ M unranked (kills only)`, warns it is irreversible.
Success dialog: total paid, players paid, new status, and where the data now lives.

### 5. Unranked = kills only (backend)
- `PayoutResultInput.rank: number | null`
- `result.controller`: `rank: z.coerce.number().int().min(1).max(48).nullable().optional()`,
  normalised with `rank: r.rank ?? null`
- `rankPrize = entry.rank === null ? 0 : ...`
- ledger note uses `unranked` label

### Verified numbers
| Case | Result |
|---|---|
| rank 0, 0 kills | `rank = null`, prize **0**, balance untouched |
| rank 1, 5 kills | **₹675** = ₹600 rank share + ₹75 kills |
| after save | status `COMPLETED`, LIVE feed count **0** |
| tests | **296/296 pass**, `tsc --noEmit` clean |

---

## 🧪 Match-day smoke test (full end-to-end, run on emulator + local server)

Local server `http://localhost:5000` up; emulator reachability fixed with
`adb reverse tcp:5000 tcp:5000` (the player app calls `localhost:5000`).

| Step | Action | Result |
|---|---|---|
| 1 | `POST /api/v1/tournaments` (Bermuda • Squad, ₹10 entry, ₹1000 pool, ₹10/kill) | match **#850** created, status `OPEN` |
| 2 | Player app → match 850 → `Confirm & Join Slot` | joined, balance **₹990 → ₹980**, matches 3 → 2 |
| 3 | `PATCH /api/v1/tournaments/:id/room` `{778899/pass123, revealNow}` | *"Room credentials published"* |
| 4 | Match set `LIVE` | player app shows **1 Live** |
| 5 | Player app → match 850 | **Custom Room** screen shows `778899` / `pass123`, *"Match Lobby Open ✅"* |
| 6 | Admin → Spectator Scorer | only `850 \| Bermuda • Squad` listed (LIVE filter works) |
| 7 | Console opened | `0 ranked • 0 flagged`, `1 running`, kills **0**, rank empty `—` |
| 8 | +5 kills, rank `1` | header flips to `🎯 1 ranked` |
| 9 | Done switch ON → `✓ Done` | `✅ Finished (1)` → `#1 SpartanOP • 5 kill(s) • slot 1` |
| 10 | `💾 Save Results & Complete Match (1 finished)` → confirm | **Total paid: ₹550**, players paid 1, status **COMPLETED** |
| 11 | Player app home | **0 Live** (match gone), balance **₹980 → ₹1,530** (₹550 prize credited) |
| 12 | Admin → Manage Matches → History | `850 \| Bermuda • Squad` **COMPLETED** |
| 13 | `⋮` → Players & Rewards | `1/48 joined • ₹10 collected • ₹550 paid of ₹1,000`, APE-0219, **Rank 1**, ✓ paid |
| 14 | `GET /admin/matches/:id/participants` | `rank: 1, verifiedKills: 5, prizeWon: "550", isApproved: true, flags: []` |

**Prize math confirmed:** rank 1 = 50% of ₹1,000 = **₹500**, plus 5 kills × ₹10 = **₹50** → **₹550**.

**Test data cleaned up:** prize rolled back, entry fee refunded, results/slots/match deleted,
APE-0219 balance restored to **₹990** / win **₹0**.
Backend `tsc --noEmit` clean, **296/296 tests pass**.

### Dev note
Player app reads `api_base_url: http://localhost:5000/api/v1` from `assets/client_config.json`.
On a good emulator `localhost:5000` resolves to the host, but when it does not, run:

```bash
adb reverse tcp:5000 tcp:5000
```

Screenshots: `tmp_screens/smoke_1_home.png` … `smoke_12_roster_paid.png`.
