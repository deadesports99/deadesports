/**
 * One-off cleanup: cancel one demo match and refund every seated player.
 * Usage: MATCH_ID=<uuid> npx tsx scripts/cancelDemoMatch.ts
 */
import { prisma } from '../src/config/prisma.js';
import { cancelTournamentAndRefundAll } from '../src/services/tournament.service.js';
import type { AuthUser } from '../src/types/auth.js';

const TENANT_ID = '53a09545-e6e2-4cf5-a5c2-7ef18b276a52';

async function main(): Promise<void> {
  const matchId = process.env.MATCH_ID?.trim();
  if (!matchId) throw new Error('MATCH_ID env var required');

  const owner = await prisma.user.findFirst({
    where: { tenantId: TENANT_ID, role: 'ADMIN' },
    select: { id: true, tenantId: true },
  });
  if (!owner) throw new Error('No ADMIN found for the tenant');

  const admin: AuthUser = {
    userId: owner.id,
    tenantId: owner.tenantId,
    role: 'ADMIN',
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: true,
    canManageWallet: true,
  };

  const result = await cancelTournamentAndRefundAll(admin, matchId, 'Duplicate demo match (superseded by the next one)');
  console.log(JSON.stringify(result, null, 1));
}

main()
  .catch((err) => {
    console.error('FATAL', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
