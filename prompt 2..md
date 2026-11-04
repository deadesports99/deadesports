# 🤖 ACTIVE MASTER PROMPT (ASTRA 6 / REASONING LLM)
## Phase 8: Production Cloud Deployment, Custom Domain & Android Live URL Switch

Bhai, Free Fire Tournament SaaS Platform ke saare core features (Player App, Admin App, Staff Roles, Anti-Fraud Device Lock, Rate Limiting, 48-Slot Concurrency Suite, Daily Settlement & Match Cloning) **100% complete ho chuke hain aur physical device par verified hain!**

Ab sabse crucial commercial step execute karna hai:
**Backend ko local machine (port 5000 + USB reverse tunnel) se hata kar LIVE CLOUD SERVER par deploy karna hai, Custom Domain + SSL connect karna hai, aur Android apps ko live public HTTPS domain par switch karna hai taaki koi bhi player poore India se bina USB cable ke 4G/5G par app chala sake.**

Target Plan File: `plan/PRODUCTION_CLOUD_DEPLOYMENT_PLAN.md`

Prompt details ke liye `prompt.md` dekhein ya niche diya gaya master prompt copy karein:

---

```markdown
Bhai, Free Fire Tournament SaaS Platform ka Production Cloud Deployment, Custom Domain & Android Live URL Switch execute karna hai.

Target Plan File: `plan/PRODUCTION_CLOUD_DEPLOYMENT_PLAN.md`

### 🧠 ASTRA 6 DEEP THINKING DIRECTIVES:
Pehle deeply think aur analyze karo:
1. Container & Node v22 Environment (multi-stage Alpine Dockerfile, Prisma generate, non-root user).
2. Cloud Database (Supabase London AWS, PgBouncer pooler port 6543, withoutSslMode CA handling).
3. Atomic Slot Redis in Cloud (Upstash Serverless Redis vs Railway/Docker Redis, graceful fallback).
4. Cold-Start & Cron Scheduler (in-process 60s match lifecycle sweep, keep-alive ping on free tiers).
5. Android 9+ Network Security & HTTPS (ClientConfig.kt asset config, cleartext vs TLS enforcement).

### 🎯 KYA IMPLEMENT & DELIVER KARNA HAI:
1. Production Dockerfile & .dockerignore (`backend/Dockerfile`).
2. Cloud Deployment Blueprints (`backend/render.yaml`, `backend/docker-compose.prod.yml`, `backend/.env.production.example`).
3. Custom Domain & Automated SSL Setup Guide (Cloudflare / Namecheap / Let's Encrypt).
4. Android App Production URL Switch (`:app-player` & `:app-admin` client_config.json update).
5. Pre-flight verification (Docker build, HTTPS curl health check, Android assembleDebug, USB-free 4G/5G mobile test).
```
