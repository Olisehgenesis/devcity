-- AlterTable
ALTER TABLE "wallet_backups" ADD COLUMN     "userId" TEXT;

-- Set existing rows to a sentinel user id so the NOT NULL constraint can be applied.
-- In practice the seeded/dev database has no wallet backups yet; this is a no-op
-- guard in case a row exists from an earlier deploy.
UPDATE "wallet_backups" SET "userId" = '00000000-0000-0000-0000-000000000000' WHERE "userId" IS NULL;

-- Make the column required going forward.
ALTER TABLE "wallet_backups" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "wallet_backups" ADD CONSTRAINT "wallet_backups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "wallet_backups_userId_idx" ON "wallet_backups"("userId");