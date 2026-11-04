# 🧪 Module 05: Wallet Ledger, Deposits & Withdrawals

> **Target Screens:** `WalletScreen.kt`, `AdminWalletScreen.kt`, `wallet.service.ts`, `adminWallet.routes.ts`  
> **Target Role:** Player App (`:app-player`) & Admin App (`:app-admin`)  
> **Status:** ⏳ Testing in progress

---

### 📋 Checklist & Acceptance Criteria

- [ ] **5.1 Dual-Balance Display:**
  - Card 1: **Deposit Cash** (Non-withdrawable, used exclusively for entry fees).
  - Card 2: **Winning Cash** (Earned from tournament prizes & kills, 100% withdrawable to UPI).
  - Total Available Cash clearly computed.

- [ ] **5.2 Add Cash (Deposit Flow via UPI):**
  - Player selects ₹20, ₹50, ₹100 or enters custom amount (>= minDeposit).
  - Generates client-branded UPI Intent URL (`upi://pay?pa=...&pn=...`).
  - Player submits 12-digit UTR / Transaction Reference.
  - Status set to `PENDING`.
  - Rate limiting check: Max 3 deposit requests per minute per user.

- [ ] **5.3 Admin Review & 1-Click Deposit Approval:**
  - In Admin App (`AdminWalletScreen.kt`), deposit appears in "Pending Approvals" queue.
  - Shows Player Phone, IGN, Amount, UTR, and submission time.
  - 1-Click "Approve" button: Atomically credits player's `depositBalance`.
  - 1-Click "Reject" button: Prompts for rejection reason.

- [ ] **5.4 Withdrawal Flow:**
  - Player requests payout to their personal UPI ID (e.g. `gamer@okaxis`).
  - Validation: Withdrawal amount must be $\le$ `winningBalance`.
  - Atomically locks/deducts winning balance to prevent double-spending.
  - Rate limiting check: Max 2 withdrawal requests per minute per user.

- [ ] **5.5 Admin Withdrawal Approval & Payout:**
  - Admin reviews pending withdrawal request.
  - Admin copies player UPI ID, transfers funds, and enters payout UTR.
  - Status updates to `APPROVED` $\rightarrow$ Double-entry ledger logs `WITHDRAWAL` transaction.

- [ ] **5.6 Transaction History & Double-Entry Ledger:**
  - Realtime history list: Deposits (Green +), Entry Fees (Red -), Winnings (Green +), Withdrawals (Orange -).
  - Strict audit invariant verified: Current Balance = Total Credits - Total Debits.
