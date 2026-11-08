# Thunder eSports — Free Fire Tournament Platform

A white-label Free Fire tournament platform: two Android apps (player + admin), one
Node/Express + Prisma API, and a web preview of the player app. Everything is
multi-tenant (one deployment can host many organisers) and built around a
double-entry wallet, so money can never be created or lost silently.

| Part | What it is |
|---|---|
| `android/app-player` | Player app — sign in, wallet, join a match, room ID, live scoreboard |
| `android/app-admin` | Admin app — create matches, publish rooms, run the scorer, pay winners, manage staff |
| `android/core` | Shared Kotlin module (design system, auth screens, networking, models) |
| `backend` | REST API + Postgres (Supabase) + Prisma + realtime WebSocket + FCM |
| `player-web` | React preview of the player screens (design reference / marketing) |

---

## 1. Repository layout

```
android/
  core/                 shared design system (AuthDesign, DemoUi, network, models)
  app-player/           player app  (com.thunderesports.player)
  app-admin/            admin app   (com.thunderesports.admin)
backend/
  src/                  API (routes / controllers / services / middlewares)
  prisma/schema.prisma  database schema
  scripts/              seed + stress + end-to-end test scripts
  tests/                node:test suite (308 tests, fake Prisma harness)
player-web/             React/Vite design preview
plan/                   product + rollout docs (see §11)
docs/                   payment, code quality, test-account sheets
```

---

## 2. What the player can do (`app-player`)

**Login** (`☎ phone + OTP`, shared auth design with the admin app)

- Any 10-digit number + any 6-digit OTP in demo mode; Firebase SMS OTP once
  `PHONE_OTP_BYPASS=false` and `PHONE_OTP_ENABLED=true`.
- Auto-registration on first login, session persisted, JWT (7 days).

**Home / matches**

- Esports title row (Free Fire live, BGMI/COD "soon"), filter chips
  (All / Solo / Duo / Squad / Clash Squad), pull-to-refresh.
- Match card shows match number, map + mode, time, slot count
  (`15/48 Slots`, `33 left` / **`Slot Full`**), prize pool, entry fee and Join button.
- Live badge + auto-refresh through the realtime WebSocket (`SLOT_BOOKED`,
  `MATCH_STATUS_CHANGED`).

**Join flow (bottom sheet)**

- Compact sheet: entry fee vs wallet, **In-Game Name + Free Fire UID** (remembered
  as the player's default after a successful join), team code for Duo/Squad.
- Slot picker for an explicit seat, otherwise the lowest free seat is taken
  server-side.
- Clear, human errors only: `Slot Full — all seats are taken`,
  `Entry closed — joining stops 1 minute before the match starts`,
  `Server is busy — please try again in a moment` (never a database status code).
- The moment the last seat goes, the button turns into a red **Slot Full** and the
  card badge flips too.

**Room ID & Password**

- Unlocks at the organiser's reveal time (or "reveal now"), only for seated players.
- 1-tap copy for Room ID and password.

**Wallet**

- Deposit + winning balances shown separately, full ledger history
  (add money, join fee, prize, withdrawal, refund).
- Add cash via UPI intent / payment gateway order, withdraw request with UPI ID.
- Balance updates pushed live (`WALLET_UPDATED`).

**Scoreboard / results**

- Official spectator-verified scoreboard per match: rank, kills, prize.
- Player's own result highlighted after payout.

**Settings / profile**

- IGN & Free Fire UID, theme (dark/light), notifications, support WhatsApp,
  logout.

---

## 3. What the admin can do (`app-admin`)

| Screen | Capability |
|---|---|
| **Dashboard** | Live counters (players, matches, money), realtime event feed, quick actions |
| **Create Match** | 48-slot Free Fire matches: map, mode, fee, prize pool, per-kill prize, start time, visibility window, auto title (`849 \| Bermuda • Solo`) |
| **Manage Matches** | Filter by status, go LIVE, cancel + auto-refund all, clone a match, view roster |
| **Match Roster** | Every seated player with join-time IGN/UID snapshot, copy CSV, ban/unban a player in this match, manual payout per player |
| **Publish Room ID** | Set Room ID + password, choose auto-reveal minutes or "reveal now"; players see it instantly |
| **Spectator Scorer** | Enter verified kills + rank per player, flag hackers/teamers (disqualify = ₹0), then 1-click payout |
| **End match by UID** | Fastest path: type the winner's Free Fire UID, kills optional → rank-1 prize credited and match completed |
| **Players** | Search by player code / phone / IGN / FF UID, wallet + history, ban account, reset device |
| **Suspicious Players** | Auto suspicion score (multi-account, device sharing, UID mismatch, newly created accounts) |
| **Device Watchlist & Device Groups** | Flag a device, alert when any account on it joins; see all accounts per device |
| **Wallet / Payments** | Pending deposit requests (UTR verify), withdrawals queue (approve/reject with note), payment history |
| **Settlement** | Per-match money in/out, commission view |
| **Staff** | Create sub-admins, toggle the four permission flags, reset their password |
| **Settings** | Tenant branding (name, colours, logo), UPI ID, min deposit, support WhatsApp, phone auth switch, commission |

---

## 4. Sub-admin (staff) permissions

Staff accounts are `SUB_ADMIN` with fine-grained flags — a sub-admin can only do
what the owner ticks:

| Permission | Unlocks |
|---|---|
| `canCreateMatch` | Create / clone / cancel matches, go LIVE, sweep match states, visibility |
| `canUpdateRoomId` | Publish Room ID & password, reveal to players |
| `canDistributePrize` | Enter verified results, payout, end-match-by-UID, disqualify |
| `canManageWallet` | Deposit approvals, withdrawal approvals, manual wallet adjustments |

Everything else (staff management, tenant settings, commission) stays with the
`ADMIN` (owner). Every privileged action is written to the audit log.

---

## 5. Money rules (single source of truth)

- **Entry fee** is debited atomically with a conditional `UPDATE … WHERE balance >= fee`
  inside the join transaction, and one `JOIN_FEE` ledger row per seat.
- **Prize split**: rank 1 = 50 %, rank 2 = 30 %, rank 3 = 20 % of the prize pool,
  plus `verifiedKills × perKillPrize` for every ranked/kill-credited player.
- **Payout is idempotent**: running it twice pays nothing the second time
  (`409`, ledger unchanged, `already paid` per player).
- Only confirmed participants can be paid; banned / disqualified players get ₹0.
- Double-entry ledger (`WalletLedger`): `ADD_MONEY`, `JOIN_FEE`, `WINNING_PRIZE`,
  `WITHDRAWAL`, `REFUND` — every row stores `balanceAfter`, so any wallet can be
  reconstructed from the ledger.
- **Identity snapshot**: IGN, FF UID and device ID are frozen on the seat at join
  time. A later profile edit cannot rewrite match history; the roster flags
  `UID_MISMATCH` instead of silently trusting the new value.

---

## 6. Concurrency & reliability (measured, not guessed)

| Scenario | Result |
|---|---|
| 48 sequential joins | 48/48, 0 errors |
| 55 players racing for the last 3 seats | 3 winners, 52 clean `409`, 0 five-hundreds |
| 53 players racing for **1** seat | 1 winner (seat 48), 52 clean `409` |
| 108 taps (54 players × 2) for 2 seats | 2 winners, 106 clean `409` |
| **216 taps (54 players × 4) for 2 seats** | 2 winners, 214 clean `409`, **0 errors**, server healthy |
| Full match flow (create → 48 joins → room → payout) | 14/14 checks passed |

How it holds up:

- unique `(tournamentId, slotNumber)` index + unique `(tournamentId, userId)` → no
  double selling, no double join;
- lost seat races are **retried on a random free seat** (8 attempts) instead of
  failing the player;
- an in-memory **join gate** (`JOIN_MAX_INFLIGHT`, `JOIN_MAX_QUEUE`) keeps the DB
  pool healthy during a stampede — overflow gets `503 … try again`, never a crash;
- post-commit `reconcileFullStatus()` makes sure a 48/48 match always ends up
  `SLOTS_FULL`, even when two last-seat joins race;
- a 60-second sweep moves matches `OPEN → ROOM_REVEALED → LIVE → UNDER_REVIEW` and
  closes joins 1 minute before kickoff.

---

## 7. Local setup

### 7.1 Prerequisites

| Tool | Version used |
|---|---|
| Node.js | 20+ (tsx, node:test) |
| PostgreSQL | Supabase project (Postgres 15) or local Postgres |
| Android Studio / SDK | compileSdk 35, JDK 17, minSdk 24 |
| Redis (optional) | only for the distributed slot-lock path, not needed locally |

### 7.2 Backend

```bash
cd backend
npm install
cp .env.example .env          # then fill DATABASE_URL + JWT_SECRET (see §8)
npx prisma generate
npx prisma migrate deploy     # or: npx prisma db push  (fresh/dev database)
npm run dev                   # tsx watch src/server.ts  → http://localhost:5000
curl http://localhost:5000/api/v1/health
```

Useful commands:

```bash
npm run build      # tsc → dist/
npm test           # 308 tests (node:test, fake-Prisma harness, no DB needed)
npx tsc --noEmit   # type check only
```

### 7.3 Android apps

1. Point the apps at your API — `android/app-player/src/main/assets/client_config.json`
   and `android/app-admin/src/main/assets/client_config.json`:

```json
{
  "client_name": "Thunder eSports",
  "api_base_url": "http://localhost:5000/api/v1",
  "tenant_id": "<TENANT_UUID>",
  "upi_id": "thunderesports@okaxis",
  "upi_name": "Thunder eSports",
  "min_deposit": 10,
  "support_whatsapp": "919999900001"
}
```

2. Build & install:

```bash
cd android
./gradlew :app-player:assembleDebug :app-admin:assembleDebug
adb install -r app-player/build/outputs/apk/debug/app-player-debug.apk
adb install -r app-admin/build/outputs/apk/debug/app-admin-debug.apk
```

3. Phone talks to the laptop API over USB:

```bash
adb reverse tcp:5000 tcp:5000      # (Windows helper: connect_phone.bat)
```

If you run the API on a real server, just put its HTTPS URL in `api_base_url` and
skip the reverse.

### 7.4 Seed demo data

```bash
cd backend
npx tsx scripts/seedTestAccounts.ts create --count 100 --credit 200
npx tsx scripts/seedTestAccounts.ts list
```

Creates 100 real-signup-shaped demo players (`TEST BOT 001…100`), phones
`9000000001…9000000100`, ₹200 each, and writes `docs/test-accounts.csv`.

---

## 8. Environment variables (`backend/.env`)

Copy `backend/.env.example` → `backend/.env` and fill the values marked **required**.
The file is git-ignored — real keys never enter the repo.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | `production` enforces the safety checks below |
| `TRUST_PROXY` | `false` | set `true` behind nginx / load balancer |
| **`DATABASE_URL`** | — | **required** — Supabase/Postgres URL. Keep `?sslmode=require`. On the Supabase **session pooler** add `&connection_limit=15&pool_timeout=60` (the pooler caps at 15 clients) |
| `DB_POOL_MAX` / `DB_POOL_IDLE_TIMEOUT_MS` / `DB_POOL_CONNECTION_TIMEOUT_MS` | `10` / `10000` / `5000` | optional pool tuning |
| `REDIS_URL` | `redis://localhost:6379` | optional; only for the Redis slot-lock path |
| **`JWT_SECRET`** | — | **required** — 32+ random chars |
| `JWT_EXPIRES_IN` | `7d` | player session length |
| `CORS_ORIGIN` | `http://localhost:3000,http://localhost:3001` | comma separated |
| `PHONE_OTP_ENABLED` | `true` | `false` disables Firebase phone OTP for players (admin logins unaffected) |
| `PHONE_OTP_BYPASS` | `false` | **demo only** — any phone + any OTP logs in. Must stay `false` in production |
| `RATE_LIMIT_ALLOW_IPS` | empty | dev only; IPs that skip rate limiting (ignored in production, boot warning) |
| **`ACCESS_KEY_PEPPER`** | dev default | **required in production** — 32+ chars, used for staff permission keys and email OTP hashes |
| `PAYMENT_PROVIDER` | `mock` | `mock` (demo, no real money) or `razorpay` |
| `PAYMENT_MIN_AMOUNT_PAISE` / `PAYMENT_MAX_AMOUNT_PAISE` | `1000` / `1000000` | ₹10 – ₹10,000 |
| `PAYMENT_ORDER_TTL_SECONDS` / `PAYMENT_EXPIRY_SWEEP_INTERVAL_MS` | `900` / `300000` | checkout lifetime + stale-order sweep |
| `PAYMENT_MOCK_AUTO_CAPTURE` | `true` | mock gateway auto-captures after "Pay now" |
| `PUBLIC_BASE_URL` | `http://localhost:5000` | used to build checkout URLs |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | — | only when `PAYMENT_PROVIDER=razorpay` (see `docs/RAZORPAY_LIVE_RUNBOOK.md`) |
| `JOIN_MAX_INFLIGHT` / `JOIN_MAX_QUEUE` | `12` / `400` | join burst control; keep `JOIN_MAX_INFLIGHT ≤` DB pool size |
| `ADMIN_SESSION_TTL_HOURS` | `12` | admin-web session |
| `ADMIN_WEB_ORIGIN` | `http://localhost:5174` | CSRF origin gate for the admin web |
| `EMAIL_PROVIDER` | `console` | `console` (dev) / `smtp` / `resend` / `brevo` |
| `EMAIL_FROM` | `Apex Free Fire Club <no-reply@apexff.com>` | sender header |
| `FCM_CREDENTIALS_JSON` | — | optional Firebase service account (one line) for push |
| `DEV_FAKE_FIREBASE` | `true` locally | skips real Firebase verification while demo mode is on |

Production boot guards (the server refuses to start if violated): `NODE_ENV=production`
with `PAYMENT_PROVIDER=mock`, with the development `ACCESS_KEY_PEPPER`, or with
`PHONE_OTP_BYPASS=true`.

### 8.1 Firebase (only when real phone OTP is wanted)

1. Firebase console → project → **Authentication → Sign-in method → Phone** → enable.
2. Add the Android apps (`com.thunderesports.player`, `com.thunderesports.admin`) and
   put the real `google-services.json` into each app module.
3. Backend: add a service account JSON as `FCM_CREDENTIALS_JSON` (single line) and set
   `PHONE_OTP_ENABLED=true`, `PHONE_OTP_BYPASS=false`, `DEV_FAKE_FIREBASE=false`.

---

## 9. Helper scripts (`backend/scripts`)

| Script | Purpose |
|---|---|
| `seedTestAccounts.ts create\|list\|delete` | Create / list / delete the demo players (only rows named `TEST BOT%` are ever deleted) |
| `raceJoinTest.ts --fill N --race M [--slots 48] [--dup K] [--cleanup <id>]` | Fills a match, then hammers the last seats with M concurrent joins and verifies oversell / ledger / wallet invariants |
| `measureJoin.ts --count N` | Join latency probe (round-trip + full join time) |
| `e2eMatchFlow.ts [--cleanup]` | Full match life-cycle: create → 48 joins → publish room → payout → scoreboard (14 checks) |
| `src/scripts/_checkAuthFlags.ts` | Prints the effective auth flags (phone OTP on/off, bypass, demo) |

---

## 10. API surface (v1)

```
POST   /auth/player/register | /auth/player/login | /auth/player/google
POST   /auth/player/email/send-otp | /auth/player/email/verify-otp
GET    /players/me                    profile + wallet
PATCH  /players/me                    name / IGN / FF UID / device
GET    /wallet                        balances + ledger
POST   /wallet/deposit | /wallet/withdraw
GET    /tournaments                   player feed (publishable, paginated)
POST   /tournaments                   create (canCreateMatch)
GET    /tournaments/:id | /:id/slots
POST   /tournaments/:id/join          join with IGN/UID (+ optional seat)
PATCH  /tournaments/:id/go-live       force LIVE
POST   /tournaments/:id/cancel        cancel + refund everyone
POST   /tournaments/:id/clone
PATCH  /tournaments/:id/visibility    player-feed visibility window
PATCH  /tournaments/:id/room          room ID & password (canUpdateRoomId)
PATCH  /tournaments/:id/room-reveal   reveal now / N minutes before start
GET    /tournaments/:id/room          seated player only
GET    /tournaments/:id/results       official scoreboard
POST   /tournaments/:id/payout        verified results + payout (canDistributePrize)
POST   /tournaments/:id/finish        end match & pay winner by FF UID
Admin: /admin/players*, /admin/wallet*, /admin/payments*, /admin/staff*, /admin/devices*
Payments: /payments/orders, /payments/webhook/razorpay, /payments/history
Realtime: ws://…/ws   events SLOT_BOOKED, MATCH_STATUS_CHANGED, WALLET_UPDATED,
                      ROOM_CREDENTIALS_REVEALED, DEPOSIT_APPROVED, PRIZE_WON
```

---

## 11. Tests & verification

```bash
cd backend
npm test                 # 308 tests: money, join races, roster flags, payouts,
                         # auth flags, payments, webhooks, rate limits
npx tsc --noEmit         # type check only
npx tsx scripts/e2eMatchFlow.ts          # 14/14 checks against the live database
npx tsx scripts/raceJoinTest.ts --fill 46 --race 100 --dup 4
```

Last recorded results: **308/308 tests pass**, `tsc` clean, end-to-end flow
**14/14 checks**, 216-tap burst → **2 winners, 214 clean rejections, 0 errors**.

More detail lives in:

- `plan/PRODUCTION_CLOUD_EXECUTION_PLAN.md` — demo relaxations (V3), join latency and
  DB region (V3.1), burst behaviour (V3.2), player-facing messages (V3.2.1),
  end-to-end flow (V3.3)
- `plan/PRODUCTION_CLOUD_DEPLOYMENT_PLAN.md` — cloud rollout
- `docs/PAYMENT_GATEWAY.md`, `docs/RAZORPAY_LIVE_RUNBOOK.md`, `docs/CODE_QUALITY.md`
- `plan/ROADMAP.md`, `plan/NEXT_PHASE_PLAN.md`

---

## 12. Demo credentials (current environment)

| Role | Login |
|---|---|
| Owner | phone `9999900001` (admin app), any 6-digit OTP |
| Player | phone `9111100222` (player app), any 6-digit OTP |
| Demo players | `9000000001` … `9000000100`, any 6-digit OTP, ₹200 each |

Tenant: `Apex Free Fire Club` — `a3c11cd0-324e-4886-b27c-9667fd7f59dc`.

Going back to real OTP: `PHONE_OTP_BYPASS=false`, `PHONE_OTP_ENABLED=true`,
`DEV_FAKE_FIREBASE=false`, enable Phone auth in Firebase, and switch on
*Settings → Phone Auth* in the admin app.

---

## 13. Known limitations / next up

1. **Database region** — the current Supabase project sits in `eu-west-2` (London), so a
   join costs ~1.4 s from India, almost all of it network round-trips. Moving to
   `ap-south-1` (Mumbai) should bring a join to ~150-250 ms with no code change.
2. **Payment gateway** — runs on `PAYMENT_PROVIDER=mock`; real Razorpay keys and a
   webhook secret are required for live money (runbook ready in `docs/`).
3. **Push notifications** — `FCM_CREDENTIALS_JSON` is not set, so FCM sends are skipped.
4. **Phone OTP** — Firebase SMS is intentionally bypassed for the demo.
5. **Admin web** — endpoints and plans exist (`plan/admin-web`); the web UI itself is not
   in this repository yet.
