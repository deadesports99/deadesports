const { prisma } = require('../dist/config/prisma');

async function run() {
  console.log('Running migration for Email Auth...');
  
  console.log('1. Adding allowEmailAuth column to Tenant table...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "allowEmailAuth" BOOLEAN NOT NULL DEFAULT true;`);

  console.log('2. Dropping allowDirectNumber column from Tenant...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "allowDirectNumber";`);

  console.log('3. Adding passwordHash column to User table...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;`);

  console.log('4. Creating EmailOtp table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmailOtp" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'LOGIN',
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_email_otp_tenant_email" ON "EmailOtp"("tenantId", "email");`);

  console.log('5. Enabling allowEmailAuth for all tenants...');
  await prisma.$executeRawUnsafe(`UPDATE "Tenant" SET "allowEmailAuth" = true WHERE "allowEmailAuth" IS NULL;`);

  const tenant = await prisma.tenant.findFirst();
  console.log('✅ Migration complete! Tenant settings:', {
    id: tenant?.id,
    brandName: tenant?.brandName,
    allowPhoneAuth: tenant?.allowPhoneAuth,
    allowGoogleAuth: tenant?.allowGoogleAuth,
    allowEmailAuth: tenant?.allowEmailAuth,
  });
}

run()
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
