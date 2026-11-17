-- AlterTable
ALTER TABLE "TournamentSlot" ADD COLUMN     "eliminatedAt" TIMESTAMP(3),
ADD COLUMN     "isEliminated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liveKills" INTEGER NOT NULL DEFAULT 0;
