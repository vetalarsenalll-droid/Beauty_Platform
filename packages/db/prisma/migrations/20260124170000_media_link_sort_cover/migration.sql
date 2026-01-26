ALTER TABLE "MediaLink" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MediaLink" ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MediaLink_entityType_entityId_sortOrder_idx" ON "MediaLink"("entityType", "entityId", "sortOrder");
