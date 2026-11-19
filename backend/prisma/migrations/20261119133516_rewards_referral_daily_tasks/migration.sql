-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "TaskKind" AS ENUM ('JOIN_MATCH', 'PLAY_MATCH', 'TOP10', 'FIRST_DEPOSIT', 'REFERRAL', 'FIRST_WIN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Category" ADD VALUE 'REFERRAL_BONUS';
ALTER TYPE "Category" ADD VALUE 'DAILY_BONUS';
ALTER TYPE "Category" ADD VALUE 'TASK_REWARD';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "featureFlags" JSONB,
ADD COLUMN     "rewardConfig" JSONB;

-- CreateTable
CREATE TABLE "ReferralProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "referredById" TEXT,
    "referredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "friendAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "tournamentId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyBonusClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimDay" TEXT NOT NULL,
    "streakDay" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyBonusClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "TaskKind" NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "rewardAmount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "cooldownDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL DEFAULT 'once',
    "progress" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProfile_userId_key" ON "ReferralProfile"("userId");

-- CreateIndex
CREATE INDEX "ReferralProfile_tenantId_referredById_idx" ON "ReferralProfile"("tenantId", "referredById");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralProfile_tenantId_code_key" ON "ReferralProfile"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ReferralEarning_tenantId_status_idx" ON "ReferralEarning"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ReferralEarning_referrerId_createdAt_idx" ON "ReferralEarning"("referrerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralEarning_referrerId_refereeId_key" ON "ReferralEarning"("referrerId", "refereeId");

-- CreateIndex
CREATE INDEX "DailyBonusClaim_tenantId_claimDay_idx" ON "DailyBonusClaim"("tenantId", "claimDay");

-- CreateIndex
CREATE UNIQUE INDEX "DailyBonusClaim_userId_claimDay_key" ON "DailyBonusClaim"("userId", "claimDay");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDefinition_tenantId_code_key" ON "TaskDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TaskClaim_tenantId_claimedAt_idx" ON "TaskClaim"("tenantId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskClaim_userId_taskId_periodKey_key" ON "TaskClaim"("userId", "taskId", "periodKey");
