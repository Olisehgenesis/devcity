/*
  Warnings:

  - You are about to drop the column `level` on the `game_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `xp` on the `game_profiles` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "game_profiles_xp_leaderboardsOptIn_idx";

-- AlterTable
ALTER TABLE "game_profiles" DROP COLUMN "level",
DROP COLUMN "xp";

-- CreateIndex
CREATE INDEX "game_profiles_leaderboardsOptIn_updatedAt_idx" ON "game_profiles"("leaderboardsOptIn", "updatedAt");
