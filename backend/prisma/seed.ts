/**
 * Seed script — creates the demo white-label tenant with an admin, a staff
 * member and two players, then prints login credentials + test tokens.
 *
 * Run with:  npm run seed   (or:  npx tsx prisma/seed.ts)
 * Safe to re-run: all records are upserted by (tenant, phoneNumber).
 */
import { prisma } from '../src/config/prisma.js';
import { generateToken } from '../src/services/auth.service.js';

const TENANT_SUBDOMAIN = 'apex-ff';

async function main(): Promise<void> {
  console.log('🌱 Seeding database...\n');

  // 1) Tenant — the white-label client
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: TENANT_SUBDOMAIN },
    update: {
      brandName: 'Apex Free Fire Club',
      primaryColor: '#FF4757',
      commissionRate: 10,
      isActive: true,
    },
    create: {
      subdomain: TENANT_SUBDOMAIN,
      brandName: 'Apex Free Fire Club',
      primaryColor: '#FF4757',
      commissionRate: 10,
      isActive: true,
    },
  });
  console.log(`✔ Tenant: ${tenant.brandName} (${tenant.subdomain}) [${tenant.id}]`);

  const upsertUser = async (data: {
    phoneNumber: string;
    role: 'ADMIN' | 'SUB_ADMIN' | 'USER';
    name?: string;
    email?: string;
    inGameName?: string;
    inGameUid?: string;
    canCreateMatch?: boolean;
    canUpdateRoomId?: boolean;
    canDistributePrize?: boolean;
    canManageWallet?: boolean;
    adminId?: string;
  }) => {
    return prisma.user.upsert({
      where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: data.phoneNumber } },
      update: {
        name: data.name ?? undefined,
        email: data.email ?? undefined,
        inGameName: data.inGameName ?? undefined,
        inGameUid: data.inGameUid ?? undefined,
        canCreateMatch: data.canCreateMatch ?? false,
        canUpdateRoomId: data.canUpdateRoomId ?? false,
        canDistributePrize: data.canDistributePrize ?? false,
        canManageWallet: data.canManageWallet ?? false,
        adminId: data.adminId ?? undefined,
        isBanned: false,
      },
      create: {
        tenantId: tenant.id,
        phoneNumber: data.phoneNumber,
        role: data.role,
        name: data.name,
        email: data.email,
        inGameName: data.inGameName,
        inGameUid: data.inGameUid,
        canCreateMatch: data.canCreateMatch ?? false,
        canUpdateRoomId: data.canUpdateRoomId ?? false,
        canDistributePrize: data.canDistributePrize ?? false,
        canManageWallet: data.canManageWallet ?? false,
        adminId: data.adminId,
      },
    });
  };

  // 2) ADMIN — the client / tournament owner
  const admin = await upsertUser({
    phoneNumber: '9999900001',
    role: 'ADMIN',
    name: 'Apex Owner',
    email: 'owner@apexff.com',
    canCreateMatch: true,
    canUpdateRoomId: true,
    canDistributePrize: true,
    canManageWallet: true,
  });
  console.log(`✔ Admin: ${admin.name} (${admin.phoneNumber}) [${admin.id}]`);

  // 3) SUB_ADMIN — staff hired by the admin, only room ID permission
  const staff = await upsertUser({
    phoneNumber: '9999900002',
    role: 'SUB_ADMIN',
    name: 'Squad Manager',
    email: 'staff@apexff.com',
    canUpdateRoomId: true,
    adminId: admin.id,
  });
  console.log(`✔ Sub-Admin: ${staff.name} — canUpdateRoomId: ${staff.canUpdateRoomId}`);

  // 4) USER players with Free Fire accounts
  const player1 = await upsertUser({
    phoneNumber: '9999900003',
    role: 'USER',
    name: 'Rahul Sharma',
    inGameName: 'RAISTAR_99',
    inGameUid: '1928374612',
  });
  const player2 = await upsertUser({
    phoneNumber: '9999900004',
    role: 'USER',
    name: 'Vikram Singh',
    inGameName: 'DESTROYER_X',
    inGameUid: '5819392048',
  });
  console.log(`✔ Players: ${player1.inGameName} (${player1.inGameUid}), ${player2.inGameName} (${player2.inGameUid})`);

  // 5) Print credentials + ready-to-use JWT tokens
  const token = (u: { id: string; tenantId: string; role: 'ADMIN' | 'SUB_ADMIN' | 'USER' }) =>
    generateToken({ userId: u.id, tenantId: u.tenantId, role: u.role });

  console.log('\n──────────────────────────────────────────────────');
  console.log('🔑 LOGIN CREDENTIALS & TEST TOKENS');
  console.log('──────────────────────────────────────────────────');
  console.log('Tenant ID      :', tenant.id);
  console.log('Tenant Slug    :', tenant.subdomain);
  console.log('');
  console.log('ADMIN  — phone:', admin.phoneNumber);
  console.log('         token:', token(admin));
  console.log('');
  console.log('SUB_ADMIN — phone:', staff.phoneNumber);
  console.log('             token:', token(staff));
  console.log('');
  console.log('USER (RAISTAR_99) — phone:', player1.phoneNumber);
  console.log('                     in-game:', `${player1.inGameName} / ${player1.inGameUid}`);
  console.log('                     token:', token(player1));
  console.log('──────────────────────────────────────────────────\n');
  console.log('✅ Seed complete!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });