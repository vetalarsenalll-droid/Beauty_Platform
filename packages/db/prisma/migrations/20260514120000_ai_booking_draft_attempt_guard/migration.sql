ALTER TABLE "public"."AiBookingDraft"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bookingAttemptKey" TEXT,
  ADD COLUMN "completedAppointmentId" INTEGER,
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE INDEX "AiBookingDraft_bookingAttemptKey_idx" ON "public"."AiBookingDraft"("bookingAttemptKey");
