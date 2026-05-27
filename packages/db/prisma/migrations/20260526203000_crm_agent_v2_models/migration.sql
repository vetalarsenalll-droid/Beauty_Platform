CREATE TABLE "CrmAgentSession" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "mode" TEXT NOT NULL DEFAULT 'chat',
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentMessage" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAgentMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentState" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "accountId" INTEGER NOT NULL,
  "goalType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "slots" JSONB NOT NULL,
  "candidates" JSONB,
  "selected" JSONB,
  "missing" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentPlan" (
  "id" SERIAL NOT NULL,
  "sessionId" INTEGER NOT NULL,
  "accountId" INTEGER NOT NULL,
  "goalType" TEXT NOT NULL,
  "goal" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentPlanStep" (
  "id" SERIAL NOT NULL,
  "planId" INTEGER NOT NULL,
  "order" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "toolName" TEXT,
  "args" JSONB,
  "result" JSONB,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAgentPlanStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentAction" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "sessionId" INTEGER,
  "actionType" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "riskLevel" TEXT NOT NULL,
  "permission" TEXT,
  "result" JSONB,
  "error" TEXT,
  "expiresAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentToolCall" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "sessionId" INTEGER,
  "planStepId" INTEGER,
  "toolName" TEXT NOT NULL,
  "args" JSONB NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "CrmAgentToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentArtifact" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "sessionId" INTEGER,
  "planId" INTEGER,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAgentArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentMemory" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "source" TEXT,
  "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentInsight" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentTask" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "sessionId" INTEGER,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentPolicy" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentKnowledgeSnapshot" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentKnowledgeSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentCampaign" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "audience" JSONB NOT NULL,
  "offer" JSONB,
  "content" JSONB NOT NULL,
  "channels" TEXT[],
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAgentCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentCampaignRecipient" (
  "id" SERIAL NOT NULL,
  "campaignId" INTEGER NOT NULL,
  "accountId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "target" TEXT,
  "message" TEXT NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAgentCampaignRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAgentAudit" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "sessionId" INTEGER,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmAgentAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmAgentSession_accountId_userId_status_updatedAt_idx" ON "CrmAgentSession"("accountId", "userId", "status", "updatedAt");
CREATE INDEX "CrmAgentMessage_sessionId_createdAt_idx" ON "CrmAgentMessage"("sessionId", "createdAt");
CREATE INDEX "CrmAgentState_accountId_goalType_status_idx" ON "CrmAgentState"("accountId", "goalType", "status");
CREATE INDEX "CrmAgentState_sessionId_updatedAt_idx" ON "CrmAgentState"("sessionId", "updatedAt");
CREATE INDEX "CrmAgentPlan_accountId_status_createdAt_idx" ON "CrmAgentPlan"("accountId", "status", "createdAt");
CREATE INDEX "CrmAgentPlan_goalType_idx" ON "CrmAgentPlan"("goalType");
CREATE INDEX "CrmAgentPlanStep_planId_order_idx" ON "CrmAgentPlanStep"("planId", "order");
CREATE INDEX "CrmAgentPlanStep_status_idx" ON "CrmAgentPlanStep"("status");
CREATE INDEX "CrmAgentAction_accountId_status_createdAt_idx" ON "CrmAgentAction"("accountId", "status", "createdAt");
CREATE INDEX "CrmAgentAction_sessionId_status_idx" ON "CrmAgentAction"("sessionId", "status");
CREATE INDEX "CrmAgentAction_actionType_idx" ON "CrmAgentAction"("actionType");
CREATE INDEX "CrmAgentToolCall_accountId_toolName_startedAt_idx" ON "CrmAgentToolCall"("accountId", "toolName", "startedAt");
CREATE INDEX "CrmAgentToolCall_sessionId_idx" ON "CrmAgentToolCall"("sessionId");
CREATE INDEX "CrmAgentToolCall_planStepId_idx" ON "CrmAgentToolCall"("planStepId");
CREATE INDEX "CrmAgentArtifact_accountId_type_createdAt_idx" ON "CrmAgentArtifact"("accountId", "type", "createdAt");
CREATE INDEX "CrmAgentArtifact_sessionId_idx" ON "CrmAgentArtifact"("sessionId");
CREATE INDEX "CrmAgentArtifact_planId_idx" ON "CrmAgentArtifact"("planId");
CREATE UNIQUE INDEX "CrmAgentMemory_accountId_key_key" ON "CrmAgentMemory"("accountId", "key");
CREATE INDEX "CrmAgentMemory_accountId_updatedAt_idx" ON "CrmAgentMemory"("accountId", "updatedAt");
CREATE INDEX "CrmAgentInsight_accountId_status_priority_createdAt_idx" ON "CrmAgentInsight"("accountId", "status", "priority", "createdAt");
CREATE INDEX "CrmAgentInsight_accountId_type_status_idx" ON "CrmAgentInsight"("accountId", "type", "status");
CREATE INDEX "CrmAgentTask_accountId_status_createdAt_idx" ON "CrmAgentTask"("accountId", "status", "createdAt");
CREATE INDEX "CrmAgentTask_accountId_type_status_idx" ON "CrmAgentTask"("accountId", "type", "status");
CREATE UNIQUE INDEX "CrmAgentPolicy_accountId_key_key" ON "CrmAgentPolicy"("accountId", "key");
CREATE INDEX "CrmAgentKnowledgeSnapshot_accountId_type_idx" ON "CrmAgentKnowledgeSnapshot"("accountId", "type");
CREATE INDEX "CrmAgentKnowledgeSnapshot_expiresAt_idx" ON "CrmAgentKnowledgeSnapshot"("expiresAt");
CREATE INDEX "CrmAgentCampaign_accountId_status_createdAt_idx" ON "CrmAgentCampaign"("accountId", "status", "createdAt");
CREATE INDEX "CrmAgentCampaign_scheduledAt_idx" ON "CrmAgentCampaign"("scheduledAt");
CREATE INDEX "CrmAgentCampaignRecipient_accountId_status_createdAt_idx" ON "CrmAgentCampaignRecipient"("accountId", "status", "createdAt");
CREATE INDEX "CrmAgentCampaignRecipient_campaignId_status_idx" ON "CrmAgentCampaignRecipient"("campaignId", "status");
CREATE INDEX "CrmAgentCampaignRecipient_clientId_createdAt_idx" ON "CrmAgentCampaignRecipient"("clientId", "createdAt");
CREATE INDEX "CrmAgentAudit_accountId_createdAt_idx" ON "CrmAgentAudit"("accountId", "createdAt");
CREATE INDEX "CrmAgentAudit_sessionId_idx" ON "CrmAgentAudit"("sessionId");

ALTER TABLE "CrmAgentMessage" ADD CONSTRAINT "CrmAgentMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CrmAgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAgentState" ADD CONSTRAINT "CrmAgentState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CrmAgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAgentPlan" ADD CONSTRAINT "CrmAgentPlan_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CrmAgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAgentPlanStep" ADD CONSTRAINT "CrmAgentPlanStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CrmAgentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAgentArtifact" ADD CONSTRAINT "CrmAgentArtifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CrmAgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAgentCampaignRecipient" ADD CONSTRAINT "CrmAgentCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmAgentCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
