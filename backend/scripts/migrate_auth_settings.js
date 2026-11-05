const { prisma } = require('../dist/config/prisma');

async function run() {
  console.log('Running migration for Tenant auth settings...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "allowPhoneAuth" BOOLEAN NOT NULL DEFAULT true;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "allowDirectNumber" BOOLEAN NOT NULL DEFAULT true;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "allowGoogleAuth" BOOLEAN NOT NULL DEFAULT true;`);
  console.log('Columns added successfully to Tenant table!');
  const tenant = await prisma.tenant.findFirst();
  console.log('Current tenant settings:', {
    id: tenant?.id,
    brandName: tenant?.brandName,
    allowPhoneAuth: tenant?.allowPhoneAuth,
    allowDirectNumber: tenant?.allowDirectNumber,
    allowGoogleAuth: tenant?.allowGoogleAuth,
  });
}

run()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
