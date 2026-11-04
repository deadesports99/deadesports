# ⚡ MISSION: Transform Free Fire Esports Platform into 100% Real-Time Reactive Architecture

---

## 🎯 Executive Overview & Goal

Aapko **Free Fire Tournament Platform (`C:\Free Fire turnament`)** ko **100% Real-Time Reactive Architecture** me convert karne ki poori azaadi aur command di jaati hai. 

Abhi ke system me client Android app (`app-player`) match feed aur wallet balance ko background silent polling (har 4-5 second ke timer) se refresh karta hai. Polling se network latency hoti hai, instant feel nahi aati, aur user experience compromise hota hai.

Aapka lakshya hai: **Bina kisi page refresh ya pull-to-refresh ke, sab kuch (Slots, Balance, Room ID/Password, Tournament Status) 0.05 second ke andar live screen par update hona chahiye — exactly jaise modern high-frequency esports & gaming apps me hota hai.**

---

## 🛠️ Full Architectural Freedom & Authority

Aapko is task ke liye **poori azaadi (complete autonomy)** hai:
- Aap backend code (`backend/src/`), Android Kotlin code (`android/core/`, `android/app-player/`), database schema, aur configuration files ko freely inspect, modify, aur optimize kar sakte hain.
- Aap decide kar sakte hain ki sabse best approach kya hai:
  - **Option 1: Direct Supabase Realtime WebSockets** (Client connects to Supabase Realtime Postgres Changes via WebSocket).
  - **Option 2: Backend WebSocket Server (Socket.IO / Native `ws` with Redis/Memory PubSub)** + Android OkHttp WebSocket.
  - **Option 3: Hybrid Architecture** (Supabase Realtime for database synchronization + Backend WebSocket for protected game credentials like Room ID/Password).
- Aapko terminal commands chalane, builds create karne (`assembleDebug`), physical device (`6103d5c2`) par deploy aur screencap se verify karne ka poora adhikaar hai.

---

## 📂 Reference Project (Must Inspect)

User ne 1 saal pehle ek production gaming app banaya tha jisme sab kuch 100% real-time tha (Coins, spins, tokens, leaderboard bina page reload ke update hote the):

> **Path:** `C:\Users\Jay Kumar\Desktop\copy-of-hexfire-royal-spin-new-11`

### Khas Files jo aapko zaroor dekhni hain:
1. `C:\Users\Jay Kumar\Desktop\copy-of-hexfire-royal-spin-new-11\supabaseClient.ts`
   - Dekhein kaise `supabase.channel(...)` aur `postgres_changes` configure kiye gaye the.
   - Dekhein `eventsPerSecond: 10`, `subscribeToUserChanges`, aur table filters (`uid=eq.${userUid}`).
2. `C:\Users\Jay Kumar\Desktop\copy-of-hexfire-royal-spin-new-11\App.tsx` (Lines 475 to 585)
   - Dekhein kaise live database row update aate hi React state (`setCoins`, `setSpinsToday`, `setUser`) seamlessly update hoti thi bina kisi flicker ke.

---

## 🏗️ Current Project Stack & Context (`C:\Free Fire turnament`)

- **Backend:** Node.js, Express, TypeScript, Prisma ORM ([backend/src/](file:///C:/Free%20Fire%20turnament/backend/src/)).
- **Database:** Supabase PostgreSQL (`aws-0-eu-west-2.pooler.supabase.com:5432/postgres?sslmode=require`, Project Ref: `zupnlhdtfirufmlurkef`).
- **Android App:** Kotlin, Jetpack Compose, Material 3, Coroutines, StateFlow.
  - Networking: OkHttp 4.12.0, Retrofit 2.11.0, Moshi 1.15.1.
  - App Package / ID: `com.thunderesports.player` (`app-player`).
  - Config: `android/app-player/src/main/assets/client_config.json` (contains `api_base_url`, `supabase_url`, `tenant_id`).
- **Target Physical Test Device:**
  - Device ID: `6103d5c2` (Realme P3 5G, Android, USB Connected).
  - Reverse Proxy: `adb -s 6103d5c2 reverse tcp:5000 tcp:5000`.

---

## ⚡ Mandatory MCP Supabase Usage

Aapko **Supabase MCP tools** (`mcp: supabase`) ka use karke live database configuration aur setup manage karna hai:
1. **Tables & Publication Check:**
   - Use `execute_sql` tool to inspect current publication:
     ```sql
     SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
     ```
2. **Enable Realtime on Core Tables:**
   - Realtime stream ke liye in tables ko `supabase_realtime` publication me add karein aur REPLICA IDENTITY set karein:
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE "Tournament";
     ALTER PUBLICATION supabase_realtime ADD TABLE "TournamentSlot";
     ALTER PUBLICATION supabase_realtime ADD TABLE "User";
     ALTER PUBLICATION supabase_realtime ADD TABLE "WalletTransaction";
     
     ALTER TABLE "Tournament" REPLICA IDENTITY FULL;
     ALTER TABLE "TournamentSlot" REPLICA IDENTITY FULL;
     ALTER TABLE "User" REPLICA IDENTITY FULL;
     ALTER TABLE "WalletTransaction" REPLICA IDENTITY FULL;
     ```
3. Use `list_tables`, `query_logs`, aur `list_migrations` as needed to ensure zero permission or RLS bottlenecks.

---

## 🎯 Specific Real-Time Features to Deliver

### 1. Live Slot Booking & Occupancy Counter
- Jab User A kisi match me slot book kare (Swipe to Join / Tap to Join):
  - User B, C, D sabhi ke screens par match card ka slot count (`0/48` ➔ `1/48` ➔ `2/48`) bina kisi delay ke 0.05s me update hona chahiye.
  - Linear Progress Bar bina kisi reload ke animate hokar aage badhe.
  - Agar match full ho jaye (`48/48`), to button automatically `❌ Full` ho jaye.

### 2. Live Wallet Balances (Zero Page Navigation)
- Jab bhi user ka wallet balance change ho:
  - Match entry fee deduct hone par Deposit Balance instantly update ho.
  - Admin ke UPI deposit approve/reject karne par deposit balance real-time float ho.
  - Match end hone par prize winnings automatically user ke winning balance me reflect ho.
  - Wallet tab ya passbook me page refresh ki zaroorat na pade.

### 3. Live Match Lifecycle & Tab Hopping
- Match status transition: `UPCOMING` ➔ `ROOM_REVEALED` ➔ `LIVE` ➔ `COMPLETED`.
- Jab match shuru ho:
  - Match automatically **⚡ Upcoming** tab se hatkar **🔴 Live Matches** tab me switch ho jaye bina manual pull-to-refresh ke.
- Jab Admin match finalize/complete kare (Payout distributed):
  - Match turant player feed se gayab (disappear) ho jaye.

### 4. Live Custom Room ID & Password Delivery
- Jaise hi Admin Room ID aur Password save karta hai:
  - Match ke registered players ke device par turant Room ID & Password card unhide ho jaye ya live dialog popup trigger ho.
  - Unregistered players ko ye credentials kabhi leak na hon (Security check ensure karein).

---

## 🧪 Verification & Delivery Checklist

1. **Clean Code & Build:**
   - Run compilation: `.\gradlew.bat :app-player:assembleDebug` in `android` directory. Ensure 0 compilation errors.
2. **Deploy to Physical Device:**
   - Install APK on Realme P3 5G (`6103d5c2`).
   - Setup `adb reverse tcp:5000 tcp:5000`.
3. **Verify End-to-End Real-Time:**
   - Server ya database se slot book karein ya balance update karein.
   - Screen capture le kar verify karein ki bina page reload ke screen par values instantly update hui hain.

---
*Aapke paas poori authority aur modern tooling hai. Best-in-class real-time esports engine deliver karein!*
