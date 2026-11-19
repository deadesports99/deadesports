import { prisma } from '../src/config/prisma.js';

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF'] } },
    select: { role: true, email: true, phone: true },
    take: 5,
  });
  console.log(JSON.stringify(admins, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1); });
