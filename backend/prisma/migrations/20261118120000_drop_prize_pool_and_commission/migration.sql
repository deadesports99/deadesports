-- Prize pool and platform commission are gone: entries now pay kills directly.
ALTER TABLE "Tournament" DROP COLUMN IF EXISTS "prizePool";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "commissionRate";
