# 📘 TURNKEY HANDOVER MANUAL
## Free Fire Tournament Platform — White-Label SaaS (Boss / Client Delivery Guide)

> **Purpose:** Give this document + the repo + two APKs to any client and they can run
> their own Free Fire tournament business in under 30 minutes — with **their own**
> database, **their own** Firebase project and **their own** UPI ID.
>
> **Zero data liability:** we never store the client's money, player data or match data.
> Everything lives in the client's Supabase/Firebase account after handover.

---

## 1. What exactly are we selling?

| Deliverable | What it is |
| --- | --- |
| `Player.apk` | Gamer app: register (phone + FF UID), browse matches, book 1 of 48 slots, Add Cash via UPI + UTR, room ID at T-15 min, official scoreboard, withdraw winnings |
| `Admin.apk` | Owner + staff app: create matches, publish room ID, spectator scorer (kills/ranks/hacker flags + 1-click payout), deposits (UTR) & withdrawals approvals, staff hiring with granular permissions |
| `backend/` | Node.js + Express + TypeScript + Prisma + Redis API (multi-tenant, double-entry wallet ledger, FCM push, auto match-lifecycle sweep) |
| `clients/<slug>/` + `package_client.bat` | 10-minute re-branding: name, colors, package id, tenant, UPI, icon → two fresh APKs |
| This manual | Supabase/Firebase setup, Play Store compliance, ops runbook |

**Panels:** Owner (Admin) → Staff (Sub-Admin with 4 permission flags) → Player.
**Money flow:** Player pays the client's UPI → submits 12-digit UTR → staff approves → deposit balance → joins match → spectator verifies → prize to winning balance → withdrawal request → staff pays UPI.

---

## 2. Folder map

```
Free Fire turnament/
├── backend/                 # API (Node + Express + Prisma + Redis)
├── android/
│   ├── core/                # shared UI, API client, theme engine, FCM service, art
│   ├── app-player/          # Player APK  (reads src/main/assets/client_config.json)
│   └── app-admin/           # Admin APK
├── clients/
│   ├── _template/           # copy this for every new client
│   └── sample_client/       # working demo (Thunder eSports)
├── package_client.bat       # 1-click branding + build + dist/<client>/*.apk
├── tools/package_client.mjs # the engine behind the .bat (Node 18+)
├── dist/                    # generated (git-ignored): one folder per client
└── HANDOVER_MANUAL.md       # this file
```

---

## 3. Prerequisites (install once on your machine)

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 18+ (22 recommended) | `node -v` |
| JDK | 17 | `java -version` |
| Android SDK | compileSdk 36 + build-tools | Android Studio / `local.properties` with `sdk.dir` |
| Git | any | `git --version` |
| Supabase account | free tier OK | supabase.com |
| Redis | Upstash free tier (cloud) or local Docker | — |
| Firebase account | free (optional, for push) | console.firebase.google.com |

---

## 4. Part A — Client's Supabase + backend (≈ 10 minutes)

### A1. Create the client's PostgreSQL
1. supabase.com → **New project** (region: Mumbai/Singapore for Indian clients).
2. **Project Settings → Database → Connection string → URI** (Session pooler).
3. Keep the password safe — this is the client's DB password.

### A2. Configure the backend
```bat
cd backend
copy .env.example .env
```
Fill `backend/.env`:

```ini
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://postgres.<ref>:<PASSWORD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
REDIS_URL="rediss://default:<PASSWORD>@<region>.upstash.io:6379"
JWT_SECRET="<64 random characters - generate once, never share>"
JWT_EXPIRES_IN=7d
CORS_ORIGIN="https://admin.client-domain.com"
# WhatsApp/Firebase optional:
FCM_CREDENTIALS_JSON='{"type":"service_account", ... }'
```

> `DATABASE_URL` needs `sslmode=require` — the code strips that flag for the
> driver but keeps TLS on, so Supabase pooler works out of the box.

### A3. Create the tables + first owner account
```bat
cd backend
npm install
npx prisma generate
npx prisma db push
npm run seed        # optional demo tenant (Apex Free Fire Club) + test players
```
`seed` prints the demo tenant id and login phone numbers. For a **real** client,
create the tenant row (Supabase SQL editor) and the owner user:

```sql
INSERT INTO "Tenant" (id, subdomain, "brandName", "primaryColor", "commissionRate", "upiId", "isActive", "createdAt")
VALUES (gen_random_uuid(), 'alpha-ff', 'Alpha eSports', '#FF5722', 10, 'alphaesports@okaxis', true, now())
RETURNING id;   -- ← copy this id: it is the client's tenant_id

INSERT INTO "User" (id, "tenantId", "phoneNumber", name, email, role, "createdAt")
VALUES (gen_random_uuid(), '<tenant_id>', '9876543210', 'Owner Name', 'owner@alpha.com', 'ADMIN', now());
```
The owner logs into the **Admin app** with that phone number (phone login — no
password to leak). Staff are created from inside the app (Staff Management).

### A4. Deploy the API
- **Render / Railway / Fly.io:** start command `npm run build && npm start`, root `backend/`.
- Health check: `GET /health` → `{ "status": "up" }`.
- Note the public URL — it goes into `backend.api_base_url` (must end with `/api/v1`).
- The in-process match sweep runs automatically every 60s; no separate cron needed.

### A5. Online payments (wallet top-up) — optional but recommended
- Config keys live in `backend/.env` (see `backend/.env.example` and
  [PAYMENT_GATEWAY.md](file:///C:/Free%20Fire%20turnament/docs/PAYMENT_GATEWAY.md)):
  `PAYMENT_PROVIDER`, `PAYMENT_MIN_AMOUNT_PAISE`, `PAYMENT_MAX_AMOUNT_PAISE`,
  `PAYMENT_ORDER_TTL_SECONDS`, `PAYMENT_MOCK_AUTO_CAPTURE`, `PUBLIC_BASE_URL`,
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- **Demo/dev:** `PAYMENT_PROVIDER=mock` → the player's **Add Money → Continue to demo
  checkout** opens a fake gateway page (no real money). The server **refuses to boot**
  production + mock.
- **Live:** create a Razorpay account, paste `RAZORPAY_KEY_ID/KEY_SECRET`, set
  `PAYMENT_PROVIDER=razorpay`, and add the webhook
  `https://<api-host>/api/v1/payments/webhook` with the webhook secret. Orders settle
  into the same double-entry wallet ledger (idempotent — replay can never double-credit).
- Players can still use the manual **UPI + UTR** flow (tenant UPI ID in App Settings) —
  online payments are an addition, not a replacement.

---

## 5. Part B — Client's Firebase (5 minutes, for SMS OTP Login & Push)

1. console.firebase.google.com → **Add project** (client's own, e.g. `alpha-esports`).
2. **Authentication → Sign-in method**:
   - Enable **Phone** provider.
   - *(Optional for Instant Testing)*: Under "Phone numbers for testing", add `+91 9999900001` with OTP `123456` and `+91 9999900003` with OTP `123456`.
3. **Add Android app** using the exact package IDs from `client_config.json`:
   - `com.alphaesports.ff` (player) & `com.alphaesports.ff.admin` (admin).
   - Add SHA-1 and SHA-256 fingerprints for SMS verification (SafetyNet / Play Integrity).
   - Download `google-services.json` and drop into `clients/<slug>/google-services.json` (or `android/app-player/` and `android/app-admin/`).
4. The Gradle build detects `google-services.json` automatically and enables Firebase Phone Auth + FCM push.
5. Backend push & token verification: **Project settings → Service accounts → Generate new private key** →
   paste the JSON string into `FCM_CREDENTIALS_JSON` in `backend/.env`.

> 💡 **Production SMS Cost & Gateway Optimization (Roadmap):**  
> Firebase Phone Auth in India uses international telecom gateways and costs ~$0.07/SMS (~₹5.80/SMS).  
> During development & initial launch, use **Firebase Test Numbers** (`+91 9999900001` with OTP `123456`) which are **100% free with unlimited runs**.  
> For production scale (>1,000 active players), the platform roadmap includes a cutover to **Indian Domestic Gateways (Fast2SMS / 2Factor at ~18 paise/OTP)** or **Phone + 4-digit PIN (₹0 cost forever)** to maximize business profits.

---

## 6. Part C — 10-minute branding & APK generation

### C1. Create the client folder
```bat
xcopy /E /I clients\_template clients\alpha_esports
```
Edit `clients\alpha_esports\client_config.json` (never touch Kotlin for branding):

```json
{
  "client": {
    "name": "Alpha eSports",
    "app_name": "Alpha eSports",
    "application_id": "com.alphaesports.ff",
    "version_name": "1.0.0",
    "version_code": 1
  },
  "theme": { "primary_color": "#E53935", "button_color": "#FF6F60", "accent_color": "#FFC107", "corner_radius_dp": 12 },
  "backend": { "api_base_url": "https://api.alphaesports.in/api/v1", "tenant_id": "<tenant uuid from A3>" },
  "payments": { "upi_id": "alphaesports@okaxis", "upi_name": "Alpha eSports", "min_deposit": 10, "support_whatsapp": "919876543210" },
  "assets": { "app_icon": "icons/app_icon.png" }
}
```

Put a **512×512 PNG** logo in `clients\alpha_esports\icons\app_icon.png`.

### C2. Build
```bat
package_client.bat alpha_esports
```
Output:
```
dist\alpha_esports\Player.apk
dist\alpha_esports\Admin.apk
dist\alpha_esports\build-info.json   ← package ids, version, SHA-256, API URL
```
Flags: `--release` (R8, smaller + fast), `--no-build` (validate config only),
`--keep` (leave the branded files in `android/` for Android Studio work).

The script **restores the repo** after building, so no client branding is ever
committed by mistake.

### C3. Play Store release (signed)
Create one keystore per client (**never** share across clients):
```bat
keytool -genkey -v -keystore android\keystore\alpha-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias alpha
```
Add to `android/app-player/build.gradle.kts` (and `app-admin`):
```kotlin
android {
    signingConfigs {
        create("release") {
            storeFile = file("../keystore/alpha-release.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KEY_ALIAS")
            keyPassword = System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes { release { signingConfig = signingConfigs.getByName("release") } }
}
```
Then `package_client.bat alpha_esports --release` → sign/align with `apksigner`
if you keep the config external. **Bump `version_code` for every upload.**

---

## 7. Part D — Client go-live checklist (in the Admin app)

1. **Login** with the owner phone number → Dashboard.
2. **Staff Management** → Hire room manager / scorer / cashier with only the needed permissions.
3. **Create Match** (map, mode, entry fee, prize pool, per-kill, date & time in **IST with AM/PM**).
   Optionally set **Player List Visibility** — “Always visible” or “Only near start” (e.g. a match
   12h away with a 10-hour window stays hidden from players until only 10h remain; joined players
   always keep seeing it). Visibility can be changed later from **Manage Matches → 👁️ Player Visibility Window**.
   Also set **Room ID & Password Reveal** — default 15 minutes before start, or any custom window
   (5m…24h). The code is only shown to joined players when that window opens.
4. **Wallet Console → Deposits**: approve player "Add Cash" requests after checking the UTR in the bank/UPI app (1 tap = deposit balance credited, ledger written).
5. **Publish Room ID** before kick-off. Players see it automatically at the reveal time you set, or
   press **🔑 Reveal to players now** (Publish Room screen) / **🔑 Reveal Room ID to Players Now**
   (Manage Matches) to release the code immediately.
6. **Spectator Scorer**: sit in the custom room's spectator slot, enter verified kills + rank, flag hackers with a reason → **Distribute Prize & Complete Match** (atomic payout to winning balances).
7. **Wallet Console → Withdrawals**: pay the player's UPI, paste the payout UTR → mark paid (reject auto-refunds).
8. **Verify**: player app scoreboard shows Booyah, top fragger and the full ranking.

Players cannot upload screenshots anywhere in the Player app (anti-fraud by design).

---

## 8. Part E — Google Play compliance (read before publishing)

| Risk | Rule we follow |
| --- | --- |
| **Trademark** | App name, icon and store listing must **not** use "Free Fire", Garena logos or official key art. Use the client's own brand (e.g. "Alpha eSports"). Inside the app, describing "Free Fire tournaments" as a community organiser is acceptable — but never imply affiliation. |
| **Disclaimer (required, in listing + app)** | *"This is a community esports tournament app. It is not affiliated with, endorsed by, or sponsored by Garena. Free Fire is a trademark of Garena International. All game assets belong to their respective owners."* Put it in the store description and in the app's support section. |
| **Repetitive content / spam policy** | Each client gets a **unique package id**, name, icon, colors and **their own backend/tenant**. Never publish two brands with the same package id or identical listing text. |
| **Real-money / gambling** | The platform is an **entry-fee skill contest** (esports), not a game of chance. Show entry fee + prize pool clearly before joining; keep the "skill" framing in the listing; no "bet/win cash" language. Check your state's local rules with the client (some Indian states restrict paid-entry gaming). |
| **Payments** | Money moves **directly between the player and the client's UPI ID**. Never route it through our account (zero data/financial liability). UTR approval is a manual verification step. |
| **Data safety form** | Declare: phone number, name, Free Fire IGN/UID, wallet transaction history, device id (fraud signal), optional FCM token. Data is stored in the client's own Supabase. |
| **Account deletion** | Google requires an in-app or web deletion path. Client must provide a support contact (`support_whatsapp` in the config is shown in the player wallet) and delete/anonymise on request. |
| **Target API level** | `compileSdk/targetSdk 36`, `minSdk 24` — meets current Play requirements. |
| **Permissions** | INTERNET + POST_NOTIFICATIONS only. No location, contacts or file access. |
| **Ads / kids** | App is 18+ (cash prizes). Do not target children; declare "Not designed for children". |

### Play Console pre-flight checklist

- Confirm the client replaces `privacy_policy_url` in both app modules with its real public privacy-policy URL before publishing.
- Confirm the community/Garena disclaimer is visible in the Player app support/profile area and copied into the store listing.
- Use a unique client package id, app name, icon, screenshots and listing copy for every white-label build.
- Upload the signed release APK/AAB only after the release build and manifest permission review pass.

---

## 9. Zero data liability — what you must NOT keep

- ❌ Client's Supabase password / connection string (theirs, in their own `.env`).
- ❌ Client's Firebase service account JSON (theirs).
- ❌ Player money — never in our UPI/bank account.
- ❌ Copies of the player database after handover.
- ✅ You keep: source code, this manual, and (optionally) a support retainer.

Revenue model: one-time setup + monthly maintenance, or a small % of the client's
platform commission — never custody of funds.

---

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid environment variables` on `npm start` | `backend/.env` missing a key — the error lists the exact field |
| `self-signed certificate in certificate chain` (DB) | Add `?sslmode=require` to `DATABASE_URL` (code strips it for the driver) — already handled in `config/prisma.ts` |
| 401 on every API call | JWT secret changed after login → log out/in; or staff was deactivated |
| Staff cannot see a console | Owner must tick that permission in Staff Management (dashboard is permission-driven) |
| Room ID not visible to players | T-15 window not reached, or admin hasn't published the room yet |
| Push not arriving | `google-services.json` missing in the app module, or `FCM_CREDENTIALS_JSON` not set on the backend |
| `package_client.bat` fails | Run `node tools/package_client.mjs <client> --no-build` to see the exact validation error |
| Gradle build fails after packaging | The script restores files automatically; run `git status` — if anything branded remains, `git checkout -- android` |
| APK installs with wrong name/icon | Old APK with the same package id installed — uninstall first |

---

## 11. Final handover package (what to give the client)

1. `dist/<client>/Player.apk` + `Admin.apk` (+ `build-info.json`).
2. `backend/` source zip (they deploy on **their** account) **or** a deployed URL billed to them.
3. `backend/.env.example` filled with placeholders (never your secrets).
4. Owner login phone number + tenant id.
5. This manual (sections 4–8) and their UPI ID confirmation.
6. Support contact + a one-page "how to run a match" cheat sheet (section 7).
