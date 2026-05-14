ALTER TABLE "public"."SpecialistProfile"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "SpecialistProfile_accountId_isPublic_idx" ON "public"."SpecialistProfile"("accountId", "isPublic");
