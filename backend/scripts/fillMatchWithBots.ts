/**
 * Fill a match with the seeded TEST BOT accounts (real join path, over the API).
 *
 *   npx tsx scripts/fillMatchWithBots.ts                 # auto-pick nearest open match
 *   npx tsx scripts/fillMatchWithBots.ts --match 850     # by matchNumber
 *   npx tsx scripts/fillMatchWithBots.ts --id <uuid>
 *   npx tsx scripts/fillMatchWithBots.ts --dry-run
 *   npx tsx scripts/fillMatchWithBots.ts --concurrency 4 --limit 20
 *   npx tsx scripts/fillMatchWithBots.ts --exclude-phone 9876543210 --exclude-device 1d24b2b7de7dafdb
 *
 * Safety: only accounts named "TEST BOT …" ever join. Real players, admins and
 * the account installed on the phone are never touched — they can be excluded
 * explicitly too, and the run fails loudly if any non-bot ends up seated.
 *
 * Every bot logs in through the normal demo-OTP endpoint and calls the same
 * POST /tournaments/:id/join a player uses, so wallet debit, ledger, seat
 * snapshot, SLOTS_FULL flip and realtime broadcasts all happen for real.
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';

const API = process.env.API_BASE_URL ?? 'http://localhost:5000/api/v1';
const TENANT = process.env.TENANT_ID ?? 'a3c11cd0-324e-4886-b27c-9667fd7f59dc';
const BOT_PREFIX = 'TEST BOT';
const JOIN_CUTOFF_MS = 60 * 1000;

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);

const MATCH_NUMBER = flag('match');
const MATCH_ID = flag('id');
const DRY = has('dry-run');
const LIMIT = Number(flag('limit', '0')) || 0;
const CONCURRENCY = Math.max(1, Number(flag('concurrency', '4')));
const EXCLUDE_PHONES = new Set(
  (flag('exclude-phone', '') ?? '').split(',').map((v) => v.trim()).filter(Boolean),
);
const EXCLUDE_DEVICES = new Set(
  (flag('exclude-device', '') ?? '').split(',').map((v) => v.trim()).filter(Boolean),
);

type Target = {
  id: string;
  matchNumber: number | null;
  title: string;
  status: string;
  matchType: string;
  entryFee: unknown;
  totalSlots: number;
  matchTime: Date;
  booked: number;
};

async function pickTarget(): Promise<Target> {
  const base = {
    id: true, matchNumber: true, title: true, status: true, matchType: true,
    entryFee: true, totalSlots: true, matchTime: true,
  } as const;

  const shape = async (where: Record<string, unknown>) => {
    const t = await prisma.tournament.findFirst({ where, orderBy: { matchTime: 'asc' }, select: base });
    if (!t) return null;
    const booked = await prisma.tournamentSlot.count({ where: { tournamentId: t.id } });
    return { ...t, booked } as Target;
  };

  if (MATCH_ID) {
    const t = await shape({ id: MATCH_ID, tenantId: TENANT });
    if (!t) throw new Error(`match id ${MATCH_ID} not found in tenant ${TENANT}`);
    return t;
  }
  if (MATCH_NUMBER) {
    const t = await shape({ matchNumber: Number(MATCH_NUMBER), tenantId: TENANT });
    if (!t) throw new Error(`match #${MATCH_NUMBER} not found in tenant ${TENANT}`);
    return t;
  }

  // Nearest match that is still taking entries and has free seats.
  const t = await shape({
    tenantId: TENANT,
    status: { in: ['OPEN', 'UPCOMING', 'DRAFT', 'ROOM_REVEALED', 'SLOTS_FULL'] },
    matchTime: { gte: new Date(Date.now() + JOIN_CUTOFF_MS) },
  });
  if (!t) throw new Error('no open upcoming match found — create one or pass --match/--id');
  return t;
}

async function getBotTokens(bots: Array<{ phoneNumber: string }>, tournamentId: string) {
  const seated = await prisma.tournamentSlot.findMany({
    where: { tournamentId },
    select: { userId: true },
  });
  const seatedIds = new Set(seated.map((s) => s.userId));
  return { seatedIds };
}

async function login(phoneNumber: string): Promise<string> {
  const res = await fetch(`${API}/auth/player/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, phoneNumber, idToken: `dev_otp_${phoneNumber}` }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!body?.success) throw new Error(`login failed for ${phoneNumber}: ${body?.message ?? res.status}`);
  return body.data.token as string;
}

async function join(token: string, tournamentId: string, bot: { inGameName: string | null; inGameUid: string | null }) {
  const res = await fetch(`${API}/tournaments/${tournamentId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      inGameName: bot.inGameName ?? undefined,
      inGameUid: bot.inGameUid ?? undefined,
      saveAsDefault: false,
    }),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!body?.success) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body.data as { slotNumber: number; tournamentStatus: string };
}

async function main() {
  const t = await pickTarget();
  const free = Math.max(0, t.totalSlots - t.booked);
  console.log(
    `target: #${t.matchNumber ?? '-'} "${t.title}" (${t.matchType}) — ${t.booked}/${t.totalSlots} filled, ` +
      `fee ₹${Number(t.entryFee)}, starts ${t.matchTime.toISOString()} [${t.status}]`,
  );
  console.log(`id: ${t.id} — free seats: ${free}`);

  const health = await fetch(`${API}/health`).then((r) => r.json() as Promise<any>).catch(() => null);
  if (!health?.success) throw new Error(`backend not reachable at ${API} — start it with npm run dev`);
  console.log(`backend: ${health.data.environment}, uptime ${health.data.uptime}`);

  if (t.matchTime.getTime() - Date.now() <= JOIN_CUTOFF_MS) {
    throw new Error('join window closed (less than 1 minute to match start)');
  }
  if (t.status === 'SLOTS_FULL' || free === 0) {
    console.log('match is already full — nothing to do');
    return;
  }

  const { seatedIds } = await getBotTokens([], t.id);
  const allBots = await prisma.user.findMany({
    where: { tenantId: TENANT, name: { startsWith: BOT_PREFIX }, isBanned: false },
    orderBy: { phoneNumber: 'asc' },
    select: { id: true, phoneNumber: true, inGameName: true, inGameUid: true, depositBalance: true, deviceId: true },
  });
  const fee = Number(t.entryFee);
  const eligible = allBots.filter(
    (b) =>
      !seatedIds.has(b.id) &&
      Number(b.depositBalance) >= fee &&
      !EXCLUDE_PHONES.has(b.phoneNumber) &&
      !(b.deviceId && EXCLUDE_DEVICES.has(b.deviceId)),
  );
  const needed = Math.min(free, LIMIT || eligible.length, eligible.length);

  console.log(
    `bots: ${allBots.length} total, ${seatedIds.size} already seated, ` +
      `${allBots.filter((b) => Number(b.depositBalance) < fee).length} too poor → joining ${needed}`,
  );

  if (DRY) {
    console.log('dry run — first 5 candidates:', eligible.slice(0, 5).map((b) => b.phoneNumber).join(', '));
    return;
  }

  const queue = eligible.slice(0, needed);
  let ok = 0;
  let failed = 0;
  let lastStatus = t.status;
  const errors = new Map<string, number>();

  const worker = async () => {
    for (;;) {
      const bot = queue.shift();
      if (!bot) return;
      try {
        const token = await login(bot.phoneNumber);
        const res = await join(token, t.id, bot);
        ok += 1;
        lastStatus = res.tournamentStatus;
        console.log(`  ✓ ${bot.phoneNumber} → seat ${res.slotNumber}`);
      } catch (error) {
        failed += 1;
        const msg = error instanceof Error ? error.message : String(error);
        errors.set(msg, (errors.get(msg) ?? 0) + 1);
        console.log(`  ✗ ${bot.phoneNumber} → ${msg}`);
        // A full match means stop pulling more bots.
        if (/Slot Full/i.test(msg)) queue.length = 0;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  const final = await prisma.tournament.findUnique({
    where: { id: t.id },
    select: { status: true, totalSlots: true, _count: { select: { slots: true } } },
  });
  console.log('\n── result ──');
  console.log(`joined: ${ok}, failed: ${failed}`);
  if (errors.size) console.log('errors:', [...errors.entries()].map(([m, n]) => `${n}× ${m}`).join(' | '));
  console.log(
    `match now: ${final?._count.slots}/${final?.totalSlots} — status ${final?.status} (was ${t.status}, join reply last: ${lastStatus})`,
  );

  // Safety net: this script must never seat a real player or an admin.
  const seatedPeople = await prisma.tournamentSlot.findMany({
    where: { tournamentId: t.id },
    select: { user: { select: { name: true, phoneNumber: true } } },
  });
  const outsiders = seatedPeople.filter((s) => !(s.user?.name ?? '').startsWith(BOT_PREFIX));
  if (outsiders.length) {
    console.error(
      `WARNING: ${outsiders.length} non-bot account(s) are seated in this match: ` +
        outsiders.map((s) => s.user?.phoneNumber).join(', '),
    );
    process.exitCode = 1;
  } else {
    console.log(`seat check: all ${seatedPeople.length} seats are test bots — no real/phone account joined`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
