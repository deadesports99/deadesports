# 🤖 Master Prompt for Kimi K3.1 Pro (FreePI)
## Phase 3: Tournament Engine & High-Concurrency Slot Booking (Redis Mutex)

```text
You are an Elite Principal Backend Architect for our Free Fire Tournament Platform.

Phase 1 (Scaffolding) and Phase 2 (Auth & Sub-Admin RBAC) are fully verified and passing cleanly.

### YOUR MISSION FOR PHASE 3:
Build the Tournament Engine and the High-Concurrency Slot Booking System using Redis Atomic Locking and Prisma Transactions.

---

### CORE LOGIC REQUIREMENTS:

#### 1. TOURNAMENT CREATION & MANAGEMENT:
- Game Modes: `BATTLE_ROYALE`, `CLASH_SQUAD`
- Match Types: `SOLO` (48 slots), `DUO` (24 teams / 48 slots), `SQUAD` (12 teams / 48 slots)
- Maps: `BERMUDA`, `PURGATORY`, `KALAHARI`, `ALPINE`, `NEXTERRA`
- Financials: `entryFee`, `prizePool`, `perKillPrize`
- Match Schedule: `matchTime` (must be in the future)
- Guarded by `authenticate` and `requirePermission('canCreateMatch')` (Admins and authorized Sub-Admins only).

#### 2. ATOMIC SLOT BOOKING (PREVENTING RACE CONDITIONS):
- When 100+ players hit `POST /api/v1/tournaments/:id/join` for the last 2 available slots:
  - **Redis Atomic Lock:** Check and reserve the slot in Redis before touching the database.
  - **Balance Verification:** Player must have sufficient `depositBalance` (or `winningBalance` if allowed) >= `entryFee`.
  - **ACID Prisma Transaction:**
    1. Deduct `entryFee` from User balance.
    2. Create `WalletLedger` record (`type: 'DEBIT', category: 'JOIN_FEE'`).
    3. Insert into `TournamentSlot` (`tournamentId`, `userId`, `slotNumber`, `teamId`).
    4. If total slots reach 48, update `Tournament.status = 'SLOTS_FULL'`.
  - If the database transaction fails for any reason, release the Redis slot reservation automatically (Rollback).
- Single User Constraint: One user cannot book multiple slots in the same tournament.
- Team Code for Squads: In DUO/SQUAD, the squad leader creates a 6-digit squad code, and teammates join the same team slot using that code.

---

### FILES TO IMPLEMENT:

#### 1. `src/services/slotLock.service.ts`
- Redis-based atomic slot reservation using Lua scripts or Redis hashes (`ioredis` client from `src/config/redis.ts`):
  - `reserveSlot(tournamentId: string, slotNumber: number, userId: string, maxSlots: number): Promise<boolean>`
  - `releaseSlot(tournamentId: string, slotNumber: number): Promise<void>`
  - `getOccupiedSlots(tournamentId: string): Promise<Record<number, string>>`

#### 2. `src/services/tournament.service.ts`
- `createTournament(creator: AuthUser, data: CreateTournamentInput)`
- `listTournaments(tenantId: string, query: { status?: TournamentStatus; page?: number; limit?: number })`
- `getTournamentDetails(tenantId: string, tournamentId: string)`
- `getTournamentSlots(tenantId: string, tournamentId: string)`
- `joinTournament(user: AuthUser, tournamentId: string, slotNumber: number, teamId?: string)`
- `cancelTournamentAndRefundAll(adminUser: AuthUser, tournamentId: string, reason: string)`

#### 3. `src/controllers/tournament.controller.ts`
- Zod validation schemas for:
  - Create tournament payload
  - Join match payload (slotNumber 1-48, optional teamCode)
  - Query parameters (status, page, limit)
- Controller methods wired to `tournament.service.ts`.

#### 4. `src/routes/tournament.routes.ts`
- Express router mounted at `/api/v1/tournaments`:
  - `POST /` -> `authenticate`, `requirePermission('canCreateMatch')`, `createTournament`
  - `GET /` -> `authenticate`, `listTournaments`
  - `GET /:id` -> `authenticate`, `getTournamentDetails`
  - `GET /:id/slots` -> `authenticate`, `getTournamentSlots`
  - `POST /:id/join` -> `authenticate`, `requireRole('USER')`, `joinTournament`
  - `POST /:id/cancel` -> `authenticate`, `requireRole('ADMIN')`, `cancelTournamentAndRefundAll`

---

### OUTPUT FORMAT:
Provide the file name clearly for each file, followed by the complete, typed TypeScript code block with zero placeholders.
```
