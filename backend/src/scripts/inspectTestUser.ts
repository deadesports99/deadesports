import { prisma } from '../config/prisma.js';

async function main() {
  const userId = '693498cb-5c00-4274-9d9b-7f9dae706e2b';
  const tenantId = 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phoneNumber: true,
      name: true,
      inGameName: true,
      inGameUid: true,
      depositBalance: true,
      winningBalance: true,
    },
  });
  console.log('User on device:', user);

  const tournaments = await prisma.tournament.findMany({
    where: { tenantId },
    select: {
      id: true,
      title: true,
      status: true,
      totalSlots: true,
      _count: { select: { slots: true } },
    },
  });
  console.log('Tournaments:', tournaments);
}

main().finally(() => prisma.$disconnect());
