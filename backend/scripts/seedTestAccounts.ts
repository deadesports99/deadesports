/**
 * Seed / clean realistic test player accounts.
 *
 * These are ordinary player rows (same shape as a real signup): tenant, phone,
 * name, in-game name/UID, auto player code, role USER. In demo OTP mode they can
 * log in from any device with any 6-digit code, exactly like a real account.
 *
 *   npx tsx scripts/seedTestAccounts.ts create --count 100 --credit 200
 *   npx tsx scripts/seedTestAccounts.ts list
 *   npx tsx scripts/seedTestAccounts.ts delete
 *
 * Options: --start 9000000001 (first phone), --count 100, --credit 200 (₹ each),
 *          --tenant <uuid> (defaults to first tenant), --force (allow in production)
 */
import 'dotenv/config';
import { prisma } from '../src/config/prisma.js';
import { allocatePlayerCode } from '../src/services/identity.service.js';

const argv = process.argv.slice(2);
const cmd = argv[0] ?? 'list';
const flag = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);

const START = Number(flag('start', '9000000001'));
const COUNT = Number(flag('count', '100'));
const CREDIT = Number(flag('credit', '0'));

/** Marker so test rows are always distinguishable from real players. */
const IGN_PREFIX = 'TestBot';
const NAME_PREFIX = 'TEST BOT';

async function resolveTenantId(): Promise<string> {
  const explicit = flag('tenant');
  if (explicit) return explicit;
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!tenant) throw new Error('No tenant found');
  return tenant.id;
}

function phoneAt(i: number): string {
  return String(START + i);
}

async function create() {
  if (process.env.NODE_ENV === 'production' && !has('force')) {
    throw new Error('Refusing to seed test accounts in production without --force');
  }
  const tenantId = await resolveTenantId();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  console.log(`tenant: ${tenant.name} (${tenantId})`);
  console.log(`creating up to ${COUNT} accounts from ${phoneAt(0)} … credit ₹${CREDIT} each`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < COUNT; i += 1) {
    const phone = phoneAt(i);
    const tag = String(i + 1).padStart(3, '0');
    const existing = await prisma.user.findFirst({
      where: { tenantId, phoneNumber: phone },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const user = await prisma.user.create({
      data: {
        tenantId,
        phoneNumber: phone,
        name: `${NAME_PREFIX} ${tag}`,
        inGameName: `${IGN_PREFIX}${tag}`,
        inGameUid: phone,
        playerCode: await allocatePlayerCode(tenantId),
        depositBalance: CREDIT,
        role: 'USER',
        isBanned: false,
      },
      select: { id: true, playerCode: true },
    });
    if (CREDIT > 0) {
      await prisma.walletLedger.create({
        data: {
          tenantId,
          userId: user.id,
          balanceType: 'DEPOSIT',
          type: 'CREDIT',
          category: 'ADD_MONEY',
          amount: CREDIT,
          balanceAfter: CREDIT,
          notes: 'Test account seed credit',
        },
      });
    }
    created += 1;
    if (created % 20 === 0) console.log(`  … ${created} created`);
  }

  console.log(`done: created=${created} skipped(existing)=${skipped}`);
  const total = await prisma.user.count({
    where: { tenantId, phoneNumber: { startsWith: String(START).slice(0, 4) }, name: { startsWith: NAME_PREFIX } },
  });
  console.log(`test accounts now in tenant: ${total}`);
  console.log(`login: phone ${phoneAt(0)} … ${phoneAt(COUNT - 1)} with any 6-digit OTP (demo bypass mode)`);
}

async function list() {
  const tenantId = await resolveTenantId();
  const rows = await prisma.user.findMany({
    where: { tenantId, name: { startsWith: NAME_PREFIX } },
    orderBy: { phoneNumber: 'asc' },
    select: { phoneNumber: true, name: true, playerCode: true, inGameName: true, inGameUid: true, depositBalance: true, isBanned: true },
  });
  console.log(JSON.stringify(rows.map((r) => ({ ...r, depositBalance: String(r.depositBalance) })), null, 1));
  console.log(`total: ${rows.length}`);
}

async function remove() {
  const tenantId = await resolveTenantId();
  const users = await prisma.user.findMany({
    where: { tenantId, name: { startsWith: NAME_PREFIX } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) {
    console.log('nothing to delete');
    return;
  }
  const where = { userId: { in: ids } };
  const removed: Record<string, number> = {};
  removed.slots = (await prisma.tournamentSlot.deleteMany({ where })).count;
  removed.ledger = (await prisma.walletLedger.deleteMany({ where })).count;
  removed.results = (await prisma.matchResult.deleteMany({ where })).count;
  removed.deposits = (await prisma.depositRequest.deleteMany({ where })).count;
  removed.withdrawals = (await prisma.withdrawalRequest.deleteMany({ where })).count;
  removed.users = (await prisma.user.deleteMany({ where: { id: { in: ids } } })).count;
  console.log('deleted:', removed);
}

const run = { create, list, delete: remove }[cmd];
if (!run) {
  console.error(`unknown command "${cmd}" — use create | list | delete`);
  process.exit(1);
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
