/**
 * Backfill missing match numbers.
 *
 * Every match must show "50 | Bermuda · Solo" so the admin and staff can say
 * "match 50" out loud. Matches created before the auto-numbering existed have
 * `matchNumber = NULL`; this script assigns the next free number per tenant in
 * creation order so the sequence stays natural (oldest = lowest number).
 *
 * Idempotent: only rows with `matchNumber = NULL` are touched.
 *
 *   npx tsx scripts/backfill_match_numbers.ts          # dry run
 *   npx tsx scripts/backfill_match_numbers.ts --apply  # write
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { autoMatchTitle } from '../src/services/identity.service.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const tenants = await prisma.tournament.groupBy({
    by: ['tenantId'],
    _max: { matchNumber: true },
    _count: { _all: true },
  });

  let totalAssigned = 0;

  for (const tenant of tenants) {
    let next = (tenant._max.matchNumber ?? 0) + 1;

    const missing = await prisma.tournament.findMany({
      where: { tenantId: tenant.tenantId, matchNumber: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, mapType: true, matchType: true },
    });

    if (missing.length === 0) continue;
    console.log(
      `tenant ${tenant.tenantId}: ${tenant._count._all} matches, ` +
        `maxNumber=${tenant._max.matchNumber ?? '-'}, missing=${missing.length}`,
    );

    for (const match of missing) {
      const number = next++;
      const title = autoMatchTitle(match.mapType, match.matchType, number);
      if (APPLY) {
        await prisma.tournament.update({
          where: { id: match.id },
          data: { matchNumber: number, title },
        });
      }
      console.log(`  ${APPLY ? 'WROTE' : 'WOULD WRITE'} #${number} <- ${match.title}`);
      totalAssigned += 1;
    }
  }

  console.log(`${APPLY ? 'WROTE' : 'WOULD WRITE'} numbers=${totalAssigned}`);
  if (!APPLY && totalAssigned > 0) console.log('Re-run with --apply to persist.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('backfill failed:', e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
