# 🧪 Module 06: Spectator Scoring & 1-Click Payout Engine

> **Target Screens:** `AdminSpectatorScorerScreen.kt`, `result.service.ts`, `result.controller.ts`  
> **Target Role:** Admin App (`:app-admin`)  
> **Status:** ⏳ Testing in progress

---

### 📋 Checklist & Acceptance Criteria

- [ ] **6.1 Spectator Participant List (48 Players):**
  - Renders all 48 registered players with their Slot Number, IGN, and UID.
  - Search / filter by IGN or Slot Number.

- [ ] **6.2 Kill Counter & Rank Selection:**
  - Rapid `+` / `-` buttons to increment/decrement verified kills per player.
  - Rank dropdown / picker (Rank 1 Booyah, Rank 2, Rank 3... 48).
  - Quick validation: No duplicate ranks for non-disqualified players.

- [ ] **6.3 Anti-Hacker / Disqualification Toggle:**
  - "Disqualify" toggle with reason input (e.g. "Hacking", "Teaming", "No-show").
  - Disqualified players receive ₹0 prize pool and ₹0 kill earnings.

- [ ] **6.4 1-Click Automated Payout Calculation:**
  - Admin/Moderator taps "Distribute Prizes & Complete Match".
  - Backend calculates:
    $$\text{Prize} = (\text{Prize Pool} \times \text{Rank \%}) + (\text{Kills} \times \text{Per-Kill Reward})$$
  - Disburses atomically to each player's `winningBalance`.
  - Creates individual `WINNING_PRIZE` ledger records.
  - Flips match status to `COMPLETED`.

- [ ] **6.5 Financial Reconciliation:**
  - Total Entry Fees Collected = Total Prizes Paid + Organizer Net Margin.
  - Payout executes in under 2 seconds for all 48 players.
