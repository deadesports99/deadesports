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
  return r.data?.token as string;
}

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { subdomain: 'apex-ff' } });
  const tenantId = tenant.id;
  const adminToken = await login(tenantId, '9999900001');
  const playerToken = await login(tenantId, '9999900003');
  const staffToken = await login(tenantId, '9999900002');

  const original = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const backup = {
    upiId: original.upiId,
    upiName: original.upiName,
    supportWhatsapp: original.supportWhatsapp,
    minDeposit: original.minDeposit,
  };

  console.log('\n== 1. TENANT SETTINGS (runtime UPI / WhatsApp) ================');
  const pub = await api('/tenant/settings', { token: playerToken });
  check('player reads /tenant/settings', pub.status === 200 && typeof pub.data?.upiId === 'string',
    `upi=${pub.data?.upiId} min=${pub.data?.minDeposit}`);

  const anon = await api('/tenant/settings');
  check('anonymous blocked (401)', anon.status === 401, `status=${anon.status}`);

  const playerPatch = await api('/admin/tenant/settings', {
    method: 'PATCH', token: playerToken, body: { upiId: 'hacker@okaxis' },
  });
  check('player cannot PATCH settings (403)', playerPatch.status === 403, `status=${playerPatch.status}`);

  const staffPatch = await api('/admin/tenant/settings', {
    method: 'PATCH', token: staffToken, body: { upiId: 'staff@okaxis' },
  });
  check('sub-admin cannot PATCH settings (403)', staffPatch.status === 403, `status=${staffPatch.status}`);

  const adminGet = await api('/admin/tenant/settings', { token: adminToken });
  check('owner reads /admin/tenant/settings', adminGet.status === 200 && adminGet.data?.brandName === tenant.brandName);

  const badUpi = await api('/admin/tenant/settings', {
    method: 'PATCH', token: adminToken, body: { upiId: 'not-a-upi' },
  });
  check('invalid UPI rejected (400)', badUpi.status === 400, `status=${badUpi.status}`);

  const badWhatsapp = await api('/admin/tenant/settings', {
    method: 'PATCH', token: adminToken, body: { supportWhatsapp: 'abc' },
  });
  check('invalid WhatsApp rejected (400)', badWhatsapp.status === 400, `status=${badWhatsapp.status}`);

  const badMin = await api('/admin/tenant/settings', {
    method: 'PATCH', token: adminToken, body: { minDeposit: 1 },
  });
  check('min deposit floor enforced (400)', badMin.status === 400, `status=${badMin.status}`);

  const saved = await api('/admin/tenant/settings', {
    method: 'PATCH', token: adminToken,
    body: {
      upiId: 'phase6.test@okaxis',
      upiName: 'Phase 6 Test Payee',
      supportWhatsapp: '919999900123',
      minDeposit: 20,
    },
  });
  check('owner saves all 4 settings', saved.status === 200 &&
    saved.data?.upiId === 'phase6.test@okaxis' &&
    saved.data?.upiName === 'Phase 6 Test Payee' &&
    saved.data?.supportWhatsapp === '919999900123' &&
    saved.data?.minDeposit === 20,
    `upi=${saved.data?.upiId} wa=${saved.data?.supportWhatsapp}`);

  const refreshed = await api('/tenant/settings', { token: playerToken });
  check('player app sees the new UPI instantly (no APK rebuild)',
    refreshed.data?.upiId === 'phase6.test@okaxis' && refreshed.data?.minDeposit === 20 && refreshed.data?.supportWhatsapp === '919999900123');

  const belowMin = await api('/wallet/deposit', {
    method: 'POST', token: playerToken,
    body: { amount: 15, utrNumber: ('T' + Date.now().toString().slice(-11)).toUpperCase() },
  });
  check('deposit below the new tenant floor rejected (400)', belowMin.status === 400, `status=${belowMin.status} msg=${belowMin.message}`);

  const waCleared = await api('/admin/tenant/settings', {
    method: 'PATCH', token: adminToken, body: { supportWhatsapp: '' },
  });
  check('WhatsApp can be cleared (empty)', waCleared.status === 200 && waCleared.data?.supportWhatsapp === '');

  console.log('\n== 2. PLAYER CAREER STATS ====================================');
  const stats = await api('/players/me/stats', { token: playerToken });
  check('GET /players/me/stats', stats.status === 200 && typeof stats.data?.matchesJoined === 'number' &&
    typeof stats.data?.totalKills === 'number' && typeof stats.data?.totalWinnings === 'number',
    JSON.stringify(stats.data));

  const anonStats = await api('/players/me/stats');
  check('anonymous stats blocked (401)', anonStats.status === 401, `status=${anonStats.status}`);

  console.log('\n== 3. ADMIN MATCH OPS (cancel + sweep routes) ================');
  const sweep = await api('/tournaments/sweep/states', { method: 'POST', token: adminToken, body: {} });
  check('sweep endpoint reachable', sweep.status === 200, `status=${sweep.status}`);

  const cancelMissing = await api('/tournaments/00000000-0000-0000-0000-000000000000/cancel', {
    method: 'POST', token: adminToken, body: {},
  });
  check('cancel on unknown match rejected (400/404)', cancelMissing.status === 400 || cancelMissing.status === 404, `status=${cancelMissing.status}`);

  // ─── restore the tenant settings exactly as they were ─────────────────
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      upiId: backup.upiId,
      upiName: backup.upiName,
      supportWhatsapp: backup.supportWhatsapp,
      minDeposit: backup.minDeposit,
    },
  });
  const restored = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  console.log(`\n(cleanup: tenant settings restored -> upi=${restored.upiId}, wa=${restored.supportWhatsapp}, min=${restored.minDeposit})`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('PHASE 6 PROBE CRASHED:', e);
  await prisma.$disconnect();
  process.exit(1);
});
