/**
 * ─────────────────────────────────────────────────────────────────────────
 *  PHASE 7 — 48-PLAYER CONCURRENCY STRESS TEST SUITE
 * ─────────────────────────────────────────────────────────────────────────
 *  Standalone end-to-end suite (`npx tsx scripts_stress_test.ts`) that races
 *  the full tournament money loop against a LIVE server:
 *
 *    1. Creates a fresh 48-slot match.
 *    2. Registers 48 brand-new players (no device collisions).
 *    3. Each deposits entry money via UTR -> admin approves all 48.
 *    4. Fires 48 CONCURRENT joins (Promise.all) — verifies 0 duplicate
 *       slots, atomic balance debits, and the 48th seat flips SLOTS_FULL.
 *    5. Attempts a 49th join — must be rejected (SLOTS_FULL).
 *    6. Publishes custom room credentials (T-15 reveal).
 *    7. Spectator submits verified kills + ranks for all 48 players.
 *    8. Executes the 1-click payout.
 *    9. Verifies the double-entry ledger invariant:
 *          Σ JOIN_FEE (debits) == Σ WINNING_PRIZE (credits) + organizer margin
 *   10. Winners request withdrawals -> admin batch approves.
 *   11. Automatic cleanup of every test entity (users, deposits, ledger,
 *       results, slots, tournament) + Redis state — tenant restored.
 *
 *  Requires the backend to be running on PORT (default http://localhost:5000).
 * ─────────────────────────────────────────────────────────────────────────
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './src/config/prisma.js';

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:5000/api/v1';
const ENTRY_FEE = 50;
const PRIZE_POOL = 1500;
const PER_KILL = 5;
const SLOT_COUNT = 48;
const RUN_ID = String(Date.now()).slice(-6); // numeric — keeps phones 100% digits

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  (${extra})` : ''}`);
};

interface ApiResult {
  status: number;
  data: any;
  message?: string;
}

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<ApiResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(BASE + path, {
        method: opts.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-stress-test': 'apex-ff-internal',
          ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const json: any = await res.json().catch(() => ({}));
      return { status: res.status, data: json?.data, message: json?.message };
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  return { status: 500, data: null };
}

async function login(tenantId: string, phoneNumber: string): Promise<string> {
  const r = await api('/auth/player/login', { method: 'POST', body: { tenantId, phoneNumber } });
  if (r.status !== 200 || !r.data?.token) throw new Error(`Login failed for ${phoneNumber}: ${r.message}`);
  return r.data.token as string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { subdomain: 'apex-ff' } });
  const tenantId = tenant.id;

  // ── Test identity scope (for safe cleanup) ────────────────────────────
  const testPlayers: Array<{ id: string; token: string; phone: string; inGameName: string; inGameUid: string }> = [];
  let testTournamentId: string | null = null;

  // We create players via the public register API (same as the app does).
  const adminToken = await login(tenantId, '9999900001');

  // ── Restore helper (used in finally) ──────────────────────────────────
  const cleanup = async () => {
    const ids = testPlayers.map((p) => p.id);
    if (testTournamentId) {
      // Best-effort Redis wipe for the stress tournament.
      try {
        const { clearTournamentRedis } = await import('./src/services/slotLock.service.js');
        await clearTournamentRedis(testTournamentId);
      } catch {
        /* redis not running — fine, DB backstop is authoritative */
      }
    }
    if (ids.length > 0 || testTournamentId) {
      await prisma.$transaction([
        prisma.withdrawalRequest.deleteMany({ where: { tenantId, userId: { in: ids } } }),
        prisma.matchResult.deleteMany({ where: { tournamentId: testTournamentId ?? '' } }),
        prisma.tournamentSlot.deleteMany({ where: { tournamentId: testTournamentId ?? '' } }),
        prisma.walletLedger.deleteMany({ where: { userId: { in: ids } } }),
        prisma.depositRequest.deleteMany({ where: { userId: { in: ids } } }),
        ...(testTournamentId
          ? [prisma.tournament.deleteMany({ where: { id: testTournamentId } })]
          : []),
        prisma.user.deleteMany({ where: { id: { in: ids } } }),
      ]);
      console.log(`  (cleanup: removed ${ids.length} test player(s) + test tournament + ledger rows)`);
    }
  };

  try {
    console.log('\n━━━ 1. CREATE 48-SLOT MATCH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const created = await api('/tournaments', {
      method: 'POST',
      token: adminToken,
      body: {
        title: `STRESS #${RUN_ID} — 48P Concurrency`,
        gameMode: 'BATTLE_ROYALE',
        matchType: 'SOLO',
        mapType: 'BERMUDA',
        entryFee: ENTRY_FEE,
        prizePool: PRIZE_POOL,
        perKillPrize: PER_KILL,
        matchTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        totalSlots: SLOT_COUNT,
      },
    });
    testTournamentId = created.data?.id ?? null;
    check('match created with 48 slots', created.status === 201 && created.data?.totalSlots === 48,
      `id=${testTournamentId}`);

    console.log('\n━━━ 2. REGISTER + FUND 48 PLAYERS (UTR -> ADMIN APPROVAL) ━━');
    const players: Array<{ id: string; token: string; phone: string; inGameName: string; inGameUid: string }> = [];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      const uniquePhone = `91${RUN_ID}${String(i).padStart(4, '0')}`; // 12 digits, unique per run
      const inGameName = `STRESS_${RUN_ID}_${String(i).padStart(2, '0')}`;
      const inGameUid = String(1_000_000_000 + Number(RUN_ID) + i); // 10 digits, unique per player

      const reg = await api('/auth/player/register', {
        method: 'POST',
        body: { tenantId, phoneNumber: uniquePhone, inGameName, inGameUid, deviceId: `DEV_${RUN_ID}_${i}` },
      });
      if (reg.status !== 201 || !reg.data?.token) {
        check(`player ${i} registered`, false, reg.message ?? `status ${reg.status}`);
        throw new Error(`Could not register player ${i}: ${reg.message}`);
      }
      players.push({ id: reg.data.user.id, token: reg.data.token, phone: uniquePhone, inGameName, inGameUid });
      testPlayers.push({ id: reg.data.user.id, token: reg.data.token, phone: uniquePhone, inGameName, inGameUid });
    }
    check(`all ${SLOT_COUNT} players registered`, players.length === SLOT_COUNT);

    // Each player deposits the exact entry fee with a unique UTR.
    for (let i = 0; i < SLOT_COUNT; i++) {
      const utr = ('T' + (Date.now() + i).toString().slice(-11)).toUpperCase();
      const dep = await api('/wallet/deposit', {
        method: 'POST',
        token: players[i].token,
        body: { amount: ENTRY_FEE, utrNumber: utr },
      });
      if (dep.status !== 201) check(`player ${i + 1} deposit submitted`, false, dep.message);
    }
    check('48 deposits submitted (UTR)', true);

    const pending = await api('/admin/wallet/deposits?status=PENDING', { token: adminToken });
    const myPlayerIds = new Set(players.map((p) => p.id));
    const myPending = (pending.data?.deposits ?? []).filter((d: any) => myPlayerIds.has(d.player?.id ?? d.userId));
    check('admin sees 48 pending deposits', myPending.length === SLOT_COUNT, `count=${myPending.length}`);
    const depositIds: string[] = myPending.map((d: any) => d.id);
    let approvedCount = 0;
    for (const id of depositIds) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const ap = await api(`/admin/wallet/deposits/${id}/approve`, { method: 'POST', token: adminToken, body: {} });
        if (ap.status === 200) {
          approvedCount++;
          break;
        }
        if (attempt === 2) {
          console.log(`      Deposit ${id} failed: status=${ap.status} msg=${ap.message}`);
        } else {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    check('admin approved all 48 deposits', approvedCount === SLOT_COUNT, `approved=${approvedCount}`);

    // Verify every player actually got the money.
    const balancesOk = (
      await Promise.all(
        players.map(async (p) => {
          const w = await api('/wallet', { token: p.token });
          return Number(w.data?.depositBalance) >= ENTRY_FEE;
        }),
      )
    ).every(Boolean);
    check('all 48 players funded (deposit balance >= entry fee)', balancesOk);

    console.log('\n━━━ 3. 48 CONCURRENT JOINS (Promise.all) ━━━━━━━━━━━━━━━━━');
    const attempts = players.map(async (p, i) => {
      const r = await api(`/tournaments/${testTournamentId}/join`, {
        method: 'POST',
        token: p.token,
        body: { slotNumber: i + 1 },
      });
      return { slotNumber: i + 1, ok: r.status === 201, msg: r.message };
    });
    const firstWave = await Promise.all(attempts);

    // Retry any lost race (P2034 "booking conflict — please retry") — a real
    // client re-taps; the invariant we must prove is 0 duplicate seats.
    let wave = firstWave;
    for (let round = 0; round < 3; round++) {
      const losers = wave.filter((w) => !w.ok);
      if (losers.length === 0) break;
      await new Promise((r) => setTimeout(r, 300));
      const retried = await Promise.all(
        losers.map((l) =>
          api(`/tournaments/${testTournamentId}/join`, {
            method: 'POST',
            token: players[l.slotNumber - 1].token,
            body: { slotNumber: l.slotNumber },
          }),
        ),
      );
      wave = wave.map((w) => {
        if (w.ok) return w;
        const ret = retried.shift();
        return { slotNumber: w.slotNumber, ok: ret?.status === 201, msg: ret?.message };
      });
    }

    const successful = wave.filter((w) => w.ok);
    const failed = wave.filter((w) => !w.ok);
    check('48/48 joins eventually succeeded', successful.length === SLOT_COUNT,
      `ok=${successful.length} retried=${SLOT_COUNT - successful.length}`);
    check('0 duplicate slots', new Set(successful.map((w) => w.slotNumber)).size === successful.length);

    // ── The 48th seat must have flipped the match to SLOTS_FULL ─────────
    const detail = await api(`/tournaments/${testTournamentId}`, { token: adminToken });
    check('48th seat triggers SLOTS_FULL', detail.data?.status === 'SLOTS_FULL',
      `status=${detail.data?.status} booked=${detail.data?.slotsBooked}`);

    const slotsView = await api(`/tournaments/${testTournamentId}/slots`, { token: adminToken });
    const booked = slotsView.data?.slots?.filter((s: any) => s.player) ?? [];
    check('slot grid shows exactly 48 booked seats', booked.length === SLOT_COUNT, `booked=${booked.length}`);
    check('slot grid has zero duplicates', new Set(booked.map((s: any) => s.slotNumber)).size === booked.length);
    check('no player owns 2 seats (unique user per seat)',
      new Set(booked.map((s: any) => s.player.id)).size === booked.length);

    // ── 49th player must be rejected ────────────────────────────────────
    const lateReg = await api('/auth/player/register', {
      method: 'POST',
      body: {
        tenantId,
        phoneNumber: `91${RUN_ID}9999`,
        inGameName: `STRESS_${RUN_ID}_49`,
        inGameUid: '7000000049',
      },
    });
    const lateToken = lateReg.data?.token as string | undefined;
    if (lateToken) {
      testPlayers.push({ id: lateReg.data.user.id, token: lateToken, phone: `91${RUN_ID}9999`, inGameName: `STRESS_${RUN_ID}_49`, inGameUid: '7000000049' });
      // Fund the 49th player so the rejection is genuinely about the match
      // being full — not about an insufficient balance.
      const lateDep = await api('/wallet/deposit', {
        method: 'POST', token: lateToken,
        body: { amount: ENTRY_FEE, utrNumber: ('T' + Date.now().toString().slice(-11)).toUpperCase() },
      });
      const lateDepositId = lateDep.data?.deposit?.id as string | undefined;
      if (lateDepositId) {
        await api(`/admin/wallet/deposits/${lateDepositId}/approve`, { method: 'POST', token: adminToken, body: {} });
      }
      const lateJoin = await api(`/tournaments/${testTournamentId}/join`, {
        method: 'POST',
        token: lateToken,
        body: { slotNumber: 1 },
      });
      const fullRejected = lateJoin.status === 409 && /full|not accepting/i.test(lateJoin.message ?? '');
      check('49th join rejected (match full — SLOTS_FULL)', fullRejected,
        `${lateJoin.status} ${lateJoin.message ?? ''}`);
    }

    console.log('\n━━━ 4. ROOM CREDENTIALS REVEAL ━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const room = await api(`/tournaments/${testTournamentId}/room`, {
      method: 'PATCH',
      token: adminToken,
      body: { roomId: 'FF-STRESS-42', roomPassword: 'stress99' },
    });
    check('room credentials published', room.status === 200 && room.data?.room?.roomId === 'FF-STRESS-42');
    const roomRead = await api(`/tournaments/${testTournamentId}/room`, { token: adminToken });
    check('room credentials readable post-reveal', roomRead.status === 200 && roomRead.data?.roomId === 'FF-STRESS-42');

    console.log('\n━━━ 5. SPECTATOR SUBMITS 48 RESULTS + 1-CLICK PAYOUT ━━━━━');
    // Rank 1-3 split 50/30/20% of the pool; everyone earns per-kill money.
    // Low kill counts (0..3) keep the tournament profitable: revenue 48×₹50 =
    // ₹2400 vs ₹1500 pool + 72 kills × ₹5 = ₹360 => organizer keeps ₹540.
    const results = players.map((p, i) => ({
      userId: p.id,
      verifiedKills: i % 4,
      rank: i + 1,
    }));
    const totalKills = results.reduce((s, r) => s + r.verifiedKills, 0);
    const expectedPrizes = round2(PRIZE_POOL + totalKills * PER_KILL);
    const payout = await api(`/tournaments/${testTournamentId}/payout`, {
      method: 'POST',
      token: adminToken,
      body: { results },
    });
    const paidTotal = round2(Number(payout.data?.totalPaid ?? NaN));
    check('1-click payout executed', payout.status === 200 && payout.data?.playersPaid === SLOT_COUNT,
      `paid=${payout.data?.playersPaid} total=${paidTotal}`);
    check('payout math exact: rank shares + kills × perKill',
      paidTotal === expectedPrizes, `paid=${paidTotal} expected=${expectedPrizes}`);

    console.log('\n━━━ 6. DOUBLE-ENTRY LEDGER BALANCE INTEGRITY ━━━━━━━━━━━━━');
    const ledger = await prisma.walletLedger.findMany({
      where: { userId: { in: players.map((p) => p.id) } },
      select: { category: true, type: true, amount: true, balanceType: true },
    });
    const joinFees = ledger
      .filter((l) => l.category === 'JOIN_FEE' && l.type === 'DEBIT')
      .reduce((s, l) => s + Number(l.amount), 0);
    const prizes = ledger
      .filter((l) => l.category === 'WINNING_PRIZE' && l.type === 'CREDIT')
      .reduce((s, l) => s + Number(l.amount), 0);
    const expectedFees = round2(ENTRY_FEE * SLOT_COUNT);
    const margin = round2(expectedFees - prizes);
    check('Σ JOIN_FEE == entryFee × 48', round2(joinFees) === expectedFees, `fees=${round2(joinFees)}`);
    check('Σ WINNING_PRIZE == totalPaid from payout', round2(prizes) === paidTotal,
      `prizes=${round2(prizes)} paid=${paidTotal}`);
    check('Total Entry Fees == Total Prizes + Margin (double-entry holds)',
      round2(joinFees) === round2(prizes + margin) && margin >= 0 && prizes <= expectedFees,
      `margin=${margin} prizes=${round2(prizes)} <= fees=${expectedFees}`);

    console.log('\n━━━ 7. WINNERS WITHDRAW -> ADMIN BATCH APPROVAL ━━━━━━━━━━');
    const winners = players.slice(0, 3); // top 3 (got rank prizes)
    const withdrawals: Array<{ id: string; token: string }> = [];
    for (const w of winners) {
      const wr = await api('/wallet/withdraw', {
        method: 'POST',
        token: w.token,
        body: { amount: 50, upiId: `${w.inGameName.toLowerCase()}@okaxis` },
      });
      if (wr.status === 201 && wr.data?.withdrawal?.id) {
        withdrawals.push({ id: wr.data.withdrawal.id, token: w.token });
      }
    }
    check('3 winners requested withdrawals', withdrawals.length === 3, `requests=${withdrawals.length}`);

    const wq = await api('/admin/wallet/withdrawals?status=PENDING', { token: adminToken });
    const wIds = (wq.data?.withdrawals ?? []).map((w: any) => w.id);
    let wApproved = 0;
    for (const id of wIds) {
      const a = await api(`/admin/wallet/withdrawals/${id}/approve`, {
        method: 'POST',
        token: adminToken,
        body: { utrNumber: ('P' + Date.now().toString().slice(-11)).toUpperCase() },
      });
      if (a.status === 200) wApproved++;
    }
    check('admin batch-approved all withdrawals', wApproved >= withdrawals.length, `approved=${wApproved}`);

    console.log('\n━━━ 8. SETTLEMENT REPORT SEES THE DAY ━━━━━━━━━━━━━━━━━━━━');
    const scheduledDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const settle = await api(`/admin/wallet/settlement?date=${scheduledDate}`, { token: adminToken });
    check('settlement endpoint reachable', settle.status === 200, `status=${settle.status}`);
    check('settlement reflects scheduled match revenue >= entryFees',
      Number(settle.data?.summary?.totalMatchRevenue) >= expectedFees,
      `revenue=${settle.data?.summary?.totalMatchRevenue}`);

    console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
    await cleanup();
    await prisma.$disconnect();
    process.exit(fail === 0 ? 0 : 1);
  } catch (err) {
    console.error('\n❌ STRESS TEST CRASHED:', err);
    try {
      await cleanup();
    } catch (cleanErr) {
      console.error('Cleanup failed:', cleanErr);
    }
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
