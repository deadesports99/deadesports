import { prisma } from './src/config/prisma.js';

const BASE = 'http://localhost:5000/api/v1';
let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  (${extra})` : ''}`);
};

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  return { status: res.status, data: json?.data, message: json?.message };
}

async function login(tenantId: string, phoneNumber: string) {
  const r = await api('/auth/player/login', { method: 'POST', body: { tenantId, phoneNumber } });
  return { status: r.status, token: r.data?.token as string | undefined, userId: r.data?.user?.id as string | undefined };
}

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { subdomain: 'apex-ff' } });
  const tenantId = tenant.id;
  const admin = await login(tenantId, '9999900001');
  const adminToken = admin.token!;
  const playerLogin = await login(tenantId, '9999900003');
  const playerToken = playerLogin.token!;
  const playerId = (await prisma.user.findFirstOrThrow({ where: { tenantId, phoneNumber: '9999900003' } })).id;
  const before = await prisma.user.findUniqueOrThrow({ where: { id: playerId } });
  const beforeDeposit = Number(before.depositBalance);
  const beforeWinning = Number(before.winningBalance);

  const created = { staffId: '', staffPhone: '', tournamentId: '', withdrawalId: '', depositId: '' };

  console.log('\n== 1. STAFF MANAGEMENT (owner only) ==========================');
  const stamp = Date.now().toString().slice(-6);
  created.staffPhone = `99999${stamp}`;
  const staffEmail = `smoke.staff.${stamp}@example.com`;

  const list0 = await api('/auth/admin/staff', { token: adminToken });
  check('GET /auth/admin/staff lists staff', list0.status === 200 && Array.isArray(list0.data?.staff), `count=${list0.data?.count}`);

  const playerStaffList = await api('/auth/admin/staff', { token: playerToken });
  check('player blocked from staff console (403)', playerStaffList.status === 403, `status=${playerStaffList.status}`);

  const hire = await api('/auth/admin/staff', {
    method: 'POST', token: adminToken,
    body: { name: 'Smoke Staff', email: staffEmail, phoneNumber: created.staffPhone, permissions: { canCreateMatch: false } },
  });
  created.staffId = hire.data?.user?.id ?? '';
  check('hire staff -> 201 SUB_ADMIN', hire.status === 201 && hire.data?.user?.role === 'SUB_ADMIN', `id=${created.staffId.slice(0, 8)}`);

  const dupHire = await api('/auth/admin/staff', {
    method: 'POST', token: adminToken,
    body: { name: 'Dup Staff', email: staffEmail, phoneNumber: created.staffPhone },
  });
  check('duplicate staff phone rejected (409)', dupHire.status === 409, `status=${dupHire.status}`);

  const staffLogin = await login(tenantId, created.staffPhone);
  check('new staff can log in on the admin app', Boolean(staffLogin.token));

  const staffDenied = await api('/admin/wallet/deposits?status=PENDING', { token: staffLogin.token });
  check('staff without canManageWallet blocked (403)', staffDenied.status === 403, `status=${staffDenied.status}`);

  const grant = await api(`/auth/admin/staff/${created.staffId}`, {
    method: 'PATCH', token: adminToken,
    body: { permissions: { canCreateMatch: true, canUpdateRoomId: false, canDistributePrize: false, canManageWallet: true } },
  });
  check('PATCH grants canManageWallet', grant.status === 200 && grant.data?.staff?.permissions?.canManageWallet === true);

  const staffAllowed = await api('/admin/wallet/deposits?status=PENDING', { token: staffLogin.token });
  check('permission applies instantly (auth cache invalidated)', staffAllowed.status === 200, `status=${staffAllowed.status}`);

  const staffCannotPatch = await api(`/auth/admin/staff/${created.staffId}`, { method: 'PATCH', token: staffLogin.token, body: { name: 'Hacked' } });
  check('staff cannot manage staff (403)', staffCannotPatch.status === 403, `status=${staffCannotPatch.status}`);

  console.log('\n== 2. DEPOSIT -> UTR APPROVAL -> CREDIT =====================');
  const utr = ('L' + Date.now().toString().slice(-11)).toUpperCase();
  const dep = await api('/wallet/deposit', { method: 'POST', token: playerToken, body: { amount: 100, utrNumber: utr } });
  created.depositId = dep.data?.deposit?.id ?? '';
  check('player submits Rs.100 UTR deposit -> PENDING', dep.status === 201 && dep.data?.deposit?.status === 'PENDING', `status=${dep.status}`);

  const dupUtr = await api('/wallet/deposit', { method: 'POST', token: playerToken, body: { amount: 100, utrNumber: utr } });
  check('duplicate UTR rejected (409)', dupUtr.status === 409, `status=${dupUtr.status}`);

  const depApprove = await api(`/admin/wallet/deposits/${created.depositId}/approve`, { method: 'POST', token: adminToken, body: {} });
  check('admin approves deposit -> balance credited',
    depApprove.status === 200 && Number(depApprove.data?.depositBalance) === beforeDeposit + 100,
    `balance=${depApprove.data?.depositBalance}`);

  const reApprove = await api(`/admin/wallet/deposits/${created.depositId}/approve`, { method: 'POST', token: adminToken, body: {} });
  check('double approve blocked (no double credit)', reApprove.status >= 400, `status=${reApprove.status}`);

  console.log('\n== 3. MATCH -> JOIN -> ROOM -> SCORE -> PAYOUT ==============');
  const create = await api('/tournaments', {
    method: 'POST', token: adminToken,
    body: {
      title: `Lifecycle Smoke ${stamp}`,
      gameMode: 'BATTLE_ROYALE', matchType: 'SOLO', mapType: 'BERMUDA',
      entryFee: 10, prizePool: 100, perKillPrize: 5,
      matchTime: new Date(Date.now() + 10 * 60_000).toISOString(),
    },
  });
  created.tournamentId = create.data?.id ?? '';
  check('admin creates tournament (T-10min)', create.status === 201, `id=${created.tournamentId.slice(0, 8)}`);

  const slots = await api(`/tournaments/${created.tournamentId}/slots`, { token: playerToken });
  check('48 slots load for the seat map', slots.data?.totalSlots === 48 && slots.data?.slots?.length === 48, `slots=${slots.data?.slots?.length}`);

  const join = await api(`/tournaments/${created.tournamentId}/join`, { method: 'POST', token: playerToken, body: { slotNumber: 7 } });
  check('player books seat #7 (entry fee debited)', join.status === 201 && join.data?.slotNumber === 7, `status=${join.status}`);

  const secondJoin = await api(`/tournaments/${created.tournamentId}/join`, { method: 'POST', token: playerToken, body: { slotNumber: 9 } });
  check('duplicate join blocked (409)', secondJoin.status === 409, `status=${secondJoin.status}`);

  const walletAfterJoin = await api('/wallet', { token: playerToken });
  check('deposit balance = +100 -10 entry', Number(walletAfterJoin.data?.depositBalance) === beforeDeposit + 90, `balance=${walletAfterJoin.data?.depositBalance}`);

  const room = await api(`/tournaments/${created.tournamentId}/room`, {
    method: 'PATCH', token: adminToken, body: { roomId: 'SMOKE1234', roomPassword: 'SI_SECRET_PASS_42' },
  });
  check('admin publishes room -> ROOM_REVEALED', room.status === 200 && room.data?.status === 'ROOM_REVEALED', `status=${room.data?.status}`);

  const playerRoom = await api(`/tournaments/${created.tournamentId}/room`, { token: playerToken });
  check('player sees room creds inside T-15 window', playerRoom.status === 200 && playerRoom.data?.roomId === 'SMOKE1234');

  const payout = await api(`/tournaments/${created.tournamentId}/payout`, {
    method: 'POST', token: adminToken,
    body: { results: [{ userId: playerId, verifiedKills: 3, rank: 1, isDisqualified: false }] },
  });
  check('1-click payout: rank1 Rs.50 + 3 kills Rs.15 = Rs.65', payout.status === 200 && Number(payout.data?.totalPaid) === 65, `paid=${payout.data?.totalPaid}`);
  check('tournament marked COMPLETED', payout.data?.status === 'COMPLETED', `status=${payout.data?.status}`);

  const walletAfterPayout = await api('/wallet', { token: playerToken });
  const ledger0 = walletAfterPayout.data?.ledger?.[0];
  check('Rs.65 credited to winning balance (WINNING_PRIZE ledger)',
    Number(walletAfterPayout.data?.winningBalance) === beforeWinning + 65 && ledger0?.category === 'WINNING_PRIZE',
    `winning=${walletAfterPayout.data?.winningBalance} category=${ledger0?.category}`);

  const results = await api(`/tournaments/${created.tournamentId}/results`, { token: playerToken });
  const row = results.data?.scoreboard?.[0];
  check('official scoreboard shows Booyah row', results.status === 200 && row?.rank === 1 && row?.kills === 3 && Number(row?.prizeWon) === 65,
    `rank=${row?.rank} kills=${row?.kills} prize=${row?.prizeWon}`);
  check('scoreboard header carries map + mode (banner)',
    results.data?.tournament?.mapType === 'BERMUDA' && results.data?.tournament?.gameMode === 'BATTLE_ROYALE');

  const rejoin = await api(`/tournaments/${created.tournamentId}/join`, { method: 'POST', token: playerToken, body: { slotNumber: 8 } });
  check('completed match rejects new joins (409)', rejoin.status === 409, `status=${rejoin.status}`);

  console.log('\n== 4. WITHDRAWAL (winning -> UPI payout) ====================');
  const wd = await api('/wallet/withdraw', { method: 'POST', token: playerToken, body: { amount: 50, upiId: 'smoke.player@okaxis' } });
  created.withdrawalId = wd.data?.withdrawal?.id ?? '';
  check('player requests Rs.50 withdrawal (funds held)',
    wd.status === 201 && Number(wd.data?.winningBalance) === beforeWinning + 15, `winning=${wd.data?.winningBalance}`);

  const queue = await api('/admin/wallet/withdrawals?status=PENDING', { token: adminToken });
  const target = (queue.data?.withdrawals ?? []).find((w: any) => w.id === created.withdrawalId);
  check('withdrawal appears in admin queue', Boolean(target), `queue=${queue.data?.withdrawals?.length}`);

  const approveWd = await api(`/admin/wallet/withdrawals/${created.withdrawalId}/approve`, {
    method: 'POST', token: adminToken, body: { utrNumber: '409012345678' },
  });
  check('admin approves payout with UTR', approveWd.status === 200 && approveWd.data?.withdrawal?.status === 'APPROVED', `status=${approveWd.status}`);

  const finalWallet = await api('/wallet', { token: playerToken });
  const categories = (finalWallet.data?.ledger ?? []).map((l: any) => l.category);
  check('ledger trail: ADD_MONEY -> JOIN_FEE -> WINNING_PRIZE -> WITHDRAWAL',
    ['ADD_MONEY', 'JOIN_FEE', 'WINNING_PRIZE', 'WITHDRAWAL'].every((c) => categories.includes(c)),
    categories.slice(0, 5).join(','));

  console.log('\n== 5. STAFF DEACTIVATION ====================================');
  const remove = await api(`/auth/admin/staff/${created.staffId}`, { method: 'DELETE', token: adminToken });
  check('DELETE deactivates staff', remove.status === 200 && remove.data?.staff?.isBanned === true, `status=${remove.status}`);

  const staffAfter = await api('/admin/wallet/deposits', { token: staffLogin.token });
  check('deactivated staff token rejected', staffAfter.status === 401 || staffAfter.status === 403, `status=${staffAfter.status}`);

  const staffLoginAfter = await login(tenantId, created.staffPhone);
  check('deactivated staff cannot log in again', staffLoginAfter.status >= 400 && !staffLoginAfter.token, `status=${staffLoginAfter.status}`);

  // ---------------- CLEANUP ----------------
  await prisma.walletLedger.deleteMany({ where: { tenantId, referenceId: { in: [created.tournamentId, created.withdrawalId, created.depositId].filter(Boolean) } } });
  await prisma.walletLedger.deleteMany({ where: { userId: playerId, referenceId: null } });
  await prisma.matchResult.deleteMany({ where: { tournamentId: created.tournamentId } });
  await prisma.tournamentSlot.deleteMany({ where: { tournamentId: created.tournamentId } });
  await prisma.tournament.deleteMany({ where: { id: created.tournamentId } });
  await prisma.withdrawalRequest.deleteMany({ where: { id: created.withdrawalId } });
  await prisma.depositRequest.deleteMany({ where: { id: created.depositId } });
  await prisma.user.update({ where: { id: playerId }, data: { depositBalance: before.depositBalance, winningBalance: before.winningBalance } });
  if (created.staffId) await prisma.user.deleteMany({ where: { id: created.staffId } });

  const restored = await prisma.user.findUniqueOrThrow({ where: { id: playerId } });
  console.log(`\n(cleanup: staff deleted, match/ledger rows removed, balances restored to ${restored.depositBalance}/${restored.winningBalance})`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('LIFECYCLE SMOKE CRASHED:', e);
  await prisma.$disconnect();
  process.exit(1);
});