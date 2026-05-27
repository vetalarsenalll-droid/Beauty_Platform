import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CrmAgentPlannerPlan, CrmAgentPlannerStep } from "./planner";
import type { CrmAgentRiskLevel, CrmAgentTaskState } from "./types";

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export async function createCrmAgentSession(input: {
  accountId: number;
  userId?: number | null;
  mode?: string;
  title?: string | null;
}) {
  return prisma.crmAgentSession.create({
    data: {
      accountId: input.accountId,
      userId: input.userId ?? null,
      mode: input.mode ?? "chat",
      title: input.title ?? null,
    },
  });
}

export async function getCrmAgentSession(input: { accountId: number; sessionId: number }) {
  return prisma.crmAgentSession.findFirst({
    where: { id: input.sessionId, accountId: input.accountId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
      states: { orderBy: { updatedAt: "desc" }, take: 1 },
      plans: { orderBy: { createdAt: "desc" }, take: 5, include: { steps: { orderBy: { order: "asc" } } } },
      artifacts: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
}

export async function closeCrmAgentSession(input: { accountId: number; sessionId: number; status?: "CLOSED" | "FAILED" }) {
  await prisma.crmAgentSession.updateMany({
    where: { id: input.sessionId, accountId: input.accountId },
    data: { status: input.status ?? "CLOSED" },
  });
}

export async function addCrmAgentMessage(input: {
  accountId: number;
  sessionId: number;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  data?: Prisma.InputJsonValue | null;
}) {
  await assertCrmAgentSessionBelongsToAccount({
    accountId: input.accountId,
    sessionId: input.sessionId,
  });
  return prisma.crmAgentMessage.create({
    data: {
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      data: input.data ?? Prisma.JsonNull,
    },
  });
}

export async function saveCrmAgentTaskState(state: CrmAgentTaskState) {
  await assertCrmAgentSessionBelongsToAccount({
    accountId: state.accountId,
    sessionId: state.sessionId,
  });
  return prisma.crmAgentState.create({
    data: {
      sessionId: state.sessionId,
      accountId: state.accountId,
      goalType: state.goalType,
      status: state.status,
      slots: inputJson(state.slots),
      candidates: inputJson(state.candidates),
      selected: inputJson(state.selected),
      missing: inputJson(state.missing),
    },
  });
}

export async function getLatestCrmAgentTaskState(input: { accountId: number; sessionId: number }) {
  return prisma.crmAgentState.findFirst({
    where: { accountId: input.accountId, sessionId: input.sessionId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createCrmAgentPlan(input: {
  sessionId: number;
  accountId: number;
  plan: CrmAgentPlannerPlan;
}) {
  await assertCrmAgentSessionBelongsToAccount({
    accountId: input.accountId,
    sessionId: input.sessionId,
  });
  return prisma.crmAgentPlan.create({
    data: {
      sessionId: input.sessionId,
      accountId: input.accountId,
      goalType: input.plan.goal.type,
      goal: inputJson(input.plan.goal),
      status: input.plan.status === "needs_clarification" ? "needs_user" : "planned",
      steps: {
        create: input.plan.steps.map((step) => planStepCreateInput(step)),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
}

function planStepCreateInput(step: CrmAgentPlannerStep) {
  return {
    order: step.order,
    type: step.type,
    toolName: step.toolName ?? null,
    args: step.args ? inputJson(step.args) : Prisma.JsonNull,
    status: "pending",
  };
}

export async function updateCrmAgentPlanStatus(input: {
  accountId: number;
  planId: number;
  status: "planned" | "running" | "needs_user" | "completed" | "failed";
  result?: Prisma.InputJsonValue | null;
  error?: string | null;
}) {
  await prisma.crmAgentPlan.updateMany({
    where: { id: input.planId, accountId: input.accountId },
    data: {
      status: input.status,
      result: input.result ?? undefined,
      error: input.error ?? null,
    },
  });
}

export async function updateCrmAgentPlanStep(input: {
  accountId: number;
  planStepId: number;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  result?: Prisma.InputJsonValue | null;
  error?: string | null;
}) {
  const result = await prisma.crmAgentPlanStep.updateMany({
    where: { id: input.planStepId, plan: { accountId: input.accountId } },
    data: {
      status: input.status,
      result: input.result ?? undefined,
      error: input.error ?? null,
      startedAt: input.status === "running" ? new Date() : undefined,
      finishedAt: ["done", "failed", "skipped"].includes(input.status) ? new Date() : undefined,
    },
  });
  if (!result.count) throw new Error("CrmAgentPlanStep not found for account.");
  return result;
}

export async function createCrmAgentArtifact(input: {
  accountId: number;
  sessionId?: number | null;
  planId?: number | null;
  type: string;
  title?: string | null;
  data: Prisma.InputJsonValue;
}) {
  if (input.sessionId) {
    await assertCrmAgentSessionBelongsToAccount({
      accountId: input.accountId,
      sessionId: input.sessionId,
    });
  }
  if (input.planId) {
    await assertCrmAgentPlanBelongsToAccount({
      accountId: input.accountId,
      planId: input.planId,
    });
  }
  return prisma.crmAgentArtifact.create({
    data: {
      accountId: input.accountId,
      sessionId: input.sessionId ?? null,
      planId: input.planId ?? null,
      type: input.type,
      title: input.title ?? null,
      data: input.data,
    },
  });
}

export async function createCrmAgentAction(input: {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  actionType: string;
  summary: string;
  payload: Prisma.InputJsonValue;
  riskLevel: CrmAgentRiskLevel;
  permission?: string | null;
  expiresAt?: Date | null;
}) {
  if (input.sessionId) {
    await assertCrmAgentSessionBelongsToAccount({
      accountId: input.accountId,
      sessionId: input.sessionId,
    });
  }
  return prisma.crmAgentAction.create({
    data: {
      accountId: input.accountId,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      actionType: input.actionType,
      summary: input.summary,
      payload: input.payload,
      riskLevel: input.riskLevel,
      permission: input.permission ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

export async function getCrmAgentAction(input: { accountId: number; actionId: number }) {
  return prisma.crmAgentAction.findFirst({
    where: { id: input.actionId, accountId: input.accountId },
  });
}

export async function getLatestPendingCrmAgentActionForSession(input: { accountId: number; sessionId: number }) {
  await assertCrmAgentSessionBelongsToAccount({
    accountId: input.accountId,
    sessionId: input.sessionId,
  });
  return prisma.crmAgentAction.findFirst({
    where: {
      accountId: input.accountId,
      sessionId: input.sessionId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateCrmAgentActionPayload(input: {
  accountId: number;
  actionId: number;
  payload: Prisma.InputJsonValue;
  summary?: string | null;
}) {
  await prisma.crmAgentAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId, status: "PENDING" },
    data: {
      payload: input.payload,
      summary: input.summary ?? undefined,
    },
  });
  return getCrmAgentAction({ accountId: input.accountId, actionId: input.actionId });
}

export async function confirmCrmAgentAction(input: { accountId: number; actionId: number }) {
  await prisma.crmAgentAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  return getCrmAgentAction(input);
}

export async function rejectCrmAgentAction(input: { accountId: number; actionId: number; error?: string | null }) {
  await prisma.crmAgentAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId, status: { in: ["PENDING", "CONFIRMED"] } },
    data: { status: "REJECTED", error: input.error ?? null },
  });
  return getCrmAgentAction(input);
}

export async function markCrmAgentActionExecuted(input: {
  accountId: number;
  actionId: number;
  result: Prisma.InputJsonValue;
}) {
  await prisma.crmAgentAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId },
    data: { status: "EXECUTED", result: input.result, error: null, executedAt: new Date() },
  });
}

export async function markCrmAgentActionFailed(input: { accountId: number; actionId: number; error: string }) {
  await prisma.crmAgentAction.updateMany({
    where: { id: input.actionId, accountId: input.accountId },
    data: { status: "FAILED", error: input.error },
  });
}

export async function startCrmAgentToolCall(input: {
  accountId: number;
  sessionId?: number | null;
  planStepId?: number | null;
  toolName: string;
  args: Prisma.InputJsonValue;
}) {
  if (input.sessionId) {
    await assertCrmAgentSessionBelongsToAccount({
      accountId: input.accountId,
      sessionId: input.sessionId,
    });
  }
  if (input.planStepId) {
    await assertCrmAgentPlanStepBelongsToAccount({
      accountId: input.accountId,
      planStepId: input.planStepId,
    });
  }
  return prisma.crmAgentToolCall.create({
    data: {
      accountId: input.accountId,
      sessionId: input.sessionId ?? null,
      planStepId: input.planStepId ?? null,
      toolName: input.toolName,
      args: input.args,
    },
  });
}

export async function finishCrmAgentToolCall(input: {
  accountId: number;
  toolCallId: number;
  status: "DONE" | "FAILED";
  result?: Prisma.InputJsonValue | null;
  error?: string | null;
}) {
  const result = await prisma.crmAgentToolCall.updateMany({
    where: { id: input.toolCallId, accountId: input.accountId },
    data: {
      status: input.status,
      result: input.result ?? undefined,
      error: input.error ?? null,
      finishedAt: new Date(),
    },
  });
  if (!result.count) throw new Error("CrmAgentToolCall not found for account.");
  return result;
}

export async function writeCrmAgentAudit(input: {
  accountId: number;
  userId?: number | null;
  sessionId?: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  data?: Prisma.InputJsonValue | null;
}) {
  if (input.sessionId) {
    await assertCrmAgentSessionBelongsToAccount({
      accountId: input.accountId,
      sessionId: input.sessionId,
    });
  }
  return prisma.crmAgentAudit.create({
    data: {
      accountId: input.accountId,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      data: input.data ?? Prisma.JsonNull,
    },
  });
}

async function assertCrmAgentSessionBelongsToAccount(input: { accountId: number; sessionId: number }) {
  const session = await prisma.crmAgentSession.findFirst({
    where: { id: input.sessionId, accountId: input.accountId },
    select: { id: true },
  });
  if (!session) throw new Error("CrmAgentSession not found for account.");
}

async function assertCrmAgentPlanBelongsToAccount(input: { accountId: number; planId: number }) {
  const plan = await prisma.crmAgentPlan.findFirst({
    where: { id: input.planId, accountId: input.accountId },
    select: { id: true },
  });
  if (!plan) throw new Error("CrmAgentPlan not found for account.");
}

async function assertCrmAgentPlanStepBelongsToAccount(input: { accountId: number; planStepId: number }) {
  const step = await prisma.crmAgentPlanStep.findFirst({
    where: { id: input.planStepId, plan: { accountId: input.accountId } },
    select: { id: true },
  });
  if (!step) throw new Error("CrmAgentPlanStep not found for account.");
}
