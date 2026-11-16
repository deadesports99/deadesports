# Local development (sab kuch is machine par)

| Part | URL / port | Notes |
|---|---|---|
| Postgres (Docker) | `localhost:5433` | db `freefire_tournament`, user/pass `postgres` |
| Redis (Docker) | `localhost:6379` | |
| Backend API | `http://localhost:5000` | `cd backend && npm run dev` |
| Admin console | `http://localhost:5174` | `cd admin-web && npm run dev` — port fixed (CSRF origin) |
| Player web | `http://localhost:5173` | `cd player-web && npm run dev` |
| Android apps | via `adb reverse tcp:5000 tcp:5000` | APK `api_base_url` is `http://localhost:5000/api/v1` |

One-click start/stop (repo root):

```bat
start-local.bat      :: Docker → Postgres+Redis → backend :5000 → admin :5174 → player :5173
                     :: → adb reverse tcp:5000 (phone ho to) → browser kholta hai
stop-local.bat       :: Postgres + Redis band (volume safe)
```

`start-local.bat` idempotent hai — dobara chalao to jo already up hai use skip kar deta hai.
Reboot ke baad bas ye ek file chalao, aur kuch manual nahi karna.

Firebase delivery layer (mirror + live feed) locally **ON** hai — details
`plan/firebase-migration/` me, service account `backend/.env` ke `FCM_CREDENTIALS_JSON` me.

First-time DB setup:

```bash
cd backend
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate deploy   # 13 tables (baseline migration)
npm run seed          # demo tenant, players, 2 matches
npm run seed:owner    # deadesports99@gmail.com as ADMIN
```

> **Schema change karne ke baad `prisma db push` mat use karo.**
> Uske bajaye `npx prisma migrate dev --name describe_change` — isse migration file banti
> hai jo git me jaati hai aur Supabase par clean deploy hoti hai. Details:
> `docs/PRISMA-MIGRATIONS.md`.

## Tenant ids (bohot important)

| DB | Tenant id |
|---|---|
| **Local Docker** (current) | `53a09545-e6e2-4cf5-a5c2-7ef18b276a52` |
| **Production (Neon)** | `a3c11cd0-324e-4886-b27c-9667fd7f59dc` |

Ye id in sab jagah same hona chahiye, warna login "Tenant not found" deta hai:

- `admin-web/.env` → `VITE_TENANT_ID`
- `player-web/.env` → `VITE_TENANT_ID`
- `android/app-player/src/main/assets/client_config.json` → `tenant_id`
- `android/app-admin/src/main/assets/client_config.json` → `tenant_id`

## Demo login (local only)

- Player app / player web: **kyi bhi 10-digit number + koi bhi 6-digit OTP** — backend
  `PHONE_OTP_BYPASS=true` hai isliye Firebase SMS skip hota hai aur naya player
  on-the-fly ban jata hai. Admin role ke liye owner number `9999900001` use karo.
- Admin console (web): `deadesports99@gmail.com` → OTP screen ka **DEV** chip.
- **Rate limit:** login endpoint 5 requests/minute/IP. Zyada retry karne par `429`
  aata hai — 1 minute ruk jao.

## Android APK local build

**Fast loop (recommended):** `START-DEV-CONSOLE.bat` → phone/laptop browser me
`http://localhost:5199` → Player/Admin tap = build+install+launch, aur **Watcher ON**
kar do to file save = phone me APK khud install. Details: `docs/DEV-CONSOLE.md`.

Manual:

```bash
adb reverse tcp:5000 tcp:5000          # USB connected device → laptop's backend
cd android
./gradlew.bat :app-player:installDebug
./gradlew.bat :app-admin:installDebug
```

- `adb reverse` USB/disconnect ke baad reset ho sakta hai — dobara chalao.
- APK me `localhost` hardcoded hai, isliye bina USB + adb reverse ke app backend tak
  nahi pahunchegi (Wi-Fi par laptop ka LAN IP use karna padega).
- Release build me `-PapiBaseUrl=https://api.<domain>/api/v1` dena zaroori hai
  (Gradle release me localhost accept nahi karta).
- Client config badalne ke baad **APK dobara build + install** karna zaroori hai.

## Database: Postgres (local Docker ya Neon)

App ka kisi hosted BaaS par **koi runtime dependency nahi** hai — na Supabase SDK,
na koi BaaS client. Sirf plain PostgreSQL:

| Environment | DB |
|---|---|
| **Local dev** | Docker Postgres `localhost:5433` (`backend/docker-compose.dev.yml`) |
| **Production** | **Neon Postgres** — setup: `docs/DEPLOY_RENDER.md` §4 |

`DATABASE_URL` badalne ke alawa kuch nahi karna. Neon ke liye `?sslmode=require`
zaroori hai; Prisma schema, queries aur migrations dono par bilkul same chalte hain.

> Purana hosted DB (Supabase) repo se **poori tarah hata diya gaya** (2026-11-16).
> Na koi SDK, na connection string, na backup file. Sirf plain PostgreSQL bacha hai.

## Local DB functions (ek baar)

`/api/v1/time` DB clock se padhta hai (`get_server_time()`). Naye/local database par ek baar:

```bash
docker exec -i ff-postgres psql -U postgres -d freefire_tournament -c "\
  CREATE OR REPLACE FUNCTION get_server_time() RETURNS json LANGUAGE sql STABLE AS \$\$
  SELECT json_build_object('utc_now',NOW(),'ist_now',NOW() AT TIME ZONE 'Asia/Kolkata',
    'ist_formatted',TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI:SS'),
    'epoch_ms',(EXTRACT(EPOCH FROM NOW())*1000)::bigint,
    'timezone','Asia/Kolkata','offset_minutes',330); \$\$;"
```

Function na ho to endpoint `source: "server_clock"` par fallback karta hai (app nahi tootti).
