-- CreateEnum
CREATE TYPE "PlatformInvoicePurpose" AS ENUM ('MANUAL', 'SUBSCRIPTION', 'AI_TOKENS');

-- AlterTable
ALTER TABLE "PlatformInvoice"
ADD COLUMN "purpose" "PlatformInvoicePurpose" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "description" TEXT,
ADD COLUMN "paymentProvider" TEXT,
ADD COLUMN "paymentMethod" TEXT,
ADD COLUMN "providerPaymentId" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "paymentUrl" TEXT,
ADD COLUMN "metadataJson" JSONB;

-- AlterTable
ALTER TABLE "PlatformPayment"
ADD COLUMN "method" TEXT,
ADD COLUMN "providerStatus" TEXT,
ADD COLUMN "receiptStatus" TEXT,
ADD COLUMN "receiptUrl" TEXT,
ADD COLUMN "rawProviderJson" JSONB,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "PlatformPayment"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

ALTER TABLE "PlatformPayment"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "PlatformInvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vat" TEXT NOT NULL DEFAULT 'none',
    "paymentObject" TEXT NOT NULL DEFAULT 'service',
    "paymentMethod" TEXT NOT NULL DEFAULT 'full_payment',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPaymentWebhookEvent" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT,
    "providerPaymentId" TEXT,
    "invoiceId" INTEGER,
    "status" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "tokenValid" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformInvoice_purpose_status_idx" ON "PlatformInvoice"("purpose", "status");

-- CreateIndex
CREATE INDEX "PlatformInvoice_paymentProvider_providerPaymentId_idx" ON "PlatformInvoice"("paymentProvider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PlatformPayment_invoiceId_status_idx" ON "PlatformPayment"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "PlatformPayment_provider_providerRef_idx" ON "PlatformPayment"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "PlatformInvoiceItem_invoiceId_idx" ON "PlatformInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "PlatformPaymentWebhookEvent_provider_providerPaymentId_idx" ON "PlatformPaymentWebhookEvent"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PlatformPaymentWebhookEvent_invoiceId_idx" ON "PlatformPaymentWebhookEvent"("invoiceId");

-- CreateIndex
CREATE INDEX "PlatformPaymentWebhookEvent_createdAt_idx" ON "PlatformPaymentWebhookEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformInvoiceItem" ADD CONSTRAINT "PlatformInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
