ALTER TABLE "AiAccessPackage"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "AiAccessPackage_archivedAt_idx" ON "AiAccessPackage"("archivedAt");
