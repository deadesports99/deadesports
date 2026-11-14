# 📧 Phase 6 — Real Email OTP, Access Gate (Cloudflare) & Deploy

> **Goal:** OTP asli email pe jaye; admin panel bahar se **dhoondha bhi na ja sake**;
> production deploy + hardening.
>
> **Location:** `backend/src/services/email.service.ts`, `admin-web/`, `DEPLOYMENT.md`
> **Status:** ⏸ NEXT — Phase 1–5 ✅ done. Email provider = **Brevo** (boss decision).

---

## 🧭 HOSTING DECISION (final, Nov 2026 — boss)

**Ek hi backend hai aur wo Postgres ke saath hi rahega. Firebase usko replace nahi karta**
(`firebase-migration` rule #3: money tables never leave PostgreSQL). Deploy ka sawal sirf
itna hai: **wo ek backend kis machine pe chalega**. Vercel wo machine nahi deta — Render deta hai.

| Hissa | Kahan chalta hai | Free? |
|---|---|---|
| UI (`admin-web/dist` — 3 files) | **Render (same service)** ya baad me Vercel | ✅ |
| Backend (Express + Prisma + `/ws`) | **Render free web service** — Vercel pe nahi | ✅ |
| Database | Supabase Postgres (existing) | ✅ |
| Email OTP | Brevo | ✅ 300/din |
| Access gate | optional — Cloudflare (domain chahiye) ya Tailscale | ✅ |

### ⭐ Option A — DEFAULT (boss: domain nahi chahiye)
**UI + API + WS sab ek hi Render service pe.** Ek URL `https://<name>.onrender.com`,
same origin → cookie/cors/WS sab automatic, **zero code change**, realtime chalta hai.
- Render free: 750 instance-hrs/mahina, 15 min idle pe sleep, jagane me ~1 min.
- Isliye free keep-warm ping (cron-job.org) — warna pehla click slow.
- Email/DB Firebase pe nahi jaate: match create, roster, payout, wallet = Postgres hi.

### Option B — baad me, agar UI ko CDN speed chahiye
UI Vercel pe + backend Render pe. Tab 3 chhote code changes: `VITE_WS_URL` (absolute),
`vercel.json` rewrite, prod `ADMIN_WEB_ORIGIN`. Realtime tab bhi chalta hai kyunki
browser WS seedha backend host se jodta hai (cross-origin WS pe koi rok nahi).

```
  Option A (default)                 Option B (baad me)
  ┌─ Render (ek service) ─┐          ┌─ Vercel ─┐   ┌─ Render ─┐
  │ dist/ + /api + /ws    │          │  dist/   │──▶│ /api+/ws │
  └───────────────────────┘          └──────────┘   └──────────┘
           └────────→ Supabase Postgres ←──────────────┘
```

### Firebase ka role (backend ko hata kar nahi aata)
`live_events` mirror (default **OFF**: `FIREBASE_LIVE_MIRROR=false`), FCM push,
Firebase Auth token verify, Storage, stats export. Ye sab **Postgres ke upar** kaam karte
hain — ledger/wallet/roster Postgres me hi rehta hai.


### Kyun backend Vercel pe nahi
- Backend **stateful** hai: in-memory realtime client registry (`realtime.service.ts`),
  long-running WS server, open Prisma pool. Serverless me har request naya process.
- Vercel Functions pe WS GA hai (Oct 2026) par Hobby pe connection **300s** me band hota
  hai aur cross-instance broadcast ke liye **Redis** chahiye — poora rewrite, iske laayak nahi.
- Static `dist/` Vercel pe perfect fit hai (Vite build = 3 files).

### Vercel Hobby ke limits jo matter karte hain
- ✅ Rewrites / Reverse proxy **included** free → `/api/*` proxy chalega (timeout 120s).
- ❌ **Production domain pe password protection free me nahi hai.** Vercel Authentication
  sirf preview/deployment URLs protect karta hai; production domain public rehta hai.
  Password Protection / Trusted IPs = Pro (paid).
  → **Isliye gate Vercel pe nahi, Cloudflare Access pe lagega — uske liye custom domain chahiye.**
- 100 GB transfer, 1M requests/mahina — admin panel ke liye bahut zyada hai.
- Free URL: `<project>.vercel.app` — milta hai, par us par Cloudflare Access nahi lag sakta
  (Cloudflare ko apna zone chahiye). Sirf `robots`/`noindex` + login bachata hai.

### Code changes jo is decision se aate hain
1. `admin-web/src/lib/api.ts` → `realtimeUrl()` ko absolute `VITE_WS_URL` support karo
   (rewrite WS proxy nahi karta). Abhi wo `window.location.origin` se `/ws` banata hai.
2. Vercel `vercel.json` — SPA rewrite + `/api/*` external rewrite.
3. `ADMIN_WEB_ORIGIN` / `CORS_ORIGIN` prod me exact Vercel+Cloudflare domain.
4. Backend host pe keep-warm ping (free tier sleep se bachne ke liye) — optional.

### URL chhipana (obscurity) ka sach
Lambe/random URL se security **nahi** aati: HTTPS certificate transparency logs me
har domain public hota hai, aur `*.vercel.app` bots scan karte hain. Isliye bachav
**login + gate** se aata hai, URL ki lambai se nahi. URL chhota/lamba hone ka farak
sirf itna: galti se koi na aa jaye.

---

## 📋 Checklist

### 🔹 Stage 1: Email provider
- [ ] **1.1 `email.service.ts`** with providers via env `EMAIL_PROVIDER`:
      - `console` (dev — OTP console log, no real mail)
      - `smtp` (Gmail app password / any SMTP — `SMTP_HOST/PORT/USER/PASS/FROM`)
      - `resend` (`RESEND_API_KEY`) — free tier, recommended
      - `brevo` (`BREVO_API_KEY`) — free tier alternative
- [ ] **1.2 Templates (HTML + text):** Admin OTP (brand name, 10 min expiry,
      "agar aapne request nahi ki, ignore karo"), Staff access key share (optional).
- [ ] **1.3 Send failure → 502 with generic message; OTP row delete (retry clean).
      Send success log me email + provider, **OTP value kabhi nahi**.
- [ ] **1.4 Rate limit per email/day (e.g. 10) — provider abuse se bacho.**
- [ ] **1.5 Dev fallback:** `debugOtp` only when `NODE_ENV !== 'production'`.
- [ ] **1.6 Test:** mock provider (no network) se send called + failure path.

### 🔹 Stage 2: Access gate — **Cloudflare Access (chosen)**
- [ ] **2.1** Chhota domain (~₹100–800/saal) Cloudflare pe add, DNS proxy ON.
      `admin.<domain>` CNAME → Vercel project.
- [ ] **2.2** Zero Trust → Access → Application → `admin.<domain>`:
      policy = owner email + har sub-admin ka email (allowlist), login = **One-time PIN**
      (email OTP, Cloudflare free), session 8h.
- [ ] **2.3** Verify: bahar se URL kholo → Cloudflare login; allowed email → app ka login;
      galat email → block. Cloudflare band karke bhi app ka login OTP kaam kare (2 layers).
- [ ] **2.4** `docs/ADMIN_WEB_ACCESS.md` me exact steps + rollback (gate hatana, email add/remove).
- [ ] **2.5** (Fallback, agar domain/Cloudflare na ho) Tailscale `serve` — sirf owner devices,
      free 6 users. Tab admin-web Vercel pe nahi, apne host se serve hoga.

### 🔹 Stage 3: Static build + serve (Vercel)
- [ ] **3.1 `npm run build`** → `dist/`; prod me `VITE_API_URL=/api/v1` (same origin),
      `VITE_WS_URL=wss://<backend-host>/ws` (absolute, rewrite WS proxy nahi karta).
- [ ] **3.2 `vercel.json`:** SPA fallback (`all` → `/index.html`), `/api/:path*` →
      backend origin, hashed assets `immutable` cache, `X-Robots-Tag: noindex`.
- [ ] **3.3 Backend env prod:**
      ```
      NODE_ENV=production
      CORS_ORIGIN=https://admin.<domain>   # '*' hatao
      ACCESS_KEY_PEPPER=<32+ random>
      ADMIN_SESSION_TTL_HOURS=12
      ADMIN_WEB_ORIGIN=https://admin.<domain>
      EMAIL_PROVIDER=brevo
      BREVO_API_KEY=<key>
      EMAIL_FROM=<verified sender>
      ```
- [ ] **3.4 Cookies prod me:** `Secure`, `SameSite=Strict`, `Domain` set nahi
      (host-only), `Path=/`.
- [ ] **3.5 HTTPS mandatory (HSTS), TLS auto (Caddy/Cloudflare).**

### 🔹 Stage 4: Anti-discovery hardening
- [ ] **4.1 `robots.txt`:** `Disallow: /` + `<meta name="robots" content="noindex,nofollow">`.
- [ ] **4.2 Headers:** `X-Robots-Tag: noindex`, `X-Frame-Options: DENY`,
      `Referrer-Policy: no-referrer`, CSP (self only), no `X-Powered-By`.
- [ ] **4.3 Prod build me source maps **off** (`build.sourcemap = false`).**
- [ ] **4.4 Player app / player web / public site se admin URL ka koi reference nahi
      (grep karke verify).**
- [ ] **4.5 Backend admin routes ka koi directory listing / swagger public nahi.**
- [ ] **4.6 Login page pe brand + "Authorised staff only" note; koi role hint nahi.**

### 🔹 Stage 5: Deploy verification
- [ ] Owner login prod URL se → OTP real mail me → dashboard.
- [ ] Sub-admin: owner email + key + OTP → restricted dashboard.
- [ ] Access gate ke bahar se URL unreachable (Tailscale) / CF login block.
- [ ] `curl -I` pe noindex + security headers present.
- [ ] Player app + Android admin app abhi bhi kaam kar rahe (regression check).
- [ ] Backup/rollback note (previous dist + env snapshot).
- [ ] Plan ticks.

---

## 🎯 Acceptance

- OTP asli inbox me aata hai (spam folder note docs me).
- Admin panel internet se directly discover/access nahi hota.
- Prod headers + cookies + CORS + noindex sab verified.
- Handover docs me client ke liye access steps.
