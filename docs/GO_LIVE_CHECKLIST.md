# ✅ Go-live checklist — ek hi page (print kar lo)

> Deploy ke din bas ye list upar se neeche follow karo. Har step ke saath **pass condition**
> likha hai — jo dikhna chahiye wahi. Detail chahiye to `docs/DEPLOY_RENDER.md`.
> Total time: **~40 min** (accounts banane ke saath) · Kharcha: **₹0**

---

## 0. Pehle laptop pe (deploy se 1 din pehle) — sab green hona chahiye

- [ ] `cd backend && npm test` → **441/441 pass**
- [ ] `cd backend && npx tsc --noEmit` → **no output**
- [ ] `cd admin-web && npm run build` → `dist/` bana, koi error nahi
- [ ] `git status` → sirf jaan-boojh kar chhode gaye files
- [ ] `git push origin main` → **`main` clean**

---

## 1. Accounts (teen, sab free, card nahi)

- [ ] **Neon** — https://neon.com → New Project → region **ap-southeast-1 (Singapore)**
- [ ] **Upstash** — https://upstash.com → Redis → **ap-south-1 (Mumbai)**, TLS on
- [ ] **Render** — https://render.com → GitHub se sign in
- [ ] **Brevo** — ✅ already done (sender verified, API-keys IP blocking off)
- [ ] **Firebase** — ✅ already setup (`deadesports-865d2`, rules + indexes deployed)

---

## 2. URL copy karo (kahin note karo)

- [ ] `NEON_URL` = Neon connection string — **`?sslmode=require` ke saath poora**
- [ ] `UPSTASH_URL` = `rediss://default:...@....upstash.io:6379`

---

## 3. Render deploy

- [ ] Dashboard → **New → Blueprint** → repo `deadesports99/deadesports` → **Apply**
- [ ] Build khatam (pehli baar **6-10 min**) → status **Live**
- [ ] `RENDER_URL` = `https://____.onrender.com` **copy karo**

---

## 4. Env vars (Render → Environment)

`sync: false` wale khud bharne hain:

- [ ] `DATABASE_URL` = `NEON_URL`
- [ ] `REDIS_URL` = `UPSTASH_URL`
- [ ] `ACCESS_KEY_PEPPER` = `openssl rand -hex 32` ka output (32+ chars)
- [ ] `ADMIN_WEB_ORIGIN` = `RENDER_URL` **(no trailing slash!)**
- [ ] `CORS_ORIGIN` = `RENDER_URL`
- [ ] `BREVO_API_KEY` = `backend/.env` wali key
- [ ] `EMAIL_FROM` = `Spartan Arena <deadesports99@gmail.com>` (quotes ke bina)
- [ ] `FCM_CREDENTIALS_JSON` = service account JSON **ek line** me
- [ ] Save → auto redeploy → **Live**

Pass condition: deploy logs me
`[admin-web] serving console from /app/admin-web/dist` aur `Server running in PRODUCTION mode`.

---

## 5. Database tables (laptop se, ek hi baar)

```bash
cd backend
export DATABASE_URL="<NEON_URL>"
npm run prisma:push      # tables banao
npm run seed:owner       # owner: deadesports99@gmail.com
npm run seed             # demo data (optional)
```

- [ ] `prisma:push` → `Your database is now in sync with your Prisma schema`
- [ ] Apps script khatam bina error

---

## 6. Keep-warm (warna 15 min me so jaayegi)

- [ ] https://cron-job.org → new cronjob → `RENDER_URL/health` → **every 10 min**
- [ ] "TEST RUN" → **200 OK**

---

## 7. Smoke test (5 curl + 4 browser)

```bash
B=https://____.onrender.com
curl -s -o /dev/null -w "health %{http_code}\n"  $B/health
curl -s -o /dev/null -w "ui     %{http_code}\n"  $B/
curl -s -o /dev/null -w "wallet %{http_code}\n"  $B/wallet
curl -s -o /dev/null -w "api    %{http_code}\n"  $B/api/v1/health
curl -s -o /dev/null -w "404    %{http_code}\n"  $B/api/v1/nope
```

- [ ] health **200** · ui **200** · wallet **200** · api **200** · 404 **404**
- [ ] Browser: `$B` → login screen dikhta hai
- [ ] Owner email → **Send sign-in code** → **mail aaya** (Brevo)
- [ ] Code daalo → **dashboard khula**
- [ ] Ek match banao → page refresh → match bacha hua (DB ok)
- [ ] DevTools → Application → Cookies → `admin_session`: **HttpOnly ✅ Secure ✅ SameSite=Strict ✅**

---

## 8. Permission + security (5 min)

- [ ] Staff screen → naya key banao (24-char) → copy
- [ ] Incognito me staff login (owner email + key) → sirf allowed cards dikhein
- [ ] Us key ko **revoke** karo → staff ka agla click **401/403** (session dead)
- [ ] Owner: `curl` se CSRF test (doc: `ADMIN_WEB_ACCESS.md` §7) → **403**

---

## 9. Firebase (delivery layer)

- [ ] Render logs: `🔥 Firestore live mirror ON → collection "live_events"`
- [ ] `cd backend && npm run verify:firebase` → Phase 1, 2, 5 **PASS**
      (Phase 4 Storage **FAIL expected** — Blaze/paid chahiye)
- [ ] Firebase console → Firestore → `live_events` → naye documents aa rahe hain

---

## 10. Android apps (2 files)

- [ ] `android/app-player/src/main/assets/client_config.json`:
      `api_base_url` = `https://____.onrender.com/api/v1` · `tenant_id` = production tenant
- [ ] `android/app-admin/src/main/assets/client_config.json` — wahi
- [ ] Purana `http://localhost:5000` **kahin bacha nahi** (`grep -r localhost android/`)
- [ ] Real phone pe install → login → match list load

---

## 11. Backup plan (agar kuch tootа hai)

| Symptom | Turant karo |
|---|---|
| Build fail | Render → Logs → pehla error; local `npm run build` se reproduce |
| Service baar baar restart | Env var missing / DB URL galat — Logs me `Invalid environment` / `P1001` |
| Login ke baad 403 | `ADMIN_WEB_ORIGIN` **exactly** browser URL jaisa (no `/`) |
| Mail nahi ja raha | `BREVO_API_KEY` + `EMAIL_FROM` sender match; log me `[EMAIL:brevo]` |
| Sab kuch band | Render → **Rollback** → pichla deploy (1 click) |

---

## 12. Deploy ke baad — pehle 24 ghante

- [ ] Subah 9 baje `RENDER_URL` kholo — cold start ~50s lag sakta hai (cron 10-min chal raha ho to nahi)
- [ ] Brevo quota: **300/din** (staff + player OTP dono isi me) — din ke end me dashboard check
- [ ] Neon: **0.5 GB** storage — 1 hafte baad size dekh lo
- [ ] Audit log: koi anjaan IP se login try? (`AdminAuditLog`)
- [ ] `docs/DEV-NOTES-*.md` jaise purane local notes delete kar do

---

## Sign-off

| | Naam | Date | Result |
|---|---|---|---|
| Deploy kiya | | | |
| Smoke test pass | | | |
| Boss ko dikhaya | | | |
