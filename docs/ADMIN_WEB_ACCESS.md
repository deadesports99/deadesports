# 🎛️ Admin web — Roles & permission matrix (as built)

> Har line **code se** verify ki gayi hai: `admin-web/src/lib/permissions.ts` (UI) aur
> `backend/src/routes/*.ts` (server). Do jagah **same** hona chahiye — neeche dono columns hain.

## 1. Roles

| Role | Kaise milta hai | Matlab |
|---|---|---|
| `ADMIN` | owner (email OTP) | **sab kuch** — har permission flag bypass |
| `SUB_ADMIN` | owner email + 24-char key | sirf jo section flags on hain |
| `USER` | player | admin panel me **login hi nahi** kar sakta |

Server rule (`requirePermission`):

```
ADMIN      → hamesha pass (owner ko flag ki zaroorat nahi)
SUB_ADMIN  → us section ka flag true hona chahiye (array = koi ek kaafi)
USER       → hamesha 403
```

## 2. Chhe permissions — ek section = ek flag

Har admin-console section ka **apna** toggle hai, isliye ek key sirf "pay dekho,
paise mat do" jaisi bhi ban sakti hai.

| Flag | UI label | Kaam |
|---|---|---|
| `canCreateMatch` | Create match | naya match, clone, visibility |
| `canManageMatch` | Manage match | manage board, kills, done, room, go-live, sweep, submit, cancel |
| `canUpdateRoomId` | Publish room | room ID/password, reveal timing |
| `canViewPayout` | Final payout (view) | `/payouts` desk, roster + money totals dekhna |
| `canDistributePrize` | Pay real money | payout, seat refund, DQ/ban, finish-by-UID |
| `canManageWallet` | Manage wallet | deposits, withdrawals, payment sync |

> Naya key banate waqt **saare 6 toggles ON** aate hain; jo nahi chahiye wo
> **All off** karke on karo. Purane staff rows migration me backfill ho gaye
> (`canManageMatch` ← `canCreateMatch`, `canViewPayout` ← `canDistributePrize`).

## 3. Matrix — UI screens

| Screen / Route | Owner | `canCreateMatch` | `canManageMatch` | `canUpdateRoomId` | `canViewPayout` | `canDistributePrize` | `canManageWallet` |
|---|---|---|---|---|---|---|---|
| `/` Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/matches` list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/matches/:id` detail | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/matches/create` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/manage` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/payouts` (Final Payout desk) | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/wallet` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/wallet/settlement` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `/players` (+ watchlist, devices, suspicious, `:id`) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `/staff` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `/settings` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `*` (unknown) | → Dashboard | | | | | | |

> `/payouts` dekhne ke liye **`canViewPayout`** kaafi hai — pay button tabhi
> dikhta hai jab **`canDistributePrize`** bhi ho, warna panel likhta hai
> "Paying needs the Pay real money permission" (403 se pehle hi pata chal jaata hai).

## 4. Matrix — API (asli enforcement yahan hai)

| Endpoint | Guard |
|---|---|
| `POST /api/v1/tournaments` (create) | `canCreateMatch` |
| `POST /api/v1/tournaments/:id/clone` | `canCreateMatch` |
| `PATCH /api/v1/tournaments/:id/visibility` | `canCreateMatch` |
| `PATCH /api/v1/tournaments/:id/go-live` | `canManageMatch` (ya `canCreateMatch`) |
| `POST /api/v1/tournaments/sweep/states` | `canManageMatch` (ya `canCreateMatch`) |
| `POST /api/v1/tournaments/:id/cancel` | `canManageMatch` (ya `canCreateMatch`) |
| `/api/v1/admin/matches/manage` | `canManageMatch` |
| `GET /api/v1/admin/matches/:id/live-board` | `canManageMatch` |
| `PATCH /api/v1/admin/matches/:id/participants/:userId/kills` | `canManageMatch` |
| `POST /api/v1/admin/matches/:id/participants/:userId/done` | `canManageMatch` |
| `POST /api/v1/admin/matches/:id/submit` | `canManageMatch` |
| `PATCH /api/v1/tournaments/:id/room` | `canUpdateRoomId` (ya `canManageMatch`) |
| `PATCH /api/v1/tournaments/:id/room-reveal` | `canUpdateRoomId` (ya `canManageMatch`) |
| `/api/v1/admin/matches/payouts/inbox` | `canViewPayout` (ya `canDistributePrize`) |
| `/api/v1/admin/matches/:id/participants` (+ `export.csv`) | `canViewPayout`, `canDistributePrize` ya `canManageMatch` |
| `POST /api/v1/admin/matches/:id/payout` | **`canDistributePrize`** + step-up |
| `PATCH /api/v1/admin/matches/:id/participants/:userId/ban` | `canDistributePrize` (ya `canManageMatch`) |
| `POST /api/v1/tournaments/:id/payout` | `canDistributePrize` |
| `POST /api/v1/tournaments/:id/finish` | `canDistributePrize` |
| `/api/v1/admin/wallet/deposits` (+ approve/reject) | `canManageWallet` |
| `/api/v1/admin/wallet/withdrawals` (+ approve/reject) | `canManageWallet` |
| `/api/v1/admin/wallet/payments` (+ sync) | `canManageWallet` |
| `/api/v1/admin/wallet/settlement` (+ `.csv`) | **`requireRole('ADMIN')`** |
| `/api/v1/admin/players/*` | **ADMIN** |
| `/api/v1/admin/access/*` (staff keys) | **ADMIN** |
| `/api/v1/admin/tenant/settings` (GET/PATCH) | **ADMIN** |
| `GET /api/v1/tournaments/:id`, `/slots`, `/:id/room`, `/:id/results` | koi bhi authenticated |
| `POST /api/v1/tournaments/:id/join` | **`requireRole('USER')`** (player only) |

> UI sirf **chhupata** hai. Asli rok **API guard** hai — isliye DevTools se bhi koi
> permission bypass nahi kar sakta.

## 4b. Extra safety rules (jailbreak audit ke baad)

| Rule | Kyun | Kahan |
|---|---|---|
| Staff apna deposit/withdrawal **approve nahi kar sakta** | warna fake UTR se apna hi balance bana leta | `deposit.service` / `withdrawal.service` — `userId === adminId` → 403 |
| Staff player wallet se **deposit/withdraw request bhi nahi** bana sakta | `/wallet/deposit`, `/wallet/withdraw` ab `requireRole('USER')` | `wallet.routes.ts` |
| Room ID/password sirf **room kaam karne wale staff** ko reveal se pehle | view/wallet-only key ko password nahi dikhna chahiye | `result.service` → `mayWorkRoom()` |
| Permission badalne pe **logout nahi hota**, agle request pe naya flag lagta hai | live scoring session beech me na toote; server har request DB se flags padhta hai | `auth.service.updateStaffMember` + `invalidateAuthCache` |
| Deactivate/ban pe **saari sessions dead** | banned account live cookie se kuch na kar sake | `killUserSessions` + middleware `isBanned` → 403 |
| Step-up token **user + browser** se bandha | dusre ki proof copy nahi ho sakti | `stepUp.middleware` (`userId`, `sid`) |

## 5. Permission live badalna (bina logout)

`auth.middleware.ts` har request pe user row se flags padhta hai (30s cache ke saath):

1. Owner → **Staff & Access** → staff key → toggle off → Save
2. Staff ka agla fetch/route change → wo card/action **gayab**
3. Permission **turant** lagu: server-side check per request (cache sirf user row ka hai)

## 6. Staff key lifecycle

| Action | Endpoint | Asar |
|---|---|---|
| Naya key | `POST /api/v1/admin/access` | 24-char key **ek baar** dikhti hai |
| Revoke | `POST /api/v1/admin/access/:id/revoke` | session **agle request pe** dead — par **30 s** tak chal sakta hai (key cache TTL) |
| Regenerate | `POST /api/v1/admin/access/:id/regenerate` | **naya key row** banta hai + purana auto-revoke (purane id pe revoke dobara call karna no-op hai) |
| List | `GET /api/v1/admin/access` | sirf `keyHint` (last 4) + permissions |

## 7. Verify karna (2 min, curl se)

```bash
BASE=http://localhost:5000/api/v1

# 1) bina cookie = 401
curl -o /dev/null -w "no-cookie: %{http_code}\n" $BASE/admin/wallet/deposits

# 2) staff key (canManageWallet off) se cookie le kar
curl -o /dev/null -w "staff-no-perm: %{http_code}\n" -b staff.txt $BASE/admin/wallet/deposits
#   expected: 403  {"…":"You lack permission to perform this action"}

# 3) owner cookie = 200
curl -o /dev/null -w "owner: %{http_code}\n" -b owner.txt $BASE/admin/wallet/deposits

# 4) owner-only route staff se = 403
curl -o /dev/null -w "staff-settlement: %{http_code}\n" -b staff.txt $BASE/admin/wallet/settlement

# 5) CSRF gate: cookie + galat Origin = 403 "Blocked cross-site request"
curl -o /dev/null -w "csrf: %{http_code}\n" -b owner.txt -X POST \
  -H "Origin: https://evil.com" $BASE/admin/access -H 'content-type: application/json' -d '{}'
```

Sab expected (401/403/200/403/403) mile = permission system sahi hai.

## 8. Jailbreak audit (verified 2026-11-19)

Real API pe 6 staff roles (zero / manage / view / pay / wallet / all) ke saath **47 checks**,
sab pass. Script run ke baad data cleanup (staff, keys, tenant, room creds restore).

Covered: owner-only surfaces (keys, staff CRUD, settings, audit, settlement, players),
section separation (wallet / payout / manage / room), cross-tenant IDOR (details, roster,
room write, cancel → 404 + status untouched), role confusion (`join` staff se 403),
step-up bypass (missing/forged/other-user token → 403), live permission revoke (agle
request pe 403), input smuggling (unknown key / non-boolean / `role: ADMIN` → 400),
ban → 401/403, session list/revoke self-scoped, wallet self-dealing → 403.
