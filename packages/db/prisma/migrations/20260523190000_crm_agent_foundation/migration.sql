CREATE TYPE "AiPendingActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXECUTED', 'FAILED', 'EXPIRED');
CREATE TYPE "AiAccountInsightStatus" AS ENUM ('NEW', 'VIEWED', 'ACCEPTED', 'DISMISSED', 'EXPIRED');
CREATE TYPE "AiAgentTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED', 'FAILED');
CREATE TYPE "AiAgentCampaignStatus" AS ENUM ('DRAFT', 'READY', 'PENDING_CONFIRMATION', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED', 'FAILED');
CREATE TYPE "AiAgentDraftStatus" AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'APPROVED', 'APPLIED', 'REJECTED', 'FAILED');
CREATE TYPE "AiAgentRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');
CREATE TYPE "AiAgentToolCallStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

CREATE TABLE "AiPendingAction" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "threadId" INTEGER,
  "actionType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "AiPendingActionStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "error" TEXT,
  "riskLevel" TEXT NOT NULL DEFAULT 'medium',
  "permission" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiPendingAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAccountMemory" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL DEFAULT 1,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAccountMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAccountInsight" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" "AiAccountInsightStatus" NOT NULL DEFAULT 'NEW',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAccountInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentTask" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "payload" JSONB NOT NULL,
  "status" "AiAgentTaskStatus" NOT NULL DEFAULT 'OPEN',
  "sourceInsightId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAgentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentCampaign" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "audience" JSONB NOT NULL,
  "offer" JSONB,
  "content" JSONB NOT NULL,
  "channels" TEXT[],
  "status" "AiAgentCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "result" JSONB,
  "error" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAgentCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentNotificationDraft" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "campaignId" INTEGER,
  "title" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "audience" JSONB NOT NULL,
  "bodyText" TEXT NOT NULL,
  "status" "AiAgentDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAgentNotificationDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentReviewDraft" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "reviewId" INTEGER NOT NULL,
  "replyText" TEXT NOT NULL,
  "status" "AiAgentDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAgentReviewDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentSiteDraft" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "patch" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "AiAgentDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiAgentSiteDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentRun" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "threadId" INTEGER,
  "runType" TEXT NOT NULL,
  "status" "AiAgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentToolCall" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "runId" INTEGER,
  "threadId" INTEGER,
  "toolName" TEXT NOT NULL,
  "arguments" JSONB NOT NULL,
  "result" JSONB,
  "status" "AiAgentToolCallStatus" NOT NULL DEFAULT 'RUNNING',
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAgentToolCall_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiAgentAudit" (
  "id" SERIAL NOT NULL,
  "accountId" INTEGER NOT NULL,
  "userId" INTEGER,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiAgentAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiPendingAction_accountId_status_createdAt_idx" ON "AiPendingAction"("accountId", "status", "createdAt");
CREATE INDEX "AiPendingAction_threadId_status_idx" ON "AiPendingAction"("threadId", "status");
CREATE INDEX "AiPendingAction_actionType_idx" ON "AiPendingAction"("actionType");
CREATE INDEX "AiPendingAction_expiresAt_idx" ON "AiPendingAction"("expiresAt");

CREATE UNIQUE INDEX "AiAccountMemory_accountId_key_key" ON "AiAccountMemory"("accountId", "key");
CREATE INDEX "AiAccountMemory_accountId_updatedAt_idx" ON "AiAccountMemory"("accountId", "updatedAt");

CREATE INDEX "AiAccountInsight_accountId_status_priority_createdAt_idx" ON "AiAccountInsight"("accountId", "status", "priority", "createdAt");
CREATE INDEX "AiAccountInsight_accountId_type_status_idx" ON "AiAccountInsight"("accountId", "type", "status");
CREATE INDEX "AiAccountInsight_expiresAt_idx" ON "AiAccountInsight"("expiresAt");

CREATE INDEX "AiAgentTask_accountId_status_createdAt_idx" ON "AiAgentTask"("accountId", "status", "createdAt");
CREATE INDEX "AiAgentTask_accountId_type_status_idx" ON "AiAgentTask"("accountId", "type", "status");
CREATE INDEX "AiAgentTask_sourceInsightId_idx" ON "AiAgentTask"("sourceInsightId");

CREATE INDEX "AiAgentCampaign_accountId_status_createdAt_idx" ON "AiAgentCampaign"("accountId", "status", "createdAt");
CREATE INDEX "AiAgentCampaign_scheduledAt_idx" ON "AiAgentCampaign"("scheduledAt");

CREATE INDEX "AiAgentNotificationDraft_accountId_status_createdAt_idx" ON "AiAgentNotificationDraft"("accountId", "status", "createdAt");
CREATE INDEX "AiAgentNotificationDraft_campaignId_idx" ON "AiAgentNotificationDraft"("campaignId");

CREATE INDEX "AiAgentReviewDraft_accountId_status_createdAt_idx" ON "AiAgentReviewDraft"("accountId", "status", "createdAt");
CREATE INDEX "AiAgentReviewDraft_reviewId_idx" ON "AiAgentReviewDraft"("reviewId");

CREATE INDEX "AiAgentSiteDraft_accountId_status_createdAt_idx" ON "AiAgentSiteDraft"("accountId", "status", "createdAt");
CREATE INDEX "AiAgentSiteDraft_accountId_targetType_idx" ON "AiAgentSiteDraft"("accountId", "targetType");

CREATE INDEX "AiAgentRun_accountId_runType_createdAt_idx" ON "AiAgentRun"("accountId", "runType", "createdAt");
CREATE INDEX "AiAgentRun_accountId_status_createdAt_idx" ON "AiAgentRun"("accountId", "status", "createdAt");
CREATE INDEX "AiAgentRun_threadId_idx" ON "AiAgentRun"("threadId");

CREATE INDEX "AiAgentToolCall_accountId_toolName_createdAt_idx" ON "AiAgentToolCall"("accountId", "toolName", "createdAt");
CREATE INDEX "AiAgentToolCall_runId_idx" ON "AiAgentToolCall"("runId");
CREATE INDEX "AiAgentToolCall_threadId_idx" ON "AiAgentToolCall"("threadId");

CREATE INDEX "AiAgentAudit_accountId_createdAt_idx" ON "AiAgentAudit"("accountId", "createdAt");
CREATE INDEX "AiAgentAudit_userId_createdAt_idx" ON "AiAgentAudit"("userId", "createdAt");
CREATE INDEX "AiAgentAudit_action_idx" ON "AiAgentAudit"("action");
