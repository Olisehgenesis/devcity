-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT,
ALTER COLUMN "username" DROP NOT NULL,
ALTER COLUMN "walletAddress" DROP NOT NULL;

-- CreateTable
CREATE TABLE "wallet_backups" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "iterations" INTEGER NOT NULL DEFAULT 250000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_backups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_backups_address_key" ON "wallet_backups"("address");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

