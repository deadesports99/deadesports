# 🎮 Free Fire Tournament Platform - Master Roadmap & Architecture Plan

> **Project Concept:** Multi-Tenant / White-Label Esports Tournament SaaS Platform (Exclusively for Free Fire & Free Fire MAX)  
> **Source Directives:** WhatsApp Requirements Discussion with Boss (`boss demand/WP.txt`)  
> **Author:** Jay Kumar  
> **Target Form Factor:** iOS-style Modern Mobile App (Player Panel) + Modern Responsive Web Dashboards (Admin & Manager Panels)  
> **Theme Support:** Native Dual Theme (Deep Dark Mode & Clean Light Mode)

---

## 📌 1. Executive Summary & Boss Requirements Breakdown

Boss ki chat (`WP.txt`) ke basis par key points aur business model:

| Boss Requirement | Technical Interpretation | Implementation Strategy |
| :--- | :--- | :--- |
| **"Multiple clients ko sell karna hai"** | **Multi-Tenant / White-Label SaaS Architecture** | Ek centralized backend jisme har client (Tournament Organizer) apna sub-brand, custom logo, payment gateway aur matches chala sake. Database level par `tenant_id` isolation. |
| **"Html se bas mat banana... React me pura app"** | **Modern Component-Driven Tech Stack** | Mobile App: **React Native (Expo SDK / Bare)** ya **Flutter** (iOS native feeling ke liye). Web Panels: **Next.js / React + Tailwind CSS + shadcn/ui**. |
| **"iOS / iPhone app ke jaisa modern UI"** | **Cupertino / Glassmorphic Design System** | Rounded cards (16px/24px radius), subtle blur/glassmorphism, smooth spring micro-animations, bottom sheets, floating navigation bar. |
| **"Light mode dark mode rakhna"** | **System & Manual Theme Switcher** | Tailored Dark Gaming Theme (OLED Black + Neon Violet/Orange accents) aur Clean Light Theme (Apple Slate Grey + Crisp White). |
| **"3 Panels: Admin, Manager, User"** | **Role-Based Access Control (RBAC)** | 1. **Super Admin Panel** (Platform Owner)<br>2. **Manager Panel** (Client/Organizer)<br>3. **User App** (Free Fire Gamers) |
| **"Feature advance banana, security me dekh lunga"** | **High-Tech Tournament Engine** | Anti-fraud slot booking, auto-wallet ledger, room credentials timed delivery, screenshot result upload, commission payout automation. |
| **"Banate time preview dikhate rehna"** | **CI/CD & Live Staging Links** | Expo Go / Web Preview deployments har phase ke end par boss ko live review karwane ke liye. |

---

## 🏗️ 2. High-Level Architecture & Tech Stack Recommendation

```mermaid
flowchart TD
    subgraph ClientLayer["Clients & End Users"]
        UA["📱 User App (iOS & Android)<br>React Native / Expo + NativeWind"]
        MP["💻 Manager Panel (Web/PWA)<br>Next.js 15 + Tailwind + shadcn"]
        AP["🛡️ Super Admin Panel (Web)<br>Next.js 15 + TanStack Table"]
    end

    subgraph Gateway["API & Realtime Gateway"]
        API["REST / GraphQL API<br>Node.js (NestJS / Express)"]
        WS["Realtime WebSockets (Socket.io)<br>Instant Room ID/Pass & Live Updates"]
        REDIS["Redis Cache<br>Atomic Slot Locking & Rate Limiting"]
    end

    subgraph BackendServices["Backend Services"]
        AUTH["Auth Service (JWT / Mobile OTP)"]
        TOURN["Tournament Lifecycle Engine"]
        WALLET["Double-Entry Wallet Ledger"]
        NOTIF["Push Notification Engine (FCM / APNs)"]
    end

    subgraph DataStore["Data & Media Storage"]
        DB[(PostgreSQL / Supabase<br>Multi-Tenant Partitioned)]
        S3["Cloud Storage (S3 / R2 / Supabase)<br>Match Result Screenshots"]
    end

    UA --> API
    MP --> API
    AP --> API
    UA <--> WS
    MP <--> WS

    API --> AUTH
    API --> TOURN
    API --> WALLET
    API --> NOTIF

    TOURN --> REDIS
    WALLET --> DB
    TOURN --> DB
    TOURN --> S3
```

### Recommended Technology Stack:
1. **Mobile App (Player Panel)**:
   - **Framework:** **React Native with Expo** (TypeScript) + **NativeWind (Tailwind CSS for React Native)**.
   - **UI Polish:** `@gorhom/bottom-sheet`, `react-native-reanimated`, `expo-haptics`, `lucide-react-native`, `expo-blur`.
   - **Why?** Boss ne React approve kiya hai, aur Expo se directly iOS aur Android dono par 100% iPhone-style fluid UI banti hai bina alag-alag Swift/Kotlin likhe.

2. **Manager & Super Admin Dashboards (Web)**:
   - **Framework:** **Next.js 15 (App Router)** or **Vite + React**.
   - **UI Library:** **shadcn/ui** (Radix UI primitives) + **Tailwind CSS** + **Lucide Icons** + **Tremor Charts**.
   - **State & Tables:** `@tanstack/react-query` + `@tanstack/react-table`.

3. **Backend & Cloud Architecture: Smart Hybrid Model (Firebase + Supabase)**:
   - **The Smart Hybrid Approach (Recommended):**
     * **Firebase Auth & FCM:** Free Fire players ke fast Mobile Number + OTP Login ke liye Firebase Authentication, aur Match start hone se 15 min pehle Room ID/Password ka high-priority device notification bhejne ke liye **Firebase Cloud Messaging (FCM)**.
     * **Supabase (Managed PostgreSQL):** Core relational database, multi-tenant isolation, Prisma ORM connectivity, double-entry wallet ledger, aur screenshot image storage ke liye **Supabase Storage**.
     * **Realtime Layer:** Supabase Realtime / Socket.io for instant live slot updates and in-app room revealing.
     * **In-Memory Cache & Mutex:** **Redis (Upstash / Redis)** slot booking me high concurrency race condition prevent karne ke liye.
   - **Alternative (Pure Firebase):**
     * Agar boss strictly 100% Firebase chahte hain: **Cloud Firestore + Firebase Auth + Firebase Storage + Cloud Functions (Node.js)**. (Note: Firestore me slot booking ke waqt concurrency limit ka dhyan rakhna padega).

---

## 👥 3. Updated Role-Based Architecture (As per Boss Demand: `poss demand..md`)

> **Key Pivot:** Hamare (Jay & Boss) ke liye alag se koi platform Super Admin panel nahi banega. Jo client humse app lega, wahi **Admin (Manager/Owner)** hoga. Aur wo apne kaam ke liye jo bande hire karega, wo **Sub-Admin (Staff/Moderator)** honge.

```mermaid
graph TD
    subgraph ClientOrganization["Client Organization (Tournament Owner)"]
        Admin["👑 Client / Admin (Owner)<br>Full Access: Financials, Match Creation, Staff Management"]
        SubAdmin["🛡️ Sub-Admin / Staff<br>Granular Role: Room ID Update, Result Verification"]
    end

    subgraph Gamers["Esports Players"]
        Player["🎮 User / Gamer (Player App)<br>Match Join, Slot Pick, Wallet, Room ID Access"]
    end

    Admin -->|Hires & Grants Permissions| SubAdmin
    Admin -->|Hosts Tournaments| Player
    SubAdmin -->|Manages Room ID / Results| Player
```

### 👑 Role 1: Admin App (The Client / Tournament Owner)
*Ye app us client ko milega jo tournament system kharid raha hai.*
- **Full Business Control:** Total matches hosted, entry fee revenue, net profit, pending withdrawal requests.
- **Staff Management (Sub-Admin Creation):** 
  - Naye staff member ko add karna (Email, Password) aur specific permissions dena:
    * `canCreateMatch`: Boolean (Naya match create kar sakta hai ya nahi)
    * `canUpdateRoomId`: Boolean (Custom Room ID/Pass update karne ka haq)
    * `canDistributePrize`: Boolean (Winner ko paise distribute karne ka haq)
    * `canManageWallet`: Boolean (Deposit/Withdrawal approve karne ka haq)
- **Tournament Control:** Match creation (Solo/Duo/Squad/CS), map selection, entry fee, prize pool, cancellation & auto-refund.
- **Financial Settings:** Apna personal UPI ID, QR code, payment gateway keys, aur WhatsApp support number configure karna.

---

### 🛡️ Role 2: Sub-Admin (Staff / Moderator App - Same Admin APK)
*Ye wahi Admin app hai, lekin staff jab login karega toh unhe sirf wahi buttons/cards dikhenge jinki permission Admin ne di hai.*
- **Dynamic Jetpack Compose Dashboard:**
  - Agar `canUpdateRoomId == true` hai, toh Room ID input box open hoga.
  - Agar `canDistributePrize == true` hai, toh Result & Screenshot review section dikhega.
  - Financial data aur Staff add karne ke rights inke paas **nahi** honge.

---

### 🎮 Role 3: Player Mobile App (Kotlin + Jetpack Compose)
*Free Fire gamers ke liye dedicated client-branded app.*
- **1-Tap Google / Phone Auth:** Firebase Auth + Free Fire UID aur In-Game Name (IGN) mandatory setup.
- **Match Feed & Slot Selector:** Bermuda, Purgatory, Kalahari matches with live filled slots counter (e.g. 38/48).
- **Protected Room ID View:** Match time se 15 min pehle countdown khatam hone par Room ID aur Password unlock hona (sirf registered slot holders ke liye).
- **Dual Wallet:** Deposit balance (for joining) + Winning balance (withdrawable to UPI).
- **Result Proof Upload:** End-game scorecard screenshot upload for kill verification.

---

## 📱 3.1 Android Studio Multi-Module Architecture (Kotlin + Jetpack Compose)

```
FreeFireTourneyApp/
├── :app-player      # Player APK (Gamer UI, Slot Picker, Room ID, Wallet)
├── :app-admin       # Admin & Staff APK (Role == "admin" vs "sub_admin" dynamic Compose screens)
└── :core            # Shared Kotlin Data Classes (Tournament.kt, User.kt, Permissions.kt) & Supabase/Firebase Repositories
```

### ⏱️ 10-Minute Client Handover Model:
Har naye client ke aane par sirf ye 4 steps karne honge:
1. Client ke Supabase/Firebase credentials project me connect karna.
2. `build.gradle.kts` me Client ka App Name, Package Name (`com.client.player`), aur Theme Colors update karna.
3. Client ka Logo mipmap me daalna.
4. Android Studio se 2 signed APK generate karna (`Player.apk` aur `Admin.apk`) aur client ko de dena!
  - Match Card UI: Match Banner, Map Name, Prize Pool, Per Kill Reward, Entry Fee, Available Slots Progress Bar (e.g., 38/48 Joined).
- **Interactive Slot Selector:**
  - Solo ke liye direct entry; Squad ke liye Slot 1 se Slot 12 tak seat map (kaun sa squad slot khali hai dekh kar select karna).
  - Team Code generation to invite friends directly into the squad slot.
- **Match Room Locker (Security Feature):**
  - Match start hone se 15 min pehle countdown timer.
  - Jaise hi manager Room ID & Password dale, instant Push Notification + Copy Room ID & Password one-click button.
- **Wallet System:**
  - Balance Split: **Deposit Cash** | **Winnings Cash** | **Bonus Coins**.
  - Add Money via UPI (GPay, PhonePe, Paytm).
  - Instant Withdrawal request to UPI / Bank Account with status tracking (Pending -> Approved -> Success).
- **Result & Proof Submission:**
  - Match khatam hone ke baad end screen screenshot upload karne ka section (kill proof aur booyah proof).
- **Social & Gamification:**
  - Leaderboard (Top Earners, Top Fraggers of the Month).
  - Refer & Earn system (Referral code to earn bonus entry coins).
  - Dual Theme: OLED Dark Mode (Default gaming feel) / Cupertino Light Mode.

---

## 🗄️ 4. Multi-Tenant Database Schema Blueprint

```sql
-- 1. Tenants (Clients / Organizers)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL, -- e.g. "jharkhand-esports"
    logo_url TEXT,
    branding_colors JSONB, -- { "primary": "#FF5722", "darkBg": "#0A0A0C" }
    status VARCHAR(20) DEFAULT 'ACTIVE',
    commission_rate DECIMAL(5, 2) DEFAULT 10.00, -- Platform cut %
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users (Players across tenants)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    ff_ign VARCHAR(50) NOT NULL, -- Free Fire In-Game Name
    ff_uid VARCHAR(30) NOT NULL, -- Free Fire Numeric UID
    role VARCHAR(20) DEFAULT 'PLAYER', -- 'SUPERADMIN', 'MANAGER', 'PLAYER'
    wallet_deposit DECIMAL(10,2) DEFAULT 0.00,
    wallet_winnings DECIMAL(10,2) DEFAULT 0.00,
    wallet_bonus DECIMAL(10,2) DEFAULT 0.00,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, phone),
    UNIQUE(tenant_id, ff_uid)
);

-- 3. Tournaments
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    title VARCHAR(150) NOT NULL,
    match_type VARCHAR(20) NOT NULL, -- 'SOLO', 'DUO', 'SQUAD', 'CS_4V4'
    map_type VARCHAR(50) NOT NULL, -- 'BERMUDA', 'PURGATORY', 'KALAHARI', 'ALPINE'
    entry_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    prize_pool DECIMAL(10, 2) NOT NULL,
    per_kill_prize DECIMAL(10, 2) DEFAULT 0.00,
    total_slots INT NOT NULL DEFAULT 48,
    match_time TIMESTAMP WITH TIME ZONE NOT NULL,
    room_id VARCHAR(50),
    room_password VARCHAR(50),
    room_released_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) DEFAULT 'UPCOMING', -- 'UPCOMING', 'OPEN', 'ONGOING', 'VERIFYING', 'COMPLETED', 'CANCELLED'
    rules_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tournament Participants & Slot Booking
CREATE TABLE tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    slot_number INT NOT NULL, -- 1 to 48 or Team 1-12
    team_name VARCHAR(50),
    kills INT DEFAULT 0,
    rank INT DEFAULT 0,
    prize_won DECIMAL(10, 2) DEFAULT 0.00,
    screenshot_proof_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tournament_id, slot_number),
    UNIQUE(tournament_id, user_id)
);

-- 5. Wallet Ledger (Strict Double-Entry Records)
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tournament_id UUID REFERENCES tournaments(id),
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(30) NOT NULL, -- 'DEPOSIT', 'ENTRY_FEE', 'WINNING_PAYOUT', 'WITHDRAWAL', 'REFUND', 'BONUS'
    status VARCHAR(20) DEFAULT 'SUCCESS', -- 'PENDING', 'SUCCESS', 'FAILED'
    reference_id VARCHAR(100), -- Gateway Transaction ID / UTR
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🗓️ 5. Step-by-Step Implementation Phases (7-Phase Roadmap)

### 📍 Phase 1: Foundation & Multi-Tenant Database Setup (Days 1–3)
- [ ] Initialize monorepo or standard folder structure (`/mobile-app`, `/admin-web`, `/backend-api`).
- [ ] Set up PostgreSQL database with Multi-Tenant schema (Tenants, Users, Tournaments, Slots, Ledger).
- [ ] Docker container setup for local DB + Redis.
- [ ] Seed script ready with demo tenant (e.g., "Apex Free Fire Club") and demo tournaments.

### 📍 Phase 2: Authentication & Core API Service (Days 4–7)
- [x] Multi-tenant Auth service (JWT tokens with `tenant_id` and `role` claims).
- [x] Phone OTP login flow + Free Fire UID & In-game name capture (Firebase Auth wired for dev).
- [x] Role Guards: SuperAdmin, Manager, and Player middleware.
- [ ] Swagger / Postman API documentation auto-generation for testing.

#### 🎯 Production Cost-Optimization Milestone: Indian SMS Gateway Cutover (Fast2SMS / 2Factor / PIN)
> **Financial Risk Analysis:**  
> Firebase Identity Platform routes SMS via international telecom gateways, billing ~$0.07 USD (~₹5.80–₹6 per SMS) in India with only 10 daily free SMS on live traffic. At 10,000 monthly OTPs, Firebase incurs a devastating ~₹60,000 bill.  
> **Production Cutover Action Items:**
> 1. **Current Development Phase:** Kept on Firebase Auth using configured **Test Phone Numbers** (`+91 9999900001` -> `123456`, `+91 9999900003` -> `123456`) which consume **₹0 quota** for unlimited dev/UI testing.
> 2. **Production Option 1 — Domestic Indian SMS Gateway (Fast2SMS / 2Factor / MSG91):**
>    - Direct DLT-registered local A2P route costing **₹0.15 to ₹0.25 (15–25 paise) per OTP**.
>    - 10,000 OTPs cost only **~₹1,800** (saving ~₹58,000/month!).
>    - Simple Node.js backend REST call to send 4/6-digit OTP and verify in Redis cache (5-min TTL).
> 3. **Production Option 2 — Phone + 4-Digit Security PIN / Password (₹0 Cost Model):**
>    - Gamer sets a 4-digit PIN upon registration.
>    - All future logins use Phone + PIN directly against bcrypt hash in DB.
>    - **Zero SMS cost forever (₹0)**, zero dependency on telecom gateways, instant login with 0 delay.
> 4. **Production Option 3 — Hybrid Architecture (Recommended for Scale):**
>    - Initial registration + Password reset uses Indian SMS Gateway (Fast2SMS ~18 paise).
>    - Daily logins use Phone + PIN or Persistent DataStore JWT session (already built in core).

### 📍 Phase 3: Tournament Engine & Race-Condition Proof Slot Booking (Days 8–12)
- [x] Match creation endpoints with Free Fire presets (Bermuda/Purgatory, Solo/Duo/Squad, Gun Prop off, etc.).
- [x] **Atomic Slot Reservation with Redis:** Prevent two players from booking the same slot at the exact same millisecond.
- [x] Squad invitation flow (leader generates 6-digit squad join code for teammates).
- [x] Automatic entry fee deduction from User Wallet.
- [x] Cancel tournament + auto-refund all players (ledger double-entry verified).
- [x] e2e race test: 20 concurrent joins on last 2 seats -> exactly 2 granted, SLOTS_FULL at 48.

### 📍 Phase 4: Room ID Delivery & Match Day Automation (Days 13–16)
- [x] Manager Room ID & Password input API (PATCH /room, ROOM_REVEALED status).
- [x] Timed room release: players see creds only from T-15min (403 countdown lock).
- [x] Player screenshot result submission + verify (MatchResult upsert).
- [x] 1-Click winner payout: per-kill + rank prize -> winningBalance -> double-entry ledger -> COMPLETED.
- [ ] WebSocket / Socket.io channel: Room credentials broadcast strictly to confirmed tournament participants.
- [ ] Push Notifications via Firebase Cloud Messaging (FCM).
- [ ] Match status state machine hookup (frontend-driven transitions pending apps).

### 📍 Phase 5: Result Processing, Screenshot Verification & Wallet Ledger (Days 17–21)
- [ ] Player Screenshot upload pipeline to Cloud Storage.
- [ ] Manager Review Dashboard: Side-by-side screenshot viewer with Kill count and Rank input.
- [ ] 1-Click Winner Payout Calculator (calculates rank reward + per-kill bonus automatically).
- [ ] 1-Click Match Cancellation & Auto-Refund to all participant wallets if room crashes.
- [ ] Withdrawal request management (Approve/Reject with UTR reference).

### 📍 Phase 6: iOS-Style UI/UX & Native Polish (Days 22–27)
- [ ] Native Cupertino components integration:
  - Frosted glass blur headers (`expo-blur`).
  - Smooth bottom sheets (`@gorhom/bottom-sheet`) for match details and slot pickers.
  - Haptic feedback on button clicks (`expo-haptics`).
- [ ] Complete **Dark & Light Mode** styling tokens with smooth transitions.
- [ ] Clean card layouts, tournament countdown timers, and live slot counter bars.
- [ ] Deploy web preview & Expo build for Boss review.

### 📍 Phase 7: Multi-Client White-Label Engine & Security Hardening (Days 28–30) — ✅ COMPLETE
- [ ] Dynamic branding injector: Logo, primary colors, and app name load dynamically based on Tenant configuration.
- [ ] Security hardening:
  - Device ID fingerprinting to block multiple accounts per device.
  - Rate limiting on sensitive wallet and slot-booking endpoints.
  - SQL injection & XSS sanitization.
- [x] Final end-to-end testing (Solo, Duo, Squad tournament lifecycle from creation to cash withdrawal).
- [x] 48-Player Concurrency Stress Suite passed with 0 errors (`scripts_stress_test.ts`).
- [x] Daily Settlement Console & 1-Tap Match Cloning presets.

### 📍 Phase 8: Production Cloud Deployment & Custom Domain (Active)
- [ ] Multi-stage production `Dockerfile` with non-root security & Prisma compilation.
- [ ] Cloud deployment to Render / Railway / VPS / Cloud Run.
- [ ] Connect production Upstash Serverless Redis & Supabase pooler (Port 6543).
- [ ] Custom domain DNS mapping (`api.yourbrand.com`) with automated SSL/TLS certificates.
- [ ] Android apps (`:app-player` & `:app-admin`) switch from `localhost:5000` to live HTTPS domain.
- [ ] Refer to comprehensive plan: `plan/PRODUCTION_CLOUD_DEPLOYMENT_PLAN.md`.

---

## 🔗 6. Top GitHub Repositories & UI Kits to Reference

Aapke research aur code references ke liye best open-source GitHub projects:

### 🎮 Tournament & Esports Platforms (Logic & Architecture References)
1. **[AnupSharma12 / syndicate](https://github.com/AnupSharma12/syndicate)**
   - *Stack:* Next.js, React, TypeScript, Tailwind CSS, Firebase
   * *Utility:* Esports tournament management platform for Free Fire, Valorant, etc. Team/squad handling aur admin flow ka clean reference.
2. **[codeAntu / battle-zone](https://github.com/codeAntu/battle-zone)**
   - *Stack:* TypeScript, React, Tailwind CSS, Node.js
   * *Utility:* BGMI & Free Fire tournament registration, wallet entry fee handling, and OTP verification flow.
3. **[tomasmajercik / tournify](https://github.com/tomasmajercik/tournify)**
   - *Stack:* React Native (Expo), Express.js, PostgreSQL
   * *Utility:* Complete mobile app for organizing and joining tournaments with brackets, participant management, and real-time updates.
4. **[ahmadbenos / mobile-tournament-manager-app](https://github.com/ahmadbenos/mobile-tournament-manager-app)**
   - *Stack:* React Native, AWS Lambda, MongoDB
   * *Utility:* League and tournament scheduling with mobile UI state management.

### 📱 iOS-Style UI & Modern Component Kits (React Native / Expo)
1. **[nativewind / nativewind](https://github.com/nativewind/nativewind)**: Tailwind CSS v4 inside React Native for effortless dark/light styling.
2. **[gorhom / react-native-bottom-sheet](https://github.com/gorhom/react-native-bottom-sheet)**: Exact iOS Apple Maps style smooth interactive bottom sheets.
3. **[software-mansion / react-native-reanimated](https://github.com/software-mansion/react-native-reanimated)**: 60fps / 120fps fluid physics-based animations.
4. **[shadcn / ui](https://github.com/shadcn-ui/ui)**: For Admin & Manager Web Dashboard - industry standard clean modern UI.
5. **[tremorlabs / tremor](https://github.com/tremorlabs/tremor)**: Beautiful modern charts and metrics for Super Admin & Organizer analytics.

---

## 🎯 7. The Ultimate "Deep Research & GitHub Hunting" Master Prompt

*Aap is prompt ko Gemini, Claude, ya Perplexity me copy-paste karke ultra-deep research kar sakte hain:*

```text
You are a Principal Software Architect and Lead Mobile Engineer specializing in real-money esports platforms (similar to Gamerji, Khiladi Adda, WinZO, and Battlemania) tailored for Garena Free Fire tournaments.

I am developing a multi-tenant, white-label Free Fire Tournament SaaS platform that will be sold to multiple tournament organizers (clients). The system consists of:
1. Mobile App (Players/Users): Built with React Native (Expo) or Flutter, strictly following modern iOS design principles (Cupertino glassmorphic blur, smooth bottom sheets, haptic feedback, dual OLED Dark & Light modes).
2. Manager Panel (Organizers): Web-based portal to create custom Free Fire matches (Solo/Duo/Squad/Clash Squad, maps like Bermuda/Purgatory/Alpine), input timed Room IDs & Passwords, verify player screenshot proofs, and distribute prize pools.
3. Super Admin Panel: Multi-tenant control center to manage client licenses, global platform commission cuts, payment gateway configs, and anti-fraud/ban lists.

Conduct a deep research dive and provide:
1. GITHUB REPOSITORIES & BOILERPLATES:
   - Identify active open-source GitHub repositories for esports tournament apps, tournament brackets, and wallet/ledger systems. Provide exact repo paths, tech stacks, and what architectural modules can be borrowed.
2. CONCURRENCY & SLOT LOCKING ALGORITHM:
   - Provide a battle-tested Redis Mutex / Distributed Lock implementation in Node.js/TypeScript to prevent race conditions when 100+ players attempt to join the remaining 2 slots of a tournament simultaneously.
3. FREE FIRE TOURNAMENT WORKFLOW & AUTOMATION:
   - How to architect the timed delivery of Custom Room ID and Password so that only registered, verified players can view it exactly 15 minutes before match start.
   - Design an OCR or streamlined verification pipeline for end-game match screenshots (Kill count and Booyah rank) to speed up manual manager review.
4. MULTI-TENANT DATABASE DESIGN:
   - Provide a complete PostgreSQL DDL schema with Row Level Security (RLS) or tenant_id partitioning ensuring complete data isolation between different tournament organizers.
5. UI/UX DESIGN TOKENS & COMPONENT ARCHITECTURE:
   - Provide a design system spec for React Native (NativeWind / Tailwind) that mimics high-end iOS gaming aesthetics (blur backdrops, card elevations, animated slot progress bars, and high-contrast dark/light mode palettes).
```

---

## 🚀 8. Immediate Next Steps for Jay

1. **Boss ko Preview bhejo:** `plan/ROADMAP.md` ka summary boss ke sath share karo taaki unhe confidence ho jaye ki architecture multi-tenant, modern iOS UI aur full security ke hisab se planned hai.
2. **Backend Development Kickoff (Phase 1):** Backend folder initialize karke database schema aur API router structure taiyar karein.

---

## 🛠️ 9. Backend Development Starting Blueprint (Kidhar se shuru karein)

Aap backend developer hain, toh backend development ko in **5 specific steps** me shuru kiya jayega:

### Step 1: Project Folder & Environment Scaffolding
- Root directory me `backend/` folder create karna.
- Node.js + TypeScript environment initialize karna:
  ```bash
  npm init -y
  npm install express dotenv cors helmet ioredis @prisma/client
  npm install -D typescript tsx @types/node @types/express prisma
  npx tsc --init
  ```

### Step 2: Supabase Project & Prisma Schema Connection
- [supabase.com](https://supabase.com) par free project banana.
- Supabase se PostgreSQL connection string copy karke `.env` me daalna:
  `DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"`
- `npx prisma init` run karke hamara Multi-Tenant schema (`Tenants`, `Users`, `Tournaments`, `TournamentSlots`, `WalletLedger`) `prisma/schema.prisma` me paste karna.
- `npx prisma db push` chalakar Supabase me tables ready karna.

### Step 3: Firebase Admin SDK Integration (Auth & FCM)
- Firebase console se service account JSON download karna (`firebase-admin` setup).
- Auth middleware banana jo player ke phone OTP token ko verify karega aur user create/login karega.

### Step 4: Core Tournament & Slot Booking Engine (The Meat)
- Free Fire tournament creation CRUD endpoints (Manager ke liye).
- **Atomic Slot Reservation Logic (Redis Mutex / Redlock):**
  - Player join API with atomic check: `POST /api/tournaments/:id/join`
  - Balance check -> Slot lock -> Entry fee deduction -> Confirmed slot ticket.

### Step 5: Timed Room ID & Result Submission Workflow
- Room Credentials release API with 15-minute countdown lock:
  `GET /api/tournaments/:id/room-credentials`
- Match result & screenshot upload endpoint linking to Supabase Storage.



---

## 💼 10. Multi-Client Commercial Strategy & Monetization (From Research: `one app alll clint sell.md`)

Boss ke core business objective: **"Ye sirf ek bande ko sell karne ke liye nahi hoga, multiple clients ko dena hai"** ke liye commercial and deployment model:

### 🏆 10.1 Three White-Label Sales Models for Clients:
1. **Model 1: Multi-Club Marketplace Model (Quickest Onboarding)**
   - Ek common app platform par har client ka apna verified "Club/Community" hota hai.
   - Client ke players club join karte hain aur unhe sirf usi client ke matches dikhte hain. Zero APK compilation needed.
2. **Model 2: Dynamic Branded App with Tenant Code (Recommended)**
   - Single core APK. Jab user client ke invite link ya code se app kholta hai, backend se runtime par client ka custom logo, accent colors aur banners inject ho jate hain (`X-Tenant-ID` header routing).
3. **Model 3: Standalone Automated Whitelabel APK (Enterprise Clients)**
   - Client ka dedicated package name (`com.clientname.esports`), custom app icon, aur isolated Google Play upload build.

### 💰 10.2 Payment Routing Schemes:
- **Small Organizers:** Dynamic UPI QR Code (Direct player-to-organizer UPI transfer with zero gateway deductions).
- **Pro Organizers:** Client's own Razorpay / Cashfree API credentials configured inside their Admin Settings.
- **Platform Marketplace:** Saara payment central platform par aata hai, platform apna commission (e.g. 5%) kaat kar baaki 95% client ko payout karta hai.

### 🛡️ 10.3 License Protection & Remote Kill-Switch:
- Database table `tenants` me `isActive: boolean` flag.
- Backend auth middleware har request par verify karta hai:
  `if (!tenant || !tenant.isActive) throw ApiError.forbidden('Tenant account is inactive');`
- Agar koi client monthly subscription fee nahi deta, toh Boss 1-click me unka tournament creation aur match engine freeze kar sakte hain.

### 📈 10.4 SaaS Pricing Tiers for Boss:
| Tier | Pricing | Features & Inclusions |
| :--- | :--- | :--- |
| **Starter Tier** | ₹1,999 / month + 5% platform cut | Up to 20 Tournaments/month, Shared Branded Portal, Dynamic UPI QR |
| **Pro Tier** | ₹4,999 / month + 3% platform cut | Unlimited Tournaments, Sub-Admin staff management, Own Payment Gateway keys |
| **Enterprise Tier** | ₹25,000 one-time + ₹2,500/mo AMC | Standalone dedicated APK, Full custom Android build, Play Store upload assistance |


---

## ⚡ 11. Turnkey Standalone Delivery Engine (Zero Data Liability Model)

> **Boss & Jay Core Philosophy:** "Hum client ko app denge, fir uske data se hamara koi lena dena nahi hai. Client ka apna Supabase aur apna Firebase 2 second me connect hoga, aur har client ka App Name, Logo, Button Colors aur Play Store build 100% alag banegi."

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 TURNKEY ZERO-LIABILITY HANDOVER BLUEPRINT                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Data Liability:                                                     │
│    • Jay aur Boss kisi client ka user data, passwords ya match money apne   │
│      server par store nahi karenge.                                         │
│    • Har client ka apna free/paid Supabase database aur Firebase project     │
│      hoga. Client apne database aur paison ka 100% khud maalik hoga.        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. 2-Second Backend Connection:                                             │
│    • Client ka `google-services.json` daalo.                                │
│    • Client ka `SUPABASE_URL` aur `SUPABASE_ANON_KEY` daalo.                │
│    • App turant client ke database se baat karna shuru kar degi!            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. 10-Minute Dynamic Re-Branding Engine (Jetpack Compose):                  │
│    • Central `client_config.json` se ek click me sab change:                │
│      - App Name (e.g. "Thunder eSports", "Alpha Zone", "Godlike Arena")     │
│      - Logo & App Icons (mipmap automatic resize)                           │
│      - Button Colors & Primary Theme (Crimson, Neon Blue, Gold, Green)      │
│      - Button Shapes (Sharp 4dp, Rounded 12dp, Pill-shaped)                 │
│      - Play Store Package ID (com.clientname.player / com.clientname.admin) │
│      - R8 Obfuscation Dictionary (unique DEX bytecode per client)           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Two Clean APKs Generated:                                                │
│    • Player.apk (Gamers ke liye)                                            │
│    • Admin.apk (Client Owner aur uske Sub-Admin Staff ke liye)              │
│    • Release .aab (Google Play Console par upload ke liye ready)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📄 Central Client Configuration Blueprint (`client_config.json`):
```json
{
  "client_id": "thunder_esports",
  "app_name": "Thunder eSports",
  "package_name": "com.thunderesports.app",
  "version_code": 1,
  "version_name": "1.0.0",
  "theme": {
    "primary_color": "#FF5722",
    "button_color": "#FF5722",
    "button_corner_radius": 12,
    "accent_color": "#FFC107",
    "card_style": "ROUNDED_16"
  },
  "backend_keys": {
    "supabase_url": "https://client-project.supabase.co",
    "supabase_anon_key": "eyJhbGciOi...",
    "support_whatsapp": "+919876543210"
  }
}
```
