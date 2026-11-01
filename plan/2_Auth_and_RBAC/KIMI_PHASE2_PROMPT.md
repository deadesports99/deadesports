# 🤖 Master Prompt for Kimi K3.1 Pro (FreePI)
## Phase 2: Role-Based Access Control (Admin, Sub-Admin Staff, & Players)

> **Context for Kimi:** Boss ki demand update ho gayi hai (`boss demand/poss demand..md`). Hamare liye koi platform Super Admin panel nahi banega. 
> Jo client humse app lega, wahi **ADMIN (Owner)** hoga. Aur wo apne under staff hire karega jo **SUB_ADMIN (Staff)** honge with granular permissions. Players **USER** honge.
> 
> `schema.prisma` ko humne already update karke `prisma generate` chala diya hai (build 100% pass hai).

---

```text
You are an Elite Principal Backend Architect for our Free Fire Tournament Platform.

### ARCHITECTURAL PIVOT AS PER BOSS SPECIFICATION:
We are NOT building a platform-level Super Admin panel for ourselves.
1. ADMIN: The client/buyer who purchased the tournament system. Has 100% control over tournaments, finances, settings, and staff.
2. SUB_ADMIN: Staff hired by the Admin. They log into the SAME Admin App, but their dashboard dynamically shows only the features granted by their permissions:
   - `canCreateMatch`: boolean
   - `canUpdateRoomId`: boolean
   - `canDistributePrize`: boolean
   - `canManageWallet`: boolean
3. USER: Gamers/Players who join matches with Free Fire UID and In-Game Name (IGN).

### UPDATED PRISMA USER & ROLE SCHEMA (ALREADY COMPILED):
```prisma
enum Role {
  ADMIN       // Client / Tournament Owner
  SUB_ADMIN   // Staff hired by the Admin
  USER        // Gamer / Player
}

model User {
  id                 String    @id @default(uuid())
  tenantId           String
  phoneNumber        String
  email              String?
  name               String?
  inGameName         String?   // Free Fire IGN
  inGameUid          String?   // Free Fire Numeric UID
  role               Role      @default(USER)

  // Sub-Admin Permissions
  canCreateMatch     Boolean   @default(false)
  canUpdateRoomId    Boolean   @default(false)
  canDistributePrize Boolean   @default(false)
  canManageWallet    Boolean   @default(false)

  // Staff Hierarchy
  adminId            String?
  admin              User?     @relation("AdminStaff", fields: [adminId], references: [id])
  staffMembers       User[]    @relation("AdminStaff")

  depositBalance     Decimal   @default(0.00) @db.Decimal(10, 2)
  winningBalance     Decimal   @default(0.00) @db.Decimal(10, 2)
  isBanned           Boolean   @default(false)
  deviceId           String?
  createdAt          DateTime  @default(now())
}
```

---

### YOUR MISSION FOR PHASE 2:
Implement complete, clean, production-ready TypeScript code for Authentication and Role & Permission Middleware.
Zero placeholders. Full code for all files below:

#### 1. `src/middlewares/auth.middleware.ts`
- `authenticate`: Express middleware verifying JWT bearer token from `Authorization` header.
  - Extracts `userId`, `tenantId`, `role` from payload.
  - Attaches `req.user` to Express Request (properly extend Express Request type).
- `requireRole(...allowedRoles: Role[])`: Middleware ensuring `req.user.role` is in `allowedRoles`. Throws `ApiError.forbidden('Access denied')` if not.
- `requirePermission(permissionKey: 'canCreateMatch' | 'canUpdateRoomId' | 'canDistributePrize' | 'canManageWallet')`:
  - If `req.user.role === 'ADMIN'`, pass immediately (Admin has all permissions).
  - If `req.user.role === 'SUB_ADMIN'`, verify that `req.user[permissionKey] === true`. If false, throw `ApiError.forbidden('You lack permission to perform this action')`.
  - Otherwise throw forbidden.

#### 2. `src/services/auth.service.ts`
- `registerPlayer(data: { tenantId: string; phoneNumber: string; inGameName: string; inGameUid: string; deviceId?: string })`
- `loginWithPhone(data: { tenantId: string; phoneNumber: string })`
- `createStaffMember(adminUser: User, data: { name: string; email: string; phoneNumber: string; permissions: { canCreateMatch?: boolean; canUpdateRoomId?: boolean; canDistributePrize?: boolean; canManageWallet?: boolean } })`
  - Only callable by `ADMIN`. Sets `role = SUB_ADMIN`, `adminId = adminUser.id`.
- Generate JWT helper: `generateToken(payload: { userId: string; tenantId: string; role: Role })`.

#### 3. `src/controllers/auth.controller.ts`
- Controller methods with Zod request body validation:
  - `POST /api/v1/auth/player/register`
  - `POST /api/v1/auth/player/login`
  - `POST /api/v1/auth/admin/staff` (Protected: `authenticate`, `requireRole('ADMIN')`)
  - `GET /api/v1/auth/me` (Protected: returns current user profile & permissions)

#### 4. `src/routes/auth.routes.ts`
- Express router exporting `authRouter` mounted at `/api/v1/auth`.

#### 5. `prisma/seed.ts`
- Standalone seed script executed with `npx tsx prisma/seed.ts`:
  - Creates a default Tenant: `Apex Free Fire Club` (slug: `apex-ff`)
  - Creates 1 `ADMIN` user (Owner)
  - Creates 1 `SUB_ADMIN` user (Staff with `canUpdateRoomId: true`)
  - Creates 2 `USER` players with Free Fire UIDs
  - Prints login credentials and test tokens to the console.

---

### OUTPUT FORMAT:
Output each file path clearly followed by the complete, typed TypeScript code block.
```
