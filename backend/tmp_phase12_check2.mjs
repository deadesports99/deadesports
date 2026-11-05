import { prisma, disconnectPrisma } from './dist/config/prisma.js';

async function main() {
  const ledgers = await prisma.walletLedger.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      id: true,
      userId: true,
      type: true,
      balanceType: true,
      category: true,
      amount: true,
      balanceAfter: true,
      referenceId: true,
      notes: true,
      createdAt: true,
    },
  });
  console.log('recent ledgers:', JSON.stringify(ledgers, null, 2));

  const banned = await prisma.user.findMany({
    where: { isBanned: true },
    select: { id: true, playerCode: true, name: true, phoneNumber: true, role: true },
  });
  console.log('banned users:', banned);

  const results = await prisma.matchResult.findMany({
    orderBy: { reviewedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      tournamentId: true,
      rank: true,
      verifiedKills: true,
      prizeWon: true,
      isApproved: true,
      reviewedAt: true,
    },
  });
  console.log('recent results:', JSON.stringify(results, null, 2));

  const codes = await prisma.user.findMany({
    where: { role: 'USER' },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: { playerCode: true, name: true, createdAt: true },
  });
  console.log('first player codes:', codes);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
