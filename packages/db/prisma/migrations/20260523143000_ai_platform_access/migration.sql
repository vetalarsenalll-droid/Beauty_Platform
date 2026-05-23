CREATE TABLE "AiProviderPool" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "packageTokens" INTEGER NOT NULL,
    "packageCostRub" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderPool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAccessPackage" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "includedCreditRub" DECIMAL(18,2) NOT NULL,
    "displayTokens" INTEGER,
    "priceRub" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAccessPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAccessPurchase" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "packageId" INTEGER,
    "invoiceId" INTEGER,
    "amountRub" DECIMAL(18,2) NOT NULL,
    "creditRub" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "AiAccessPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAccountAccess" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "siteAssistantEnabled" BOOLEAN NOT NULL DEFAULT true,
    "crmAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailySpendLimitRub" DECIMAL(18,2),
    "monthlySpendLimitRub" DECIMAL(18,2),
    "minBalanceNotifyRub" DECIMAL(18,2),
    "stopWhenBalanceBelowRub" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAccountAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProviderPool_provider_model_idx" ON "AiProviderPool"("provider", "model");
CREATE INDEX "AiProviderPool_isActive_idx" ON "AiProviderPool"("isActive");

CREATE UNIQUE INDEX "AiAccessPackage_code_key" ON "AiAccessPackage"("code");
CREATE INDEX "AiAccessPackage_isActive_sortOrder_idx" ON "AiAccessPackage"("isActive", "sortOrder");

CREATE INDEX "AiAccessPurchase_accountId_createdAt_idx" ON "AiAccessPurchase"("accountId", "createdAt");
CREATE INDEX "AiAccessPurchase_packageId_idx" ON "AiAccessPurchase"("packageId");
CREATE INDEX "AiAccessPurchase_invoiceId_idx" ON "AiAccessPurchase"("invoiceId");
CREATE INDEX "AiAccessPurchase_status_idx" ON "AiAccessPurchase"("status");

CREATE UNIQUE INDEX "AiAccountAccess_accountId_key" ON "AiAccountAccess"("accountId");

