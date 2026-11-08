# 🎮 Phase 4 — Match Operations (Create · Publish · Reveal · Scorer · Manage)

> **Goal:** Admin app ke match features browser me — parity + ek canonical payout flow.
>
> **Location:** `admin-web/src/screens/matches/`, `admin-web/src/screens/scorer/`
> **Status:** PAUSED — Phase 3–7 baad me (Phase 1–2 auth already done & verified)

---

## 📋 Checklist

### 🔹 Stage 1: Create Match
- [ ] **1.1** Map (Bermuda / Purgatory / Kalahari / Alpine), Mode (Solo / Duo / Squad),
      slots (12–48), entry fee, prize pool, per-kill, match type.
- [ ] **1.2** IST date read-only + Material-style time picker (AM/PM), live preview
      `05 Nov 2026, 08:00 PM IST` + `starts in 2h 15m`, quick chips
      +1h/+3h/+6h/+12h/+24h.
- [ ] **1.3** Visibility window: Always visible / Only near start (1–336h) + preview.
- [ ] **1.4** Room reveal window: 5m/15m/30m/1h/2h/6h/12h/24h + custom + preview.
- [ ] **1.5** Auto title note: "#N <Map> • <Mode> backend generate karega —
      title field nahi."
- [ ] **1.6** Validation + submit → success toast + matches list refresh
      (realtime MATCH_CREATED se bhi).

### 🔹 Stage 2: Publish Room
- [ ] **2.1** `publishable=true` list (UPCOMING/OPEN/SLOTS_FULL/ROOM_REVEALED, 1h grace),
      empty state + refresh.
- [ ] **2.2** Room ID + password inputs, reveal state card, timing chips,
      "Reveal to players immediately" switch, "Reveal Now" action.
- [ ] **2.3** Copy room credentials + WhatsApp share text (player ke liye nahi —
      staff ke liye).

### 🔹 Stage 3: Live Scorer → Match Roster merge (canonical flow)
- [ ] **3.1 Decision:** **canonical payout = match roster** (per-player awards,
      budget-checked, idempotent). Scorer route sirf roster screen pe le jaye —
      duplicate UI hatao.
- [ ] **3.2** Match picker: LIVE tab + "Unscored backlog" (REVIEW) tab, search.
- [ ] **3.3** **Match control screen** (ek jagah sab):
      - match header: `#N Map • Mode`, IST time, status, seats, entry, prize pool
      - participants table: slot, player code, IGN, FF UID, rank, kills, reward
        preview, cheat flags, DQ + reason
      - search + filter (all / unpaid / flagged / DQ)
      - bulk actions: mark all done, clear rank, export CSV
      - **Save results & Complete match** (confirm dialog, prize preview,
        total paid summary)
- [ ] **3.4** Ban from roster (reason + ban account vs match-only) — existing
      PATCH endpoint.
- [ ] **3.5** Double-submit guard + server idempotency; "already paid" rows clearly
      marked.
- [ ] **3.6** Old `POST /tournaments/:id/payout` aur `/finish` UI se hide;
      endpoints backend pe rahenge (Android app ke liye), web sirf roster flow.

### 🔹 Stage 4: Manage Matches
- [ ] **4.1** Tabs: LIVE / UPCOMING / HISTORY, search by match number/map/mode.
- [ ] **4.2** Card: `#N Map • Mode`, IST time, status badge, seats, entry,
      prize pool, visibility status (`👁 Listed` / `Hidden — lists at …`),
      room status (`set / hidden / revealed / not published`).
- [ ] **4.3** Actions: Open Roster, Publish Room, Visibility Window dialog,
      Room Reveal dialog, Clone (date +1h/+1d), Cancel & Refund (reason ≥5 chars),
      End Match (link to roster).
- [ ] **4.4** Sweep Lifecycle Now button + result summary + auto refresh.
- [ ] **4.5** History: completed/cancelled with settlement notes, clone allowed.
- [ ] **4.6** Empty states for each tab with next action.

### 🔹 Stage 5: Verification
- [ ] Create → player feed pe appear (visibility window respect).
- [ ] Publish → reveal → player app sees credentials (existing behavior intact).
- [ ] Roster payout → ledger `WINNING_PRIZE` + COMPLETED + double payout blocked.
- [ ] Cancel → refunds + CANCELLED.
- [ ] Clone → fresh UPCOMING with inherited settings.
- [ ] Permission matrix: `canCreateMatch` / `canUpdateRoomId` / `canDistributePrize`
      ke bina respective action blocked (UI + server).
- [ ] Plan ticks.

---

## 🎯 Acceptance

- Admin app ke saare match features web pe available.
- Ek hi payout flow (roster) — confusion khatam.
- Sabhi times IST 12-hour, auto match number, no manual title.
- Money actions double-submit safe.
