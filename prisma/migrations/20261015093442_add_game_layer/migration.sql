-- CreateTable
CREATE TABLE "game_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastVisitDay" TEXT,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stickers" JSONB NOT NULL DEFAULT '{}',
    "leaderboardsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_profiles_userId_key" ON "game_profiles"("userId");

-- CreateIndex
CREATE INDEX "game_profiles_xp_leaderboardsOptIn_idx" ON "game_profiles"("xp", "leaderboardsOptIn");

-- AddForeignKey
ALTER TABLE "game_profiles" ADD CONSTRAINT "game_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
