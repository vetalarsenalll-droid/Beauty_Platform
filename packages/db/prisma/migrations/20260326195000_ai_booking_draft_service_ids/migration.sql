-- Add serviceIds array to AI booking draft
ALTER TABLE "AiBookingDraft" ADD COLUMN "serviceIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
