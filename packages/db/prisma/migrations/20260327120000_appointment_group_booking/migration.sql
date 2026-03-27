-- Add groupBookingId for chained appointments
ALTER TABLE "Appointment" ADD COLUMN "groupBookingId" UUID;
CREATE INDEX "Appointment_groupBookingId_idx" ON "Appointment"("groupBookingId");
