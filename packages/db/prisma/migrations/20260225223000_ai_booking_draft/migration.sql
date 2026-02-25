CREATE TABLE "AiBookingDraft" (
  "id" SERIAL NOT NULL,
  "threadId" INTEGER NOT NULL,
  "locationId" INTEGER,
  "serviceId" INTEGER,
  "specialistId" INTEGER,
  "date" TEXT,
  "time" TEXT,
  "clientName" TEXT,
  "clientPhone" TEXT,
  "mode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'COLLECTING',
  "consentConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiBookingDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiBookingDraft_threadId_key" ON "AiBookingDraft"("threadId");

ALTER TABLE "AiBookingDraft"
ADD CONSTRAINT "AiBookingDraft_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "AiThread"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
