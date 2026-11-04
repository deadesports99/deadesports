# 🧪 Module 01: Auth, Profile & Dual-Theme System

> **Target Screens:** `LoginRegisterScreen.kt`, `ProfileScreen.kt`, `Theme.kt`, `auth.service.ts`  
> **Target Role:** Player App (`:app-player`) & Admin App (`:app-admin`)  
> **Status:** ✅ COMPLETED & VERIFIED ON REALME P3 5G

---

### 📋 Checklist & Acceptance Criteria

- [x] **1.1 Player Google 1-Tap & Phone Login:**
  - Google Sign-In with official SHA-1/OAuth Web Client ID.
  - Backend verifies Firebase ID Token, issues JWT, and fetches `/auth/me`.
  - Auto-redirects seamlessly to Matches Feed.

- [x] **1.2 Player Device Lock & Anti-Fraud Security:**
  - Max 2 accounts per physical mobile device enforced for fraud prevention.
  - Developer physical phone (`1d24b2b7de7dafdb`) whitelisted for testing.
  - Tracked in `plan/PRODUCTION_CLOUD_EXECUTION_PLAN.md` for pre-launch cleanup.

- [x] **1.3 Profile Screen & Trust Badge:**
  - Shows Google Account Name, Email (`aototata@gmail.com`) with 1-tap Copy button.
  - Shows Login Method badge (`🚀 Google Account`).
  - Physical Phone Trust Badge: `✅ Verified Mobile Device` renders in green.
  - Redundant Free Fire profile editor removed from Profile screen (streamlined to tournament joining sheet).

- [x] **1.4 Game Profile Input on Match Booking:**
  - Free Fire IGN & numeric UID are captured directly in the match join slot sheet (`SlotPickerScreen.kt`) before entry fee deduction.

- [x] **1.5 Career Stats Display:**
  - Clean responsive grid for Matches Joined, Matches Played, Booyah Wins, Total Kills, Total Winnings, and Best Rank.

- [x] **1.6 Dual-Theme System (Speed & Smoothness):**
  - Switch between **Light Mode** and **Dark Mode** is instantaneous with zero activity recreation lag.
  - Preference persists in Android Jetpack DataStore across app restarts.
