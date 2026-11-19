# 02 — Backend: data model, API, money rules

Everything here is additive: no existing endpoint changes shape, no existing
ledger category is renamed. One new route file, one new service folder, four new
tables, two `Category` values, two `Tenant` columns.

---

## 1. Prisma schema additions

```prisma
// ─── REWARDS (referral / daily bonus / tasks) ──────────────────────────

model ReferralProfile {
  id          String   @id @default(uuid())
  tenantId    String
  userId      String   @unique            // one profile per player
  code        String                       // "SPARTAN7X" — player's own code
  referredById String?                     // who invited them (null = organic)
  referredAt  DateTime?
  createdAt   DateTime @default(now())

  @@unique([tenantId, code])
  @@index([tenantId, referredById])
}

model ReferralEarning {
  id          String   @id @default(uuid())
  tenantId    String
  referrerId  String                       // who gets paid
  refereeId   String                       // the invited player
  amount      Decimal  @db.Decimal(10, 2)
  status      ReferralStatus @default(PENDING)
  tournamentId String?                     // qualification match
  qualifiedAt DateTime?
  paidAt      DateTime?
  createdAt   DateTime @default(now())

  @@unique([referrerId, refereeId])        // one payout per pair, ever
  @@index([tenantId, status])
}

enum ReferralStatus { PENDING QUALIFIED PAID VOID }

model DailyBonusClaim {
  id          String   @id @default(uuid())
  tenantId    String
  userId      String
  /** IST calendar day, "2026-11-20" — the anti-double-claim key. */
  claimDay    String
  streakDay   Int                          // 1..7 then wraps
  amount      Decimal  @db.Decimal(10, 2)
  createdAt   DateTime @default(now())

  @@unique([userId, claimDay])
  @@index([tenantId, claimDay])
}

model TaskDefinition {
  id           String   @id @default(uuid())
  tenantId     String
  code         String                      // JOIN_1_MATCH, PLAY_3_MATCHES, TOP10, FIRST_DEPOSIT…
  title        String
  description  String?
  kind         TaskKind
  targetCount  Int      @default(1)
  rewardAmount Decimal  @db.Decimal(10, 2)
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  /** null = repeatable, N = once per player per N days (periodKey buckets). */
  cooldownDays Int?
  createdAt    DateTime @default(now())

  @@unique([tenantId, code])
}

enum TaskKind { JOIN_MATCH PLAY_MATCH TOP10 FIRST_DEPOSIT REFERRAL FIRST_WIN }

model TaskClaim {
  id          String   @id @default(uuid())
  tenantId    String
  userId      String
  taskId      String
  /** "once" or the period bucket ("2026-W47"), so repeatable tasks stay honest. */
  periodKey   String   @default("once")
  progress    Int
  amount      Decimal  @db.Decimal(10, 2)
  claimedAt   DateTime @default(now())

  @@unique([userId, taskId, periodKey])
  @@index([tenantId, claimedAt])
}
```

`Tenant` gets two validated JSON blobs (no more columns every time a number
changes):

```prisma
  featureFlags Json?   // { "referral": true, "daily_bonus": false, ... }
  rewardConfig Json?   // { "dailyBonus": {...}, "referral": {...}, "tasks": {...} }
```

`Category` enum gains three values (Postgres enum migration is additive, safe):

```prisma
enum Category {
  ADD_MONEY
  JOIN_FEE
  WINNING_PRIZE
  WITHDRAWAL
  REFUND
  REFERRAL_BONUS
  DAILY_BONUS
  TASK_REWARD
}
```

Migration: `npx prisma migrate dev --name rewards_referral_daily_tasks`.
No backfill needed — every table starts empty and `ReferralProfile.code` is
created lazily on first read of the referral screen.

---

## 2. Money rules (non-negotiable)

1. **All three bonuses credit `DEPOSIT` balance** (`balanceType: 'DEPOSIT'`).
   Playable for entry fees, not withdrawable. Winnings stay the only cash-out
   route. Configurable later via `rewardConfig.referral.withdrawable`, default
   `false` — do not ship `true` without a legal review.
2. Every credit goes through the same pattern as `approveDeposit`:
   `$transaction` → **conditional update / insert with unique key** → increment
   balance → `walletLedger.create({ category, referenceId })` → realtime
   `WALLET_UPDATED`. Never `increment` first and check later.
3. `referenceId` is the row id (`dailyBonusClaim.id`, `taskClaim.id`,
   `referralEarning.id`), so a ledger row can always be traced back.
4. Double tap / retry → `409 CONFLICT` from the unique constraint, no second
   credit.
5. Amounts come **only** from the server config, never from the request body.

---

## 3. API surface (player, authenticated)

All under `playerRouter`, gated by `rewardEnabled(module)` middleware that reads
`tenant.featureFlags` and returns `404` when the module is off (so a stale APK
cannot claim what the client turned off).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/rewards/summary` | One call for the whole hub: daily state, tasks, referral stats |
| `POST` | `/rewards/daily-bonus/claim` | Claim today's bonus |
| `GET` | `/rewards/tasks` | Full task list + this player's progress |
| `POST` | `/rewards/tasks/:id/claim` | Claim one completed task |
| `GET` | `/rewards/referral` | Code, invite link, invited list, earnings |
| `POST` | `/rewards/referral/apply` | `{ code }` — attach inviter, one time |

`GET /rewards/summary` response (drives the whole screen, one round trip):

```json
{
  "features": { "daily_bonus": true, "tasks": true, "referral": true },
  "dailyBonus": {
    "available": true, "amount": 5, "streakDay": 3, "streakTarget": 7,
    "nextAmount": 5, "claimedToday": false, "lastClaimAt": "2026-11-19T…",
    "ladder": [2, 3, 5, 5, 8, 10, 20]
  },
  "tasks": [
    { "id": "…", "code": "JOIN_1_MATCH", "title": "1 match join karo",
      "description": "Koi bhi paid match join karo", "progress": 1, "target": 1,
      "reward": 5, "claimable": true, "claimed": false }
  ],
  "referral": {
    "code": "SPARTAN7X", "invited": 4, "qualified": 2, "earned": 80,
    "rewardPerFriend": 40, "friendReward": 20, "minMatches": 1
  }
}
```

Task progress is **derived**, never stored: it is computed from existing tables in
one query per kind (`TournamentSlot` count, `MatchResult` rows, `DepositRequest`
approved count, `ReferralEarning` paid count). `TaskClaim` only records what was
already paid — so no event pipeline, no drift, no double counting.

---

## 4. Defaults (all editable from admin, no rebuild)

| Key | Default | Notes |
| --- | --- | --- |
| `dailyBonus.ladder` | `[2,3,5,5,8,10,20]` | Streak day 1…7, then wraps to day 3 |
| `dailyBonus.resetOnMiss` | `true` | Miss a day → back to day 1 |
| `dailyBonus.minMatches` | `0` | Optional gate: must have played N matches |
| `referral.rewardPerFriend` | `40` | Paid to referrer, after qualification |
| `referral.friendReward` | `20` | Paid to the invited player, same moment |
| `referral.minMatches` | `1` | Friend must play N paid matches |
| `referral.maxPerDay` | `10` | Anti-farm cap per referrer |
| `tasks.defaults` | `JOIN_1_MATCH ₹5`, `PLAY_3_MATCHES ₹15`, `TOP10 ₹25`, `FIRST_DEPOSIT ₹10` | Seeded once per tenant |

Everything lives in `Tenant.rewardConfig`, validated with zod on write
(`rewardSettingsSchema`), so a bad number cannot reach the ledger.

---

## 5. Anti-abuse (the part that actually matters)

| Attack | Guard |
| --- | --- |
| Claim twice at midnight | `@@unique([userId, claimDay])` with `claimDay` derived from **server** IST clock (`TimeAuthority`), not the device |
| Clock change on phone | Device clock never participates; server time only |
| Self-referral | `code` != own code; also block same `deviceId` and same phone-prefix heuristic (`suspicion.service`) |
| Friend farm (install-only) | Reward only on `QUALIFIED` after friend's `minMatches` paid matches |
| New-account burst | Referrer must be ≥3 days old and have ≥1 paid match |
| Banned player | `user.isBanned` blocks claim + referral apply |
| Repeatable task spam | `periodKey` (`once` / `2026-W47`) inside the unique key |
| Admin self-payout | Admin endpoints are read-only for rewards except task CRUD (no manual credit) |

`ReferralEarning` moving `PENDING → QUALIFIED → PAID` follows the same
`updateMany({ where: { status: 'QUALIFIED' } })` conditional-flip pattern as
deposits — exactly one caller wins.

---

## 6. Files to add / touch

**New**
```
backend/src/services/rewards/dailyBonus.service.ts
backend/src/services/rewards/task.service.ts
backend/src/services/rewards/referral.service.ts
backend/src/services/rewards/rewardConfig.service.ts   // zod defaults + merge
backend/src/controllers/reward.controller.ts
backend/src/routes/reward.routes.ts                    // playerRouter mount
backend/src/controllers/adminReward.controller.ts
backend/src/routes/adminReward.routes.ts               // owner console
```

**Touched**
```
backend/prisma/schema.prisma           (+4 models, +1 enum, +3 Category values, +2 Tenant cols)
backend/src/routes/index.ts            (mount /rewards + /admin/rewards)
backend/src/services/tenant.service.ts (features + rewardConfig in settings view)
backend/src/controllers/tenant.controller.ts (PATCH accepts features/rewardConfig)
backend/src/services/settlement.service.ts (promote PENDING→QUALIFIED on match end)
backend/src/services/fcm.service.ts    (optional DAILY_BONUS_READY push)
```

Admin console (`admin-web`) needs one small page later: Rewards → daily ladder,
referral amounts, task CRUD, claims log. Ship the API first; the owner console
page is M5 and does not block the app.

---

## 7. Tests to write (backend)

- `dailyBonus.service.test.ts` — claim, double claim same day, streak advance,
  streak reset after a missed day, IST day boundary (23:59 vs 00:01 IST).
- `task.service.test.ts` — progress derivation per kind, claim before complete,
  claim twice, repeatable `periodKey` rollover.
- `referral.service.test.ts` — code generation uniqueness, self-apply reject,
  qualification on match settle, `maxPerDay` cap, banned player reject.
- `rewardConfig.service.test.ts` — missing config falls back to defaults, bad
  input rejected by zod.
- Ledger assertions: every claim writes exactly one `WalletLedger` row with the
  right `category` and `referenceId` (mirror the existing deposit tests).
