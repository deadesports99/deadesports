import 'dotenv/config';
import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { allocatePlayerCode } from '../services/identity.service.js';

/**
 * ─── Owner (ADMIN) seed ───────────────────────────────────────────────────
 *
 * Makes sure ONE owner account exists for the tenant with a real Gmail address.
 * This is the only account that can log into the admin web without a staff
 * permission key.
 *
 * Usage:
 *   npm run seed:owner
 *   npm run seed:owner -- --email=you@gmail.com --name="Jay" --tenant=apex-ff
 *   npm run seed:owner -- --email=you@gmail.com --phone=9999900001
 *
 * Safe to re-run: it updates the existing ADMIN row instead of creating a
 * second owner. Secrets (keys/OTPs) are never printed.
 */

const DEFAULT_EMAIL = 'deadesports99@gmail.com';
const DEFAULT_NAME = 'Owner';

function arg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || fallback : fallback;
}

/** Phone numbers are unique per tenant — pick a free 10-digit placeholder. */
async function allocatePhoneNumber(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `9${crypto.randomInt(100_000_000, 1_000_000_000)}`;
    const taken = await prisma.user.findFirst({
      where: { tenantId, phoneNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error('Could not allocate a unique placeholder phone number');
}

async function main(): Promise<void> {
  const email = (arg('email') ?? DEFAULT_EMAIL).toLowerCase();
  const name = arg('name') ?? DEFAULT_NAME;
  const tenantHint = arg('tenant');
  const phone = arg('phone');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid --email: ${email}`);
  }

  const tenant = tenantHint
    ? await prisma.tenant.findFirst({
        where: { OR: [{ id: tenantHint }, { subdomain: tenantHint }] },
      })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!tenant) {
    throw new Error(
      'No tenant found. Create the tenant first (or pass --tenant=<subdomain> after creating it).',
    );
  }

  // One email = one login. Refuse to shadow an existing player/staff account.
  const emailOwner = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email },
    select: { id: true, role: true },
  });
  if (emailOwner && emailOwner.role !== 'ADMIN') {
    throw new Error(
      `Email ${email} already belongs to a ${emailOwner.role} in this tenant. Use that account's email or free this one first.`,
    );
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });

  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          email,
          name,
          isBanned: false,
          ...(phone ? { phoneNumber: phone } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          tenantId: tenant.id,
          phoneNumber: phone ?? (await allocatePhoneNumber(tenant.id)),
          email,
          name,
          role: 'ADMIN',
          playerCode: await allocatePlayerCode(tenant.id),
        },
      });

  console.log('✔ Owner admin ready');
  console.log(`  tenant : ${tenant.brandName} (${tenant.subdomain}) [${tenant.id}]`);
  console.log(`  owner  : ${admin.email} — ${admin.role} [${admin.id}]`);
  console.log(`  mode   : ${existingAdmin ? 'updated existing ADMIN' : 'created new ADMIN'}`);
  console.log('  login  : admin web → email → OTP (no permission key needed)');
}

main()
  .catch((error: unknown) => {
    console.error('✖ seed:owner failed —', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
