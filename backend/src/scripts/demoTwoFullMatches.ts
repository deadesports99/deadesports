import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { createTournament, joinTournament } from '../services/tournament.service.js';
import { approveDeposit, submitDeposit } from '../services/deposit.service.js';
import type { AuthUser } from '../types/auth.js';

/**
 * ─── Demo seed: 2 full matches (52 seats, 48 players each) ───────────────
 *
 * Creates two BATTLE_ROYALE / SOLO matches with 52 seats, then seats 48 real
 * players in each by going through the SAME join flow the app uses (entry fee
 * debited + WalletLedger JOIN_FEE rows). Missing balance is funded with a real
 * ADD_MONEY deposit (submit + approve), so wallet history stays consistent.
 *
 * Usage:
 *   npx tsx src/scripts/demoTwoFullMatches.ts
 *   npx tsx src/scripts/demoTwoFullMatches.ts --players=48 --slots=52 --fee=50
 *
 * Safe to re-run: it always creates two NEW matches; a player is only topped up
 * when their balance is below what the two new seats need.
 */

const arg = (name: string, fallback: number): number => {
  const hit = process.argv.find((v) => v.startsWith(`--${name}=`));
  const parsed = hit ? Number(hit.slice(name.length + 3)) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const PLAYERS_PER_MATCH = arg('players', 48);
const TOTAL_SLOTS = arg('slots', 52);
const ENTRY_FEE = arg('fee', 50);
const PER_KILL = arg('kill', 25);
const MATCHES = 2;

const matches: Array<{
  mapType: 'BERMUDA' | 'PURGATORY' | 'KALAHARI' | 'ALPINE' | 'NEXTERRA';
  hoursFromNow: number;
}> = [
  { mapType: 'BERMUDA', hoursFromNow: 3 },
  { mapType: 'PURGATORY', hoursFromNow: 5 },
];

const asAuthUser = (
  row: { id: string; role: 'ADMIN' | 'SUB_ADMIN' | 'USER' },
  tenantId: string,
): AuthUser => ({
  userId: row.id,
  tenantId,
  role: row.role,
  canCreateMatch: row.role === 'ADMIN',
  canManageMatch: row.role === 'ADMIN',
  canUpdateRoomId: row.role === 'ADMIN',
  canViewPayout: row.role === 'ADMIN',
  canDistributePrize: row.role === 'ADMIN',
  canManageWallet: row.role === 'ADMIN',
});

/** 12-char UPI reference (UTR_REGEX = /^[A-Za-z0-9]{12}$/). */
const demoUtr = () => `DD${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

async function main() {
  if (PLAYERS_PER_MATCH > TOTAL_SLOTS) {
    throw new Error('players cannot be more than slots');
  }

  const tenant = await prisma.tenant.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, subdomain: true, brandName: true },
  });
  if (!tenant) throw new Error('No active tenant found — run npm run seed first');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true },
  });
  if (!admin) throw new Error('No ADMIN user found — run npm run seed:owner first');

  console.log(`Tenant : ${tenant.brandName} (${tenant.subdomain})`);
  console.log(`Admin  : ${admin.id}\n`);

  // ── 1. Player pool ───────────────────────────────────────────────────
  let players = await prisma.user.findMany({
    where: { tenantId: tenant.id, role: 'USER' },
    orderBy: { createdAt: 'asc' },
    take: PLAYERS_PER_MATCH,
    select: { id: true, role: true, phoneNumber: true, inGameName: true, inGameUid: true },
  });

  if (players.length < PLAYERS_PER_MATCH) {
    const need = PLAYERS_PER_MATCH - players.length;
    console.log(`Only ${players.length} players in DB — creating ${need} more…`);
    for (let i = 0; i < need; i += 1) {
      let created = null;
      for (let attempt = 0; attempt < 25 && !created; attempt += 1) {
        const phone = `8${crypto.randomInt(100_000_000, 1_000_000_000)}`;
        try {
          created = await prisma.user.create({
            data: {
              tenantId: tenant.id,
              phoneNumber: phone,
              name: `Demo Player ${players.length + i + 1}`,
              inGameName: `DEMO_${String(players.length + i + 1).padStart(3, '0')}`,
              inGameUid: String(2_000_000_000 + crypto.randomInt(1, 900_000_000)),
              role: 'USER',
            },
            select: { id: true, role: true, phoneNumber: true, inGameName: true, inGameUid: true },
          });
        } catch (err) {
          if ((err as { code?: string }).code !== 'P2002') throw err;
        }
      }
      if (!created) throw new Error('Could not allocate a demo phone number');
      players.push(created);
    }
  }
  console.log(`Players: ${players.length} (${PLAYERS_PER_MATCH} per match)\n`);

  // ── 2. Fund everyone for BOTH seats (real deposit + approve) ─────────
  const neededPerPlayer = ENTRY_FEE * MATCHES;
  let funded = 0;

  for (const player of players) {
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: player.id },
      select: { depositBalance: true, winningBalance: true },
    });
    const total = Number(row.depositBalance) + Number(row.winningBalance);
    if (total >= neededPerPlayer) continue;

    const amount = neededPerPlayer + 10 - total; // keep a small buffer
    const deposit = await submitDeposit(player.id, tenant.id, {
      amount,
      utrNumber: demoUtr(),
    });
    await approveDeposit(admin.id, tenant.id, deposit.deposit.id);
    funded += 1;
  }
  console.log(`Wallet : topped up ${funded} player(s) to ₹${neededPerPlayer + 10}\n`);

  // ── 3. Create 2 matches (52 seats) ───────────────────────────────────
  const created = [] as Array<{ id: string; title: string; matchNumber: number | null }>;
  for (const cfg of matches) {
    const tournament = (await createTournament(asAuthUser(admin, tenant.id), {
      gameMode: 'BATTLE_ROYALE',
      matchType: 'SOLO',
      mapType: cfg.mapType,
      entryFee: ENTRY_FEE,
      perKillPrize: PER_KILL,
      totalSlots: TOTAL_SLOTS,
      matchTime: new Date(Date.now() + cfg.hoursFromNow * 60 * 60 * 1000),
      visibilityHours: null,
      roomRevealMinutes: 15,
    })) as { id: string; title: string; matchNumber: number | null };

    created.push({
      id: tournament.id,
      title: tournament.title,
      matchNumber: tournament.matchNumber,
    });
    console.log(`Match  : #${tournament.matchNumber} "${tournament.title}" — ${TOTAL_SLOTS} seats`);
  }

  // ── 4. Seat 48 players in each (real join flow) ──────────────────────
  for (const match of created) {
    let seated = 0;
    const failures: string[] = [];

    for (const player of players) {
      try {
        await joinTournament(
          asAuthUser(player, tenant.id),
          match.id,
          undefined,
          undefined,
          player.inGameName ?? undefined,
          player.inGameUid ?? undefined,
          false,
        );
        seated += 1;
      } catch (err) {
        failures.push(`${player.phoneNumber}: ${(err as Error).message}`);
      }
    }

    console.log(`Seats  : ${match.title} → ${seated}/${TOTAL_SLOTS} filled`);
    if (failures.length) {
      console.log(`  ⚠ ${failures.length} join failure(s):`);
      failures.slice(0, 5).forEach((f) => console.log(`    - ${f}`));
    }
  }

  // ── 5. Verify ────────────────────────────────────────────────────────
  console.log('\n─── Verification ───');
  for (const match of created) {
    const fresh = await prisma.tournament.findUniqueOrThrow({
      where: { id: match.id },
      include: { _count: { select: { slots: true } } },
    });
    const feeRows = await prisma.walletLedger.count({
      where: { referenceId: match.id, category: 'JOIN_FEE' },
    });
    console.log(
      `${fresh.title}: status=${fresh.status} seats=${fresh._count.slots}/${fresh.totalSlots} ` +
        `entryFee=₹${fresh.entryFee} joinFeeLedger=${feeRows}`,
    );
  }
  console.log('\nDone ✅');
}

main()
  .catch((err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
