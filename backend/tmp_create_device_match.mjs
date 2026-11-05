import { prisma, disconnectPrisma } from './dist/config/prisma.js';
import { createTournament } from './dist/services/tournament.service.js';

const adminRow = await prisma.user.findFirst({
  where: { role: 'ADMIN' },
  select: { id: true, tenantId: true },
});
if (!adminRow) throw new Error('no admin');
const admin = {
  userId: adminRow.id,
  tenantId: adminRow.tenantId,
  role: 'ADMIN',
  canCreateMatch: true,
  canUpdateRoomId: true,
  canDistributePrize: true,
  canManageWallet: true,
};
const created = await createTournament(admin, {
  gameMode: 'BATTLE_ROYALE',
  matchType: 'SOLO',
  mapType: 'BERMUDA',
  entryFee: 0,
  prizePool: 20,
  perKillPrize: 0,
  matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
  totalSlots: 48,
});
console.log('CREATED', created.id, created.matchNumber, created.title, created.status);
await disconnectPrisma();
