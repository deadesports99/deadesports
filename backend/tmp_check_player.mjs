import { prisma, disconnectPrisma } from './dist/config/prisma.js';

const u = await prisma.user.findFirst({
  where: { playerCode: 'APE-0214' },
  select: {
    id: true,
    playerCode: true,
    name: true,
    email: true,
    phoneNumber: true,
    inGameName: true,
    inGameUid: true,
    depositBalance: true,
    winningBalance: true,
    isBanned: true,
    tenantId: true,
  },
});
console.log(JSON.stringify(u, null, 2));
await disconnectPrisma();
