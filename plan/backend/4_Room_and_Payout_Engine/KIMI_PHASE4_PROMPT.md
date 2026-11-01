# 🤖 Master Prompt for Kimi K3.1 Pro (FreePI)
## Phase 4: Timed Room ID Security, Official Spectator Scoreboard & Winner Payout Engine

> **Critical Spec Update:** Screenshot uploads have been eliminated. Client staff spectates the Free Fire custom match directly in the lobby, records live kills and rank, catches hackers, and submits official scorecards.

---

```text
You are an Elite Principal Backend Architect for our Free Fire Tournament Platform.

Phases 1, 2, and 3 are 100% complete and passing with zero build errors.

### YOUR MISSION FOR PHASE 4:
Implement the Timed Room ID security module (T-15 min lock), Official Spectator Match Scoreboard, and Serializable 1-Click Winner Payout Engine.

---

### CORE SPECIFICATIONS:

#### 1. Timed Room ID Security:
- `PATCH /api/v1/tournaments/:id/room`: Guarded by `canUpdateRoomId`. Staff enters `customRoomId` and `customRoomPassword`. Transitions status to `ROOM_REVEALED`.
- `GET /api/v1/tournaments/:id/room`: 
  - Admin/Sub-Admin: Instant access.
  - Player: Must hold a booked slot in the match.
  - T-15 Lock: Only accessible when `matchTime - currentTime <= 15 minutes`. If requested earlier, returns 403 Forbidden with exact seconds remaining until reveal.

#### 2. Official Spectator Scorecard (No Screenshots):
- `GET /api/v1/tournaments/:id/results`: Guarded by `authenticate`. Returns match rankings, player IGNs, verified kills, prizes won, and hacker disqualification status.

#### 3. 1-Click Serializable Payout Engine:
- `POST /api/v1/tournaments/:id/payout`: Guarded by `canDistributePrize`.
- Accepts array of player results `{ userId, rank, kills, isDisqualified }`.
- Executes inside an ACID `Serializable` Prisma transaction:
  - Verifies slot participation.
  - Calculates prize: `(kills * perKillPrize) + (rankPrizeShare * prizePool)`.
  - Atomically credits winner's `winningBalance`.
  - Creates double-entry audit record in `WalletLedger` (`CREDIT`, `WINNING_PRIZE`).
  - Flags hackers as `isDisqualified: true` with 0 prize.
  - Transitions tournament status to `COMPLETED`.
  - Evicts Redis slot keys to free memory.

---

### OUTPUT FORMAT:
Provide the file name clearly for each file, followed by the complete, typed TypeScript code block with zero placeholders.
```
