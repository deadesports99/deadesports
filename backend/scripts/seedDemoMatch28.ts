/**
 * One-off demo fixture (boss request):
 *   "ek match banao 10 min baad ka aur 28 fake account se join kar dena"
 *
 * Creates ONE Battle-Royale SOLO match starting ~10 minutes from now, seeds
 * 28 fake players (each with ₹100 deposit balance) and seats every one of them
 * through the REAL join service — so wallet debit, ledger rows, seat numbers
 * and identity snapshots are exactly what a live player would produce.
 *
 * Run (backend must be able to reach the DB):
 *   cd backend && npx tsx scripts/seedDemoMatch28.ts
 *
 * Safe to re-run: fake players are reused (unique phone numbers), only a new
 * match + new seats are created.
 */
import { prisma } from '../src/config/prisma.js';
import { createTournament, joinTournament } from '../src/services/tournament.service.js';
import type { AuthUser } from '../src/types/auth.js';

const TENANT_ID = '53a09545-e6e2-4cf5-a5c2-7ef18b276a52';
const PLAYER_COUNT = 28;
const MINUTES_FROM_NOW = 10;
const ENTRY_FEE = 10;
const PER_KILL_PRIZE = 5;
const TOTAL_SLOTS = 48;
const STARTING_BALANCE = 100;

/** Fake-player phone numbers: 9000000001 … 9000000028 (unique per tenant). */
const phoneFor = (i: number): string => `90000000${String(i).padStart(2, '0')}`;

async function main(): Promise<void> {
  // ── 1. Who is creating the match? The tenant owner (ADMIN). ──────────────
  const owner =
    (await prisma.user.findFirst({
      where: { tenantId: TENANT_ID, role: 'ADMIN' },
      select: { id: true, tenantId: true },
    })) ?? null;
  if (!owner) throw new Error('No ADMIN found for the tenant — run `npm run seed:owner` first.');

  const admin: AuthUser = {
    userId: owner.id,
    tenantId: owner.tenantId,
    role: 'ADMIN',
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: true,
    canManageWallet: true,
  };

  // ── 2. The match: ~10 minutes from now, listed immediately. ─────────────
  //    TOURNAMENT_ID=<uuid> re-uses an existing match (re-run after a fix).
  const reuseId = process.env.TOURNAMENT_ID?.trim();
  const matchTime = new Date(Date.now() + MINUTES_FROM_NOW * 60 * 1000);
  const tournament = reuseId
    ? await prisma.tournament.findUniqueOrThrow({
        where: { id: reuseId },
        select: { id: true, title: true, matchNumber: true },
      })
    : await createTournament(admin, {
        gameMode: 'BATTLE_ROYALE',
        matchType: 'SOLO',
        mapType: 'BERMUDA',
        entryFee: ENTRY_FEE,
        perKillPrize: PER_KILL_PRIZE,
        matchTime,
        totalSlots: TOTAL_SLOTS,
        visibilityHours: null, // listed right away
        roomRevealMinutes: 5, // Room ID reveal window stays inside the last 5 min
      });

  const realMatchTime =
    (
      await prisma.tournament.findUniqueOrThrow({
        where: { id: tournament.id },
        select: { matchTime: true },
      })
    ).matchTime ?? matchTime;

  console.log(`\nMatch ${reuseId ? 'reused' : 'created'}`);
  console.log(`  id        ${tournament.id}`);
  console.log(`  title     ${tournament.title}  (#${tournament.matchNumber})`);
  console.log(`  starts    ${realMatchTime.toISOString()}  (${realMatchTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST)`);
  console.log(`  entry     ₹${ENTRY_FEE}   per kill ₹${PER_KILL_PRIZE}   slots ${TOTAL_SLOTS}`);

  // ── 3. Fake players (idempotent on phone number). ───────────────────────
  await prisma.user.createMany({
    data: Array.from({ length: PLAYER_COUNT }, (_, idx) => {
      const n = idx + 1;
      const nn = String(n).padStart(2, '0');
      return {
        tenantId: TENANT_ID,
        phoneNumber: phoneFor(n),
        name: `Demo Player ${nn}`,
        inGameName: `DEMO_BOT_${nn}`,
        inGameUid: String(1000000000 + n * 137),
        role: 'USER' as const,
        playerCode: `DEMO-${nn}`,
        deviceId: `demo-device-${nn}`,
        depositBalance: STARTING_BALANCE,
      };
    }),
    skipDuplicates: true,
  });

  const players = await prisma.user.findMany({
    where: { tenantId: TENANT_ID, phoneNumber: { in: Array.from({ length: PLAYER_COUNT }, (_, i) => phoneFor(i + 1)) } },
    select: { id: true, phoneNumber: true, inGameName: true, depositBalance: true },
    orderBy: { phoneNumber: 'asc' },
  });
  console.log(`\nFake players ready: ${players.length}`);

  // ── 4. Seat them through the real join path (sequential, retry-safe). ──
  let joined = 0;
  const failures: string[] = [];

  for (const player of players) {
    const auth: AuthUser = {
      userId: player.id,
      tenantId: TENANT_ID,
      role: 'USER',
      canCreateMatch: false,
      canUpdateRoomId: false,
      canDistributePrize: false,
      canManageWallet: false,
    };
    try {
      await joinTournament(auth, tournament.id, undefined, undefined, undefined, undefined, false);
      joined += 1;
      process.stdout.write(`  seat ${String(joined).padStart(2, '0')}/${players.length}  ${player.inGameName}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${player.inGameName}: ${msg}`);
      process.stdout.write(`  FAIL       ${player.inGameName} — ${msg}\n`);
    }
  }

  // ── 5. Report what the DB now holds. ────────────────────────────────────
  const fresh = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    select: {
      id: true,
      title: true,
      status: true,
      totalSlots: true,
      matchTime: true,
      _count: { select: { slots: true } },
    },
  });
  const ledger = await prisma.walletLedger.count({
    where: { referenceId: tournament.id, category: 'JOIN_FEE' },
  });

  console.log(`\n── Result ──────────────────────────────`);
  console.log(`  joined seats   ${joined}/${players.length}`);
  console.log(`  DB slots       ${fresh?._count.slots} / ${fresh?.totalSlots}`);
  console.log(`  status         ${fresh?.status}`);
  console.log(`  ledger rows    ${ledger}`);
  console.log(`  failures       ${failures.length}`);
  if (failures.length) failures.forEach((f) => console.log(`    - ${f}`));
  console.log(`  tournamentId   ${tournament.id}`);
}

main()
  .catch((err) => {
    console.error('FATAL', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
