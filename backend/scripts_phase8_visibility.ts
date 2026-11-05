/**
 * Phase 8 — Player-feed visibility window E2E test.
 *
 * Scenario from the boss:
 *   "Match 12 hours away + admin sets 10-hour window -> match must stay hidden
 *    until only 10 hours remain, then appear automatically."
 *
 * Run with the backend up:  npx tsx scripts_phase8_visibility.ts
 */
import jwt from 'jsonwebtoken';
import { prisma } from './src/config/prisma.js';
import { env } from './src/config/env.js';

const BASE = 'http://localhost:5000/api/v1';
const HOUR = 60 * 60 * 1000;
let pass = 0;
let fail = 0;

const check = (name: string, ok: boolean, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  (${extra})` : ''}`);
};

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; data: any; message?: string }> {
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

/**
 * Test auth: sign a short-lived JWT for the seeded user directly.
 * (The production login endpoints now require Firebase idToken / email OTP,
 * which a headless test script cannot obtain — the JWT itself is what the
 * normal app session carries anyway.)
 */
async function login(tenantId: string, phoneNumber: string): Promise<string> {
  const user = await prisma.user.findFirstOrThrow({ where: { tenantId, phoneNumber } });
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );
}

/** Paginated search so the assertion never depends on total match count. */
async function findInList(token: string, title: string): Promise<any | null> {
  for (let page = 1; page <= 5; page++) {
    const r = await api(`/tournaments?limit=50&page=${page}`, { token });
    if (r.status !== 200) return null;
    const items: any[] = r.data?.items ?? [];
    const hit = items.find((t) => t.title === title);
    if (hit) return hit;
    if (items.length < 50) return null;
  }
  return null;
}

const isoIn = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const uniqueTitle = (tag: string) => `E2E ${tag} ${Date.now()}`;

const createdIds: string[] = [];

async function createMatch(
  adminToken: string,
  title: string,
  hoursAhead: number,
  visibilityHours?: number | null,
) {
  const body: Record<string, unknown> = {
    title,
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'BERMUDA',
    entryFee: 0,
    prizePool: 100,
    matchTime: isoIn(hoursAhead),
    totalSlots: 48,
  };
  if (visibilityHours !== undefined) body.visibilityHours = visibilityHours;
  const res = await api('/tournaments', { method: 'POST', token: adminToken, body });
  if (res.data?.id) createdIds.push(res.data.id);
  return res;
}

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { subdomain: 'apex-ff' } });
  const tenantId = tenant.id;

  console.log('\n== 0. AUTH ===================================================');
  const adminToken = await login(tenantId, '9999900001');
  const playerToken = await login(tenantId, '9999900003');
  check('admin login', Boolean(adminToken));
  check('player login', Boolean(playerToken));

  // ── 1. Hidden match: starts in 12h, window = 10h ─────────────────────
  console.log('\n== 1. CREATE 12h MATCH WITH 10h WINDOW =======================');
  const hiddenTitle = uniqueTitle('Hidden 12h/10h');
  const hidden = await createMatch(adminToken, hiddenTitle, 12, 10);
  check('create returns 201', hidden.status === 201, `status=${hidden.status}`);
  check('visibilityHours stored = 10', hidden.data?.visibilityHours === 10);
  const hiddenFromMs = Date.parse(hidden.data?.visibleFrom ?? '');
  const expectedFromMs = Date.parse(hidden.data?.matchTime ?? '') - 10 * HOUR;
  check(
    'visibleFrom = matchTime - 10h',
    Number.isFinite(hiddenFromMs) && Math.abs(hiddenFromMs - expectedFromMs) < 2000,
    hidden.data?.visibleFrom,
  );
  check('isListedNow = false', hidden.data?.isListedNow === false);

  const playerListHidden = await findInList(playerToken, hiddenTitle);
  check('PLAYER feed hides the match', playerListHidden === null);

  const adminListHidden = await findInList(adminToken, hiddenTitle);
  check('ADMIN list still shows the match', adminListHidden !== null);
  check('admin row has visibility metadata', adminListHidden?.visibilityHours === 10);

  const hiddenDetails = await api(`/tournaments/${hidden.data.id}`, { token: playerToken });
  check('player details 404 for hidden match', hiddenDetails.status === 404, `status=${hiddenDetails.status}`);

  const blockedJoin = await api(`/tournaments/${hidden.data.id}/join`, {
    method: 'POST',
    token: playerToken,
    body: {},
  });
  check(
    'join blocked before window (409 + IST message)',
    blockedJoin.status === 409 && /Registration is not open yet/.test(blockedJoin.message ?? ''),
    blockedJoin.message,
  );

  // ── 2. Admin can open the window early via PATCH ─────────────────────
  console.log('\n== 2. PATCH WINDOW TO 13h (OPENS NOW) ========================');
  const opened = await api(`/tournaments/${hidden.data.id}/visibility`, {
    method: 'PATCH',
    token: adminToken,
    body: { visibilityHours: 13 },
  });
  check('PATCH returns 200', opened.status === 200, `status=${opened.status}`);
  check('visibilityHours updated to 13', opened.data?.visibilityHours === 13);
  check('isListedNow = true after widening', opened.data?.isListedNow === true);

  const playerListOpen = await findInList(playerToken, hiddenTitle);
  check('PLAYER feed now shows the match', playerListOpen !== null);

  const detailsOpen = await api(`/tournaments/${hidden.data.id}`, { token: playerToken });
  check('player details now 200', detailsOpen.status === 200, `status=${detailsOpen.status}`);

  // ── 3. Admin can go back to "always visible" ─────────────────────────
  console.log('\n== 3. PATCH BACK TO ALWAYS VISIBLE ===========================');
  const always = await api(`/tournaments/${hidden.data.id}/visibility`, {
    method: 'PATCH',
    token: adminToken,
    body: { visibilityHours: null },
  });
  check('PATCH null clears the window', always.status === 200 && always.data?.visibleFrom === null);
  check('isListedNow = true with no window', always.data?.isListedNow === true);

  // ── 4. Validation + permissions ─────────────────────────────────────
  console.log('\n== 4. VALIDATION & PERMISSIONS ===============================');
  const badLow = await api(`/tournaments/${hidden.data.id}/visibility`, {
    method: 'PATCH',
    token: adminToken,
    body: { visibilityHours: 0 },
  });
  check('0 hours rejected (400)', badLow.status === 400, `status=${badLow.status}`);

  const badHigh = await api(`/tournaments/${hidden.data.id}/visibility`, {
    method: 'PATCH',
    token: adminToken,
    body: { visibilityHours: 500 },
  });
  check('500 hours rejected (400)', badHigh.status === 400, `status=${badHigh.status}`);

  const playerPatch = await api(`/tournaments/${hidden.data.id}/visibility`, {
    method: 'PATCH',
    token: playerToken,
    body: { visibilityHours: 6 },
  });
  check('player cannot change visibility (403)', playerPatch.status === 403, `status=${playerPatch.status}`);

  // ── 5. Create-time validation + immediate listing ───────────────────
  console.log('\n== 5. IMMEDIATE LISTING & CREATE VALIDATION =================');
  const immediateTitle = uniqueTitle('Immediate');
  const immediate = await createMatch(adminToken, immediateTitle, 6);
  check('create without window = always listed', immediate.status === 201 && immediate.data?.visibleFrom === null);
  check('isListedNow = true', immediate.data?.isListedNow === true);
  const playerImmediate = await findInList(playerToken, immediateTitle);
  check('PLAYER feed shows immediate match', playerImmediate !== null);

  const badWindowCreate = await createMatch(adminToken, uniqueTitle('Bad window'), 6, 0);
  check('create with 0-hour window rejected (400)', badWindowCreate.status === 400, `status=${badWindowCreate.status}`);

  // ── 6. Clone inherits the visibility preference ─────────────────────
  console.log('\n== 6. CLONE INHERITS WINDOW ==================================');
  const source = await createMatch(adminToken, uniqueTitle('Clone source'), 20, 8);
  const clone = await api(`/tournaments/${source.data.id}/clone`, {
    method: 'POST',
    token: adminToken,
    body: { matchTime: isoIn(30) },
  });
  if (clone.data?.id) createdIds.push(clone.data.id);
  const expectedCloneFrom = Date.parse(clone.data?.matchTime ?? '') - 8 * HOUR;
  check('clone created', clone.status === 201, `status=${clone.status}`);
  check('clone keeps visibilityHours = 8', clone.data?.visibilityHours === 8);
  check(
    'clone visibleFrom re-anchored to new matchTime',
    Number.isFinite(expectedCloneFrom) &&
      Math.abs(Date.parse(clone.data?.visibleFrom ?? '') - expectedCloneFrom) < 2000,
  );

  // ── 7. Small-window match (2h window, 12h away) stays hidden ────────
  console.log('\n== 7. 2h WINDOW ON A 12h MATCH ==============================');
  const tightTitle = uniqueTitle('Tight 12h/2h');
  const tight = await createMatch(adminToken, tightTitle, 12, 2);
  check('2h window stored', tight.data?.visibilityHours === 2);
  const playerTight = await findInList(playerToken, tightTitle);
  check('2h-window match hidden from players', playerTight === null);
  const seconds = tight.data?.secondsUntilListed ?? 0;
  check(
    'secondsUntilListed ~ 10h',
    Math.abs(seconds - 10 * 3600) < 120,
    `seconds=${seconds}`,
  );

  // ── 8. Joined player never loses their match when the window tightens ─
  console.log('\n== 8. JOINED PLAYER KEEPS A HIDDEN MATCH =====================');
  const joinedTitle = uniqueTitle('Joined then hidden');
  const joinedMatch = await createMatch(adminToken, joinedTitle, 12, 13); // window already open
  const joinRes = await api(`/tournaments/${joinedMatch.data.id}/join`, {
    method: 'POST',
    token: playerToken,
    body: {},
  });
  check('player joins while window is open (201)', joinRes.status === 201, `status=${joinRes.status}`);

  const reHidden = await api(`/tournaments/${joinedMatch.data.id}/visibility`, {
    method: 'PATCH',
    token: adminToken,
    body: { visibilityHours: 10 },
  });
  check('window tightened back to 10h (hidden)', reHidden.status === 200 && reHidden.data?.isListedNow === false);

  const joinedRow = await findInList(playerToken, joinedTitle);
  check('PLAYER feed still shows their joined match', joinedRow !== null);
  check('joined row keeps mySlot', joinedRow?.mySlot?.slotNumber != null);
  const joinedDetails = await api(`/tournaments/${joinedMatch.data.id}`, { token: playerToken });
  check('joined player can still open match details', joinedDetails.status === 200, `status=${joinedDetails.status}`);

  // ── Cleanup ─────────────────────────────────────────────────────────
  console.log('\n== CLEANUP ====================================================');
  const deletedSlots = await prisma.tournamentSlot.deleteMany({ where: { tournamentId: { in: createdIds } } });
  const deletedLedger = await prisma.walletLedger.deleteMany({ where: { referenceId: { in: createdIds } } });
  const deleted = await prisma.tournament.deleteMany({ where: { id: { in: createdIds } } });
  console.log(
    `  Removed ${deletedSlots.count} slot(s), ${deletedLedger.count} ledger row(s) and ${deleted.count} test match(es).`,
  );

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  try {
    await prisma.tournamentSlot.deleteMany({ where: { tournamentId: { in: createdIds } } });
    await prisma.walletLedger.deleteMany({ where: { referenceId: { in: createdIds } } });
    await prisma.tournament.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
