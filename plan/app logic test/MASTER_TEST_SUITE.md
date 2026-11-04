# 🧪 Master App Logic & Functional Verification Suite

> **Target Directory:** `C:\Free Fire turnament\plan\app logic test\`  
> **Philosophy:** **"Pehle Feature & Speed 100% Solid, Fir Production Security Lock"**  
> **Strategy:** Sabse pehle poore app ke har ek feature aur screen ko order-wise test karenge, speed optimize karenge (fast & snappy UI/API), aur bugs ko live fix karenge. Jab 100% feature pass ho jayenge, tab hum final security aur cloud deploy karenge.  
> **Target Devices:** Physical Realme P3 5G (`6103d5c2`) + Backend Node.js Port 5000 + Supabase PostgreSQL.

---

## 📋 Order-Wise Test Modules

| Step | Test Module File | What is Tested | Status |
| :---: | :--- | :--- | :---: |
| **01** | [`01_Auth_Profile_and_Theme.md`](./01_Auth_Profile_and_Theme.md) | Player/Admin Login, Profile Edit (IGN/UID), Device Trust Badge, OLED Dark $\leftrightarrow$ Light Theme Toggle | ✅ **PASSED** |
| **02** | [`02_Tournament_Feed_and_Filters.md`](./02_Tournament_Feed_and_Filters.md) | Active vs Completed Tabs, Solo/Duo/Squad Chips, Live Slot Counter, Pull-to-Refresh Speed & In-Memory Feed Cache | ✅ **PASSED** |
| **03** | [`03_Slot_Booking_and_Concurrency.md`](./03_Slot_Booking_and_Concurrency.md) | Direct "⚡ Join Match" Bottom Sheet, Auto-Slot Engine, FF Identity Validation, Wallet Sufficiency & Slide-to-Join | ✅ **PASSED** |
| **04** | [`04_Room_Locker_and_Timed_Reveal.md`](./04_Room_Locker_and_Timed_Reveal.md) | T-15 Countdown Security Lock, Dropping Soon State, In-Place Pop-up Modal, 1-Click Copy Room ID & Password | ✅ **PASSED** |
| **05** | [`05_Wallet_Deposits_and_Withdrawals.md`](./05_Wallet_Deposits_and_Withdrawals.md) | Deposit UPI QR / Intent, UTR Submit, Admin 1-Click Approve/Reject, Withdrawal UPI Request & Double-Entry Ledger | ⏳ **NEXT UP** |
| **06** | [`06_Spectator_Scorer_and_1Click_Payout.md`](./06_Spectator_Scorer_and_1Click_Payout.md) | 48-Player Spectator Sheet, Kill Counters, Rank Pick, Anti-Hacker Disqualify, 1-Click Payout Math to Winning Wallet | ⏳ Ready |
| **07** | [`07_Admin_Match_Ops_Cloning_and_Settlement.md`](./07_Admin_Match_Ops_Cloning_and_Settlement.md) | Create Match, 1-Tap Clone Match (+1 Hr/Tomorrow), Cancel & Auto-Refund All Seats, Daily Settlement KPIs & CSV Download | ⏳ Ready |
| **08** | [`08_App_Speed_and_Performance_Audit.md`](./08_App_Speed_and_Performance_Audit.md) | Jetpack Compose Recomposition Lag, Coil Image Cache, API Response Latency (WAN vs Cache), Cold Launch Time | ⏳ Ready |

---

## ⚡ Execution Rule
1. Har module ko live device par test karenge.
2. Agar koi bug ya UI lag milta hai, to **usi waqt code me fix karenge**.
3. Fix hone ke baad check box ko `[x] PASS` mark karenge.
4. Jab 01 se 08 tak saare pass ho jayenge, tab hum production cloud deploy karenge.
