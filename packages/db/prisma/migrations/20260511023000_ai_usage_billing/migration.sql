CREATE TABLE "AiUsage" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER,
    "threadId" INTEGER,
    "actionId" INTEGER,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costPerTokenRub" DECIMAL(18,10) NOT NULL,
    "costRub" DECIMAL(18,6) NOT NULL,
    "markupPercent" INTEGER NOT NULL DEFAULT 40,
    "chargedRub" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiBalanceLedger" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "usageId" INTEGER,
    "type" TEXT NOT NULL,
    "amountRub" DECIMAL(18,6) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiBalanceLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiUsage_accountId_createdAt_idx" ON "AiUsage"("accountId", "createdAt");
CREATE INDEX "AiUsage_threadId_idx" ON "AiUsage"("threadId");
CREATE INDEX "AiUsage_actionId_idx" ON "AiUsage"("actionId");
CREATE INDEX "AiUsage_provider_model_idx" ON "AiUsage"("provider", "model");

CREATE INDEX "AiBalanceLedger_accountId_createdAt_idx" ON "AiBalanceLedger"("accountId", "createdAt");
CREATE INDEX "AiBalanceLedger_usageId_idx" ON "AiBalanceLedger"("usageId");
CREATE INDEX "AiBalanceLedger_type_idx" ON "AiBalanceLedger"("type");
