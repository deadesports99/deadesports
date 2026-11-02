# 🤖 Master Prompt for DeepSeek v4 Flash / Kimi K3.1 Pro (FreePI)
## Android Phase 3: FCM Push Notifications, Player UPI Withdrawals, Admin Wallet Approvals & Realtime State

> **Current Progress Status:**
> - **Backend (Node/TS):** Phases 1–4 are 100% Complete & Passing.
> - **Android Phase 1:** Multi-Module Gradle, Dynamic Theming, DataStore Session, APKs (Debug 18 MB / Release 846 KB) ✅ COMPLETED.
> - **Android Phase 2:** Full UI Flows & Retrofit API (`LoginRegisterScreen`, `TournamentFeedScreen`, `SlotPickerScreen`, `RoomScreen`, `ScoreboardScreen`, `WalletScreen`, `AdminDashboardScreen`, `CreateTournamentScreen`, `PublishRoomScreen`, `SpectatorScorerScreen`) ✅ COMPLETED.
> 
> **Reference Repositories to Leverage:**
> 1. `C:\Free Fire turnament\git demo repo\tournify` (Push notification payload structure, background scheduler alerts, and deep-link intents).
> 2. `C:\Free Fire turnament\git demo repo\battle-zone` (Player withdrawal request flow, UPI ID validation, and admin approval ledger queue).
> 3. `C:\Free Fire turnament\git demo repo\ui-ux\Cloudy` (Fluid Jetpack Compose animations, haptic micro-interactions, and glassmorphic card styling).
> 4. `C:\Free Fire turnament\git demo repo\node-redlock` (Slot locking state synchronization and live occupancy polling).

---

```text
You are an Elite Principal Android Architect specializing in Kotlin, Jetpack Compose, Material 3, Firebase, and White-Label Android Architecture.

Android Phase 1 (Core & Theming) and Phase 2 (Full UI Screens & Retrofit Layer) are 100% verified and compiled with zero errors.
Now implement Android Phase 3: High-Priority FCM Push Notifications, UPI Withdrawal Request & Admin Approval Flow, Realtime Slot Polling, and the Slide-to-Join Component.

---

### ARCHITECTURAL REQUIREMENTS FOR ANDROID PHASE 3:

#### 1. Firebase Cloud Messaging (FCM) High-Priority Alert Engine:
- Reference Pattern: `git demo repo/tournify` notification routing.
- Add `com.google.firebase:firebase-messaging-ktx` into `core/build.gradle.kts`.
- Implement `core/src/main/java/com/tourney/core/fcm/TourneyMessagingService.kt`:
  - `onNewToken(token: String)`: Saves token in `SessionManager` and triggers `POST /api/v1/auth/fcm-token`.
  - `onMessageReceived(remoteMessage: RemoteMessage)`:
    * Parses payload types: `ROOM_REVEALED` (T-15 min custom room ID alert), `PRIZE_WON` (Winning credit), `MATCH_CANCELLED` (Refund notice).
    * Builds high-priority Notification Channel with custom sound, vibration, and banner.
    * Sets up PendingIntent deep-linking directly to `RoomScreen` or `ScoreboardScreen`.

#### 2. Player UPI Withdrawal Modal & Anti-Fraud Flow (`:app-player`):
- Reference Pattern: `git demo repo/battle-zone` withdrawal lifecycle.
- Update `app-player/src/main/java/com/tourney/player/WalletScreen.kt` & `PlayerViewModel.kt`:
  - Add "Withdraw Winnings" button opening `WithdrawalModal.kt`.
  - Input field for UPI ID (`username@okaxis`, `username@ybl`, etc.) with strict regex validation (`^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`).
  - Validation: Minimum ₹50, Maximum <= `winningBalance`.
  - Attaches `deviceId` signal to request payload for fraud detection.
  - API call: `POST /api/v1/wallet/withdraw` returning pending withdrawal ledger item.

#### 3. Staff Wallet & Withdrawal Approvals Console (`:app-admin`):
- Update `app-admin/src/main/java/com/tourney/admin/AdminDashboardScreen.kt`:
  - Add dedicated **Withdrawal Management** screen (`AdminWalletScreen.kt`) accessible ONLY to users where `permissions.canManageWallet == true` (or `Role.ADMIN`).
  - Lists all pending withdrawal requests: Player IGN, Free Fire UID, Phone, Amount, and UPI ID.
  - Action 1: "Approve & Mark Paid" -> Opens dialog to input Bank/UPI UTR Number -> Calls `POST /api/v1/admin/wallet/withdrawals/:id/approve`.
  - Action 2: "Reject & Refund" -> Inputs rejection reason -> Calls `POST /api/v1/admin/wallet/withdrawals/:id/reject` which automatically refunds the player's balance.

#### 4. Realtime Slot Occupancy Polling & Animated Progress:
- Reference Pattern: `git demo repo/node-redlock` slot state refresh.
- In `app-player/src/main/java/com/tourney/player/SlotPickerScreen.kt`:
  - Implement active 5-second polling (via Kotlin Coroutine Flow `while(isActive) { delay(5000); refreshSlots(); }`) that runs ONLY while screen is visible (Lifecycle-aware).
  - Add glowing pulse animation to the slots progress bar when match capacity reaches >= 40/48 slots.

#### 5. Slide-to-Confirm Join Component (`SlideToJoinButton.kt`):
- Reference Pattern: `git demo repo/ui-ux/Cloudy` micro-interactions.
- Create `core/src/main/java/com/tourney/core/ui/SlideToJoinButton.kt`:
  - Smooth draggable thumb with swipe threshold (>= 80% width triggers confirmation).
  - Haptic feedback (tick on drag, success buzz on unlock).
  - Shimmering arrow text: "Slide to Join ₹XX >>".
  - Auto-reset if user releases thumb before reaching 80%.

---

### OUTPUT FORMAT:
Provide the file name clearly for each file, followed by the complete, typed Kotlin code block with zero placeholders.
```
