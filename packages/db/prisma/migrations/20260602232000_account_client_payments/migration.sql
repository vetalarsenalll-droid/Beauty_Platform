-- CreateEnum
CREATE TYPE "AccountPaymentProvider" AS ENUM ('YOOKASSA', 'TBANK', 'SBER', 'ALFA');

-- CreateEnum
CREATE TYPE "PaymentConnectionMode" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "ReceiptVatCode" AS ENUM ('NONE', 'VAT_0', 'VAT_5', 'VAT_7', 'VAT_10', 'VAT_18', 'VAT_20');

-- CreateEnum
CREATE TYPE "ReceiptTaxationSystem" AS ENUM ('DEFAULT', 'OSN', 'USN_INCOME', 'USN_INCOME_OUTCOME', 'ENVD', 'ESN', 'PATENT');

-- CreateTable
CREATE TABLE "AccountPaymentConnection" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "provider" "AccountPaymentProvider" NOT NULL,
    "mode" "PaymentConnectionMode" NOT NULL DEFAULT 'TEST',
    "title" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "credentialsEncrypted" TEXT NOT NULL,
    "credentialsMasked" JSONB,
    "publicConfig" JSONB,
    "receiptEnabled" BOOLEAN NOT NULL DEFAULT false,
    "receiptVat" "ReceiptVatCode" NOT NULL DEFAULT 'NONE',
    "receiptTaxationSystem" "ReceiptTaxationSystem" NOT NULL DEFAULT 'DEFAULT',
    "receiptFfdVersion" TEXT,
    "paymentSubject" TEXT,
    "paymentMethod" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "webhookSecret" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPaymentConnection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PaymentIntent"
ADD COLUMN "connectionId" INTEGER,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerPayload" JSONB,
ADD COLUMN "paymentUrl" TEXT,
ADD COLUMN "returnUrl" TEXT,
ADD COLUMN "failUrl" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "receiptRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "receiptPayload" JSONB;

-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerPayload" JSONB,
ADD COLUMN "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Refund"
ADD COLUMN "providerRef" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "providerPayload" JSONB,
ADD COLUMN "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Receipt"
ADD COLUMN "providerRef" TEXT,
ADD COLUMN "status" TEXT,
ADD COLUMN "fiscalPayload" JSONB,
ADD COLUMN "fiscalNumber" TEXT,
ADD COLUMN "fiscalDocument" TEXT,
ADD COLUMN "fiscalSign" TEXT;

-- AlterTable
ALTER TABLE "PaymentWebhookEvent"
ADD COLUMN "accountId" INTEGER,
ADD COLUMN "intentId" INTEGER,
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "processingStatus" TEXT,
ADD COLUMN "processingError" TEXT;

-- CreateIndex
CREATE INDEX "AccountPaymentConnection_accountId_provider_idx" ON "AccountPaymentConnection"("accountId", "provider");

-- CreateIndex
CREATE INDEX "AccountPaymentConnection_accountId_isEnabled_idx" ON "AccountPaymentConnection"("accountId", "isEnabled");

-- CreateIndex
CREATE INDEX "PaymentIntent_connectionId_idx" ON "PaymentIntent"("connectionId");

-- CreateIndex
CREATE INDEX "PaymentIntent_provider_providerRef_idx" ON "PaymentIntent"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_idempotencyKey_key" ON "PaymentIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_accountId_receivedAt_idx" ON "PaymentWebhookEvent"("accountId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_intentId_idx" ON "PaymentWebhookEvent"("intentId");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_provider_receivedAt_idx" ON "PaymentWebhookEvent"("provider", "receivedAt");

-- AddForeignKey
ALTER TABLE "AccountPaymentConnection" ADD CONSTRAINT "AccountPaymentConnection_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AccountPaymentConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
