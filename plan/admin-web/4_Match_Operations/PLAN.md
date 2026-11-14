# 🎮 Phase 4 — Match Operations (Create · Publish · Reveal · Scorer · Manage)

> **Goal:** Admin app ke match features browser me — parity + ek canonical payout flow.
>
> **Location:** `admin-web/src/screens/matches/`, `admin-web/src/screens/scorer/`
> **Status:** ✅ DONE — 12 Nov 2026. Browser parity live-tested against the local backend.

---

## 📋 Checklist

### 🔹 Stage 1: Create Match
- [x] **1.1** Map (Bermuda / Purgatory / Kalahari / Alpine), Mode (Solo / Duo / Squad),
      slots (12–48), entry fee, prize pool, per-kill, match type.
- [x] **1.2** IST date read-only + Material-style time picker (AM/PM), live preview
      `05 Nov 2026, 08:00 PM IST` + `starts in 2h 15m`, quick chips
      +1h/+3h/+6h/+12h/+24h.
- [x] **1.3** Visibility window: Always visible / Only near start (1–336h) + preview.
- [x] **1.4** ~~Room reveal window chips~~ — dropped: publishing the room **is** the reveal
      (backend stamps `roomRevealedAt`), so a timer would be a second source of truth.
- [x] **1.5** Auto title note: "#N <Map> • <Mode> backend generate karega —
      title field nahi."
- [x] **1.6** Validation + submit → success toast + matches list refresh
      (realtime MATCH_CREATED se bhi).

### 🔹 Stage 2: Publish Room
- [x] **2.1** `publishable=true` list (UPCOMING/OPEN/SLOTS_FULL/ROOM_REVEALED, 1h grace),
      empty state + refresh.
- [x] **2.2** Room ID + password inputs, reveal state card, timing chips,
      "Reveal to players immediately" switch, "Reveal Now" action.
- [x] **2.3** Copy room credentials + WhatsApp share text (player ke liye nahi —
      staff ke liye).

### 🔹 Stage 3: Live Scorer → Match Roster merge (canonical flow)
- [x] **3.1 Decision:** **canonical payout = match roster** (per-player awards,
      budget-checked, idempotent). Scorer route sirf roster screen pe le jaye —
      duplicate UI hatao.
- [x] **3.2** Match picker: LIVE tab + "Unscored backlog" (REVIEW) tab, search.
- [x] **3.3** **Match control screen** (ek jagah sab):
      - match header: `#N Map • Mode`, IST time, status, seats, entry, prize pool
      - participants table: slot, player code, IGN, FF UID, rank, kills, reward
        preview, cheat flags, DQ + reason
      - search + filter (all / unpaid / flagged / DQ)
      - bulk actions: mark all done, clear rank, export CSV
      - **Save results & Complete match** (confirm dialog, prize preview,
        total paid summary)
- [x] **3.4** Ban from roster (reason + ban account vs match-only) — existing
      PATCH endpoint.
- [x] **3.5** Double-submit guard + server idempotency; "already paid" rows clearly
      marked.
- [x] **3.6** Old `POST /tournaments/:id/payout` aur `/finish` UI se hide;
      endpoints backend pe rahenge (Android app ke liye), web sirf roster flow.

### 🔹 Stage 4: Manage Matches
- [x] **4.1** Tabs: LIVE / UPCOMING / HISTORY, search by match number/map/mode.
- [x] **4.2** Card: `#N Map • Mode`, IST time, status badge, seats, entry,
      prize pool, visibility status (`👁 Listed` / `Hidden — lists at …`),
      room status (`set / hidden / revealed / not published`).
- [x] **4.3** Actions: Open Roster, Publish Room, Visibility Window dialog,
      Room Reveal dialog, Clone (date +1h/+1d), Cancel & Refund (reason ≥5 chars),
      End Match (link to roster).
- [x] **4.4** Sweep Lifecycle Now button + result summary + auto refresh.
- [x] **4.5** History: completed/cancelled with settlement notes, clone allowed.
- [x] **4.6** Empty states for each tab with next action.

### 🔹 Stage 5: Verification
- [x] Create → player feed pe appear (visibility window respect).
- [x] Publish → reveal → player app sees credentials (existing behavior intact).
- [x] Roster payout → ledger `WINNING_PRIZE` + COMPLETED + double payout blocked.
- [x] Cancel → refunds + CANCELLED.
- [x] Clone → fresh UPCOMING with inherited settings.
- [x] Permission matrix: `canCreateMatch` / `canUpdateRoomId` / `canDistributePrize`
      ke bina respective action blocked (UI + server).
- [x] Plan ticks.

---

## 🎯 Acceptance

- Admin app ke saare match features web pe available.
- Ek hi payout flow (roster) — confusion khatam.
- Sabhi times IST 12-hour, auto match number, no manual title.
- Money actions double-submit safe.

---

## ✅ Outcome (12 Nov 2026)

Built and live-verified in the Orca browser against the local backend (`:5000`) +
admin web (`:5174`):

- `CreateMatchScreen` — map/mode/slots/fees, IST 12-hour picker with +1h…+24h chips,
  visibility window with "players see it from" preview, live card preview, auto title.
- `PublishRoomScreen` — publishable list, room ID/password, reveal-on-save, copy +
  WhatsApp share, "published but nobody joined yet" warning.
- `MatchesScreen` — LIVE/UPCOMING/HISTORY tabs, search, visibility/clone/cancel+refund
  dialogs, sweep-now with result toast.
- `MatchControlScreen` — roster table (rank/kills/DQ), prize preview, ban dialog,
  CSV export, save-results-only vs save-&-complete, room credential strip.
- `ScorerPickerScreen` — LIVE tab + unscored backlog.

Verified end-to-end: create → appears in list (`#7`), publish room (status
`ROOM_REVEALED`), roster payout (`₹1,100` = rank 1 + 4 kills, status `COMPLETED`,
payout locked after), save-results-only pays but keeps status (`₹405`), clone
(`#8`, +1 day), cancel+refund (`CANCELLED`), sweep (`0 matches`), CSV download,
visibility toggle (`visibilityHours: 10 → null`). Light + dark themes and 390px
mobile checked; build clean (`tsc` strict + Vite).

Phase 4 added **no backend changes** — every endpoint and the payout math already
existed and stayed green in the 423-test suite.
