import jwt from 'jsonwebtoken';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
  const token = jwt.sign({ userId: admin.id, tenantId: admin.tenantId, role: admin.role }, env.JWT_SECRET,
    { expiresIn: '1h', issuer: 'freefire-tournament-api', audience: 'freefire-tournament-apps' });

  const m = await prisma.tournament.findFirstOrThrow({
    where: { status: 'UNDER_REVIEW' },
    orderBy: { matchNumber: 'asc' },
    select: { id: true, matchNumber: true, entryFee: true },
  });
  const slots = await prisma.tournamentSlot.findMany({ where: { tournamentId: m.id }, select: { userId: true } });
  const before = slots.length
    ? await prisma.user.findUniqueOrThrow({ where: { id: slots[0].userId }, select: { depositBalance: true, winningBalance: true } })
    : null;

  const res = await fetch(`http://localhost:5000/api/v1/tournaments/${m.id}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Owner cancelled the under-review match from the console' }),
  });
  const body: any = await res.json().catch(() => ({}));
  console.log('UNDER_REVIEW cancel =>', res.status, JSON.stringify(body.message).slice(0, 120));
  console.log('refundedPlayers:', body.data?.refundedPlayers, '| totalRefunded:', body.data?.totalRefunded, '| status:', body.data?.status);

  const after = await prisma.tournament.findUniqueOrThrow({ where: { id: m.id }, select: { status: true } });
  console.log('db status:', after.status, '| match #', m.matchNumber);

  if (before) {
    const after1 = await prisma.user.findUniqueOrThrow({ where: { id: slots[0].userId }, select: { depositBalance: true, winningBalance: true } });
    console.log('player balance:', Number(before.depositBalance), '+', Number(before.winningBalance), '->', Number(after1.depositBalance), '+', Number(after1.winningBalance));
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error('ERR', e?.message ?? e); process.exit(1); });
