/**
 * Backfill join-time identity snapshots on TournamentSlot.
 *
 * Phase 12 added `inGameNameSnapshot` / `inGameUidSnapshot` / `deviceIdSnapshot`
 * to TournamentSlot. Seats booked before the change have them NULL; this script
 * copies the player's CURRENT profile into the snapshot ONCE, so match history
 * shows a stable IGN / FF UID even if the player edits their profile later.
 *
 * Idempotent: only touches rows whose snapshot columns are all NULL.
 *
 *   npx tsx scripts/backfill_slot_snapshots.ts          # dry run (report only)
 *   npx tsx scripts/backfill_slot_snapshots.ts --apply  # write
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const pending = await prisma.tournamentSlot.findMany({
    where: { inGameNameSnapshot: null, inGameUidSnapshot: null, deviceIdSnapshot: null },
    select: {
      id: true,
      user: { select: { inGameName: true, inGameUid: true, deviceId: true } },
    },
  });

  const total = await prisma.tournamentSlot.count();
  console.log(`slots total=${total} needsBackfill=${pending.length}`);

  let updated = 0;
  let skipped = 0;
  for (const slot of pending) {
    const name = slot.user.inGameName?.trim() || null;
    const uid = slot.user.inGameUid?.trim() || null;
    const device = slot.user.deviceId?.trim() || null;
    if (!name && !uid && !device) {
      skipped += 1;
      continue;
    }
    if (APPLY) {
      await prisma.tournamentSlot.update({
        where: { id: slot.id },
        data: {
          inGameNameSnapshot: name,
          inGameUidSnapshot: uid,
          deviceIdSnapshot: device,
        },
      });
    }
    updated += 1;
  }

  console.log(
    `${APPLY ? 'WROTE' : 'WOULD WRITE'} snapshots=${updated} skippedNoProfile=${skipped}`,
  );
  if (!APPLY && updated > 0) console.log('Re-run with --apply to persist.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('backfill failed:', e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
