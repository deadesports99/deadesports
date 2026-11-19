# 03 — Android UI: where it lives, how it looks

Rules that override everything below: **DemoColors / DemoRadius / DemoText only**,
no new palette, no new card style. Gold = something the player can claim/earn,
green = credited, cyan = information, rose = block. Same as the room / status
screens already shipped.

---

## 1. Placement

### Recommended: 5th bottom tab "Rewards"

```
Tournaments · My Matches · Rewards · Wallet · Settings
```

- `PlayerTab` gains `REWARDS("rewards")`, inserted before `WALLET`
  (money-earning sits next to money-holding).
- `DemoBottomBar` already renders `DemoTab.entries` — it just needs the enum
  filtered by `FeatureFlags.earnHub`, and 5 items still fit at 360dp because each
  item is `weight(1f)` with a 10sp label.
- Label "Rewards" (6 chars) is fine; icon `Icons.Filled.Redeem` (gift) with a
  **gold 6dp dot** when `dailyBonus.available || tasks.anyClaimable`, no number
  badge (numbers on a tab look like chat unread).
- Active pill/idle colours unchanged.

### Entry points that come with it (all flag-gated)

| Surface | Element | Why |
| --- | --- | --- |
| Tournaments header | small gold coin pill left of the ₹ balance: `🪙 Claim` (only when a claim is pending) | The one thing a returning player must not miss |
| Wallet screen, under the vault card | slim card: "₹ aur kamao — daily bonus, tasks, referral" → Rewards tab | Wallet is where money-thirsty players already are |
| Settings → "REWARDS" group | `Rewards & Referral`, `Daily bonus reminder` (toggle later) | Discoverability + support answers |
| First open of the day | `DailyBonusSheet` (bottom sheet) auto-opens **once**, only if `available` and flag on | Converts streak without a tab tap |
| FCM `DAILY_BONUS_READY` | push → Rewards tab, `rewards_push` flag | Optional, off by default |

Fallback if the owner picks "no new tab": the coin pill in the header becomes the
only entry, plus the wallet card. Nothing in the screens changes — they are
pushed routes either way (`rewards`, `rewards/referral`).

---

## 2. Screens

### `RewardsHubScreen` — the only screen most players ever open

One `LazyColumn`, four blocks, no tabs inside:

1. **Header** — back arrow (arrives as a tab, so no back arrow; the *settings
   entry* pushes it with one) + "Rewards" + "How it works" text button.
2. **Daily bonus hero card** (gold accent, biggest thing on screen)
   - Row: `STREAK` chip (`Day 3 / 7`), big `₹5`, subline "Aaj ka bonus ready hai"
   - 7 streak dots (filled = claimed, gold ring = today, grey = upcoming)
   - Gold CTA full width: **"Claim ₹5"** → `Claimed ✓` (green) on success,
     grey "Kal aana — 12h 40m" once claimed
   - If `minMatches` unmet: muted subline "1 match khelne ke baad khulega"
3. **Tasks** — section title "TASKS" + `3 / 4 done`, then rows:
   `[icon] 1 match join karo   ·   ₹5   [Claim]`
   progress bar (`DemoColors.Track` → gold) with `1/3` at right; claimable row is
   cyan-outlined, claimed row is dimmed with `✓`.
4. **Referral card** — gold-gradient (same recipe as the vault card):
   `SPARTAN7X` mono, copy button (haptic, same `Copy` pattern as RoomScreen), a
   `Share` text button (Android share sheet, `wa.me` text), then
   `4 invited · 2 qualified · ₹80 earned` and a `View details ›` link to
   `ReferralScreen`.

Empty/blocked states stay one-liners, never a blank screen:
`dailyBonus` off → block hidden; tasks off → section hidden; everything off →
hub route does not exist.

### `ReferralScreen` — pushed from the hub card

- Code + copy + share (large, gold)
- `₹40 per friend` + `₹20 for your friend` bullets, Hinglish one-liner rules
- Progress list: invited players as rows with status pill
  (`PENDING` slate, `QUALIFIED` cyan, `PAID` green) — IGN of the invited friend is
  shown only when they are `QUALIFIED` (privacy: no phone, no UID)
- Total earned strip + "Rewards wallet me credit hote hain, withdraw nahi ho sakte"

### `DailyBonusSheet` — the once-a-day nudge

`ModalBottomSheet` (`DemoRadius.Sheet`), 3 elements: streak dots, `₹5` hero,
gold `Claim` button + "Abhi nahi" text button. Dismiss = remembers the day, so it
does not nag twice.

---

## 3. Data flow

One request powers the hub: `GET /rewards/summary` → `RewardsUiState`.

```kotlin
class RewardsViewModel : ViewModel() {
    var state by mutableStateOf<UiState<RewardsSummary>>(UiState.Idle)
    fun refresh(silent: Boolean = false)
    fun claimDailyBonus()   // optimistic: disable CTA, on 409 -> refresh quietly
    fun claimTask(id: String)
}
```

- Claim responses return the new balances, so the header ₹ pill updates without a
  wallet refetch; we still call `playerViewModel.refreshWallet(silent = true)`
  afterwards (existing pattern, cheap).
- Real-time: reuse `TourneyRealtimeClient` event `WALLET_UPDATED` (already
  handled) — a bonus credited from another device updates the pill.
- Offline / error: inline red line inside the card ("Bonus claim nahi hua — dubara
  try karo"), claim CTA re-enabled. No snackbar-only failures for money actions.

---

## 4. Files

**New** (`android/app-player/src/main/java/com/tourney/player/ui/rewards/`)

```
RewardsHubScreen.kt      // header + 4 blocks, ~350 lines
ReferralScreen.kt        // code, rules, invited list
DailyBonusSheet.kt       // once-a-day nudge
RewardBits.kt            // StreakDots, RewardTaskRow, ClaimButton, GoldHeroCard
RewardsViewModel.kt
```

**Core** (`android/core/.../model/Rewards.kt`, `TourneyApi.kt`)

```
RewardsSummary, DailyBonusState, RewardTask, ReferralInfo, ReferralInvitee
@GET("rewards/summary") / @POST("rewards/daily-bonus/claim")
@GET("rewards/referral") / @POST("rewards/tasks/{id}/claim")
```

**Touched**

```
FeatureFlags.kt (new)          PlayerNav.kt (tab + 2 routes, flag-gated)
ui/nav/DemoBottomBar.kt (5th tab + badge dot)   PlayerViewModel (server features overlay)
MatchesScreen.kt (coin pill)   DemoWalletScreen.kt (earn card)   DemoSettingsScreen.kt (rows)
```

---

## 5. Copy (Hinglish, short — same voice as RoomScreen)

| Where | Text |
| --- | --- |
| Tab | `Rewards` |
| Hero CTA | `Claim ₹5` / `Claimed ✓` / `Kal aana` |
| Hero subline | `Streak ${n}/7 — 7va din ₹20` |
| Locked | `${x} match khelne ke baad khulega` |
| Tasks header | `TASKS · ${done}/${total} done` |
| Task row | `1 match join karo · ₹5` |
| Referral card | `Dost ko bulao — ₹40 tumhe, ₹20 usko` |
| Referral note | `Friend ke 1 paid match khelne ke baad reward milega` |
| Share text | `Spartan Arena pe Free Fire tournaments khelo — mera code ${code} use karo, ₹20 bonus milega.` |
| Empty tasks | `Abhi koi task nahi — naye tasks jaldi aayenge` |
| Claim error | `Claim nahi hua — dubara try karo` |
| Wallet earn card | `₹ aur kamao` / `Daily bonus, tasks aur referral` |

---

## 6. UI acceptance

- [ ] 5 tabs at 360dp width: no label clipping, all touch targets ≥48dp.
- [ ] Hub renders in both themes (dark + light) with existing tokens only.
- [ ] Streak dots are distinguishable without colour: today = ring + bold number,
      claimed = filled + `✓`.
- [ ] Claim double-tap cannot fire twice (CTA disabled on first tap).
- [ ] All four modules off → no tab, no coin pill, no settings rows, no sheet.
- [ ] Screen works with 1 task, 12 tasks, and 0 tasks (no layout jump).
- [ ] TalkBack reads each row as one sentence: "1 match join karo, reward 5
      rupees, claim button".