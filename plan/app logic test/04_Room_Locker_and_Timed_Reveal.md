# 🧪 Module 04: Room Locker & Timed Reveal Automation

> **Target Screens:** `RoomDetailsScreen.kt`, `AdminPublishRoomScreen.kt`, `room.service.ts`, `matchSweep.service.ts`  
> **Target Role:** Player App (`:app-player`) & Admin App (`:app-admin`)  
> **Status:** ⏳ Testing in progress

---

### 📋 Checklist & Acceptance Criteria

- [ ] **4.1 T-15 Countdown Security Lock:**
  - Before T-15 minutes (e.g. 1 hour before match): Room ID and Password are encrypted/locked.
  - Player sees live countdown timer: *"Room ID reveals in XX:XX"*.
  - Unregistered users or non-participants attempting to fetch room credentials receive `HTTP 403 Forbidden`.

- [ ] **4.2 Admin Publish Custom Room:**
  - In Admin App (`AdminPublishRoomScreen.kt`), Admin or Sub-Admin with `canUpdateRoomId` enters Room ID & Password.
  - Taps "Publish Room Credentials" $\rightarrow$ Match status flips to `ROOM_REVEALED`.

- [ ] **4.3 Instant Room Reveal & 1-Tap Copy:**
  - Confirmed slot holders receive push alert / in-app unlock.
  - Displays Custom Room ID and Password with 1-tap "Copy" buttons.
  - Haptic feedback on copy.

- [ ] **4.4 Automatic Match Kickoff Sweep:**
  - Background scheduler (`matchSweep.service.ts`) runs every 60s.
  - When clock reaches Match Time, status automatically flips from `ROOM_REVEALED` to `LIVE`.
