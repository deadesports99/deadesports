# 📧 Phase 6 — Real Email OTP, Access Gate (Tailscale / Cloudflare) & Deploy

> **Goal:** OTP asli email pe jaye; admin panel bahar se **dhoondha bhi na ja sake**;
> production deploy + hardening.
>
> **Location:** `backend/src/services/email.service.ts`, `admin-web/`, `DEPLOYMENT.md`
> **Status:** PAUSED — Phase 3–7 baad me (Phase 1–2 auth already done & verified)

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

### 🔹 Stage 2: Access gate (choose one, both documented)
- [ ] **2.1 Tailscale (recommended for now):**
      - Server/PC pe Tailscale install, `tailscale up`
      - Admin web static build serve (`vite preview` ya Caddy `:8080`)
      - URL: `http://100.x.y.z:8080` — sirf tailnet devices
      - Mobile + laptop pe Tailscale app; ACL se sirf owner/staff devices
      - Verify: tailnet ke bahar se connection timeout
- [ ] **2.2 Cloudflare Access (client handover):**
      - `ops-<random>.yourdomain.com` → Cloudflare Tunnel → local `:8080`
      - Zero Trust → Access application → policy: owner + staff emails only,
        OTP/Google login, session 8h
      - Verify: URL khulta hai → CF login → bina allowed email ke block
- [ ] **2.3 Dono me se jo use ho, `DEPLOYMENT.md` me exact steps + rollback likho.**

### 🔹 Stage 3: Static build + serve
- [ ] **3.1 `npm run build`** → `dist/`; prod me `VITE_API_URL=/api/v1` (same origin).
- [ ] **3.2 Caddy/nginx:** SPA fallback `try_files … /index.html`, gzip/brotli,
      cache hashed assets, `/api` → backend proxy.
- [ ] **3.3 Backend env prod:**
      ```
      NODE_ENV=production
      CORS_ORIGIN=<exact admin origin>   # '*' hatao
      ACCESS_KEY_PEPPER=<32+ random>
      ADMIN_SESSION_TTL_HOURS=12
      ADMIN_WEB_ORIGIN=<admin origin>
      EMAIL_PROVIDER=resend / smtp
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
