# 🧪 Module 04: Room Locker & Timed Reveal Automation

> **Target Screens:** `RoomCredentialsDialog.kt`, `TournamentFeedScreen.kt`, `AdminPublishRoomScreen.kt`, `tournament.service.ts`, `result.service.ts`, `matchSweep.service.ts`  
> **Target Role:** Player App (`:app-player`) & Admin App (`:app-admin`)  
> **Status:** ✅ VERIFIED & PASSED on Realme P3 5G (`6103d5c2`)

---

### 📋 Checklist & Acceptance Criteria

- [x] **4.1 T-15 Countdown Security Lock & Authoritative Server Time:**
  - Before T-15 minutes (e.g. >15 min before match): Even if Admin enters Room ID early, credentials stay strictly locked on Supabase server.
  - Player sees dynamic card button: `✅ Joined • Room at T-15m`.
  - Tapping button opens dialog: *"🎟️ Match Entry Confirmed - Room ID & Password will be revealed 15 minutes before match starts"*.
  - Anti-Clock-Spoofing: Hardware monotonic time syncs with Supabase authoritative server time on every request and WebSocket heartbeat. Changing device clock has 0 impact.
  - Non-participants / unjoined users never see credentials (`HTTP 403 Forbidden`).

- [x] **4.2 Dropping Soon State (T-15 reached, credentials not yet set):**
  - When match enters 15-minute window before kickoff, but Admin has not yet entered credentials:
  - Card status badge displays `ROOM SOON`.
  - Action button dynamically shows: `⏳ Room ID Dropping Soon...`.
  - Tapping explains: *"⏳ Organizer is creating the Custom Room in Free Fire. The Room ID & Password will drop right here in a few moments!"*.

- [x] **4.3 Instant In-Place Pop-up Modal Reveal & 1-Tap Copy:**
  - When Admin publishes credentials and match is at or within T-15:
  - Card status badge flips to `ROOM OUT`.
  - Primary button transforms into: `🔑 Get Room ID & Password`.
  - Tapping opens the in-place `RoomCredentialsDialog.kt` modal dialog:
    - **Room ID** with 1-tap `Copy` button + haptic vibration.
    - **Password** with 1-tap `Copy` button + haptic vibration.
    - **"📋 Copy Both ID & Password"** button: copies both formatted as `"Room ID: XXX | Pass: YYY"` directly to clipboard for lightning-fast pasting into Free Fire.
    - Free Fire Joining Guide (3 steps).
    - `Done / Open Free Fire 🚀` button to dismiss.

- [x] **4.4 Automatic Match Kickoff Sweep:**
  - Background scheduler (`matchSweep.service.ts`) runs every 60s.
  - When match enters 15-minute window, sweeps status to `ROOM_REVEALED` and sends WebSocket broadcast.
  - When match time is reached, sweeps status from `ROOM_REVEALED` to `LIVE`.
