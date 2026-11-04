# 🧪 Module 07: Admin Match Operations, Cloning & Daily Settlement

> **Target Screens:** `AdminCreateMatchScreen.kt`, `AdminMatchManagerScreen.kt`, `AdminSettlementScreen.kt`, `AdminStaffScreen.kt`, `AdminSettingsScreen.kt`  
> **Target Role:** Admin App (`:app-admin`)  
> **Status:** ⏳ Testing in progress

---

### 📋 Checklist & Acceptance Criteria

- [ ] **7.1 Create Free Fire Match (`AdminCreateMatchScreen.kt`):**
  - Mode: Battle Royale vs Clash Squad.
  - Type: Solo (48), Duo (24 teams), Squad (12 teams).
  - Map: Bermuda, Purgatory, Kalahari, Alpine.
  - Financials: Entry Fee (₹), Prize Pool (₹), Per Kill Prize (₹).
  - Match Schedule: Future Date & Time picker.
  - Creates tournament with `UPCOMING` / `OPEN` status and populates slot grid.

- [ ] **7.2 1-Tap Match Cloning (`AdminMatchManagerScreen.kt`):**
  - "📑 Clone Match" button on existing match cards.
  - Quick dialog: "+1 Hour" and "Tomorrow" chips.
  - Clones all settings (mode, map, entry fee, prizes, 48 slots) into a new `UPCOMING` match in under 2 seconds.

- [ ] **7.3 1-Click Match Cancellation & Auto-Refund:**
  - "🛑 Cancel & Refund" button on active match card.
  - Input cancellation reason (e.g. "Server maintenance").
  - Atomically refunds 100% of entry fees back to every registered player's wallet.
  - Flips match status to `CANCELLED`.

- [ ] **7.4 Staff Management & Dynamic Role Delegation (`AdminStaffScreen.kt`):**
  - Owner creates Sub-Admin staff member (Name, Phone, Password).
  - Granular permission checkboxes:
    - `canCreateMatch`: Toggles "Create Match" card.
    - `canUpdateRoomId`: Toggles "Publish Room ID" card.
    - `canDistributePrize`: Toggles "Spectator Scorer" card.
    - `canManageWallet`: Toggles "Wallet Console" card.
  - Dynamic Compose UI: Staff logging in only sees cards for enabled permissions.

- [ ] **7.5 App Settings & Dynamic UPI (`AdminSettingsScreen.kt`):**
  - Live editing of collecting UPI ID, Payee Name, Support WhatsApp number, and Minimum Deposit.
  - Player apps immediately reflect the new UPI ID without needing APK recompile.

- [ ] **7.6 Daily Settlement Console (`AdminSettlementScreen.kt`):**
  - Date Picker / "Today" shortcut.
  - KPI Cards: Total Collections (Deposits + Entry Fees), Total Payouts (Withdrawals + Prizes), Net Organizer Margin, Platform Cut (10%).
  - Reconciliation summary: Count of deposits, withdrawals, and ledger rows.
  - "↓ Share / Download CSV": Exports daily transaction ledger for accounting.
