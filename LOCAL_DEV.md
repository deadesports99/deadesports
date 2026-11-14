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
start-local.bat      :: Docker DB → backend → admin console → browser
stop-local.bat       :: Postgres + Redis band (volume safe)
```

First-time DB setup:

```bash
cd backend
docker compose -f docker-compose.dev.yml up -d
npx prisma db push
npm run seed          # demo tenant, players, 2 matches
npm run seed:owner    # deadesports99@gmail.com as ADMIN
```

## Tenant ids (bohot important)

| DB | Tenant id |
|---|---|
| **Local Docker DB (current)** | `53a09545-e6e2-4cf5-a5c2-7ef18b276a52` |
| Hosted Supabase (backup `.env.supabase.bak`) | `a3c11cd0-324e-4886-b27c-9667fd7f59dc` |

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

## Hosted Supabase par wapas jaana

```bash
cd backend
copy /Y .env.supabase.bak .env      # Windows (bash: cp .env.supabase.bak .env)
# restart backend
```

Phir upar wale chaaron jagah tenant id `a3c11cd0-...` kar do aur admin/player web +
APKs rebuild kar lo.
