import { prisma, disconnectPrisma } from './dist/config/prisma.js';

async function main() {
  const [tenants, users, nullCodes, matches, nullNumbers] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.user.count({ where: { playerCode: null } }),
    prisma.tournament.count(),
    prisma.tournament.count({ where: { matchNumber: null } }),
  ]);
  console.log(JSON.stringify({ tenants, users, nullCodes, matches, nullNumbers }, null, 2));
  const t = await prisma.tenant.findFirst({ select: { id: true, brandName: true, subdomain: true } });
  console.log('first tenant:', t);
  if (t) {
    const admins = await prisma.user.findMany({
      where: { tenantId: t.id, role: 'ADMIN' },
      select: { id: true, name: true, phoneNumber: true, playerCode: true },
      take: 3,
    });
    console.log('admins:', admins);
    const last = await prisma.tournament.findFirst({
      where: { tenantId: t.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, matchNumber: true, status: true, createdAt: true },
    });
    console.log('last match:', last);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
