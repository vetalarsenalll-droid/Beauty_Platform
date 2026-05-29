ALTER TABLE "MediaAsset"
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "MediaAsset_accountId_archivedAt_idx" ON "MediaAsset"("accountId", "archivedAt");
