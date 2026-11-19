/**
 * HTTP-level check for the ban-refund coin switch:
 * hits the real route (guards + controller + response) with a real admin token.
 *
 * Usage: cd backend && npx tsx scripts/verifyBanRefundHttp.ts
 */
import { prisma } from '../src/config/prisma.js';
import { createAdminSession } from '../src/services/adminSession.service.js';
import { createTournament, joinTournament } from '../src/services/tournament.service.js';
import { banMatchParticipant } from '../src/services/matchRoster.service.js';
import type { AuthUser } from '../src/types/auth.js';

const BASE = 'http://localhost:5000/api/v1';
const TENANT_ID = '53a09545-e6e2-4cf5-a5c2-7ef18b276a52';
const PHONE = '9000000001';
const FEE = 10;

async function http(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json?.data, message: json?.message };
}

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  if (ok) pass += 1;
  else fail += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
};

async function main(): Promise<void> {
  const owner = await prisma.user.findFirstOrThrow({
    where: { tenantId: TENANT_ID, role: 'ADMIN' },
  });
  const staff: AuthUser = {
    userId: owner.id,
    tenantId: TENANT_ID,
    role: 'ADMIN',
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: true,
    canManageWallet: true,
  };
  const player = await prisma.user.findFirstOrThrow({
    where: { tenantId: TENANT_ID, phoneNumber: PHONE },
    select: { id: true },
  });
  const playerAuth: AuthUser = {
    userId: player.id,
    tenantId: TENANT_ID,
    role: 'USER',
    canCreateMatch: false,
    canUpdateRoomId: false,
    canDistributePrize: false,
    canManageWallet: false,
  };

  const before = Number(
    (await prisma.user.findUniqueOrThrow({ where: { id: player.id }, select: { depositBalance: true } }))
      .depositBalance,
  );
  const { token } = await createAdminSession(owner, { ip: '127.0.0.1', userAgent: 'verify-script' });

  const match = await createTournament(staff, {
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'BERMUDA',
    entryFee: FEE,
    perKillPrize: 5,
    matchTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    totalSlots: 20,
    visibilityHours: null,
    roomRevealMinutes: 5,
  });

  try {
    await joinTournament(playerAuth, match.id, 1, undefined, undefined, undefined, false);
    await banMatchParticipant(staff, match.id, player.id, true, 'http verify');

    const path = `/admin/matches/${match.id}/participants/${player.id}/ban-refund`;

    const on = await http('PATCH', path, token, { refund: true });
    check('PATCH ban-refund {refund:true} -> 200', on.status === 200, `status ${on.status} ${on.message ?? ''}`);
    const onSeat = on.data?.players?.find((p: any) => p.userId === player.id);
    check('response board shows refunded = entry fee', onSeat?.refunded === FEE, `refunded=${onSeat?.refunded}`);

    const off = await http('PATCH', path, token, { refund: false });
    const offSeat = off.data?.players?.find((p: any) => p.userId === player.id);
    check('PATCH ban-refund {refund:false} -> 200', off.status === 200, `status ${off.status}`);
    check('response board shows refunded = 0', offSeat?.refunded === 0, `refunded=${offSeat?.refunded}`);

    const bad = await http('PATCH', path, token, { refund: 'yes' });
    check('invalid body is rejected (400)', bad.status === 400, `status ${bad.status}`);

    const noAuth = await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refund: true }),
    });
    check('no token -> 401', noAuth.status === 401, `status ${noAuth.status}`);
  } finally {
    await prisma.walletLedger.deleteMany({ where: { referenceId: match.id, userId: player.id } });
    await prisma.tournamentSlot.deleteMany({ where: { tournamentId: match.id } });
    await prisma.tournament.deleteMany({ where: { id: match.id } });
    await prisma.user.update({ where: { id: player.id }, data: { depositBalance: before } });
    await prisma.adminSession.deleteMany({ where: { userId: owner.id, userAgent: 'verify-script' } });
    console.log(`\ncleanup done — balance back to ₹${before}`);
  }

  console.log(`\n── ${pass} passed, ${fail} failed ──`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('FATAL', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
