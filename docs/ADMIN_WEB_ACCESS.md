# 🎛️ Admin web — Roles & permission matrix (as built)

> Har line **code se** verify ki gayi hai: `admin-web/src/lib/permissions.ts` (UI) aur
> `backend/src/routes/*.ts` (server). Do jagah **same** hona chahiye — neeche dono columns hain.

## 1. Roles

| Role | Kaise milta hai | Matlab |
|---|---|---|
| `ADMIN` | owner (email OTP) | **sab kuch** — har permission flag bypass |
| `SUB_ADMIN` | owner email + 24-char key | sirf jo 4 flags on hain |
| `USER` | player | admin panel me **login hi nahi** kar sakta |

Server rule (`requirePermission`):

```
ADMIN      → hamesha pass (owner ko flag ki zaroorat nahi)
SUB_ADMIN  → wo specific flag true hona chahiye
USER       → hamesha 403
```

## 2. Chaar permissions

| Flag | UI label | Kaam |
|---|---|---|
| `canCreateMatch` | Create matches | naya match, clone, cancel+refund, visibility, go-live, sweep |
| `canUpdateRoomId` | Publish room | room ID/password, reveal timing |
| `canDistributePrize` | Payout prizes | live scorer, roster payout, DQ/ban, finish-by-UID |
| `canManageWallet` | Manage wallet | deposits, withdrawals, payment sync |

## 3. Matrix — UI screens

| Screen / Route | Owner | `canCreateMatch` | `canUpdateRoomId` | `canDistributePrize` | `canManageWallet` |
|---|---|---|---|---|---|
| `/` Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/matches` list | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/matches/:id` detail | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/matches/create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/matches/publish` | ✅ | ❌ | ✅ | ❌ | ❌ |
| `/roster` (Live Scorer) | ✅ | ❌ | ❌ | ✅ | ❌ |
| `/wallet` | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/wallet/settlement` | ✅ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `/players` (+ watchlist, devices, suspicious, `:id`) | ✅ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `/staff` | ✅ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `/settings` | ✅ | ❌ | ❌ | ❌ | ❌ (owner-only) |
| `*` (unknown) | → Dashboard | | | | |

> **Staff ko `/matches` list dikhti hai** — wo dekh sakta hai, par usme actions sirf
> permission ke hisaab se unlock hote hain. Koi bhi locked route kholne pe Dashboard pe
> wapas bhej diya jaata hai (`ROUTE_ACCESS`).

## 4. Matrix — API (asli enforcement yahan hai)

| Endpoint | Guard |
|---|---|
| `POST /api/v1/tournaments` (create) | `canCreateMatch` |
| `PATCH /api/v1/tournaments/:id/go-live` | `canCreateMatch` |
| `POST /api/v1/tournaments/sweep/states` | `canCreateMatch` |
| `POST /api/v1/tournaments/:id/cancel` | `canCreateMatch` |
| `POST /api/v1/tournaments/:id/clone` | `canCreateMatch` |
| `PATCH /api/v1/tournaments/:id/visibility` | `canCreateMatch` |
| `PATCH /api/v1/tournaments/:id/room` | `canUpdateRoomId` |
| `PATCH /api/v1/tournaments/:id/room-reveal` | `canUpdateRoomId` |
| `POST /api/v1/tournaments/:id/payout` | `canDistributePrize` |
| `POST /api/v1/tournaments/:id/finish` | `canDistributePrize` |
| `/api/v1/admin/matches/:id/participants` (+ `export.csv`) | `canDistributePrize` |
| `POST /api/v1/admin/matches/:id/payout` | `canDistributePrize` |
| `PATCH /api/v1/admin/matches/:id/participants/:userId/ban` | `canDistributePrize` |
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
