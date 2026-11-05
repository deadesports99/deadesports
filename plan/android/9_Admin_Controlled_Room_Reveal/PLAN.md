# 🔑 Phase 9: Admin-Controlled Room ID / Password Reveal

> **Target Goal (boss demand):** "Admin ko azadi ho ki custom room ka ID & Password
> players ko kab dikhe — 15 min pehle ya jab bhi admin chahe" — exactly the same
> control pattern as the Phase 8 match-visibility window.
> **Location:** `backend/`, `:core`, `:app-admin`, `:app-player`
> **Status:** ✅ COMPLETE — backend E2E **44/44**, both APKs build clean,
> physical-device walkthrough passed (create → join → publish → locked → Reveal Now → player sees code).

---

## 📋 Phase 9 Checklist

### 🔹 Stage 1: Backend — per-match reveal window
- [x] **1.1 Schema:** `Tournament.roomRevealMinutes Int @default(15)` (auto-reveal
      N minutes before start) alongside the existing `roomRevealedAt` (set when the
      reveal actually happens — auto sweep or admin "Reveal Now").
- [x] **1.2 Shared rule** in `src/services/roomReveal.ts`:
      `isRoomUnlocked()` = `roomRevealedAt != null` **or** `now >= matchTime - N min`.
      Used by feed, details, room endpoint, sweep — one source of truth.
- [x] **1.3 Create match** accepts `roomRevealMinutes` (1..10080, default 15) and
      stores it; clones inherit it.
- [x] **1.4 Feed/details payload** gains `roomRevealMinutes`, `roomRevealsAt`,
      `roomUnlocked`, `secondsUntilRoomReveal`; `isRoomReady` and credentials
      visibility now follow the admin window instead of a hardcoded T-15.
- [x] **1.5 Publish room** (`PATCH /tournaments/:id/room`) accepts `revealNow: true`
      → publishes + reveals immediately; otherwise stores credentials but keeps
      them hidden until the window.
- [x] **1.6 New endpoint** `PATCH /tournaments/:id/room-reveal`
      (`canUpdateRoomId`) with `{ roomRevealMinutes?, revealNow? }`:
      edit the auto window and/or reveal to players instantly. `revealNow` without
      published credentials → 409.
- [x] **1.7 Lifecycle sweep** now reveals each match at *its own*
      `matchTime - roomRevealMinutes` (no longer fixed 15 min) and still moves
      kicked-off matches to LIVE.
- [x] **1.8 `GET /tournaments/:id/room`** uses the same rule; the 403 message
      quotes the admin's window ("Room ID will be revealed 30 minutes before match start").

### 🔹 Stage 2: Admin app
- [x] **2.1 Create Match:** new "🔑 Room ID & Password Reveal" section —
      5m/15m/30m/1h/2h/6h/12h/24h presets + custom minutes (1–10080), with an IST
      preview `Room ID & Password visible from: 05 Nov 2026, 11:45 AM IST`.
- [x] **2.2 Publish Room screen:** shows the selected match's reveal state,
      tap-to-change timing chips, "Reveal to players immediately" switch at publish
      time, and a "🔑 Reveal to players now" action for already-published rooms.
- [x] **2.3 Manage Matches:** each card shows
      `🔑 Room ID: hidden — reveals at 11:45 AM (15 min before start)` /
      `🔑 Room ID: visible to players now` / `not published yet`, plus a
      `🔑 Reveal Room ID to Players Now` quick action.
- [x] **2.4 Bug found on device & fixed:** staff always receive the `room` payload,
      so "unlocked" now strictly uses the server `roomUnlocked` flag.
- [x] **2.5 Publish Room picker hygiene:** the picker previously listed every match
      (including yesterday's `LIVE`/`COMPLETED` leftovers) while the player app showed
      none. New backend filter `GET /tournaments?publishable=true` returns only
      `UPCOMING / OPEN / SLOTS_FULL / ROOM_REVEALED` with a 1-hour kickoff grace
      (`tournament.service.ts`). The Publish Room screen now uses this dedicated list
      (separate `publishTargetsUi`), keeps a client-side guard, and shows a clear
      empty state: "📭 No active or upcoming matches right now" + Refresh.

### 🔹 Stage 3: Player app
- [x] **3.1** Dynamic reveal texts everywhere (`roomRevealLabel()`), e.g.
      `✅ Joined • Room in 1h 22m` → after reveal the card flips to
      `🔑 Get Room ID & Password`.
- [x] **3.2** Room screen shows the locked countdown with the admin's message and
      auto-unlocks when the window opens (or instantly after Reveal Now).
- [x] **3.3** Join sheet / slot picker / feed copy no longer hardcode "15 minutes".

### 🔹 Stage 4: Verification
- [x] **4.1** `backend/scripts_phase9_room_reveal.ts` — **44/44 passed**
      (create 30-min window, early publish stays locked, player 403 + message,
      Reveal Now → 200 & correct code, list flags, window edit + validation,
      player 403 on admin endpoint, sweep auto-reveal per-match window,
      clone inheritance, cleanup).
- [x] **4.2** `npm run build` clean; `:app-admin` + `:app-player` `assembleDebug` ✅.
- [x] **4.3** Physical device (RMX5070 via adb): created ₹0 match (12:00 PM IST,
      reveal 11:45 AM), joined from the player app ("Match Joined"), published
      `ROOM-7788 / pass7788` without reveal → player card showed
      `✅ Joined • Room in 1h 22m`, admin Manage Matches showed
      `🔑 Room ID: hidden — reveals at 05 Nov, 11:45 AM`, pressed
      `🔑 Reveal Room ID to Players Now` → admin showed
      `✅ Room ID & Password are now visible to joined players` / `ROOM OUT`,
      player feed showed `🔑 Get Room ID & Password` and the dialog displayed
      `ROOM-7788 / pass7788`. No crashes in logcat; test match removed afterwards.

---

## 🧠 Behaviour reference

| When admin publishes | roomRevealMinutes | Player sees code |
|---|---|---|
| 2h before start | 15 (default) | ❌ hidden until 15 min before start |
| 2h before start | 120 | ✅ immediately (window already open) |
| 2h before start | 15 + **Reveal Now** | ✅ immediately |
| 2h before start, then edited 15 → 30 | 30 | ❌ hidden; reveals at T-30 min (auto, sweep) |

Staff always see the credentials in the admin app; only joined players can ever
fetch them, and only after the admin's reveal rule is satisfied.
