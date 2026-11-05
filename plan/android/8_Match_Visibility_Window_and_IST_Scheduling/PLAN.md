# 📱 Phase 8: Player-Feed Visibility Window & Indian (IST) Match Scheduling

> **Target Goal:** Admin decides when a match becomes visible in the player list
> ("show only in the last N hours before start"), and every match schedule is
> entered/displayed in Indian Standard Time with 12-hour AM/PM.
> **Location:** `C:\Free Fire turnament\backend\`, `:core`, `:app-admin`, `:app-player`
> **Status:** ✅ COMPLETE — backend E2E 31/31, both debug APKs build clean.

---

## 📋 Phase 8 Checklist

### 🔹 Stage 1: Backend — data model & visibility engine
- [x] **1.1 Tournament schema:** `visibilityHours Int?` + `visibleFrom DateTime?`
      (denormalised timestamp = `matchTime - visibilityHours`) + index on
      `[tenantId, visibleFrom]`. Applied with `prisma db push` + `prisma generate`.
- [x] **1.2 Create match:** accepts `visibilityHours` (1–336, or null/omitted =
      always listed); computes and stores `visibleFrom`.
- [x] **1.3 Player feed filter (`GET /tournaments`):** non-staff callers only get
      `visibleFrom IS NULL OR visibleFrom <= now` (+ matches they already joined).
      Admins/sub-admins always see every match. Filtering happens in SQL so
      pagination totals stay correct.
- [x] **1.4 Details guard (`GET /tournaments/:id`):** hidden match → 404 for
      players (unless already joined or staff).
- [x] **1.5 Join guard (`POST /tournaments/:id/join`):** 409 with an IST message
      ("Registration is not open yet — this match appears in the list from
      05 Nov 2026, 11:58 am IST") before the window opens.
- [x] **1.6 Admin editor:** `PATCH /tournaments/:id/visibility` (`canCreateMatch`),
      body `{ visibilityHours: N | null }`, blocked for COMPLETED/CANCELLED.
- [x] **1.7 Clone inheritance:** cloned matches keep `visibilityHours`, re-anchored
      to the new match time.
- [x] **1.8 API payload:** every tournament now carries `visibilityHours`,
      `visibleFrom`, `isListedNow`, `secondsUntilListed`.

### 🔹 Stage 2: Admin app — IST scheduling UI (`CreateTournamentScreen.kt`)
- [x] **2.1 Date field:** Indian format `Wed, 05 Nov 2026` (IST, not device TZ).
- [x] **2.2 Time field:** Material3 `TimePicker` with **AM/PM** selector, always
      shown/entered in India Standard Time.
- [x] **2.3 Schedule preview:** `⏰ Match starts: 05 Nov 2026, 08:00 PM IST` plus
      "starts in 2h 15m", future validation and T-15 warning.
- [x] **2.4 Quick schedule chips:** +1h / +3h / +6h / +12h / +24h.
- [x] **2.5 Visibility control:** `Always visible` vs `Only near start`, hours
      input (1–336) + 2h/6h/10h/12h/24h presets, with a live preview
      `👁️ Players see this match from: 05 Nov 2026, 10:00 AM IST`.
- [x] **2.6 `matchTime` is sent as a UTC ISO instant built from Asia/Kolkata**,
      so the schedule is correct even if the admin's phone is in another TZ.

### 🔹 Stage 3: Admin app — Manage Matches
- [x] **3.1 Per-match visibility badge:** `👁️ Listed to players: immediately` /
      `👁️ Listed (window opened 10:00 AM)` / `🕒 Hidden — lists at 10:00 AM (6h from now)`.
- [x] **3.2 `👁️ Player Visibility Window` dialog:** switch between always / only
      near start, hour presets, exact IST preview, calls the PATCH endpoint.

### 🔹 Stage 4: Player app
- [x] **4.1 Feed respects the window:** matches outside the admin's window are
      hidden (uses the ticking server-authoritative clock so the list is exact).
      Already-joined matches never disappear; after "my match list edge case".
- [x] **4.2 Auto-refresh every 60 s** while the feed is open, so a match appears
      the moment its window opens — no pull-to-refresh needed.
- [x] **4.3 Cards show IST time + relative countdown** (`05 Nov, 08:00 PM • starts in 2h 15m`).

### 🔹 Stage 5: Verification
- [x] **5.1** `backend/scripts_phase8_visibility.ts` — **36/36 passed**
      (hidden feed, admin list, details 404, join 409 IST message, PATCH open /
      clear, 0h & 500h rejection, player 403, immediate listing, clone inheritance,
      2h window on 12h match → `secondsUntilListed = 36000`, joined player keeps a
      hidden match after the window is tightened, cleanup).
- [x] **5.2** `npm run build` (backend tsc) — 0 errors.
- [x] **5.3** `gradlew :app-admin:assembleDebug :app-player:assembleDebug` — BUILD SUCCESSFUL.
- [x] **5.4** Physical-device walkthrough (RMX5070 over adb + `adb reverse tcp:5000`):
      installed both APKs, created a match 12h ahead with a 10h window from the admin UI
      (player feed stayed at 0 matches; Manage Matches card showed
      `🕒 Hidden — lists to players at 05 Nov, 12:15 PM`), then changed the window to 13h
      via the visibility dialog (green "Visibility updated" + `👁️ Listed to players (window
      opened …)`) → player feed then showed the match with `05 Nov, 10:15 PM • starts in 12h 6m`.
      Screenshots: `screenshots/phase8_admin_create*.png`, `phase8_manage_matches*.png`,
      `phase8_visibility_dialog.png`, `phase8_player_feed_hidden.png`, `phase8_player_feed_visible.png`.
      Test match removed afterwards; no crashes in logcat.

---

## 🧠 Behaviour reference (boss example)

| Match starts | Admin window | Player list visible from | Visible now (match is 12h away)? |
|---|---|---|---|
| 12h from now | 10h | 10h from now | ❌ hidden |
| 12h from now | 13h | 1h ago | ✅ listed |
| 12h from now | 2h | 10h from now | ❌ hidden (hidden for 10 more hours) |
| 12h from now | Always | creation time | ✅ listed immediately |

Joined players always keep seeing their match, even if the window is tightened
afterwards; admins/staff always see every match in the admin app.
