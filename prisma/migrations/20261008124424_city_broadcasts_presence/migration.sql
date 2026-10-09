-- CreateEnum
CREATE TYPE "ProfilePrivacy" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'AWAY', 'OFFLINE');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "presence" "PresenceStatus" NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "presenceUntil" TIMESTAMP(3),
ADD COLUMN     "privacy" "ProfilePrivacy" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" VARCHAR(240) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_likes" (
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_likes_pkey" PRIMARY KEY ("broadcastId","userId")
);

-- CreateTable
CREATE TABLE "broadcast_comments" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" VARCHAR(240) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_userId_createdAt_idx" ON "broadcasts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "broadcast_likes_userId_createdAt_idx" ON "broadcast_likes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "broadcast_comments_broadcastId_createdAt_idx" ON "broadcast_comments"("broadcastId", "createdAt");

-- CreateIndex
CREATE INDEX "broadcast_comments_userId_createdAt_idx" ON "broadcast_comments"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_likes" ADD CONSTRAINT "broadcast_likes_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_likes" ADD CONSTRAINT "broadcast_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_comments" ADD CONSTRAINT "broadcast_comments_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_comments" ADD CONSTRAINT "broadcast_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
