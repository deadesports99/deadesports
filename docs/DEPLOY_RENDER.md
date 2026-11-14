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
   Supabase Postgres        Upstash Redis
   (free 500 MB)            (free 10k cmd/din)
```

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
| Supabase | PostgreSQL | https://supabase.com |
| Upstash | Redis | https://upstash.com |
| cron-job.org | Sleep se bachana | https://cron-job.org |
| Brevo | OTP mail (already done ✅) | https://app.brevo.com |

## 4. Step A — Supabase Postgres

1. https://supabase.com → **New project**
   - Name: `spartan-arena` · Region: **Mumbai / Singapore** · DB password: strong yaad rakho
2. Project ready hone ke baad → **Project Settings → Database → Connection string → URI**
3. **Do URL chahiye** (dono milenge isi page pe):

| Kaam | Port | Kaisa URL |
|---|---|---|
| App runtime (Render) | **6543** (pooler / transaction) | `postgresql://postgres.xxxx:PASS@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| Table banane ke liye (local se) | **5432** (direct) | `postgresql://postgres.xxxx:PASS@aws-0-....pooler.supabase.com:5432/postgres` |

> ⚠️ `PASS` me special characters (`@ # %`) hon to **URL-encode** karo, warna connection fail.

## 5. Step B — Upstash Redis

1. https://upstash.com → **Create database**
   - Name: `spartan-arena` · Region: **ap-south-1 (Mumbai)** · TLS: **on**
2. Database page → **REST API / Redis Connect** → **`REDIS_URL`** copy karo
   - Dikhega: `rediss://default:AbCd...@xxx.upstash.io:6379` (`rediss` = TLS, `s` mat hatana)

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
| `DATABASE_URL` | §4 ka **6543 pooler** URL |
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

# 1) Direct (5432) URL se schema push karo
DATABASE_URL="postgresql://postgres.xxxx:PASS@...:5432/postgres" npm run prisma:push

# 2) Owner + demo data seed
DATABASE_URL="postgresql://postgres.xxxx:PASS@...:5432/postgres" npm run seed
DATABASE_URL="postgresql://postgres.xxxx:PASS@...:5432/postgres" npm run seed:owner
```

> `prisma:push` **5432** pe chalta hai. Runtime **6543** pe. Dono alag — ye normal hai.

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
  "tenant_id": "<production tenant uuid>"
}
```

`localhost:5000` hatana **zaroori** hai warna phone se app dead rahega.

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
| `P1001 can't reach database` | 6543 vs 5432 galat URL | Runtime = **6543**, `?pgbouncer=true` |
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
| Supabase Postgres (free 500 MB) | ₹0 |
| Upstash Redis (free 10k cmd/day) | ₹0 |
| Brevo mail (300/day) | ₹0 |
| cron-job.org keep-warm | ₹0 |
| Domain | **nahi chahiye** — `*.onrender.com` |
| **Total** | **₹0 / month** |

Scale badhne par: Render Starter $7/mo (no sleep, 512 MB→) — tab tak free kaafi hai.
