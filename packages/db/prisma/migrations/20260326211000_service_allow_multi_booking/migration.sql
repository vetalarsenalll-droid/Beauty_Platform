-- Add allowMultiServiceBooking to Service
ALTER TABLE "Service" ADD COLUMN "allowMultiServiceBooking" BOOLEAN NOT NULL DEFAULT false;
