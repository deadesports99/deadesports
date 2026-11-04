# 🌐 Master Plan: Production Cloud Deployment & Live Android URL Switch

> **Target Goal:** Transition the Free Fire Tournament SaaS Backend from local laptop execution (`http://localhost:5000` via USB ADB reverse) to a 24/7 Live Cloud Server with Custom Domain, SSL/TLS encryption, production Redis, and update Android Apps (`:app-player` & `:app-admin`) to connect over the live internet without USB cables.  
> **Target Environment:** Cloud Platform (Render / Railway / VPS / Cloud Run) + Supabase (London) + Upstash/Railway Redis + Custom Domain (`api.yourbrand.com`).  
> **Target Status:** 🏗️ READY FOR EXECUTION (Prompt generated for Astra 6 / Reasoning LLM).  
> **Author:** Antigravity Architect  

---

## 📌 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph PlayersAndAdmins["📱 Mobile & Web Clients"]
        UA["🎮 Gamer Phone (Anywhere in India)<br>No USB / No WiFi requirement<br>Base URL: https://api.yourbrand.com/api/v1"]
        AA["👑 Admin Phone (Client Owner)<br>Base URL: https://api.yourbrand.com/api/v1"]
    end

    subgraph EdgeLayer["🌍 Edge & Security Layer"]
        DNS["🌐 Custom Domain DNS<br>(Cloudflare / Namecheap / GoDaddy)"]
        SSL["🔒 Edge SSL / TLS 1.3 Termination<br>(Automated Let's Encrypt Certificate)"]
    end

    subgraph CloudCompute["☁️ Cloud Backend (Render / Railway / VPS)"]
        DOCKER["🐳 Containerized Node.js 22 Runtime<br>(Alpine Multi-Stage Build)"]
        API["Express 5 REST API + Rate Limiters + Device Lock"]
        SWEEP["🕒 In-Process Match Sweep Scheduler (60s cron)"]
    end

    subgraph ManagedDataStore["🗄️ Production Data & State"]
        SUPABASE["🐘 Supabase PostgreSQL (London AWS)<br>Pooler: Port 6543 (PgBouncer) + Direct 5432<br>Double-Entry Ledger + Multi-Tenant Isolation"]
        REDIS["⚡ Production Redis (Upstash / Railway)<br>Atomic Slot Mutex Lock (0 duplicate seats)"]
    end

    UA -->|HTTPS / 4G / 5G| DNS
    AA -->|HTTPS / 4G / 5G| DNS
    DNS --> SSL
    SSL --> DOCKER
    DOCKER --> API
    API --> SWEEP
    API --> SUPABASE
    API --> REDIS
```

---

## 🏗️ 2. Cloud Platform Evaluation & Selection

| Platform | Cost / Free Tier | Setup Complexity | Cold Starts | Built-in Redis | Best For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Render.com** | Free tier (Spins down after 15m) or $7/mo Starter | ⭐ Very Simple (Connects to GitHub repo) | Yes on Free (50s delay), No on Starter | External (Upstash) | Quickest setup, zero ops, auto-git deploy |
| **Railway.app** | $5/mo free trial credit, then pay-as-you-go (~$3-5/mo) | ⭐ Very Simple (1-Click Docker + Redis) | ❌ Zero cold starts | ✅ 1-Click Redis Add-on | Best developer experience, fast response |
| **Linux VPS (Hetzner / DO / Lightsail)** | $3.50 – $5 / month | ⭐⭐ Moderate (Docker Compose + Caddy/Nginx) | ❌ Zero cold starts | ✅ Local Redis container in Docker | Maximum performance, full control, lowest cost at scale |
| **Google Cloud Run** | Free tier: 2M requests/mo | ⭐⭐ Moderate (gcloud CLI / Artifact Registry) | Mild (1-2s cold container start) | Serverless (Upstash) | Enterprise scalability, serverless auto-scaling |

> **Recommendation for Jay:**  
> - **Fastest & Easiest:** **Render.com** (with free Upstash Redis) or **Railway.app**.  
> - **Most Cost-Effective & Powerful:** **Hetzner/DigitalOcean VPS ($4/mo)** with Docker Compose + Caddy (automatic HTTPS certificate).

---

## 📋 3. Step-by-Step Implementation Checklist

### 🔹 Stage 1: Containerization & Dockerfile Hardening
- [ ] **1.1 Multi-Stage Production `Dockerfile` (`backend/Dockerfile`):**
  - Stage 1 (`builder`): `node:22-alpine`, install dependencies, `npx prisma generate`, run `npm run build`.
  - Stage 2 (`runner`): Lightweight `node:22-alpine`, non-root user (`node:node`), copy compiled `dist/` and generated Prisma client, production dependencies only (`npm ci --omit=dev`).
  - Container health check: `HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:5000/health || exit 1`.
- [ ] **1.2 `.dockerignore`:** Exclude `node_modules`, `.env`, `.git`, `tests`, `dist`.
- [ ] **1.3 Production Orchestration Config:**
  - Create `docker-compose.prod.yml` (for VPS deployment with local Redis) and `render.yaml` (for 1-click Render blueprint).

---

### 🔹 Stage 2: Database & Redis Cloud Hardening
- [ ] **2.1 Supabase Connection Optimization:**
  - Ensure `DATABASE_URL` connects via Supabase Connection Pooler (`pooler.supabase.com:6543`) with `?pgbouncer=true&connection_limit=10`.
  - Maintain `withoutSslMode()` in `src/config/prisma.ts` so `pg` doesn't reject Supabase's managed self-signed CA.
- [ ] **2.2 Production Redis Setup:**
  - Create free serverless Redis on **Upstash** (upstash.com) or deploy managed Redis on Railway/Docker.
  - Set `REDIS_URL=rediss://default:PASSWORD@ENDPOINT.upstash.io:6379`.
  - Test graceful fallback: Ensure backend runs seamlessly even if Redis is unreachable.

---

### 🔹 Stage 3: Cloud Deployment & Custom Domain
- [ ] **3.1 Environment Variables Configuration:**
  - `PORT=5000` (or dynamically mapped by cloud provider).
  - `NODE_ENV=production`.
  - `DATABASE_URL=postgresql://postgres.zupnlhdtfirufmlurkef:...@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true`.
  - `REDIS_URL=rediss://...`.
  - `JWT_SECRET=super_secret_production_key_32_chars_long`.
  - `JWT_EXPIRES_IN=7d`.
  - `CORS_ORIGIN=*` (or comma-separated allowed web domains).
- [ ] **3.2 Custom Domain Mapping & SSL:**
  - Add DNS record in Domain registrar (Cloudflare / Namecheap / GoDaddy):
    - Type: `CNAME` | Name: `api` | Target: `<render-or-railway-app-name>.onrender.com`
  - Verify SSL certificate generation (HTTPS padlock in browser).
  - Test live endpoints: `curl https://api.yourdomain.com/health` returns `200 OK`.

---

### 🔹 Stage 4: Android App Production URL Switch
- [ ] **4.1 Update Client Configuration Assets:**
  - Update `android/app-player/src/main/assets/client_config.json`:
    - Set `"api_base_url": "https://api.yourdomain.com/api/v1"`
  - Update `android/app-admin/src/main/assets/client_config.json`:
    - Set `"api_base_url": "https://api.yourdomain.com/api/v1"`
- [ ] **4.2 Network Security & HTTPS Verification:**
  - Verify `android/app-player/src/main/res/xml/network_security_config.xml`:
    - Production domains automatically enforce secure HTTPS.
- [ ] **4.3 Build & Install Updated APKs:**
  - Assemble fresh APKs: `./gradlew :app-player:assembleDebug :app-admin:assembleDebug`.
  - Install on device and disconnect USB cable.
  - Test login, match feed, slot booking, and wallet operations over 4G/5G mobile data.

---

### 🔹 Stage 5: Post-Deployment Verification
- [ ] Test public API health check: `GET https://api.yourdomain.com/api/v1/health`.
- [ ] Verify rate-limiter over public IP.
- [ ] Verify device lock over real cellular network.
- [ ] Verify Admin match creation and Player 48-slot booking without USB tethering.
