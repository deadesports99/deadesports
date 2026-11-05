import assert from 'node:assert/strict';
import { prisma, disconnectPrisma } from './dist/config/prisma.js';
import { createTournament } from './dist/services/tournament.service.js';
import { finishMatchAndPayWinner } from './dist/services/result.service.js';
import { listAdminPlayers, setPlayerBanned } from './dist/services/playerAdmin.service.js';
import { allocatePlayerCode, nextMatchNumber, autoMatchTitle } from './dist/services/identity.service.js';

const TEST_UID = '999888777';
const TEST_PHONE = `9${Date.now().toString().slice(-9)}`;

let tournamentId = null;
let userId = null;

async function cleanup() {
  if (tournamentId) {
    await prisma.walletLedger.deleteMany({ where: { referenceId: tournamentId } });
    await prisma.matchResult.deleteMany({ where: { tournamentId } });
    await prisma.tournamentSlot.deleteMany({ where: { tournamentId } });
    await prisma.tournament.deleteMany({ where: { id: tournamentId } });
  }
  if (userId) {
    await prisma.tournamentSlot.deleteMany({ where: { userId } });
    await prisma.walletLedger.deleteMany({ where: { userId } });
    await prisma.matchResult.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  assert.ok(tenant, 'no tenant');
  const tenantId = tenant.id;
  const adminRow = await prisma.user.findFirst({ where: { tenantId, role: 'ADMIN' } });
  assert.ok(adminRow, 'no admin');
  const admin = {
    userId: adminRow.id,
    tenantId,
    role: 'ADMIN',
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: true,
    canManageWallet: true,
  };

  const playerCode = await allocatePlayerCode(tenantId);
  const player = await prisma.user.create({
    data: {
      tenantId,
      phoneNumber: TEST_PHONE,
      name: 'Phase12 QA',
      playerCode,
      inGameName: 'Phase12 QA',
      inGameUid: TEST_UID,
      role: 'USER',
    },
  });
  userId = player.id;
  console.log('PASS player code allocated:', playerCode);

  const expectedNumber = await nextMatchNumber(tenantId);
  const created = await createTournament(admin, {
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'BERMUDA',
    entryFee: 0,
    prizePool: 100,
    perKillPrize: 10,
    matchTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    totalSlots: 48,
  });
  tournamentId = created.id;
  assert.equal(created.matchNumber, expectedNumber, 'auto match number');
  assert.equal(created.title, autoMatchTitle('BERMUDA', 'SOLO', expectedNumber), 'auto title');
  console.log('PASS auto match number/title:', created.matchNumber, created.title);

  await prisma.tournamentSlot.create({
    data: { tournamentId: created.id, userId: player.id, slotNumber: 1 },
  });

  const search = await listAdminPlayers(tenantId, playerCode);
  assert.equal(search.total, 1, 'player search by code');
  assert.equal(search.players[0].playerCode, playerCode);
  console.log('PASS admin player search:', search.players[0].playerCode, search.players[0].inGameUid);

  const banned = await setPlayerBanned(tenantId, player.id, true);
  assert.equal(banned.isBanned, true);
  assert.equal(banned.playerCode, playerCode, 'ban response keeps playerCode');
  const stillBanned = await prisma.user.findUnique({ where: { id: player.id } });
  assert.equal(stillBanned.isBanned, true);
  const unbanned = await setPlayerBanned(tenantId, player.id, false);
  assert.equal(unbanned.isBanned, false);
  console.log('PASS ban / unban');

  const payout = await finishMatchAndPayWinner(admin, created.id, {
    winnerUid: TEST_UID,
    winnerKills: 2,
  });
  assert.equal(payout.status, 'COMPLETED');
  assert.equal(payout.totalPaid, 70, '50% of 100 pool + 2 kills x 10');
  assert.equal(payout.winner.playerCode, playerCode);

  const finished = await prisma.tournament.findUnique({ where: { id: created.id } });
  assert.equal(finished.status, 'COMPLETED');
  const paidUser = await prisma.user.findUnique({ where: { id: player.id } });
  assert.equal(Number(paidUser.winningBalance), 70);
  const ledger = await prisma.walletLedger.findFirst({
    where: { userId: player.id, referenceId: created.id },
  });
  assert.ok(ledger, 'payout ledger written');
  assert.equal(ledger.category, 'WINNING_PRIZE');
  assert.equal(Number(ledger.amount), 70);
  assert.match(ledger.notes, /Winner payout/);
  const result = await prisma.matchResult.findUnique({
    where: { tournamentId_userId: { tournamentId: created.id, userId: player.id } },
  });
  assert.equal(result.rank, 1);
  assert.equal(result.verifiedKills, 2);
  assert.equal(Number(result.prizeWon), 70);
  assert.equal(result.isApproved, true);
  console.log('PASS end-match payout:', JSON.stringify(payout));

  const doublePay = await finishMatchAndPayWinner(admin, created.id, { winnerUid: TEST_UID });
  assert.fail(`double payout should be rejected, got ${JSON.stringify(doublePay)}`);
}

main()
  .then(() => console.log('ALL PHASE 12 CHECKS PASSED'))
  .catch(async (e) => {
    if (e?.message?.includes('already completed')) {
      // Expected guard from the deliberate double-pay attempt.
      console.log('PASS double payout rejected:', e.message);
      console.log('ALL PHASE 12 CHECKS PASSED');
      return;
    }
    console.error('FAILED:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (e) {
      console.error('cleanup failed:', e);
      process.exitCode = 1;
    }
    await disconnectPrisma();
  });
