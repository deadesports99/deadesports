# 🤖 ACTIVE MASTER PROMPT (KIMI K3.1 PRO / DEEPSEEK)
## Phase 4: Add Cash (UPI Deposit), Match State Sweep & High-Res Asset Integration

Bhai, Phase 3 (FCM + Withdrawals + Slot Polling) verify ho chuka hai. Ab hum **Phase 4** execute kar rahe hain. Niche diye gaye prompt ko Kimi me copy-paste karke execute karwana hai:

---

```markdown
Bhai, Free Fire Tournament SaaS ka Phase 4 execute karna hai.

Target Plan File: `plan/android/4_Deposit_StateSweep_and_AssetIntegration/PLAN.md`

### 🎯 KYA IMPLEMENT KARNA HAI:

#### 1. Backend: Deposit Request Model & Endpoints
1. `prisma/schema.prisma` me naya model add karo:
   model DepositRequest {
     id          String        @id @default(uuid())
     tenantId    String
     tenant      Tenant        @relation(fields: [tenantId], references: [id])
     userId      String
     user        User          @relation(fields: [userId], references: [id])
     amount      Decimal       @db.Decimal(10, 2)
     utrNumber   String
     status      DepositStatus @default(PENDING)
     createdAt   DateTime      @default(now())

     @@index([tenantId, status])
     @@index([userId])
   }

   enum DepositStatus {
     PENDING
     APPROVED
     REJECTED
   }

2. Routes & Controllers:
   - `POST /api/v1/wallet/deposit` -> Player submits `{ amount: number, utrNumber: string }`. Validates min ₹10, UTR regex (12 digits alphanumeric). Creates `DepositRequest` with status `PENDING`.
   - `GET /api/v1/admin/wallet/deposits` -> Staff lists pending deposits (guarded by `canManageWallet`).
   - `POST /api/v1/admin/wallet/deposits/:id/approve` -> Staff approves. Updates `DepositRequest` to `APPROVED`, adds amount to player's `depositBalance`, aur `WalletLedger` me double-entry record create karta hai (`type: CREDIT, category: ADD_MONEY, balanceType: DEPOSIT`).
   - `POST /api/v1/admin/wallet/deposits/:id/reject` -> Staff rejects. Updates status to `REJECTED`.
3. Match Cancellation & Auto-Refund:
   - `POST /api/v1/tournaments/:id/cancel` -> Guarded by `canCreateMatch`. Tournament status ko `CANCELLED` karta hai, aur sabhi joined players ke `depositBalance` me `entryFee` wapas refund karta hai in single Prisma transaction (`category: REFUND`). FCM alert `MATCH_CANCELLED` push karta hai.

#### 2. Android: High-Res Assets & UI Integration
1. **Assets Copy to Drawables:**
   - `ui-ux demo/free fire assests/maps/` se map images (`bermuda_map_overview.jpeg`, `purgatory_map_overview.png`, etc.) ko `:core/src/main/res/drawable/` me copy karo.
   - `ui-ux demo/free fire assests/game_modes/` se `clash_squad_mode_splash.png` ko link karo.
   - `TournamentGlassCard.kt` me map banner thumbnail render karo based on `tournament.mapType`.
2. **Player App Deposit Flow (`:app-player`):**
   - `WalletScreen.kt` me "+ Add Cash" button dabane par `DepositModal` open ho.
   - Quick chips: ₹50, ₹100, ₹200, ₹500.
   - Dynamic UPI Intent button: "Pay with UPI (GPay/PhonePe)" using `Intent.ACTION_VIEW` with `upi://pay?pa={upiId}&pn={brandName}&am={amount}&cu=INR`.
   - 12-digit UTR input field + "Submit UTR" button calling `POST /wallet/deposit`.
   - Ledger me `DEPOSIT` category status chip dikhana.
3. **Admin App Deposit Approvals (`:app-admin`):**
   - `AdminWalletScreen.kt` me tab switch: `[ Withdrawals | Deposits ]`.
   - Deposits tab me pending requests list (Player IGN, UID, Amount, UTR).
   - 1-Click "Approve & Credit Cash" aur "Reject".

#### 3. Verification Rules:
1. `backend`: Run `npm run build` with 0 errors.
2. `android`: Run `./gradlew :app-player:assembleDebug :app-admin:assembleDebug` with 0 errors.
3. Update `plan/android/4_Deposit_StateSweep_and_AssetIntegration/PLAN.md` checklist items to `[x]`.
```
