/**
 * Verification for the BAN-REFUND coin switch (Manage Matches board).
 *
 * Creates a throwaway match, seats one demo player, then walks the whole switch:
 *   ban (no money) -> refund ON -> refund ON again (no-op) -> refund OFF ->
 *   refund OFF again (no-op) -> non-banned refusal.
 * Finally deletes every row it created, so the real DB stays exactly as it was.
 *
 * Usage: cd backend && npx tsx scripts/verifyBanRefundSwitch.ts
 */
import { prisma } from '../src/config/prisma.js';
import {
  createTournament,
  joinTournament,
} from '../src/services/tournament.service.js';
import { banMatchParticipant } from '../src/services/matchRoster.service.js';
import {
  getLiveBoard,
  setBannedSeatRefund,
} from '../src/services/manageMatch.service.js';
import type { AuthUser } from '../src/types/auth.js';

const TENANT_ID = '53a09545-e6e2-4cf5-a5c2-7ef18b276a52';
const PHONE = '9000000001'; // DEMO_BOT_01 (₹100 seeded → ₹90 after entry fee)
const FEE = 10;

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
  const player = await prisma.user.findFirstOrThrow({
    where: { tenantId: TENANT_ID, phoneNumber: PHONE },
    select: { id: true },
  });
  const playerAuth: AuthUser = {
    userId: player.id,
    tenantId: TENANT_ID,
    role: 'USER',
    canCreateMatch: false,
    canUpdateRoomId: false,
    canDistributePrize: false,
    canManageWallet: false,
  };
  const balanceOf = async (): Promise<number> => {
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: player.id },
      select: { depositBalance: true },
    });
    return Number(row.depositBalance);
  };

  const before = await balanceOf();
  const match = await createTournament(staff, {
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'BERMUDA',
    entryFee: FEE,
    perKillPrize: 5,
    matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    totalSlots: 20,
    visibilityHours: null,
    roomRevealMinutes: 5,
  });
  console.log(`\ntemp match ${match.id} (${match.title})`);

  try {
    await joinTournament(playerAuth, match.id, 1, undefined, undefined, undefined, false);
    const afterJoin = await balanceOf();
    check('join debits the entry fee', afterJoin === before - FEE, `${before} -> ${afterJoin}`);

    await banMatchParticipant(staff, match.id, player.id, true, 'verify ban-refund switch');
    let board = await getLiveBoard(TENANT_ID, match.id);
    let seat = board.players.find((p) => p.userId === player.id);
    check('ban keeps the seat', Boolean(seat));
    check('ban alone refunds nothing', seat?.refunded === 0, `refunded=${seat?.refunded}`);
    check('ban excludes the seat from payout', board.totalKills === 0 && seat?.isBanned === true);

    const on = await setBannedSeatRefund(staff, match.id, player.id, true);
    seat = on.board.players.find((p) => p.userId === player.id);
    check('refund ON returns the fee', (await balanceOf()) === before, `balance ${await balanceOf()}`);
    check('refund ON is reported on the board', seat?.refunded === FEE, `refunded=${seat?.refunded}`);
    check('refund ON keeps the ban', seat?.isBanned === true);

    const onAgain = await setBannedSeatRefund(staff, match.id, player.id, true);
    check('refund ON twice is a no-op', onAgain.refundedNow === false && (await balanceOf()) === before);

    const off = await setBannedSeatRefund(staff, match.id, player.id, false);
    seat = off.board.players.find((p) => p.userId === player.id);
    check('refund OFF takes the money back', (await balanceOf()) === before - FEE, `balance ${await balanceOf()}`);
    check('refund OFF clears the board flag', seat?.refunded === 0, `refunded=${seat?.refunded}`);
    check('refund OFF keeps the ban', seat?.isBanned === true);

    const offAgain = await setBannedSeatRefund(staff, match.id, player.id, false);
    check('refund OFF twice is a no-op', offAgain.refundedNow === false && (await balanceOf()) === before - FEE);

    await banMatchParticipant(staff, match.id, player.id, false);
    let refused = false;
    try {
      await setBannedSeatRefund(staff, match.id, player.id, true);
    } catch (err) {
      refused = /only for a banned player/i.test(err instanceof Error ? err.message : '');
    }
    check('non-banned seat is refused', refused);
  } finally {
    // ── Cleanup: remove every row this run created, restore the balance. ──
    await prisma.walletLedger.deleteMany({
      where: { referenceId: match.id, userId: player.id },
    });
    await prisma.tournamentSlot.deleteMany({ where: { tournamentId: match.id } });
    await prisma.tournament.deleteMany({ where: { id: match.id } });
    await prisma.user.update({
      where: { id: player.id },
      data: { depositBalance: before },
    });
    console.log(`\ncleanup done — balance back to ₹${before}`);
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
