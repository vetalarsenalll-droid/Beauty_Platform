CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'PENDING', 'HIDDEN');

ALTER TABLE "Review"
  ADD COLUMN "appointmentId" INTEGER,
  ADD COLUMN "entityType" TEXT NOT NULL DEFAULT 'account',
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "replyText" TEXT,
  ADD COLUMN "repliedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Review_accountId_status_createdAt_idx" ON "Review"("accountId", "status", "createdAt");
CREATE INDEX "Review_accountId_entityType_entityId_status_idx" ON "Review"("accountId", "entityType", "entityId", "status");
