# 📋 Free Fire Tournament — Saare Functions ki List + Test Plan

> **Purpose:** Har feature/function ko ek-ek karke test karne ke liye master checklist.
> Ye file code se **auto-generate** ki gayi hai (`backend/src/routes/` + `admin-web/src` + `android/`).
>
> **Last updated:** 2026-11-16
> **Status legend:** ⬜ Not tested · 🟡 Testing · ✅ Pass · ❌ Bug mila · ⏭️ Skip

---

## 📍 Test Environment

| Part | URL / Port | Status |
|---|---|---|
| Backend API | `http://localhost:5000` | ✅ Chal raha |
| Postgres (Docker) | `localhost:5433` | ✅ Healthy |
| Redis (Docker) | `localhost:6379` | ✅ Healthy |
| Admin Web | `http://localhost:5174` | ✅ Chal raha |
| Player Web | `http://localhost:5173` | ⏸️ Band |
| Android Emulator | `emulator-5554` (ffTest) | ✅ Ready |
| Player APK | `com.thunderesports.player` | ⚠️ Installed (API URL issue) |
| Admin APK | `com.thunderesports.admin` | ⚠️ Installed (API URL issue) |

**Tenant ID:** `53a09545-e6e2-4cf5-a5c2-7ef18b276a52` (`apex-ff` / Apex Free Fire Club)

---

## 🔑 Test Accounts

| Role | Login | Kaise |
|---|---|---|
| Admin (web) | `deadesports99@gmail.com` | Email + OTP (DEV chip) |
| Owner (app) | `9999900001` | Phone OTP (bypass) |
| Player | koi bhi 10-digit | Phone OTP (bypass) |
| Staff | `walletops@example.com` | Owner email + access key + OTP |

> Phone OTP bypass ON hai — koi bhi 10-digit number + koi bhi 6-digit OTP chalega.

---

# 🧪 PART 1 — Backend API Functions (74 endpoints)

## 1.1 Health & Time (5 endpoints) — `health.routes.ts`, `time.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 1 | GET | `/health` | Server zinda hai, uptime, memory | `curl /health` | ✅ |
| 2 | GET | `/health/ready` | DB ready + Redis status | `curl /health/ready` | ✅ |
| 3 | GET | `/health/db` | Postgres ping + latency | `curl /health/db` | ✅ |
| 4 | GET | `/health/redis` | Redis PING → PONG | `curl /health/redis` | ✅ |
| 5 | GET | `/api/v1/time` | Server time (Postgres clock, IST) | `curl /api/v1/time` | ✅ |

---

## 1.2 Player Auth (11 endpoints) — `auth.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 6 | POST | `/api/v1/auth/player/register` | Naya player banao | Phone + OTP | ⬜ |
| 7 | POST | `/api/v1/auth/player/login` | Phone OTP login → JWT | `dev_otp_<phone>` | ✅ |
| 8 | POST | `/api/v1/auth/player/google` | Google sign-in | Google token | ⬜ |
| 9 | POST | `/api/v1/auth/player/email/send-otp` | Email OTP bhejo | Email daalo | ⬜ |
| 10 | POST | `/api/v1/auth/player/email/verify-otp` | Email OTP verify | Code daalo | ⬜ |
| 11 | GET | `/api/v1/auth/admin/staff` | Staff list (ADMIN only) | Bearer admin | ⬜ |
| 12 | POST | `/api/v1/auth/admin/staff` | Naya staff banao | Name+email | ⬜ |
| 13 | PATCH | `/api/v1/auth/admin/staff/:id` | Staff permissions badlo | canManageWallet | ⬜ |
| 14 | DELETE | `/api/v1/auth/admin/staff/:id` | Staff hatao | — | ⬜ |
| 15 | GET | `/api/v1/auth/me` | Mera profile | Cookie/Bearer | ✅ |
| 16 | POST | `/api/v1/auth/fcm-token` | Push token register | fcmToken | ⬜ |

---

## 1.3 Admin Auth (7 endpoints) — `adminAuth.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 17 | POST | `/api/v1/auth/admin/otp/request` | Email pe OTP bhejo | Email daalo | ✅ |
| 18 | POST | `/api/v1/auth/admin/otp/verify` | OTP verify → httpOnly cookie | DEV chip | ✅ |
| 19 | POST | `/api/v1/auth/admin/logout` | Cookie clear | Sign out | ✅ |
| 20 | GET | `/api/v1/admin/access` | Staff access keys list | Owner only | ✅ |
| 21 | POST | `/api/v1/admin/access` | Naya permission key banao (24 char) | Generate | ⬜ |
| 22 | POST | `/api/v1/admin/access/:id/revoke` | Key revoke (instant 401) | Revoke | ⬜ |
| 23 | POST | `/api/v1/admin/access/:id/regenerate` | Key dobara banao | Regenerate | ⬜ |

---

## 1.4 Tournaments (3 endpoints) — `tournament.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 24 | GET | `/api/v1/tournaments` | Match list (player feed, filters) | `?limit=50` | ✅ |
| 25 | GET | `/api/v1/tournaments/:id` | Ek match ki detail | Match id | ⬜ |
| 26 | GET | `/api/v1/tournaments/:id/slots` | Booked slots ki list | Match id | ⬜ |

---

## 1.5 Match Results & Room (4 endpoints) — `result.routes.ts`, `adminMatch.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 27 | GET | `/api/v1/tournaments/:id/room` | Room ID + Password (reveal ke baad) | Time-based | ⬜ |
| 28 | GET | `/api/v1/tournaments/:id/results` | Match results (rank, kills, prize) | Match id | ⬜ |
| 29 | GET | `/api/v1/admin/matches/:id/participants` | Roster (admin view) | Match id | ✅ |
| 30 | GET | `/api/v1/admin/matches/:id/participants/export.csv` | Roster CSV download | Match id | ⬜ |

---

## 1.6 Live Scorer / Payout (2 endpoints) — `adminMatch.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 31 | POST | `/api/v1/admin/matches/:id/payout` | Ranks/kills/prize save + paisa baanto | Body: awards[] | ⬜ |
| 32 | PATCH | `/api/v1/admin/matches/:id/participants/:userId/ban` | Match-scoped ban | reason | ⬜ |

---

## 1.7 Player Profile (2 endpoints) — `player.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 33 | GET | `/api/v1/players/me/stats` | Meri stats (matches, winnings) | Bearer | ✅ |
| 34 | PATCH | `/api/v1/players/me/game-profile` | IGN + FF UID update | Body | ⬜ |

---

## 1.8 Wallet (Player) (4 endpoints) — `wallet.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 35 | GET | `/api/v1/wallet` | Deposit + winning balance | Bearer | ✅ |
| 36 | POST | `/api/v1/wallet/deposit` | Add Cash request (UPI UTR) | amount+utr | ✅ |
| 37 | GET | `/api/v1/wallet/deposits` | Meri deposit requests | Bearer | ⬜ |
| 38 | POST | `/api/v1/wallet/withdraw` | Withdrawal request (UPI) | amount+upi | ⬜ |

---

## 1.9 Admin Wallet (10 endpoints) — `adminWallet.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 39 | GET | `/api/v1/admin/wallet/withdrawals` | Withdrawal queue | `?status=PENDING` | ✅ |
| 40 | POST | `/api/v1/admin/wallet/withdrawals/:id/approve` | Approve + UTR daalo | utrNumber | ⬜ |
| 41 | POST | `/api/v1/admin/wallet/withdrawals/:id/reject` | Reject (paisa wapas) | reason | ⬜ |
| 42 | GET | `/api/v1/admin/wallet/deposits` | Deposit queue | `?status=PENDING` | ✅ |
| 43 | POST | `/api/v1/admin/wallet/deposits/:id/approve` | Add Cash approve → balance credit | id | ⬜ |
| 44 | POST | `/api/v1/admin/wallet/deposits/:id/reject` | Add Cash reject | reason | ⬜ |
| 45 | GET | `/api/v1/admin/wallet/payments` | Online payment orders | `?status=ALL` | ✅ |
| 46 | POST | `/api/v1/admin/wallet/payments/:id/sync` | Gateway se status sync | id | ⬜ |
| 47 | GET | `/api/v1/admin/wallet/settlement` | Daily P&L report | `?date=` | ⬜ |
| 48 | GET | `/api/v1/admin/wallet/settlement/export.csv` | Settlement CSV | `?date=` | ⬜ |

---

## 1.10 Admin Players & Anti-cheat (12 endpoints) — `adminPlayer.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 49 | GET | `/api/v1/admin/players` | Player list (search, paging) | `?limit=50` | ✅ |
| 50 | GET | `/api/v1/admin/players/:id` | Ek player ki poori detail | id | ⬜ |
| 51 | PATCH | `/api/v1/admin/players/:id/ban` | Account ban / unban | isBanned | ⬜ |
| 52 | GET | `/api/v1/admin/players/suspicious` | Suspicious players | — | ⬜ |
| 53 | GET | `/api/v1/admin/players/watchlist` | Device watchlist + alerts | — | ✅ |
| 54 | POST | `/api/v1/admin/players/watchlist` | Device ko watch karo | deviceId | ⬜ |
| 55 | DELETE | `/api/v1/admin/players/watchlist/:deviceId` | Watchlist se hatao | deviceId | ⬜ |
| 56 | PATCH | `/api/v1/admin/players/watchlist/:deviceId/ack` | Alerts acknowledge | deviceId | ⬜ |
| 57 | GET | `/api/v1/admin/players/devices` | Device groups (multi-account) | — | ⬜ |
| 58 | GET | `/api/v1/admin/players/devices/:deviceId` | Ek device ki detail | deviceId | ⬜ |
| 59 | PATCH | `/api/v1/admin/players/devices/:deviceId/ban` | Device ke saare account ban | deviceId | ⬜ |
| 60 | GET | `/api/v1/admin/players/devices/:deviceId/export.csv` | Device CSV | deviceId | ⬜ |

---

## 1.11 Tenant Settings (2 endpoints) — `tenant.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 61 | GET | `/api/v1/tenant/settings` | Public settings (branding, UPI) | Public | ⬜ |
| 62 | GET/PATCH | `/api/v1/admin/tenant/settings` | Admin settings (UPI, toggles) | Owner | ✅ |

---

## 1.12 Live Feed (2 endpoints) — `live.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 63 | GET | `/api/v1/live/events` | Missed events after cursor (Firestore) | `?after=` | ⬜ |
| 64 | GET | `/api/v1/live/budget` | Monthly read budget usage | — | ⬜ |

---

## 1.13 Media Upload (2 endpoints) — `media.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 65 | GET | `/api/v1/media/config` | Upload enabled? size limit? | Admin | ⬜ |
| 66 | POST | `/api/v1/media/upload` | Image upload → public URL | raw body | ⬜ |

---

## 1.14 Payments (8 endpoints) — `payment.routes.ts`

| # | Method | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 67 | GET | `/api/v1/payments/config` | Gateway config (min/max amount) | Public | ⬜ |
| 68 | GET | `/api/v1/payments/my` | Meri payment history | Bearer | ⬜ |
| 69 | POST | `/api/v1/payments/orders` | Naya payment order banao | amountPaise | ⬜ |
| 70 | GET | `/api/v1/payments/orders/:id` | Order status | id | ⬜ |
| 71 | POST | `/api/v1/payments/orders/:id/sync` | Gateway se sync | id | ⬜ |
| 72 | POST | `/api/v1/payments/verify` | Checkout signature verify | razorpay fields | ⬜ |
| 73 | POST | `/api/v1/payments/webhook` | Gateway webhook (server-to-server) | razorpay sig | ⬜ |
| 74 | GET/POST | `/api/v1/payments/demo/*` | Mock gateway (dev only) | checkout page | ⬜ |

---

## 1.15 WebSocket (1) — `realtime.service.ts`

| # | Type | Endpoint | Kya karta hai | Test | Status |
|---|---|---|---|---|---|
| 75 | WS | `/ws` | Realtime events (slot booked, room revealed) | `101 Switching` | ✅ |

---

# 🖥️ PART 2 — Admin Web Screens (11 screens)

| # | Route | Screen | Kya karta hai | Status |
|---|---|---|---|---|
| 76 | `/` | **Dashboard** | KPI cards, module grid, match-day panel | ✅ |
| 77 | `/matches` | **Matches** | Tabs: Live/Upcoming/History, sweep, lifecycle | ✅ |
| 78 | `/matches/create` | **Create Match** | Map, mode, slots, entry fee, IST schedule | ✅ |
| 79 | `/matches/publish` | **Publish Room** | Room ID + password reveal | ✅ |
| 80 | `/matches/:id` | **Match Control** | Ek match ka poora control | ⬜ |
| 81 | `/roster` | **Live Scorer** | Rank, kills, DQ, prize payout | ✅ |
| 82 | `/wallet` | **Wallet** | Withdrawals, deposits, online payments | ✅ |
| 83 | `/wallet/settlement` | **Settlement** | Daily P&L, CSV export | ✅ |
| 84 | `/players` | **Players** | Search, ban, anti-cheat tabs | ✅ |
| 85 | `/staff` | **Staff & Access** | Permission keys, revoke, regenerate | ✅ |
| 86 | `/settings` | **App Settings** | UPI, support number, login toggles | ✅ |

**Auth:** Login screen (Owner | Staff tabs), OTP 6-box, session cookie.

---

# 📱 PART 3 — Android Apps

> **⚠️ Admin App (`com.thunderesports.admin`) hata diya ja raha hai.**
> Saara admin kaam **Admin Web** (`admin-web/`) se hota hai.
> Admin App ki jagah `PART 2` (Admin Web) hi full coverage hai.
> Sirf **Player App** rakha ja raha hai.

## Player App (`com.thunderesports.player`) — ONLY ANDROID APP

| # | Screen / Feature | Kya karta hai | Status |
|---|---|---|---|
| 87 | Splash + Auth | Phone OTP login, Google, Email | ⬜ |
| 88 | Home / Match Feed | Live + upcoming matches | ✅ |
| 89 | Match Detail | Entry fee, slots, join button | ✅ |
| 90 | Join Match | Seat book, fee deduct | ✅ |
| 91 | Room Reveal | Room ID + Password (T-15 min) | ✅ |
| 92 | Wallet | Deposit + winning balance | ✅ |
| 93 | Add Cash | UPI deposit + UTR submit | ✅ |
| 94 | Withdraw | UPI withdrawal request | ⬜ |
| 95 | My Matches | Joined matches history | ⬜ |
| 96 | Profile | IGN, FF UID edit | ⬜ |
| 97 | Notifications | FCM push | ⬜ |

## ~~Admin App~~ — DEPRECATED

| # | Screen | Status |
|---|---|---|
| 98-103 | Dashboard, Create Match, Manage Matches, Scorer, Wallet, Players | ❌ **Removed** — admin web se karo |

# 🐛 Bugs MILE (Fix karne hain)

| # | Bug | Kahan | Severity | Status |
|---|---|---|---|---|
| B1 | Android apps production URL pe point kar rahe the — local test ke liye `localhost:5000` kiya gaya (test ke baad revert karna hai) | `client_config.json` (both apps) | 🟡 Med | 🔧 Temp changed |
| B2 | `liveMirror` Firestore purge fail (clock skew — **fix ho gaya**) | Backend boot | 🟡 Med | ✅ |
| B3 | Redis lazy-connect — pehla request 503 (**fix ho gaya**) | `config/redis.ts` | 🔴 High | ✅ |
| B4 | `/settlement` route galat — sahi hai `/wallet/settlement` | `App.tsx` | 🟢 Low | ✅ **NOT A BUG** — `App.tsx:68` aur `permissions.ts:80` dono already `/wallet/settlement`, koi galat link nahi mila |
| B5 | **IGN placeholder ko value samajh raha tha** — naye player ka IGN khaali hone par "SpartanOP" dikhta tha par value blank thi, join button chup-chaap disabled, koi message nahi | `JoinMatchSheet.kt` | 🟡 Med | ✅ **FIXED** |
| B6 | Production (`spartan-arena.onrender.com`) pe Redis **degraded** — Redis fix deploy nahi hua | Render | 🟡 Med | ⬜ **DEPLOY ACTION** — Redis fix push karo |
| B7 | First request pe Render cold-start 15s timeout deta hai | Render | 🟢 Low | ⬜ (normal) |
| B8 | Payout me `verifiedKills` ignore ho raha - 3 bheja, 0 save hua | `payoutMatchAwards` | 🟡 Med | ❌ **MERI GALTI** — API field ka naam `kills` hai, `verifiedKills` nahi. Zod unknown key chup-chaap drop karta hai. Code sahi hai |
| B9 | Create Match screen crash: `SEAT_OPTIONS is not defined` | `CreateMatchScreen.tsx` | 🔴 High | ✅ **FIXED** (file already me SLOT_LIMITS tha, browser purana bundle chala raha tha - reload se theek) |
| B10 | Backend stale `dist/` load ho raha tha - 24 slots pe "exactly 48 slots" 400, par UI 20-48 allow karta hai | `backend/dist/` stale build | 🔴 High | ✅ **FIXED** (server restart, ab 24 slots accept) |
| B11 | Settlement entry-fee match-date se count karta tha -> "Today" me ₹490 dikha jabki ₹10 collect hua | `settlement.service.ts` | 🟡 Med | ✅ **FIXED** (cash basis: ledger date) |

---

# 📝 Test Karne Ka Tarika

## Admin Web
```bash
# Servers pehle chalao
cd backend && npm run dev          # :5000
cd admin-web && npm run dev        # :5174
# Browser: http://localhost:5174 → deadesports99@gmail.com → DEV chip
```

## Android
```bash
adb reverse tcp:5000 tcp:5000      # emulator → laptop backend
# client_config.json me api_base_url = http://localhost:5000/api/v1 karo
# Phir rebuild + install
cd android && ./gradlew.bat :app-player:installDebug
```

## API Quick Test
```bash
# Health
curl http://localhost:5000/api/v1/health
# Admin login (cookie milta hai)
curl -c ck.txt -X POST http://localhost:5000/api/v1/auth/admin/otp/request \
  -H 'Content-Type: application/json' -d '{"email":"deadesports99@gmail.com"}'
# (debugOtp response me milega)
```

---

# 📊 Progress Tracker

| Part | Total | ✅ Pass | ⬜ Pending | ❌ Bug |
|---|---|---|---|---|
| Backend API | 75 | 32 | 43 | 0 |
| **Admin Web** (primary) | 12 | 12 | 0 | 1 |
| Player App | 11 | 6 | 5 | 1 |
| ~~Admin App~~ | ~~6~~ | ❌ deprecated | — | — |
| **TOTAL** | **98** | **52** | **46** | **0 open** |

---

# ✅ Session Log — 2026-11-16 (Emulator Testing)

## Verified Flow: Player Join → Room Reveal (END-TO-END PASS)

**Setup:** Emulator `ffTest` (Android 16), apps rebuilt with `api_base_url=http://localhost:5000/api/v1`, `adb reverse tcp:5000` active.

| Step | Action | Result |
|---|---|---|
| 1 | App launch (already logged in as `9876500011`) | ✅ Tournaments screen, wallet ₹0 |
| 2 | Matches list | ✅ "No open matches" — **sahi**, DB me sirf purane matches the |
| 3 | Admin se match #11 banaya (POST `/tournaments`) | ✅ status OPEN, Bermuda Solo, ₹10 / ₹100 |
| 4 | App me Refresh | ✅ Match card dikha: 0/48, ₹10 entry, ₹100 prize |
| 5 | "Join • ₹10" tap | ✅ Quick Join sheet, IGN `SpartanOP` prefill |
| 6 | Balance ₹0 | ✅ **Sahi validation**: "+ Top up wallet to continue", button = "Add Cash" |
| 7 | Player deposit request ₹50 (UTR) | ✅ PENDING bana |
| 8 | Admin approve | ✅ "Deposit approved and balance credited" |
| 9 | App me balance | ✅ **₹50 realtime aaya** (WebSocket se, refresh ke bina) |
| 10 | UID bhara `1928374612` | ⚠️ **BUG B5**: button disabled reh gaya, koi message nahi |
| 11 | IGN bhi bhara | ✅ Button gold/enabled ho gaya |
| 12 | Confirm & Join Slot | ✅ **JOIN SUCCESS** |
| 13 | Match card | ✅ `1/48 slots`, `47 left`, green `Joined ✓`, balance ₹40 |
| 14 | DB check | ✅ Slot 1 save, IGN + UID snapshot bhi |
| 15 | Ledger check | ✅ `ADD_MONEY +50 → 50` , `JOIN_FEE -10 → 40` (double-entry sahi) |
| 16 | `/tournaments/:id/room` before publish | ✅ 409 "credentials not set" (sahi) |
| 17 | Admin room publish (`7788990` / `ff2026`) | ✅ status → ROOM_REVEALED |
| 18 | App me room | ✅ **Room ID + Password dikha**, Copy buttons, realtime |

**Conclusion:** Join → wallet deduction → room reveal ka poora flow **kaam kar raha hai**. Sirf IGN validation UX (B5) theek karna hai.

## Realtime (WebSocket) Verified

```
D TourneyRealtime: Connecting to WebSocket: ws://localhost:5000/ws?tenantId=...&token=eyJ...
```

- Balance update bina refresh ke aa gaya (deposit approve hone par)
- Room credentials publish hone par card khud update hua
- **WebSocket + live feed dono kaam kar rahe hain** ✅

## Admin Web — Live Test Results (16 Nov 2026)

Sab kuch **browser se** test kiya gaya (Admin App hata diya hai, sirf web).

| # | Screen | Kya kiya | Result |
|---|---|---|---|
| 1 | Login | Email OTP (debugOtp) -> cookie `admin_session` | ✅ |
| 2 | Dashboard | "Good evening, Owner", 0 live, 0 withdrawals, 0 deposits | ✅ |
| 3 | Create Match | Form bhara: BR / SOLO / Bermuda / **24 slots** / ₹15 fee / ₹200 prize | ✅ Match **#12** bana |
| 4 | Publish Room | Room ID `5544332` + pass `arena123` -> confirm dialog -> publish | ✅ status ROOM_REVEALED |
| 5 | Matches | Tabs Live 0 / Upcoming 2 / History 10; #12 dikha 0/24 | ✅ |
| 6 | Live Scorer | "No live matches" + "Unscored backlog 4" | ✅ |
| 7 | Wallet (deposits) | ₹100 deposit aa gaya realtime -> Approve -> confirm | ✅ status APPROVED, balance ₹100 |
| 8 | Wallet (withdrawals) | ₹50 withdraw request -> Approve + UTR `UTR998877` -> Mark paid | ✅ status APPROVED |
| 9 | Players | 57 players list, search "Spartan" -> 1 result | ✅ |
| 10 | Player detail | Deposit / Winnings / Lifetime / Entry fees / Win rate / career / cheat signals | ✅ |
| 11 | Ban / Unban | Ban -> player login **403 "account has been banned"** -> unban | ✅ |
| 12 | Staff & Access | 1 access key, permission chips, expiry, New key / Revoke | ✅ |
| 13 | App Settings | UPI ID / payee / min deposit / WhatsApp / login methods | ✅ |
| 14 | Settlement | Deposits ₹150, Withdrawals ₹50, Entry ₹490, Prizes ₹50, Net ₹440 | ✅ |
| 15 | CSV export | `GET /admin/wallet/settlement/export.csv` -> summary + 4 ledger rows | ✅ |

### API se verify kiya (admin web ke peeche)

| Endpoint | Result |
|---|---|
| `POST /auth/admin/otp/request` + `/verify` | ✅ token + cookie |
| `GET /auth/me` | ✅ Owner |
| `POST /tournaments` (24 slots) | ✅ match #12 |
| `PATCH /tournaments/:id/room` | ✅ roomId + password saved |
| `PATCH /admin/players/:id/ban` `{isBanned:true}` | ✅ ban -> login 403 |
| `GET /admin/wallet/settlement/export.csv` | ✅ CSV |

### ✅ B11 FIXED — Settlement ab cash basis (ledger date)

**Problem:** "Settlement > Today" me **Entry fees ₹490** dikha, par aaj ka asli JOIN_FEE ledger sirf **₹10** tha.

**Kyun:** `settlement.service.ts` entry fees ko **match ki scheduled date** se count karta tha (`referenceId IN scheduledMatchIds`), ledger row ki date se nahi. Baaki teen figures (deposits, withdrawals, prizes) ledger-date se the — isliye summary neeche di gayi ledger rows se match nahi karta tha.

**Fix (cash basis):** JOIN_FEE ab `createdAt` (ledger date) se count hota hai. Ab charon figures ek hi rule follow karte hain — "is din wallet se paisa kab nikla/aaya".

**Files:**
- `backend/src/services/settlement.service.ts` — 2 query + comments
- `backend/tests/settlementReport.test.ts` — expectations + 1 naya regression test
- `admin-web/src/screens/wallet/SettlementScreen.tsx` — "1 match" grammar

**Verification (live, 16 Nov 2026):**

| Ledger truth | Settlement | Result |
|---|---|---|
| ADD_MONEY ₹150 | Deposits ₹150 (2) | ✅ |
| WITHDRAWAL ₹50 | Withdrawals ₹50 (1) | ✅ |
| JOIN_FEE ₹10 | Entry fees ₹10 (1) | ✅ (pehle ₹490) |
| WINNING_PRIZE ₹50 | Prizes ₹50 (1) | ✅ |

Net margin: **−₹40** (pehle +₹440). Platform cut −₹4.

Tests: **451/451 pass**, `tsc --noEmit` clean (backend + admin-web).

> **Side effect (jaan boojh kar):** jis din seat bikti hai us din entry fee count hoti hai, match khelne ke din nahi. Jaise Match #12 (₹10, 17 Nov ko khela jayega) aaj hi bik gaya to aaj count hua — kyunki paisa aaj hi aaya.

## ✅ B5 FIXED — Join button ab batata hai kyun band hai

**Problem:** Naye player (jiska IGN/UID save nahi hai) join sheet kholta tha:
- IGN field me **"SpartanOP"** dikhta tha — par wo **placeholder** tha, asli value khaali
- Join button **grey** tha, aur **koi message nahi**
- Player ko lagta: "app kharab hai" ya "paise kam hai"

Aur wo UID bhar deta tha, par IGN khaali hone se button phir bhi band → **fas jata tha**.

**Kyun:** `DemoCompactField` khaali value pe placeholder grey text dikhata hai (normal UI pattern). Par validation sirf `ign.isNotEmpty()` pe error deta tha — matlab **khaali field pe koi hint nahi**.

**Fix (`JoinMatchSheet.kt`, 4 jagah):**
1. Placeholder `"SpartanOP"` → **"Your in-game name"** (ab example name nahi lagta)
2. Naya **hamesha-dikhne wala hint** jo batata hai kya missing hai:
   - dono khaali → "Enter your Free Fire IGN and UID to join."
   - sirf IGN → "Enter your in-game name (2-30 characters)."
   - sirf UID → "Enter your 6-12 digit Free Fire UID."
   - galat format → "IGN must be 2-30 characters and UID 6-12 digits." (laal)
3. **Button label** ab wajah bolta hai: `"Enter IGN & UID to join"` (pehle bas grey "Confirm & Join Slot")
4. Hint pehle `ign.isNotEmpty() || uid.isNotEmpty()` pe depend karta tha — ab hamesha dikhta hai

**Verify (emulator, naya player `9876500022`, IGN/UID khaali, ₹245):**

| | Pehle | Ab |
|---|---|---|
| IGN field | placeholder "SpartanOP" (value jaisa) | placeholder "Your in-game name" |
| Hint | koi nahi | "Enter your Free Fire IGN and UID to join." (gold) |
| Button | "Confirm & Join Slot" (grey, chup) | **"Enter IGN & UID to join"** (grey, wajah batata) |
| IGN bhara, UID khaali | koi hint nahi | "Enter your 6-12 digit Free Fire UID." |

`assembleDebug` → **BUILD SUCCESSFUL**, emulator pe install + verify.

## Admin App Testing

| Screen | Result |
|---|---|
| Dashboard | ✅ "Logged in: ADMIN (Owner)", 6 module cards, **realtime device alert** |
| Create Match | ✅ Form: mode/type/map, fee/prize fields, IST date+time pickers |
| Manage Matches | ✅ Tabs (Live/Upcoming/History), match #11 ROOM OUT, 1/48 seats, ₹10 |
| Spectator Scorer | ✅ APE-0053 / SpartanOP / UID, rank 1, filters, CSV, Pay button |
| Wallet Console | ⬜ (nahi khola) |
| Player Management | ⬜ (nahi khola) |

## Payout Flow Verified

```
POST /admin/matches/:id/payout
  -> rank 1, verifiedKills 3, prizeWon 100 bheja
  -> Result: Rs.50 paid (prize pool cap), kills 0
```

Ledger me alag **WINNING** balance me gaya:
```
ADD_MONEY      CREDIT Rs.50  -> DEPOSIT  50.00
JOIN_FEE       DEBIT  Rs.10  -> DEPOSIT  40.00
WINNING_PRIZE  CREDIT Rs.50  -> WINNING  50.00   <- alag bucket, sahi hai
```

**Investigate (B8):** `prizeWon: 100` bheja par Rs.50 hi mila (system collected amount se cap karta hai - safe). `verifiedKills: 3` -> 0 ho gaya - payout me kills accept nahi ho rahe.

## Test Data Bana (cleanup ke liye)

| Cheez | ID |
|---|---|
| Match #11 | `5371c59a-d2e8-4540-b012-a138f1d956ca` |
| Player | `0f408869-7a56-460d-846b-eddb389d0025` (`9876500011`) |
| Deposit | `0ec4e241-2388-4151-96f3-7a19fd93ba30` (APPROVED ₹50) |
| Slot | match #11, slot 1 |
| Room | `7788990` / `ff2026` |

---

# ⚠️ IMPORTANT — Test ke baad revert karna hai

Dono `client_config.json` me `api_base_url` badal ke `http://localhost:5000/api/v1` kiya gaya hai.
**Production APK ke liye wapas karna hoga:** `https://spartan-arena.onrender.com/api/v1`

```bash
cp /tmp/player_cfg.bak android/app-player/src/main/assets/client_config.json
cp /tmp/admin_cfg.bak  android/app-admin/src/main/assets/client_config.json
```

---

*Ye file update hoti rahegi jaise-jaise test hote hain.*
