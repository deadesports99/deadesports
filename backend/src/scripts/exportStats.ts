/**
 * Backfill / manual run of the daily stats snapshots (Phase 5).
 *
 *   npm run export:stats                  # last STATS_EXPORT_DAYS days, all tenants
 *   npm run export:stats -- --days=30     # a month
 *   npm run export:stats -- --days=1 --dry
 *
 * Runs even when STATS_EXPORT_ENABLED=false (that flag only controls the in-process
 * scheduler), so it can be used from a one-off Render job or a laptop.
 *
 * Writes are idempotent — the document id is `<tenantId>_<YYYY-MM-DD>`, so running
 * this twice rewrites the same documents instead of duplicating them.
 */
import 'dotenv/config';
import { statsExportService } from '../services/statsExport.service.js';

function readFlag(name: string): number | undefined {
  const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const parsed = Number(arg.split('=')[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main(): Promise<void> {
  const days = readFlag('days');
  const dry = process.argv.includes('--dry');

  console.log(`📊 Exporting stats snapshots${days ? ` for the last ${days} day(s)` : ''}…`);

  if (dry) {
    const { recentDateKeys } = await import('../services/statsExport.service.js');
    console.log('Dry run — dates that would be written:', recentDateKeys(days ?? 3).join(', '));
    return;
  }

  const result = await statsExportService.run({ days, force: true });
  console.log(JSON.stringify(result, null, 2));

  if (!result.enabled) {
    console.error(
      `\n✖ Nothing exported: ${result.skippedReason}\n` +
        '  Set FCM_CREDENTIALS_JSON to a service-account JSON with Firestore access.\n',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n✔ ${result.written} snapshot(s) written for ${result.tenants} tenant(s)` +
      (result.failed ? `, ${result.failed} failed` : '') +
      `\n  Collection: ${process.env.STATS_EXPORT_COLLECTION || 'stats'}\n`,
  );
}

main()
  .catch((err) => {
    console.error('✖ export:stats crashed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Release the pool so the process exits cleanly.
    const { disconnectPrisma } = await import('../config/prisma.js');
    await disconnectPrisma();
  });
