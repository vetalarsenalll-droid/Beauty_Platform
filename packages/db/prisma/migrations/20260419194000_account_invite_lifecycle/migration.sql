-- Account onboarding lifecycle and admin invites

-- CreateEnum
CREATE TYPE "AccountOnboardingStatus" AS ENUM ('DRAFT', 'INVITED', 'ACTIVE');

-- AlterTable
ALTER TABLE "Account"
ADD COLUMN "onboardingStatus" "AccountOnboardingStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "AccountInvite" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "invitedByAdminId" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountInvite_tokenHash_key" ON "AccountInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountInvite_accountId_email_idx" ON "AccountInvite"("accountId", "email");

-- CreateIndex
CREATE INDEX "AccountInvite_expiresAt_idx" ON "AccountInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "AccountInvite"
ADD CONSTRAINT "AccountInvite_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

