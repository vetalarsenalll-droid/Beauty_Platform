-- Business registration foundation: legal type, business type, email verification tokens, account onboarding fields

-- CreateEnum
CREATE TYPE "LegalType" AS ENUM ('PRIVATE_SPECIALIST', 'SELF_EMPLOYED', 'IP', 'OOO');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM (
  'BEAUTY_SALON',
  'HAIR_SALON',
  'BARBERSHOP',
  'NAIL_STUDIO',
  'BROW_STUDIO',
  'LASH_STUDIO',
  'MAKEUP_STUDIO',
  'COSMETOLOGY_ESTHETIC',
  'COSMETOLOGY_MEDICAL',
  'MASSAGE',
  'SPA_CENTER',
  'TATTOO_STUDIO',
  'PIERCING_STUDIO',
  'PMU_STUDIO',
  'EPILATION_STUDIO',
  'BATH_WELLNESS',
  'DENTISTRY',
  'MEDICAL_CLINIC',
  'PRIVATE_MEDICAL_PRACTICE',
  'LAB_DIAGNOSTICS',
  'ULTRASOUND_DIAGNOSTICS',
  'PSYCHOLOGIST',
  'PSYCHOTHERAPIST',
  'SPEECH_THERAPIST',
  'NUTRITIONIST',
  'REHAB_LFK',
  'FITNESS_CLUB',
  'GYM',
  'YOGA_STUDIO',
  'PILATES_STUDIO',
  'STRETCHING_STUDIO',
  'DANCE_STUDIO',
  'MARTIAL_ARTS_STUDIO',
  'SWIMMING_POOL',
  'PERSONAL_TRAINER',
  'EDUCATION_CENTER',
  'LANGUAGE_SCHOOL',
  'TUTORING',
  'CHILD_CENTER',
  'EXAM_PREP_CENTER',
  'CREATIVE_EDU_STUDIO',
  'LEGAL_CONSULTING',
  'ACCOUNTING_CONSULTING',
  'FINANCE_CONSULTING',
  'BUSINESS_CONSULTING',
  'COACHING_MENTORING',
  'VET_CLINIC',
  'PET_GROOMING',
  'DOG_TRAINING',
  'PHOTO_STUDIO_RENT',
  'REHEARSAL_STUDIO_RENT',
  'COWORKING_SLOTS',
  'SPORTS_COURT_BOOKING',
  'PODCAST_STUDIO',
  'COMPUTER_CLUB'
);

-- AlterTable
ALTER TABLE "Account"
ADD COLUMN "legalType" "LegalType",
ADD COLUMN "businessType" "BusinessType",
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User"
ADD CONSTRAINT "User_phone_key" UNIQUE ("phone");

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_purpose_idx" ON "EmailVerificationToken"("email", "purpose");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
