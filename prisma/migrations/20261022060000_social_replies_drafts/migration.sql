-- Threaded replies hang off a top-level comment. Drafts belong to the account.
ALTER TABLE "broadcast_comments" ADD COLUMN "parentId" TEXT;

CREATE INDEX "broadcast_comments_parentId_idx" ON "broadcast_comments"("parentId");

ALTER TABLE "broadcast_comments" ADD CONSTRAINT "broadcast_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "broadcast_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "broadcast_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" VARCHAR(240) NOT NULL,
    "mediaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "broadcast_drafts_userId_updatedAt_idx" ON "broadcast_drafts"("userId", "updatedAt");

ALTER TABLE "broadcast_drafts" ADD CONSTRAINT "broadcast_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
