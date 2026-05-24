import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CreatePendingActionInput } from "@/lib/crm-agent-types";

const DEFAULT_PENDING_ACTION_TTL_MINUTES = 30;

function pendingActionExpiresAt(minutes = DEFAULT_PENDING_ACTION_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function getOrCreateCrmAgentThread(input: {
  accountId: number;
  userId: number;
  threadId?: number | null;
}) {
  if (input.threadId) {
    const existing = await prisma.aiThread.findFirst({
      where: {
        id: input.threadId,
        accountId: input.accountId,
        userId: input.userId,
        deletedAt: null,
      },
    });
    if (existing) return existing;
  }

  return prisma.aiThread.create({
    data: {
      accountId: input.accountId,
      userId: input.userId,
      title: "CRM AI Agent",
    },
  });
}

export async function getLatestCrmAgentThread(input: {
  accountId: number;
  userId: number;
}) {
  return prisma.aiThread.findFirst({
    where: {
      accountId: input.accountId,
      userId: input.userId,
      deletedAt: null,
      archivedAt: null,
    },
    orderBy: [{ pinnedAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getOrCreateCurrentCrmAgentThread(input: {
  accountId: number;
  userId: number;
  threadId?: number | null;
  forceNew?: boolean;
}) {
  if (input.threadId || input.forceNew) {
    return getOrCreateCrmAgentThread(input);
  }

  const latest = await getLatestCrmAgentThread(input);
  return latest ?? getOrCreateCrmAgentThread(input);
}

export async function listCrmAgentThreads(input: {
  accountId: number;
  userId: number;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  take?: number;
}) {
  return prisma.aiThread.findMany({
    where: {
      accountId: input.accountId,
      userId: input.userId,
      ...(input.includeDeleted ? { deletedAt: { not: null } } : { deletedAt: null }),
      ...(input.includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: [{ pinnedAt: "desc" }, { updatedAt: "desc" }],
    take: input.take ?? 50,
    select: {
      id: true,
      title: true,
      groupId: true,
      archivedAt: true,
      deletedAt: true,
      pinnedAt: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
  });
}

export async function listCrmAgentThreadGroups(input: {
  accountId: number;
  userId: number;
}) {
  return prisma.aiThreadGroup.findMany({
    where: { accountId: input.accountId, userId: input.userId },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });
}

export async function updateCrmAgentThread(input: {
  accountId: number;
  userId: number;
  threadId: number;
  title?: string | null;
  groupId?: number | null;
  archived?: boolean;
  pinned?: boolean;
  deleted?: boolean;
}) {
  if (input.groupId != null) {
    const group = await prisma.aiThreadGroup.findFirst({
      where: { id: input.groupId, accountId: input.accountId, userId: input.userId },
      select: { id: true },
    });
    if (!group) throw new Error("Thread group was not found.");
  }
  return prisma.aiThread.updateMany({
    where: { id: input.threadId, accountId: input.accountId, userId: input.userId },
    data: {
      ...(input.title !== undefined ? { title: input.title?.trim() || "CRM AI Agent" } : {}),
      ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
      ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      ...(input.pinned !== undefined ? { pinnedAt: input.pinned ? new Date() : null } : {}),
      ...(input.deleted !== undefined ? { deletedAt: input.deleted ? new Date() : null } : {}),
    },
  });
}

export async function deleteCrmAgentThread(input: {
  accountId: number;
  userId: number;
  threadId: number;
}) {
  return prisma.aiThread.updateMany({
    where: { id: input.threadId, accountId: input.accountId, userId: input.userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function createCrmAgentThreadGroup(input: {
  accountId: number;
  userId: number;
  title: string;
}) {
  return prisma.aiThreadGroup.create({
    data: {
      accountId: input.accountId,
      userId: input.userId,
      title: input.title.trim() || "Группа",
    },
  });
}

export async function updateCrmAgentThreadGroup(input: {
  accountId: number;
  userId: number;
  groupId: number;
  title?: string | null;
  sortOrder?: number | null;
}) {
  return prisma.aiThreadGroup.updateMany({
    where: { id: input.groupId, accountId: input.accountId, userId: input.userId },
    data: {
      ...(input.title !== undefined ? { title: input.title?.trim() || "Группа" } : {}),
      ...(typeof input.sortOrder === "number" ? { sortOrder: Math.trunc(input.sortOrder) } : {}),
    },
  });
}

export async function deleteCrmAgentThreadGroup(input: {
  accountId: number;
  userId: number;
  groupId: number;
}) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.aiThreadGroup.findFirst({
      where: { id: input.groupId, accountId: input.accountId, userId: input.userId },
      select: { id: true },
    });
    if (!group) return { count: 0 };
    await tx.aiThread.updateMany({
      where: { accountId: input.accountId, userId: input.userId, groupId: input.groupId },
      data: { groupId: null },
    });
    await tx.aiThreadGroup.delete({ where: { id: input.groupId } });
    return { count: 1 };
  });
}

export async function updateCrmAgentThreadState(input: {
  threadId: number;
  state: Prisma.InputJsonValue;
}) {
  return prisma.aiThreadState.upsert({
    where: { threadId: input.threadId },
    create: { threadId: input.threadId, state: input.state },
    update: { state: input.state },
  });
}

export async function getCrmAgentThreadState(input: {
  accountId: number;
  threadId: number;
}) {
  return prisma.aiThreadState.findFirst({
    where: { threadId: input.threadId, thread: { accountId: input.accountId, deletedAt: null } },
  });
}

export async function appendCrmAgentMessage(input: {
  threadId: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.aiMessage.create({
      data: {
        threadId: input.threadId,
        role: input.role,
        content: input.content,
      },
    });
    await tx.aiThread.update({
      where: { id: input.threadId },
      data: { updatedAt: new Date() },
    });
    return message;
  });
}

export async function listCrmAgentMessages(input: {
  accountId: number;
  threadId: number;
  take?: number;
}) {
  const thread = await prisma.aiThread.findFirst({
    where: { id: input.threadId, accountId: input.accountId, deletedAt: null },
    select: { id: true },
  });
  if (!thread) return [];

  return prisma.aiMessage.findMany({
    where: { threadId: input.threadId },
    orderBy: { id: "asc" },
    take: input.take ?? 80,
  });
}

export async function createPendingAction(input: CreatePendingActionInput) {
  return prisma.aiPendingAction.create({
    data: {
      accountId: input.accountId,
      userId: input.userId ?? null,
      threadId: input.threadId ?? null,
      actionType: input.actionType,
      payload: input.payload,
      summary: input.summary,
      riskLevel: input.riskLevel ?? "medium",
      permission: input.permission ?? null,
      expiresAt: input.expiresAt ?? pendingActionExpiresAt(),
    },
  });
}

export async function getPendingActionForAccount(input: {
  accountId: number;
  actionId: number;
}) {
  return prisma.aiPendingAction.findFirst({
    where: { id: input.actionId, accountId: input.accountId },
  });
}

export async function listPendingActions(input: {
  accountId: number;
  threadId?: number | null;
  take?: number;
}) {
  return prisma.aiPendingAction.findMany({
    where: {
      accountId: input.accountId,
      ...(input.threadId ? { threadId: input.threadId } : {}),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 20,
  });
}

export async function confirmPendingAction(input: {
  accountId: number;
  actionId: number;
  userId: number;
}) {
  return prisma.aiPendingAction.updateMany({
    where: {
      id: input.actionId,
      accountId: input.accountId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "CONFIRMED",
      userId: input.userId,
      confirmedAt: new Date(),
    },
  });
}

export async function rejectPendingAction(input: {
  accountId: number;
  actionId: number;
}) {
  return prisma.aiPendingAction.updateMany({
    where: {
      id: input.actionId,
      accountId: input.accountId,
      status: "PENDING",
    },
    data: {
      status: "REJECTED",
    },
  });
}

export async function markPendingActionExecuted(input: {
  accountId: number;
  actionId: number;
  result?: Prisma.InputJsonValue;
}) {
  return prisma.aiPendingAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId },
    data: {
      status: "EXECUTED",
      result: input.result ?? undefined,
      executedAt: new Date(),
    },
  });
}

export async function markPendingActionFailed(input: {
  accountId: number;
  actionId: number;
  error: string;
  result?: Prisma.InputJsonValue;
}) {
  return prisma.aiPendingAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId },
    data: {
      status: "FAILED",
      error: input.error,
      result: input.result ?? undefined,
      executedAt: new Date(),
    },
  });
}

export async function expireOldPendingActions(now = new Date()) {
  return prisma.aiPendingAction.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
}

export async function getAccountMemory(accountId: number) {
  return prisma.aiAccountMemory.findMany({
    where: { accountId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAccountMemoryValue(input: {
  accountId: number;
  key: string;
}) {
  return prisma.aiAccountMemory.findUnique({
    where: { accountId_key: { accountId: input.accountId, key: input.key } },
  });
}

export async function upsertAccountMemory(input: {
  accountId: number;
  key: string;
  value: Prisma.InputJsonValue;
  confidence?: number;
  source?: string | null;
}) {
  return prisma.aiAccountMemory.upsert({
    where: { accountId_key: { accountId: input.accountId, key: input.key } },
    create: {
      accountId: input.accountId,
      key: input.key,
      value: input.value,
      confidence: input.confidence ?? 1,
      source: input.source ?? null,
    },
    update: {
      value: input.value,
      confidence: input.confidence ?? 1,
      source: input.source ?? null,
    },
  });
}

export async function listAccountInsights(input: {
  accountId: number;
  status?: "NEW" | "VIEWED" | "ACCEPTED" | "DISMISSED" | "EXPIRED";
  take?: number;
}) {
  return prisma.aiAccountInsight.findMany({
    where: {
      accountId: input.accountId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: input.take ?? 20,
  });
}

export async function createAccountInsight(input: {
  accountId: number;
  type: string;
  title: string;
  summary: string;
  data: Prisma.InputJsonValue;
  priority?: number;
  expiresAt?: Date | null;
}) {
  return prisma.aiAccountInsight.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      data: input.data,
      priority: input.priority ?? 0,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function updateAccountInsightStatus(input: {
  accountId: number;
  insightId: number;
  status: "NEW" | "VIEWED" | "ACCEPTED" | "DISMISSED" | "EXPIRED";
}) {
  return prisma.aiAccountInsight.updateMany({
    where: { id: input.insightId, accountId: input.accountId },
    data: { status: input.status },
  });
}

export async function createAgentTask(input: {
  accountId: number;
  type: string;
  title: string;
  description?: string | null;
  payload: Prisma.InputJsonValue;
  sourceInsightId?: number | null;
}) {
  return prisma.aiAgentTask.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      payload: input.payload,
      sourceInsightId: input.sourceInsightId ?? null,
    },
  });
}

export async function listAgentTasks(input: {
  accountId: number;
  status?: "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED" | "FAILED";
  take?: number;
}) {
  return prisma.aiAgentTask.findMany({
    where: {
      accountId: input.accountId,
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

export async function updateAgentTaskStatus(input: {
  accountId: number;
  taskId: number;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED" | "FAILED";
}) {
  return prisma.aiAgentTask.updateMany({
    where: { id: input.taskId, accountId: input.accountId },
    data: { status: input.status },
  });
}

export async function listAgentCampaigns(input: {
  accountId: number;
  take?: number;
}) {
  return prisma.aiAgentCampaign.findMany({
    where: { accountId: input.accountId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

export async function createAgentCampaign(input: {
  accountId: number;
  title: string;
  goal: string;
  audience: Prisma.InputJsonValue;
  offer?: Prisma.InputJsonValue | null;
  content: Prisma.InputJsonValue;
  channels?: string[];
  scheduledAt?: Date | null;
}) {
  return prisma.aiAgentCampaign.create({
    data: {
      accountId: input.accountId,
      title: input.title,
      goal: input.goal,
      audience: input.audience,
      offer: input.offer ?? undefined,
      content: input.content,
      channels: input.channels ?? [],
      scheduledAt: input.scheduledAt ?? null,
    },
  });
}

export async function createNotificationDraft(input: {
  accountId: number;
  campaignId?: number | null;
  title: string;
  channel: string;
  audience: Prisma.InputJsonValue;
  bodyText: string;
}) {
  return prisma.aiAgentNotificationDraft.create({
    data: {
      accountId: input.accountId,
      campaignId: input.campaignId ?? null,
      title: input.title,
      channel: input.channel,
      audience: input.audience,
      bodyText: input.bodyText,
    },
  });
}

export async function listNotificationDrafts(input: {
  accountId: number;
  take?: number;
}) {
  return prisma.aiAgentNotificationDraft.findMany({
    where: { accountId: input.accountId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

export async function createReviewDraft(input: {
  accountId: number;
  reviewId: number;
  replyText: string;
}) {
  return prisma.aiAgentReviewDraft.create({
    data: {
      accountId: input.accountId,
      reviewId: input.reviewId,
      replyText: input.replyText,
    },
  });
}

export async function listReviewDrafts(input: {
  accountId: number;
  take?: number;
}) {
  return prisma.aiAgentReviewDraft.findMany({
    where: { accountId: input.accountId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

export async function createSiteDraft(input: {
  accountId: number;
  targetType: string;
  targetId?: string | null;
  patch: Prisma.InputJsonValue;
  summary: string;
}) {
  return prisma.aiAgentSiteDraft.create({
    data: {
      accountId: input.accountId,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      patch: input.patch,
      summary: input.summary,
    },
  });
}

export async function listSiteDrafts(input: {
  accountId: number;
  take?: number;
}) {
  return prisma.aiAgentSiteDraft.findMany({
    where: { accountId: input.accountId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

export async function listRecentAgentAudit(input: {
  accountId: number;
  take?: number;
}) {
  return prisma.aiAgentAudit.findMany({
    where: { accountId: input.accountId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 50,
  });
}

export async function listCrmAgentDebugRuns(input: {
  accountId: number;
  take?: number;
}) {
  const runs = await prisma.aiAgentRun.findMany({
    where: { accountId: input.accountId },
    orderBy: { createdAt: "desc" },
    take: input.take ?? 10,
    select: {
      id: true,
      runType: true,
      status: true,
      input: true,
      output: true,
      error: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      threadId: true,
    },
  });
  const runIds = runs.map((run) => run.id);
  if (!runIds.length) return [];

  const [toolCalls, usages] = await Promise.all([
    prisma.aiAgentToolCall.findMany({
      where: { accountId: input.accountId, runId: { in: runIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        runId: true,
        toolName: true,
        status: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
    }),
    prisma.aiUsage.findMany({
      where: { accountId: input.accountId, actionId: { in: runIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        actionId: true,
        provider: true,
        model: true,
        purpose: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        chargedRub: true,
        createdAt: true,
      },
    }),
  ]);

  return runs.map((run) => {
    const runToolCalls = toolCalls.filter((item) => item.runId === run.id);
    const runUsages = usages.filter((item) => item.actionId === run.id);
    return {
      ...run,
      toolCalls: runToolCalls,
      usage: {
        items: runUsages,
        totalTokens: runUsages.reduce((sum, item) => sum + item.totalTokens, 0),
        chargedRub: runUsages.reduce((sum, item) => sum + Number(item.chargedRub), 0).toFixed(6),
      },
    };
  });
}

export async function createAgentRun(input: {
  accountId: number;
  userId?: number | null;
  threadId?: number | null;
  runType: string;
  input?: Prisma.InputJsonValue;
}) {
  return prisma.aiAgentRun.create({
    data: {
      accountId: input.accountId,
      userId: input.userId ?? null,
      threadId: input.threadId ?? null,
      runType: input.runType,
      input: input.input ?? undefined,
    },
  });
}

export async function finishAgentRun(input: {
  accountId: number;
  runId: number;
  output?: Prisma.InputJsonValue;
  error?: string | null;
}) {
  return prisma.aiAgentRun.updateMany({
    where: { id: input.runId, accountId: input.accountId },
    data: {
      status: input.error ? "FAILED" : "DONE",
      output: input.output ?? undefined,
      error: input.error ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function createAgentToolCall(input: {
  accountId: number;
  runId?: number | null;
  threadId?: number | null;
  toolName: string;
  arguments: Prisma.InputJsonValue;
}) {
  return prisma.aiAgentToolCall.create({
    data: {
      accountId: input.accountId,
      runId: input.runId ?? null,
      threadId: input.threadId ?? null,
      toolName: input.toolName,
      arguments: input.arguments,
    },
  });
}

export async function finishAgentToolCall(input: {
  accountId: number;
  toolCallId: number;
  result?: Prisma.InputJsonValue;
  error?: string | null;
}) {
  return prisma.aiAgentToolCall.updateMany({
    where: { id: input.toolCallId, accountId: input.accountId },
    data: {
      status: input.error ? "FAILED" : "DONE",
      result: input.result ?? undefined,
      error: input.error ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function writeAgentAudit(input: {
  accountId: number;
  userId?: number | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  data?: Prisma.InputJsonValue;
}) {
  return prisma.aiAgentAudit.create({
    data: {
      accountId: input.accountId,
      userId: input.userId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      data: input.data ?? undefined,
    },
  });
}
