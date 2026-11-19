/**
 * Verification for two admin-console fixes:
 *
 *  A) ROOM LOCK — Room ID & Password can be edited before kickoff, but become
 *     read-only the moment the match is LIVE (server rejects with 409).
 *  B) BAN MONEY ON CANCEL — "Cancel & refund all" must not pay a banned seat
 *     whose refund switch is OFF, and must never pay the same seat twice when
 *     the switch is ON.
 *
 * Creates throwaway matches and deletes every row it touches afterwards.
 *
 * Usage: cd backend && npx tsx scripts/verifyRoomLockAndCancelRefund.ts
 */
import { prisma } from '../src/config/prisma.js';
import { createTournament, joinTournament, cancelTournamentAndRefundAll } from '../src/services/tournament.service.js';
import { banMatchParticipant } from '../src/services/matchRoster.service.js';
import { setBannedSeatRefund } from '../src/services/manageMatch.service.js';
import { updateRoomCredentials } from '../src/services/result.service.js';
import { forceMatchLive } from '../src/services/matchSweep.service.js';
import type { AuthUser } from '../src/types/auth.js';

const TENANT_ID = '53a09545-e6e2-4cf5-a5c2-7ef18b276a52';
const FEE = 10;
const PHONES = ['9000000001', '9000000002', '9000000003'];

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
};

async function main(): Promise<void> {
  const owner = await prisma.user.findFirstOrThrow({
    where: { tenantId: TENANT_ID, role: 'ADMIN' },
    select: { id: true },
  });
  const staff: AuthUser = {
    userId: owner.id,
    tenantId: TENANT_ID,
    role: 'ADMIN',
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: true,
    canManageWallet: true,
  };
  const players = await prisma.user.findMany({
    where: { tenantId: TENANT_ID, phoneNumber: { in: PHONES } },
    select: { id: true, phoneNumber: true },
    orderBy: { phoneNumber: 'asc' },
  });
  const balancesBefore = new Map<string, number>();
  for (const p of players) {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: p.id }, select: { depositBalance: true } });
    balancesBefore.set(p.id, Number(row.depositBalance));
  }
  const netRefund = async (matchId: string, userId: string): Promise<number> => {
    const rows = await prisma.walletLedger.findMany({
      where: { referenceId: matchId, userId, category: 'REFUND' },
      select: { type: true, amount: true },
    });
    return rows.reduce((sum, r) => sum + (r.type === 'CREDIT' ? Number(r.amount) : -Number(r.amount)), 0);
  };

  const baseInput = {
    gameMode: 'BATTLE_ROYALE' as const,
    matchType: 'SOLO' as const,
    mapType: 'BERMUDA' as const,
    entryFee: FEE,
    perKillPrize: 5,
    totalSlots: 20,
    visibilityHours: null,
    roomRevealMinutes: 5,
  };

  // ── A) Room lock ────────────────────────────────────────────────────────
  console.log('\nA) ROOM LOCK');
  const roomMatch = await createTournament(staff, {
    ...baseInput,
    matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });
  try {
    const before = await updateRoomCredentials(staff, roomMatch.id, '111222', '9999', false);
    check('room editable before kickoff', before.room.roomId === '111222');

    const again = await updateRoomCredentials(staff, roomMatch.id, '333444', '8888', false);
    check('room can be corrected before kickoff', again.room.roomId === '333444');

    await forceMatchLive(roomMatch.id, TENANT_ID);
    let rejected: string | null = null;
    try {
      await updateRoomCredentials(staff, roomMatch.id, '555666', '7777', false);
    } catch (err) {
      rejected = err instanceof Error ? err.message : String(err);
    }
    check('room update refused once LIVE', Boolean(rejected && /LIVE/.test(rejected)), rejected ?? 'no error');

    const row = await prisma.tournament.findUniqueOrThrow({
      where: { id: roomMatch.id },
      select: { roomId: true, roomPassword: true },
    });
    check('stored room values unchanged', row.roomId === '333444' && row.roomPassword === '8888', `${row.roomId}/${row.roomPassword}`);
  } finally {
    await prisma.walletLedger.deleteMany({ where: { referenceId: roomMatch.id } });
    await prisma.tournamentSlot.deleteMany({ where: { tournamentId: roomMatch.id } });
    await prisma.tournament.deleteMany({ where: { id: roomMatch.id } });
  }

  // ── B) Cancel must respect the ban refund switch ─────────────────────────
  console.log('\nB) CANCEL & REFUND WITH BANNED SEATS');
  const cancelMatch = await createTournament(staff, {
    ...baseInput,
    matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });
  const created = [cancelMatch.id];
  const [bot1, bot2, bot3] = players;
  const userAuth = (id: string): AuthUser => ({
    userId: id,
    tenantId: TENANT_ID,
    role: 'USER',
    canCreateMatch: false,
    canUpdateRoomId: false,
    canDistributePrize: false,
    canManageWallet: false,
  });

  try {
    for (const player of players) {
      await joinTournament(userAuth(player.id), cancelMatch.id, undefined, undefined, undefined, undefined, false);
    }

    // bot2 -> banned, refund OFF (money held).  bot3 -> banned, refund ON (paid).
    await banMatchParticipant(staff, cancelMatch.id, bot2.id, true, 'verify: ban only');
    await banMatchParticipant(staff, cancelMatch.id, bot3.id, true, 'verify: ban + refund');
    await setBannedSeatRefund(staff, cancelMatch.id, bot3.id, true);

    const result = await cancelTournamentAndRefundAll(staff, cancelMatch.id, 'verify cancel rule');
    console.log(
      `  result: refunded=${result.refundedPlayers} total=₹${result.totalRefunded} ` +
        `skippedBanned=${result.skippedBanned} skippedAlready=${result.skippedAlreadyRefunded}`,
    );

    check('only the clean seat was refunded on cancel', result.refundedPlayers === 1);
    check('banned + refund OFF seat was skipped', result.skippedBanned === 1);
    check('already-refunded seat was not paid twice', result.skippedAlreadyRefunded === 1);
    check('total refunded = one entry fee', result.totalRefunded === FEE, `₹${result.totalRefunded}`);

    check('clean player got the fee back', (await netRefund(cancelMatch.id, bot1.id)) === FEE);
    check('banned refund-OFF player got nothing', (await netRefund(cancelMatch.id, bot2.id)) === 0);
    check('banned refund-ON player paid exactly once', (await netRefund(cancelMatch.id, bot3.id)) === FEE);
  } finally {
    for (const id of created) {
      await prisma.walletLedger.deleteMany({ where: { referenceId: id } });
      await prisma.tournamentSlot.deleteMany({ where: { tournamentId: id } });
      await prisma.tournament.deleteMany({ where: { id } });
    }
    for (const player of players) {
      await prisma.user.update({
        where: { id: player.id },
        data: { depositBalance: balancesBefore.get(player.id) ?? 0 },
      });
    }
    console.log('\ncleanup done — balances restored, temp matches deleted');
  }

  console.log(`\n── ${pass} passed, ${fail} failed ──`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('FATAL', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
