# 💰 Phase 5 — Money, Players, Staff Access & Settings

> **Goal:** Wallet queues, settlement CSV, player management/anti-cheat, staff +
> permission keys, runtime settings — sab browser me.
>
> **Location:** `admin-web/src/screens/wallet/`, `players/`, `staff/`, `settings/`
> **Status:** PAUSED — Phase 3–7 baad me (Phase 1–2 auth already done & verified)

---

## 📋 Checklist

### 🔹 Stage 1: Wallet Console
- [ ] **1.1** Tabs: **Withdrawals | Deposits | Online** + status chips
      (Pending / Approved / Rejected / All).
- [ ] **1.2** Withdrawals: player code + name, amount, UPI VPA, requested time,
      Approve (UTR input, 12-char) / Reject (reason) confirm dialogs.
- [ ] **1.3** Deposits: player, amount, UTR, screenshot nahi (spectator model),
      Approve (credits deposit balance + ledger) / Reject.
- [ ] **1.4** Online payments: today collected ₹, paid/pending/failed counts,
      DEMO banner (mock provider), order list + one-tap Sync (reconcile).
- [ ] **1.5** Row-level busy state, double-approve server block, error toasts.
- [ ] **1.6** Wallet screen top pe day summary strip (collected, paid out, pending).

### 🔹 Stage 2: Daily Settlement
- [ ] **2.1** Date picker (IST), KPIs: collections, deposits, withdrawals,
      prizes paid, net margin, match count.
- [ ] **2.2** Transaction table + filters.
- [ ] **2.3** CSV export download (cookie-authenticated fetch → blob download).
- [ ] **2.4** Owner-only route guard (server already `requireRole('ADMIN')`).

### 🔹 Stage 3: Players & anti-cheat
- [ ] **3.1** Search: Player ID / phone / name / IGN / FF UID → result list
      (player code chip, name, phone, joined date, ban state).
- [ ] **3.2** Player detail: identity, wallet (deposit/winning), career stats,
      match history (filter all/paid/flagged), ledger preview, watchlist,
      device group, suspicious score.
- [ ] **3.3** Ban / unban (reason, confirm) → next request pe player blocked.
- [ ] **3.4** Watchlist: alerts, acknowledge, watch current device, unwatch.
- [ ] **3.5** Device groups: same-device accounts, ban device, CSV export.
- [ ] **3.6** Suspicious players: score threshold slider, ranked list → detail.

### 🔹 Stage 4: Staff & Permission Keys (core boss feature)
- [ ] **4.1** Staff list: name, email, phone, permissions chips,
      status (ACTIVE / REMOVED), key status (ACTIVE / EXPIRED / REVOKED),
      last login, created date.
- [ ] **4.2** **Generate Access** dialog: name, email, phone, 4 permission toggles
      → `POST /admin/access` → **key ek baar** dikhe (copy + WhatsApp share),
      expiry date, "I have saved this key" confirm.
- [ ] **4.3** Key actions: Revoke (confirm), Regenerate (new key once), disable staff.
- [ ] **4.4** Permission edit dialog → save → next request pe instant effect.
- [ ] **4.5** Warning copy: "Key sirf ek baar dikhti hai — abhi copy/share karo."
- [ ] **4.6** Empty states + loading + error.

### 🔹 Stage 5: App Settings
- [ ] **5.1** UPI ID, payee name, support WhatsApp, min deposit (validation,
      IST/₹ formatting).
- [ ] **5.2** Auth toggles: Phone / Google / Email (at least one on — server rule).
- [ ] **5.3** Save → toast + reload; deposit/withdraw screens follow new values
      (no rebuild).
- [ ] **5.4** Owner-only guard.

### 🔹 Stage 6: Verification
- [ ] Deposit approve → player balance + ledger correct; double approve blocked.
- [ ] Withdrawal approve → UTR stored + ledger; reject → refund/restore.
- [ ] Settlement CSV totals match ledger day-wise.
- [ ] Ban → player app blocked next request; unban → restored.
- [ ] Key generate → sub-admin login works; revoke → 401 immediately.
- [ ] Permission toggle → sub-admin dashboard/menu updates on next fetch.
- [ ] Settings save → Add Cash QR/payee/min deposit reflect (player side).
- [ ] Plan ticks.

---

## 🎯 Acceptance

- Admin app ke saare money/player/staff/settings features web pe.
- Har money action ek confirm + busy guard ke saath.
- Permission key generate → share → login → revoke ka pura loop verified.
