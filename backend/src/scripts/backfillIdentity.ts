/**
 * One-off backfill for the new auto IDs:
 *   - every existing user gets a readable playerCode (e.g. "APX-0001")
 *   - every existing match gets a sequential matchNumber (1, 2, 3 … by kickoff)
 *     and its auto title ("Bermuda Solo #12")
 *
 * Safe to re-run: it only touches rows where the column is still NULL.
 *   cd backend && npx tsx src/scripts/backfillIdentity.ts
 */
import { prisma } from '../config/prisma.js';
import { allocatePlayerCode, autoMatchTitle } from '../services/identity.service.js';

async function main(): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true, subdomain: true } });
  let usersUpdated = 0;
  let matchesUpdated = 0;

  for (const tenant of tenants) {
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id, playerCode: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    for (const user of users) {
      const code = await allocatePlayerCode(tenant.id);
      await prisma.user.update({ where: { id: user.id }, data: { playerCode: code } });
      usersUpdated++;
    }

    const tournaments = await prisma.tournament.findMany({
      where: { tenantId: tenant.id },
      orderBy: { matchTime: 'asc' },
      select: { id: true, matchNumber: true, mapType: true, matchType: true },
    });
    const maxExisting = tournaments.reduce((max, t) => Math.max(max, t.matchNumber ?? 0), 0);
    let nextNumber = maxExisting > 0 ? maxExisting + 1 : 1;
    for (const tournament of tournaments.filter((t) => t.matchNumber == null)) {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          matchNumber: nextNumber,
          title: autoMatchTitle(tournament.mapType, tournament.matchType, nextNumber),
        },
      });
      nextNumber++;
      matchesUpdated++;
    }

    console.log(
      `tenant ${tenant.subdomain}: +${users.length} player code(s), ` +
        `+${tournaments.filter((t) => t.matchNumber == null).length} match number(s)`,
    );
  }

  console.log(`\nBackfill complete — ${usersUpdated} user(s), ${matchesUpdated} match(es) updated.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Backfill failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
