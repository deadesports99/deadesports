/**
 * Verification for the new split between Manage Matches and the Final Payout desk.
 *
 *  1. "Submit" only hands the match over — no money moves, and a payout bigger
 *     than the collected pool never blocks it.
 *  2. A submitted match disappears from Manage Matches and shows up in the
 *     payout desk list with correct totals (collected / refunded / paid / due).
 *  3. Manage-level payout still refuses to exceed the pool (safety kept).
 *  4. Final Payout payout with allowOverPool=true pays more than collected and
 *     completes the match.
 *
 * Everything is throwaway: temp match, temp ledger rows, balances restored.
 *
 * Usage: cd backend && npx tsx scripts/verifyPayoutDesk.ts
 */
import { prisma } from '../src/config/prisma.js';
import { createAdminSession } from '../src/services/adminSession.service.js';
import { createTournament, joinTournament } from '../src/services/tournament.service.js';
import { setPlayerKills, setBannedSeatRefund, listManageMatches } from '../src/services/manageMatch.service.js';
import { banMatchParticipant, payoutMatchAwards } from '../src/services/matchRoster.service.js';
import { forceMatchLive } from '../src/services/matchSweep.service.js';
import type { AuthUser } from '../src/types/auth.js';

const BASE = 'http://localhost:5000/api/v1';
const TENANT_ID = '53a09545-e6e2-4cf5-a5c2-7ef18b276a52';
const PHONES = ['9000000001', '9000000002', '9000000003'];
const FEE = 10;
const PER_KILL = 5;

async function http(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json?.data, message: json?.message };
}

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
  const bots = await prisma.user.findMany({
    where: { tenantId: TENANT_ID, phoneNumber: { in: PHONES } },
    select: { id: true, phoneNumber: true },
    orderBy: { phoneNumber: 'asc' },
  });
  if (bots.length < 3) throw new Error('demo bot users 9000000001-3 are missing');
  const balancesBefore = new Map<string, number>();
  for (const bot of bots) {
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: bot.id },
      select: { depositBalance: true, winningBalance: true },
    });
    balancesBefore.set(bot.id, Number(row.depositBalance) + Number(row.winningBalance));
  }

  const session = await createAdminSession(owner, {
    ip: '127.0.0.1',
    userAgent: 'verifyPayoutDesk',
  });
  const token = session.token;

  const match = await createTournament(staff, {
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'BERMUDA',
    entryFee: FEE,
    perKillPrize: PER_KILL,
    totalSlots: 20,
    matchTime: new Date(Date.now() + 60 * 60 * 1000),
    visibilityHours: null,
    roomRevealMinutes: 5,
  });

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
    for (const bot of bots) {
      await joinTournament(userAuth(bot.id), match.id, undefined, undefined, undefined, undefined, false);
    }
    const [bot1, bot2, bot3] = bots;

    // bot2 gets banned with the refund switch ON, so it also has a refund row.
    await banMatchParticipant(staff, match.id, bot2.id, true, 'verify: ban + refund');
    await setBannedSeatRefund(staff, match.id, bot2.id, true);

    await forceMatchLive(match.id, TENANT_ID);
    await setPlayerKills(staff, match.id, bot1.id, 4);
    await setPlayerKills(staff, match.id, bot3.id, 2);
    // 6 payable kills x ₹5 = ₹30, against ₹30 collected from 3 seats... make it
    // deliberately over the pool by giving one player a big kill count.
    await setPlayerKills(staff, match.id, bot1.id, 9);
    // 11 kills x ₹5 = ₹55 > ₹30 collected → over pool on purpose.

    console.log('\n1) SUBMIT (Manage Matches → Final Payout)');
    const submitted = await http('POST', `/admin/matches/${match.id}/submit`, token);
    check('submit succeeds even when the payout is over the pool', submitted.status === 200, `${submitted.status} ${submitted.message ?? ''}`);
    check('submit returns a hand-off time', Boolean(submitted.data?.payoutSubmittedAt));

    const again = await http('POST', `/admin/matches/${match.id}/submit`, token);
    check('re-submitting is idempotent', again.status === 200 && again.data?.alreadySubmitted === true);

    const afterSubmit = await prisma.tournament.findUniqueOrThrow({
      where: { id: match.id },
      select: { status: true, payoutSubmittedAt: true },
    });
    check('match status untouched by submit', afterSubmit.status === 'LIVE', afterSubmit.status);
    check('no prize was paid by submit', (await countPrizeRows(match.id)) === 0);

    console.log('\n2) MANAGE LIST NO LONGER SHOWS IT');
    const liveList = await listManageMatches(TENANT_ID, 'live');
    check('submitted match is gone from Manage Matches', !liveList.matches.some((row) => row.id === match.id));

    console.log('\n3) PAYOUT DESK LIST + TOTALS');
    const inbox = await http('GET', '/admin/matches/payouts/inbox?filter=all', token);
    const row = (inbox.data?.rows ?? []).find((item: { id: string }) => item.id === match.id);
    check('submitted match appears on the payout desk', Boolean(row), `${inbox.status}`);
    if (row) {
      check('collected = entry fee x seats', row.collected === FEE * 3, `₹${row.collected}`);
      check('refunded total counts the banned-seat refund', row.refunded === FEE, `₹${row.refunded}`);
      check('kills exclude the banned seat', row.kills === 11, `${row.kills}`);
      check('banned count is reported', row.banned === 1, `${row.banned}`);
      check('payout due = kills x per-kill', row.payoutDue === 11 * PER_KILL, `₹${row.payoutDue}`);
      check('payout due is above collected (over-pool story)', row.payoutDue > row.collected);
    }
    check('totals block present', Boolean(inbox.data?.totals && typeof inbox.data.totals.balance === 'number'));

    console.log('\n4) MANAGE-LEVEL GUARD STILL REFUSES OVER-POOL');
    let guardMessage: string | null = null;
    try {
      await payoutMatchAwards(
        staff,
        match.id,
        [
          { userId: bot1.id, rank: null, kills: 9 },
          { userId: bot3.id, rank: null, kills: 2 },
        ],
        true,
        false,
      );
    } catch (error) {
      guardMessage = error instanceof Error ? error.message : String(error);
    }
    check('pool guard still active without allowOverPool', Boolean(guardMessage && /budget exceeded/i.test(guardMessage)), guardMessage ?? 'no error');
    check('nothing paid after the refused attempt', (await countPrizeRows(match.id)) === 0);

    console.log('\n5) FINAL PAYOUT WITH OVER-POOL ALLOWED');
    const paid = await http('POST', `/admin/matches/${match.id}/payout`, token, {
      awards: [
        { userId: bot1.id, rank: null, kills: 9 },
        { userId: bot3.id, rank: null, kills: 2 },
      ],
      completeMatch: true,
      allowOverPool: true,
    });
    check('final payout over the pool is accepted on the desk', paid.status === 200, `${paid.status} ${paid.message ?? ''}`);

    const finalRow = await prisma.tournament.findUniqueOrThrow({
      where: { id: match.id },
      select: { status: true },
    });
    check('match completed after the final payout', finalRow.status === 'COMPLETED', finalRow.status);

    const prizeRows = await prisma.matchResult.findMany({
      where: { tournamentId: match.id, isApproved: true },
      select: { userId: true, prizeWon: true },
    });
    const bot1Prize = Number(prizeRows.find((r) => r.userId === bot1.id)?.prizeWon ?? 0);
    const bot3Prize = Number(prizeRows.find((r) => r.userId === bot3.id)?.prizeWon ?? 0);
    check('bot1 got 9 kills x ₹5', bot1Prize === 45, `₹${bot1Prize}`);
    check('bot3 got 2 kills x ₹5', bot3Prize === 10, `₹${bot3Prize}`);
    check('banned bot was never paid', !prizeRows.some((r) => r.userId === bot2.id));

    const paidInbox = await http('GET', '/admin/matches/payouts/inbox?filter=paid', token);
    const paidRow = (paidInbox.data?.rows ?? []).find((item: { id: string }) => item.id === match.id);
    check('settled match now sits in the Paid tab', Boolean(paidRow));
    if (paidRow) check('paid total matches the prizes', paidRow.paid === 55, `₹${paidRow.paid}`);
  } finally {
    await prisma.walletLedger.deleteMany({ where: { referenceId: match.id } });
    await prisma.matchResult.deleteMany({ where: { tournamentId: match.id } });
    await prisma.tournamentSlot.deleteMany({ where: { tournamentId: match.id } });
    await prisma.tournament.deleteMany({ where: { id: match.id } });
    await prisma.adminSession.deleteMany({ where: { userId: owner.id, userAgent: 'verifyPayoutDesk' } });
    for (const bot of bots) {
      const before = balancesBefore.get(bot.id) ?? 0;
      const now = await prisma.user.findUniqueOrThrow({
        where: { id: bot.id },
        select: { depositBalance: true, winningBalance: true },
      });
      const total = Number(now.depositBalance) + Number(now.winningBalance);
      // Put the difference back into the deposit wallet, the demo bots' default.
      await prisma.user.update({
        where: { id: bot.id },
        data: {
          depositBalance: { increment: before - total },
          winningBalance: 0,
        },
      });
    }
    console.log('\ncleanup done — temp match + ledger removed, bot balances restored');
  }

  console.log(`\n── ${pass} passed, ${fail} failed ──`);
  if (fail > 0) process.exitCode = 1;
}

async function countPrizeRows(matchId: string): Promise<number> {
  return prisma.walletLedger.count({
    where: { referenceId: matchId, category: 'WINNING_PRIZE' },
  });
}

main()
  .catch((err) => {
    console.error('FATAL', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());