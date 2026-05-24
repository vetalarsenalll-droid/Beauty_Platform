CREATE TABLE "AiAgentCampaignConversion" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "campaignId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "appointmentId" INTEGER NOT NULL,
  "revenue" DECIMAL(12, 2) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiAgentCampaignConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAgentCampaignConversion_campaignId_appointmentId_key"
  ON "AiAgentCampaignConversion"("campaignId", "appointmentId");

CREATE INDEX "AiAgentCampaignConversion_accountId_campaignId_occurredAt_idx"
  ON "AiAgentCampaignConversion"("accountId", "campaignId", "occurredAt");

CREATE INDEX "AiAgentCampaignConversion_clientId_occurredAt_idx"
  ON "AiAgentCampaignConversion"("clientId", "occurredAt");
