# 🚀 Render deploy — poora admin panel free me live

> **Kya milega:** `https://spartan-arena.onrender.com` jaisa **free URL** jispe admin panel
> (UI), API aur live updates — **teeno ek hi jagah**. Koi domain kharidne ki zaroorat nahi.
> **Kharcha: ₹0.** Koi credit card nahi.

## 1. Kya ban raha hai

```
        Aapka browser / Android app
                    │
                    ▼
  https://spartan-arena.onrender.com          ← Render free web service (ek hi origin)
  ┌───────────────────────────────────────────┐
  │  /            → admin-web/dist (React UI) │
  │  /api/v1/*    → REST API (Express)        │
  │  /ws          → realtime WebSocket        │
  │  /health      → health probe              │
  └───────────┬───────────────────┬───────────┘
              │                   │
              ▼                   ▼
   Neon Postgres            Render Key Value
   (free 1 GB)              (free 25 MB, same region)
              │
              │   Firebase (delivery layer, Spark/free)
              └─────────────▶ Firestore live_events · FCM push · Auth token verify
```

> **Supabase hata diya.** Ledger (paisa) Neon PostgreSQL me rahega — Firebase
> Firestore me **nahi** (10 `$transaction`, Redis Lua slot-locks, withdrawal ledger:
> ye SQL ke bina safe nahi ho sakta). Firebase wo karta hai jisme wo best hai:
> live feed mirror, push, auth verify, stats export. Detail: `plan/firebase-migration/`.

Ek hi origin hone ki wajah se: **cookie (login session) first-party rehta hai**,
WebSocket ko `VITE_WS_URL` ki zaroorat nahi, CORS ka jhanjhat nahi. Isi liye
`SERVE_ADMIN_WEB=true` set karte hain — UI backend ke andar se serve hoti hai.

## 2. Free tier ki sachchai (pehle jaan lo)

| Cheez | Free limit | Matlab |
|---|---|---|
| Instance hours | **750/month** | Ek service 24×7 chal sakti hai (744 hrs) ✅ |
| Sleep | **15 min idle** ke baad so jaata hai | Pehla request ~50 sec slow (cold start) |
| RAM / CPU | 512 MB / 0.1 CPU | Hamara panel araam se chalta hai |
| WebSocket | **supported** ✅ | Live score updates kaam karenge |
| URL | `*.onrender.com` | Free, HTTPS included, **domain nahi chahiye** |

**Sleep se bachne ka tarika:** §7 me `cron-job.org` se har 10 min ping (free).

## 3. Accounts chahiye (sab free, card nahi)

| Service | Kaam | Link |
|---|---|---|
| GitHub | Code already hai ✅ | — |
| Render | App chalana | https://render.com |
| **Neon** | PostgreSQL (ledger) | https://neon.com |
| Render Key Value | Redis (Render ke andar hi, alag signup nahi) | https://dashboard.render.com/new/redis |
| cron-job.org | Sleep se bachana | https://cron-job.org |
| Brevo | OTP mail (already done ✅) | https://app.brevo.com |
| Firebase | Live mirror + push (already setup ✅) | https://console.firebase.google.com |

## 4. Step A — Neon Postgres (ledger)

> Supabase account ki **zaroorat nahi**. Neon free hai, card nahi, expire nahi hota.

1. https://neon.com → **Sign up** (GitHub ya email) → **New Project**
   - Name: `spartan-arena` · Region: **AWS ap-southeast-1 (Singapore)** · Postgres 17
2. Dashboard → **Connection string** → copy karo. Aisa dikhega:

```
postgresql://neondb_owner:PASS@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

3. **Ek hi URL kaafi hai** (runtime + `prisma:push` dono ke liye).
   Neon ka `-pooler` wala host **optional** hai — hamare paas traffic kam hai, direct
   connection sabse kam dikkat deta hai.

> ⚠️ URL me **`?sslmode=require` chhodna** — Neon TLS ke bina connect nahi hota.
> Code khud `sslmode` strip karke TLS on karta hai (remote host detect karke), par URL me
> rakhne se Neon dashboard/psql me bhi wahi chalega.
> ⚠️ `PASS` me special characters (`@ # %`) hon to **URL-encode** karo.
> ⚠️ Neon free compute **5 min idle** ke baad suspend hota hai — pehla query ~500 ms slow.
> Ye Render ke 15-min sleep se chhota hai, to keep-warm cron dono ko jagaye rakhta hai.

## 5. Step B — Redis (Render Key Value, free)

> **Upstash kyun nahi:** Upstash ke free plan me Asia region hi nahi hai (sirf US/EU/Brazil
> aur GCP ka Tokyo). Render ka apna Key Value free me **Singapore** milta hai, jo web
> service ke **same region + private network** me hota hai → per command ~1 ms (vs ~70 ms
> Tokyo se). Isliye Render Key Value chuna.

1. Render dashboard → **New → Key Value**
   - Name: `spartan-cache` · Region: **Singapore (Southeast Asia)** · Plan: **Free (25 MB, 50 connections)**
2. Ban jaane par **Internal Key Value URL** copy karo
   - Dikhega: `redis://red-xxxxxxxxxxxx:6379` (internal, private network, password nahi)
3. Ye hi `REDIS_URL` hai. 25 MB kaafi hai: Redis sirf slot-locks + rate-limit counters
   rakhta hai (kuch KB), aur restart pe slot-locks DB se `hydrateSlotsFromDb` se wapas aate hain.

## 6. Step C — Render pe deploy

1. https://dashboard.render.com → **New → Blueprint**
2. GitHub repo `deadesports99/deadesports` connect karo → Render `render.yaml` khud padh lega
3. **Apply** dabao → build shuru (pehli baar **6-10 min**, image build hota hai)
4. Build ke baad service ka URL milega, jaise:
   `https://spartan-arena-xxxx.onrender.com` ← **isko copy karo**, aage 2 baar chahiye

> Build fail ho to: **Logs** tab → jo error hai wahi actual reason hai. Common:
> `npm ci` lockfile mismatch ya `tsc` error. Local me `cd admin-web && npm run build` +
> `cd backend && npm run build` chala ke pehle pakad lo.

## 7. Step D — Environment variables (Render → Environment)

`render.yaml` me jo `sync: false` hai, wo **dashboard me** daalni hoti hai:

| Key | Value kahan se |
|---|---|
| `DATABASE_URL` | §4 ka Neon URL (`?sslmode=require` ke saath) |
| `REDIS_URL` | §5 ka `rediss://...` URL |
| `ACCESS_KEY_PEPPER` | 32+ random chars — `openssl rand -hex 32` |
| `ADMIN_WEB_ORIGIN` | `https://<service>.onrender.com` (apna URL, **bina** trailing slash) |
| `CORS_ORIGIN` | wahi URL |
| `BREVO_API_KEY` | `backend/.env` se (dashboard me dobara paste) |
| `EMAIL_FROM` | `Spartan Arena <deadesports99@gmail.com>` — **quote ke bina** |

> **`PAYMENTS_ENABLED=false`** by default (`render.yaml` me). Matlab **online wallet top-up
> band** hai: payment routes mount hi nahi hote, aur wallet me paisa owner ke **manual UTR
> approval** se jaata hai. Razorpay KYC + live keys mil jaayein tabhi `PAYMENTS_ENABLED=true`
> + `PAYMENT_PROVIDER=razorpay` + `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` daalna.
> **Test keys (`rzp_test_*`) production me kabhi mat daalna** — koi bhi fake test payment se
> apna wallet bhar sakta hai.

`JWT_SECRET` Render khud generate kar deta hai (`generateValue: true`) — chhedna mat.
Save karo → service **auto redeploy** hogi.

> **`ADMIN_WEB_ORIGIN` galat = login nahi hoga** (CSRF gate). Bina trailing slash, poora
> `https://` ke saath, bilkul wahi URL jo browser me kholte ho.

## 8. Step E — Tables banao (ek hi baar, apne laptop se)

```bash
cd backend

# Neon URL (wahi jo runtime me) — dono jagah chalega
DATABASE_URL="postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" npm run prisma:push

# Owner + demo data seed
DATABASE_URL="postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" npm run seed
DATABASE_URL="postgresql://neondb_owner:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" npm run seed:owner
```

> Neon ka **ek hi** URL runtime aur schema-push dono ke liye chalta hai — koi
> 6543/5432 ka jhanjhat nahi (wo Supabase ka tha).

## 9. Step F — Keep-warm (sleep se bachao)

1. https://cron-job.org → free account → **Create cronjob**
2. URL: `https://<service>.onrender.com/health` · Schedule: **every 10 minutes**
3. Save → "TEST RUN" dabao → `200 OK` aana chahiye

> Bina iske: 15 min baad service so jaayegi aur subah pehla login ~50 sec lagega.
> 750 hrs/month me 10-min ping aaram se fit hai.

## 10. Step G — Smoke test (sab green hone chahiye)

```bash
BASE=https://<service>.onrender.com
curl -s $BASE/health                    # {"success":true,...}
curl -s $BASE/api/v1/health             # JSON, 200
curl -sI $BASE/ | head -3               # 200 text/html  ← UI serve ho raha hai
curl -s -o /dev/null -w "%{http_code}\n" $BASE/wallet   # 200 (SPA deep link)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/v1/nope  # 404 JSON
```

Browser me:
1. `$BASE` kholo → **login screen** dikhe
2. Owner email → **Send sign-in code** → mail aaye (Brevo)
3. Code daalo → **dashboard khule** ✅
4. Panel me 1 match banao → page refresh → data bacha hua ho (DB sahi)

> `FRAME`/CSP error aaye console me to batao — `app.ts` me `contentSecurityPolicy`
> directives already tuned hain (Google Fonts + `wss:` allowed).

## 11. Step H — Mobile apps ko naya URL do

`android/app-player/src/main/assets/client_config.json` **aur**
`android/app-admin/src/main/assets/client_config.json`:

```json
{
  "api_base_url": "https://<service>.onrender.com/api/v1",
  "tenant_id": "a3c11cd0-324e-4886-b27c-9667fd7f59dc"
}
```

`localhost:5000` hatana **zaroori** hai warna phone se app dead rahega.

> **Tenant id** local aur prod me alag hai — ye galti sabse aam hai:
> **local dev** = `53a09545-e6e2-4cf5-a5c2-7ef18b276a52` (docker Postgres),
> **prod (Neon)** = `a3c11cd0-324e-4886-b27c-9667fd7f59dc` (hosted DB ka tenant).
> Local me prod id daaloge to "tenant not found", prod me local id daaloge to khaali list — dono
> silent lagte hain. Chaar jagah match hona chahiye: dono APK `client_config.json`,
> `admin-web/.env` (`VITE_TENANT_ID`), `player-web/.env`.

## 11b. Step H2 — Firebase go-live (delivery layer)

> Firebase = **live feed + push + token verify**, ledger nahi. Aapka project:
> `deadesports-865d2` (Spark/free, Firestore `asia-south1`, rules + 5 indexes deployed).

**1) Service account Render pe paste karo**

Firebase Console → ⚙️ **Project settings → Service accounts → Generate new private key**
→ JSON download → **ek line** banao:

```bash
node -e "console.log(JSON.stringify(require('./serviceAccount.json')))" > fcm-one-line.txt
```

`fcm-one-line.txt` ka poora content Render → **Environment → `FCM_CREDENTIALS_JSON`** me paste
karo (secret). **Ye file delete kar dena** kaam ke baad.

**2) Mirror on** — blueprint me `FIREBASE_LIVE_MIRROR=true` already hai. Deploy ke baad log me:

```
🔥 Firestore live mirror ON → collection "live_events" (batch 100, queue 500)
```

na dikhe to creds galat/trailing comma hai. Mirror fail ho to **API nahi rukta** (rule #4).

**3) Rules + indexes (ek hi baar, laptop se)**

```bash
firebase deploy --only firestore:rules,firestore:indexes --project deadesports-865d2
```

**4) Verify**

```bash
cd backend && npm run verify:firebase
```

| Phase | Expected |
|---|---|
| 1 live mirror write | ✅ PASS |
| 2 live feed read + budget | ✅ PASS |
| 4 Storage | ❌ FAIL — **expected**, Blaze (paid) chahiye. Ignore. |
| 5 stats snapshot | ✅ PASS |
| All (rules) | SKIP — Admin SDK rules bypass karta hai, console se manually check |

**5) TTL khud manage hota hai** — Spark plan me Firestore TTL policy nahi hoti, isliye
`liveMirrorService.purgeExpired()` har 30 min me purana feed saaf karta hai
(`FIREBASE_LIVE_MIRROR_PURGE_MINUTES=30`).

> 💸 **Cost guardrail:** Spark = 50k document reads/din free. Mirror sirf `live_events`
> likhta hai (bounded queue 500, batch 100) — normal din me ye limit ke 1% se bhi kam.

**6) App side — push tabhi chalega jab token backend tak pahunche**

APK me `google-services.json` hona chahiye (file gitignored hai, CI iske bina build karta hai →
us build me push nahi jaayega, baaki sab chalega). Login ke baad app khud
`POST /api/v1/auth/fcm-token` maarta hai (`FcmTokenSync` — app start par bhi, agar session hai).
Check:

```bash
# prod DB (Neon) par
select count(*) from "User" where "fcmToken" is not null;   -- 0 se zyada hona chahiye
```

Ek asli push bhej kar test karo (admin console se room reveal, ya `sendPush()`).
Phone par notification na aaye to pehle `POST_NOTIFICATIONS` permission dekho.

**7) Key hygiene (zaroori)**

- `fcm-one-line.txt` Render me paste karne ke baad **delete** karo.
- `C:\Users\<you>\Downloads\deadesports-865d2-firebase-adminsdk-*.json` bhi **delete** karo —
  wahi credentials ab `.env` aur Render secret me hain; download folder me rehna risk hai.
- Ye key kabhi commit na ho: `.gitignore` me `fcm-one-line.txt` aur `backend/.env` already hain
  (`git status` me dikhna nahi chahiye).

## 11c. Step H3 — Prod smoke test (deploy ke baad, 6 commands)

Deploy hote hi laptop se ye chalao — har line ke saamne expected output:

```bash
BASE=https://<service>.onrender.com

curl -s $BASE/health                       # {"status":"ok",...}
curl -s $BASE/health/ready                 # {"status":"ready","database":"up","redis":"up"}
curl -s $BASE/api/v1/time                  # "source":"postgres"   ← "server_clock" aaya to get_server_time() missing
curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/v1/live/events   # 401 — bina auth ke kholna hi nahi chahiye
```

Render → **Logs** me ye 3 lines dikhni chahiye:

```
🔥 Firestore live mirror ON → collection "live_events"
🧹 live mirror purge every 30 min
🚀 Server running in PRODUCTION mode
```

Aur admin console par ek match banao → kuch der me Firestore Console → `live_events` me
`MATCH_CREATED` doc dikhna chahiye. Nahi dikha to `FCM_CREDENTIALS_JSON` galat/trailing
comma hai (`verify:firebase` wahi batayega).

## 12. Update kaise hote hain (roz ka kaam)

```bash
git add -A && git commit -m "..." && git push origin main
```

`autoDeploy: true` hai → Render khud naya image banayega (~5 min), zero downtime ke saath.
Purana version tab tak chalta rahega jab tak naya healthy na ho jaaye.

## 13. Troubleshooting

| Symptom | Wajah | Fix |
|---|---|---|
| Service baar baar restart | Env missing / DB connect fail | **Logs** me `Invalid environment` ya `P1001` dekho |
| `P1001 can't reach database` | URL galat / `sslmode` missing | Neon URL poora copy karo (`?sslmode=require`) |
| Login ke baad 403 CSRF | `ADMIN_WEB_ORIGIN` mismatch | Wahi URL daalo jo browser me hai |
| UI blank / 404 on refresh | `SERVE_ADMIN_WEB` off | Env `true` + `ADMIN_WEB_DIST=/app/admin-web/dist` |
| OTP mail nahi aaya | Brevo key/sender | `LOG` me `[EMAIL:brevo]` line dhoondo; 401 = key galat |
| `429 Daily sign-in code limit` | 10/day cap | Agle din, ya `ADMIN_OTP_DAILY_CAP` badhao |
| Cold start 50s | Free tier neend | §9 keep-warm cron |
| Boot fail: `PAYMENT_PROVIDER=mock is not allowed` | `PAYMENTS_ENABLED` unset | `PAYMENTS_ENABLED=false` set karo (ya razorpay keys do) |
| Build `npm ci` fail | Lockfile purana | Local `npm install` → lockfile commit |

## 14. Cost summary

| Item | Cost |
|---|---|
| Render web service (free) | ₹0 |
| **Neon** Postgres (free 1 GB) | ₹0 |
| Firebase Firestore + FCM (Spark free) | ₹0 |
| Render Key Value (free 25 MB, same region) | ₹0 |
| Brevo mail (300/day) | ₹0 |
| cron-job.org keep-warm | ₹0 |
| Domain | **nahi chahiye** — `*.onrender.com` |
| **Total** | **₹0 / month** |

Scale badhne par: Render Starter $7/mo (no sleep, 512 MB→) — tab tak free kaafi hai.
