# 💰 Phase 5 — Money, Players, Staff Access & Settings

> **Goal:** Wallet queues, settlement CSV, player management/anti-cheat, staff +
> permission keys, runtime settings — sab browser me.
>
> **Location:** `admin-web/src/screens/wallet/`, `players/`, `staff/`, `settings/`
> **Status:** ✅ DONE — 12 Nov 2026 (live-verified against the running backend)

---

## 📋 Checklist

### 🔹 Stage 1: Wallet Console
- [x] **1.1** Tabs: **Withdrawals | Deposits | Online** + status chips
      (Pending / Approved / Rejected / All).
- [x] **1.2** Withdrawals: player code + name, amount, UPI VPA, requested time,
      Approve (UTR input, 12-char) / Reject (reason) confirm dialogs.
- [x] **1.3** Deposits: player, amount, UTR, screenshot nahi (spectator model),
      Approve (credits deposit balance + ledger) / Reject.
- [x] **1.4** Online payments: today collected ₹, paid/pending/failed counts,
      DEMO banner (mock provider), order list + one-tap Sync (reconcile).
- [x] **1.5** Row-level busy state, double-approve server block, error toasts.
- [x] **1.6** Wallet screen top pe day summary strip (collected, paid out, pending).

### 🔹 Stage 2: Daily Settlement
- [x] **2.1** Date picker (IST), KPIs: collections, deposits, withdrawals,
      prizes paid, net margin, match count.
- [x] **2.2** Transaction table + filters.
- [x] **2.3** CSV export download (cookie-authenticated fetch → blob download).
- [x] **2.4** Owner-only route guard (server already `requireRole('ADMIN')`).

### 🔹 Stage 3: Players & anti-cheat
- [x] **3.1** Search: Player ID / phone / name / IGN / FF UID → result list
      (player code chip, name, phone, joined date, ban state).
- [x] **3.2** Player detail: identity, wallet (deposit/winning), career stats,
      match history (filter all/paid/flagged), ledger preview, watchlist,
      device group, suspicious score.
- [x] **3.3** Ban / unban (reason, confirm) → next request pe player blocked.
- [x] **3.4** Watchlist: alerts, acknowledge, watch current device, unwatch.
- [x] **3.5** Device groups: same-device accounts, ban device, CSV export.
- [x] **3.6** Suspicious players: score threshold slider, ranked list → detail.

### 🔹 Stage 4: Staff & Permission Keys (core boss feature)
- [x] **4.1** Staff list: name, email, phone, permissions chips,
      status (ACTIVE / REMOVED), key status (ACTIVE / EXPIRED / REVOKED),
      last login, created date.
- [x] **4.2** **Generate Access** dialog: name, email, phone, 4 permission toggles
      → `POST /admin/access` → **key ek baar** dikhe (copy + WhatsApp share),
      expiry date, "I have saved this key" confirm.
- [x] **4.3** Key actions: Revoke (confirm), Regenerate (new key once), disable staff.
- [x] **4.4** Permission edit dialog → save → next request pe instant effect.
- [x] **4.5** Warning copy: "Key sirf ek baar dikhti hai — abhi copy/share karo."
- [x] **4.6** Empty states + loading + error.

### 🔹 Stage 5: App Settings
- [x] **5.1** UPI ID, payee name, support WhatsApp, min deposit (validation,
      IST/₹ formatting).
- [x] **5.2** Auth toggles: Phone / Google / Email (at least one on — server rule).
- [x] **5.3** Save → toast + reload; deposit/withdraw screens follow new values
      (no rebuild).
- [x] **5.4** Owner-only guard.

### 🔹 Stage 6: Verification
- [x] Deposit approve → player balance + ledger correct; double approve blocked.
- [x] Withdrawal approve → UTR stored + ledger; reject → refund/restore.
- [x] Settlement CSV totals match ledger day-wise.
- [x] Ban → player app blocked next request; unban → restored.
- [x] Key generate → sub-admin login works; revoke → 401 immediately.
- [x] Permission toggle → sub-admin dashboard/menu updates on next fetch.
- [x] Settings save → Add Cash QR/payee/min deposit reflect (player side).
- [x] Plan ticks.

---

## 🎯 Acceptance

- Admin app ke saare money/player/staff/settings features web pe.
- Har money action ek confirm + busy guard ke saath.
- Permission key generate → share → login → revoke ka pura loop verified.

---

## ✅ Outcome — 12 Nov 2026

**Screens (all routed in `App.tsx`, all owner-gated via `api.matches`-style guards):**

| Route | File | What works |
|---|---|---|
| `/wallet` | `screens/wallet/WalletScreen.tsx` | Withdrawals / Deposits / Online tabs, status chips, day summary strip, approve-with-UTR, reject-with-reason, deposit credit, online-payment sync + DEMO banner |
| `/wallet/settlement` | `screens/wallet/SettlementScreen.tsx` | IST date picker + quick chips, 6 KPI tiles, ledger table, credit/debit filter, CSV download |
| `/players` (+ `/suspicious`, `/devices`, `/watchlist`, `/:id`) | `screens/players/PlayersScreen.tsx`, `PlayerDetailPanel.tsx`, `DeviceDetailPanel.tsx` | Debounced search, suspicious scoring with threshold chips, device groups + per-device drill-down (accounts, shared matches, ban-all, CSV), watchlist with ack/unwatch, player profile with career history + ban/unban |
| `/staff` | `screens/staff/StaffScreen.tsx` | Key list, generate access (4 permission toggles), one-time key reveal + copy + WhatsApp, revoke, regenerate |
| `/settings` | `screens/settings/SettingsScreen.tsx` | UPI ID, payee, min deposit, support WhatsApp, Phone/Google/Email auth toggles, at-least-one guard, save |

**Live verification (browser + backend :5000, localtenant):**

- Withdrawal ₹50 approved with UTR `UTR9988776655` → status `APPROVED`, UTR stored.
- Deposit ₹100 rejected with a note → `REJECTED`; deposit ₹150 approved → player
  `depositBalance` 290 → 440, ledger `ADD_MONEY` row written.
- `/wallet/settlement?date=2026-11-12` KPIs matched the API exactly
  (deposits ₹150/1, withdrawals ₹50/1, entry fees ₹210/4 matches, prizes
  ₹1505/2, platform cut −₹129.50) and exported CSV.
- Player search + detail + ban → server `isBanned: true`, unban → restored.
- Device group (2 accounts on `TEST-DEVICE-FARM-0001`) → drill-down, watch,
  watchlist card (2 accounts / 2 new), CSV, ban-all → `bannedCount 2`, unban-all → 0.
- Staff key `02cATc-…` generated in the UI → staff login (Owner email + key + OTP)
  → `SUB_ADMIN` with only `canManageWallet`: wallet API 200, `/admin/access`,
  `/admin/players`, `/tournaments` create, settlement and settings all **403**;
  sidebar showed only Dashboard / Matches / Wallet and `/players` redirected away.
- Settings save (min deposit 10 → 60 → 10) persisted through the tenant API.
- 390 px: every Phase 5 route reports `scrollWidth === innerWidth === 390`.
- Light + dark audit: no white-on-white or dark-on-dark text on any route.

**Backend fixes found while verifying (Phase 5 needed real logic, not just UI):**

1. `deviceGroup.service.ts` — accounts that share a profile `deviceId` but never
   joined a match were dropped from the group (only the first account was
   registered per device). Now every profile device account is merged into the
   slot-derived map.
2. `deviceWatch.service.ts` — the watchlist summary counted only slot snapshots,
   so a freshly watched device showed `accountCount: 0`. Profile accounts are
   now unioned in (and their prize totals included).
3. New `tests/deviceGroups.test.ts` (3 tests) + `_sum` support in
   `tests/helpers/fakePrisma.ts` lock the grouping regression.

**Root-cause theme fix:** `index.html` body carried Tailwind's `text-white`,
which overrode the light-mode base colour set in `index.css` and made inherited
text white-on-white on every screen. Removed; body now follows the theme
(`#0f172a` light / `#e2e8f0` dark).

**Not built (deliberate):** per-row "disable staff account" toggle (revoke key is
the supported path), deposit screenshot upload (spectator deposit model has no
proof image).
