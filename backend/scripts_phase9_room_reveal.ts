/**
 * Phase 9 — Admin-controlled Room ID / Password reveal E2E test.
 *
 * Boss requirement:
 *   "Custom Room ID & Password players ko kab dikhe — 15 min pehle ya jab
 *    admin chahe" — exactly like the match visibility window.
 *
 * Run with the backend up:  npx tsx scripts_phase9_room_reveal.ts
 */
import jwt from 'jsonwebtoken';
import { prisma } from './src/config/prisma.js';
import { env } from './src/config/env.js';

const BASE = 'http://localhost:5000/api/v1';
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
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
 * (Production login endpoints require Firebase idToken / email OTP, which a
 * headless script cannot obtain — the JWT is what a real app session carries.)
 */
async function login(tenantId: string, phoneNumber: string): Promise<string> {
  const user = await prisma.user.findFirstOrThrow({ where: { tenantId, phoneNumber } });
  return jwt.sign(
    { userId: user.id, tenantId: user.tenantId, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '15m' },
  );
}

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

const uniqueTitle = (tag: string) => `E2E-Room ${tag} ${Date.now()}`;
const createdIds: string[] = [];

async function createMatch(
  adminToken: string,
  title: string,
  msAhead: number,
  roomRevealMinutes?: number,
) {
  const body: Record<string, unknown> = {
    title,
    gameMode: 'BATTLE_ROYALE',
    matchType: 'SOLO',
    mapType: 'BERMUDA',
    entryFee: 0,
    prizePool: 100,
    matchTime: new Date(Date.now() + msAhead).toISOString(),
    totalSlots: 48,
  };
  if (roomRevealMinutes !== undefined) body.roomRevealMinutes = roomRevealMinutes;
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

  // ── 1. Create a match with a 30-minute reveal window ─────────────────
  console.log('\n== 1. CREATE MATCH WITH 30-MIN ROOM WINDOW ===================');
  const mainTitle = uniqueTitle('Locked 12h/30m');
  const main = await createMatch(adminToken, mainTitle, 12 * HOUR, 30);
  check('create returns 201', main.status === 201, `status=${main.status}`);
  check('roomRevealMinutes stored = 30', main.data?.roomRevealMinutes === 30);
  check(
    'secondsUntilRoomReveal ~ 11.5h',
    Math.abs((main.data?.secondsUntilRoomReveal ?? 0) - 11.5 * 3600) < 120,
    `seconds=${main.data?.secondsUntilRoomReveal}`,
  );
  check('roomUnlocked = false before publish', main.data?.roomUnlocked === false);

  const joined = await api(`/tournaments/${main.data.id}/join`, {
    method: 'POST',
    token: playerToken,
    body: {},
  });
  check('player joins (201)', joined.status === 201, `status=${joined.status}`);
  check('player got a slot', joined.data?.slotNumber != null);

  // ── 2. Publish credentials early -> still locked for players ────────
  console.log('\n== 2. PUBLISH EARLY (NO REVEAL NOW) =========================');
  const published = await api(`/tournaments/${main.data.id}/room`, {
    method: 'PATCH',
    token: adminToken,
    body: { roomId: 'ROOM-55221', roomPassword: 'pass9211' },
  });
  check('publish returns 200', published.status === 200, `status=${published.status}`);
  check('published but still locked', published.data?.roomUnlocked === false);
  check('status stays OPEN (not revealed)', published.data?.status === 'OPEN', `status=${published.data?.status}`);

  const lockedRoom = await api(`/tournaments/${main.data.id}/room`, { token: playerToken });
  check('player room fetch is 403 (locked)', lockedRoom.status === 403, `status=${lockedRoom.status}`);
  check(
    'lock message mentions the admin window',
    /30 minutes/.test(lockedRoom.message ?? '') && /revealed/i.test(lockedRoom.message ?? ''),
    lockedRoom.message,
  );

  const playerRowLocked = await findInList(playerToken, mainTitle);
  check('player list: roomUnlocked = false', playerRowLocked?.roomUnlocked === false);
  check('player list: isRoomReady = false', playerRowLocked?.isRoomReady === false);
  check('player list: no credentials leaked', playerRowLocked?.room == null);

  const adminRowLocked = await findInList(adminToken, mainTitle);
  check('admin list sees roomUnlocked = false', adminRowLocked?.roomUnlocked === false);

  // ── 3. Admin "Reveal Now" -> credentials visible instantly ──────────
  console.log('\n== 3. ADMIN REVEAL NOW =======================================');
  const revealed = await api(`/tournaments/${main.data.id}/room-reveal`, {
    method: 'PATCH',
    token: adminToken,
    body: { revealNow: true },
  });
  check('reveal-now returns 200', revealed.status === 200, `status=${revealed.status}`);
  check('roomUnlocked = true', revealed.data?.roomUnlocked === true);
  check('status is ROOM_REVEALED', revealed.data?.status === 'ROOM_REVEALED', `status=${revealed.data?.status}`);

  const unlockedRoom = await api(`/tournaments/${main.data.id}/room`, { token: playerToken });
  check('player room fetch is 200 now', unlockedRoom.status === 200, `status=${unlockedRoom.status}`);
  check('player sees the correct Room ID', unlockedRoom.data?.roomId === 'ROOM-55221');
  check('player sees the correct Password', unlockedRoom.data?.roomPassword === 'pass9211');

  const playerRowUnlocked = await findInList(playerToken, mainTitle);
  check('player list: roomUnlocked = true', playerRowUnlocked?.roomUnlocked === true);
  check('player list: isRoomReady = true', playerRowUnlocked?.isRoomReady === true);
  check('player list: details expose room', playerRowUnlocked?.room != null);

  // ── 4. Reveal window is editable + validated ───────────────────────
  console.log('\n== 4. WINDOW EDIT & VALIDATION ===============================');
  const freshTitle = uniqueTitle('Window edit');
  const fresh = await createMatch(adminToken, freshTitle, 10 * HOUR, 15);
  const editedWindow = await api(`/tournaments/${fresh.data.id}/room-reveal`, {
    method: 'PATCH',
    token: adminToken,
    body: { roomRevealMinutes: 120 },
  });
  check('PATCH roomRevealMinutes = 120', editedWindow.status === 200 && editedWindow.data?.roomRevealMinutes === 120);
  check(
    'reveal time moved to matchTime - 2h',
    Math.abs(Date.parse(editedWindow.data?.roomRevealsAt ?? '') - (Date.parse(fresh.data?.matchTime ?? '') - 2 * HOUR)) < 2000,
  );
  check('still locked after window edit', editedWindow.data?.roomUnlocked === false);

  const zero = await api(`/tournaments/${fresh.data.id}/room-reveal`, {
    method: 'PATCH',
    token: adminToken,
    body: { roomRevealMinutes: 0 },
  });
  check('0 minutes rejected (400)', zero.status === 400, `status=${zero.status}`);

  const tooBig = await api(`/tournaments/${fresh.data.id}/room-reveal`, {
    method: 'PATCH',
    token: adminToken,
    body: { roomRevealMinutes: 20000 },
  });
  check('20000 minutes rejected (400)', tooBig.status === 400, `status=${tooBig.status}`);

  const revealNoCreds = await api(`/tournaments/${fresh.data.id}/room-reveal`, {
    method: 'PATCH',
    token: adminToken,
    body: { revealNow: true },
  });
  check('reveal-now without credentials rejected (409)', revealNoCreds.status === 409, `status=${revealNoCreds.status}`);

  const playerReveal = await api(`/tournaments/${fresh.data.id}/room-reveal`, {
    method: 'PATCH',
    token: playerToken,
    body: { revealNow: true },
  });
  check('player cannot change room reveal (403)', playerReveal.status === 403, `status=${playerReveal.status}`);

  // ── 5. Auto reveal by the lifecycle sweep (per-match window) ────────
  console.log('\n== 5. AUTO REVEAL VIA SWEEP =================================');
  const soonTitle = uniqueTitle('Auto 20m');
  const soon = await createMatch(adminToken, soonTitle, 20 * MIN, 15);
  const soonJoin = await api(`/tournaments/${soon.data.id}/join`, {
    method: 'POST',
    token: playerToken,
    body: {},
  });
  check('player joins the soon match', soonJoin.status === 201, `status=${soonJoin.status}`);
  const soonPublish = await api(`/tournaments/${soon.data.id}/room`, {
    method: 'PATCH',
    token: adminToken,
    body: { roomId: 'ROOM-AAAA', roomPassword: 'pass-aaaa' },
  });
  check('soon match published but locked', soonPublish.status === 200 && soonPublish.data?.roomUnlocked === false);
  const soonLocked = await api(`/tournaments/${soon.data.id}/room`, { token: playerToken });
  check('soon match room locked before sweep (403)', soonLocked.status === 403, `status=${soonLocked.status}`);

  // Simulate time passing: move kickoff inside the 15-minute reveal window.
  await prisma.tournament.update({
    where: { id: soon.data.id },
    data: { matchTime: new Date(Date.now() + 5 * MIN) },
  });

  const sweep = await api('/tournaments/sweep/states', { method: 'POST', token: adminToken });
  check('manual sweep runs', sweep.status === 200, `status=${sweep.status}`);
  const sweptIds: string[] = (sweep.data?.roomRevealed ?? []).map((m: any) => m.id);
  check('sweep revealed the due room', sweptIds.includes(soon.data.id), `count=${sweptIds.length}`);

  const soonUnlocked = await api(`/tournaments/${soon.data.id}/room`, { token: playerToken });
  check('sweep auto-unlocked the room for the player', soonUnlocked.status === 200, `status=${soonUnlocked.status}`);
  check('player sees auto-revealed room ID', soonUnlocked.data?.roomId === 'ROOM-AAAA');

  const soonRow = await findInList(playerToken, soonTitle);
  check('list shows the match as ROOM_REVEALED', soonRow?.status === 'ROOM_REVEALED', `status=${soonRow?.status}`);

  // ── 6. Clone inherits the reveal window ────────────────────────────
  console.log('\n== 6. CLONE INHERITS REVEAL WINDOW ===========================');
  const clone = await api(`/tournaments/${main.data.id}/clone`, {
    method: 'POST',
    token: adminToken,
    body: { matchTime: new Date(Date.now() + 24 * HOUR).toISOString() },
  });
  if (clone.data?.id) createdIds.push(clone.data.id);
  check('clone created', clone.status === 201, `status=${clone.status}`);
  check('clone keeps roomRevealMinutes = 30', clone.data?.roomRevealMinutes === 30);
  check('clone is not revealed yet', clone.data?.roomUnlocked === false && clone.data?.roomRevealedAt == null);

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
