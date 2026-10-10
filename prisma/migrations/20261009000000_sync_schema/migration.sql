-- DropIndex
DROP INDEX "drops_eventId_status_startsAt_endsAt_idx";

-- AlterTable
ALTER TABLE "drop_claims" ADD COLUMN     "tokenId" TEXT;

-- AlterTable
ALTER TABLE "drops" DROP COLUMN "amountPerClaim",
DROP COLUMN "claimsCount",
DROP COLUMN "endsAt",
DROP COLUMN "maxClaims",
ADD COLUMN     "amount" DECIMAL(78,0) NOT NULL,
ADD COLUMN     "currentClaimants" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "maxClaimants" INTEGER NOT NULL,
ADD COLUMN     "radius" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "username" TEXT NOT NULL,
ADD COLUMN     "walletAddress" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "presence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "visibility" "VisibilityMode" NOT NULL DEFAULT 'APPROXIMATE',
    "status" "PresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presence_userId_key" ON "presence"("userId");

-- CreateIndex
CREATE INDEX "presence_expiresAt_idx" ON "presence"("expiresAt");

-- CreateIndex
CREATE INDEX "drops_eventId_status_startsAt_expiresAt_idx" ON "drops"("eventId", "status", "startsAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- AddForeignKey
ALTER TABLE "drop_claims" ADD CONSTRAINT "drop_claims_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence" ADD CONSTRAINT "presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

