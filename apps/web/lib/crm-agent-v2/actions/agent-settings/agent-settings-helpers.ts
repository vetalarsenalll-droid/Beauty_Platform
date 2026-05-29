import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, numberOrNull, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function previewAgentSettingPayload(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = await resolvePreviewBefore(payload, ctx.accountId);
  return buildActionPreview({ before, after: payload });
}

export async function readAgentMemory(accountId: number, payload: JsonRecord) {
  const key = optionalString(payload, "key");
  const rows = await prisma.crmAgentMemory.findMany({
    where: { accountId, ...(key ? { key } : {}) },
    orderBy: { updatedAt: "desc" },
    take: take(payload.take),
  });
  return { memory: rows.map(serializeMemory) };
}

export async function executeAgentMemoryUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const key = requiredString(payload, "key");
  const memory = await prisma.crmAgentMemory.upsert({
    where: { accountId_key: { accountId: ctx.accountId, key } },
    create: {
      accountId: ctx.accountId,
      key,
      value: inputJson(payload.value ?? null),
      confidence: confidence(payload.confidence),
      source: optionalString(payload, "source") ?? "crm_agent_action",
    },
    update: {
      value: inputJson(payload.value ?? null),
      confidence: confidence(payload.confidence),
      source: optionalString(payload, "source") ?? "crm_agent_action",
    },
  });
  return { status: "DONE" as const, data: { memoryId: memory.id, key: memory.key } };
}

export async function executeAgentMemoryDelete(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const memoryId = numberOrNull(payload.memoryId);
  const key = optionalString(payload, "key");
  if (!memoryId && !key) throw new Error("Action payload memoryId or key is required.");
  const deleted = await prisma.crmAgentMemory.deleteMany({ where: { accountId: ctx.accountId, ...(memoryId ? { id: memoryId } : { key: key ?? "" }) } });
  return { status: "DONE" as const, data: { memoryId: memoryId ?? null, key, deleted: deleted.count > 0 } };
}

export async function readAgentPolicies(accountId: number, payload: JsonRecord) {
  const key = optionalString(payload, "key");
  const [policies, access] = await Promise.all([
    prisma.crmAgentPolicy.findMany({ where: { accountId, ...(key ? { key } : {}) }, orderBy: { updatedAt: "desc" }, take: take(payload.take) }),
    prisma.aiAccountAccess.findUnique({ where: { accountId } }),
  ]);
  return {
    access: access
      ? {
          crmAgentEnabled: access.crmAgentEnabled,
          aiEnabled: access.aiEnabled,
          siteAssistantEnabled: access.siteAssistantEnabled,
          updatedAt: access.updatedAt.toISOString(),
        }
      : null,
    policies: policies.map(serializePolicy),
  };
}

export async function executeAgentPolicyUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const key = requiredString(payload, "key");
  const policy = await upsertPolicy(ctx.accountId, key, payload.value ?? null);
  return { status: "DONE" as const, data: { policyId: policy.id, key: policy.key } };
}

export async function executeAutopilotEnabled(payload: JsonRecord, ctx: CrmAgentActionContext, enabled: boolean) {
  await prisma.aiAccountAccess.upsert({
    where: { accountId: ctx.accountId },
    create: { accountId: ctx.accountId, crmAgentEnabled: enabled },
    update: { crmAgentEnabled: enabled },
  });
  const policy = await upsertPolicy(ctx.accountId, "autopilot.enabled", enabled);
  return { status: "DONE" as const, data: { crmAgentEnabled: enabled, policyId: policy.id } };
}

export async function executeAutopilotSetLevel(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const level = requiredString(payload, "level");
  const policy = await upsertPolicy(ctx.accountId, "autopilot.level", level);
  return { status: "DONE" as const, data: { level, policyId: policy.id } };
}

export async function readAgentRuns(accountId: number, payload: JsonRecord) {
  const [sessions, plans, tasks] = await Promise.all([
    prisma.crmAgentSession.findMany({
      where: { accountId, ...(payload.status !== undefined ? { status: requiredString(payload, "status") } : {}) },
      orderBy: { updatedAt: "desc" },
      take: take(payload.take),
      include: { _count: { select: { messages: true, plans: true, states: true, artifacts: true } } },
    }),
    prisma.crmAgentPlan.findMany({
      where: { accountId, ...(payload.status !== undefined ? { status: requiredString(payload, "status") } : {}) },
      orderBy: { updatedAt: "desc" },
      take: take(payload.take),
    }),
    prisma.crmAgentTask.findMany({
      where: { accountId, ...(payload.taskStatus !== undefined ? { status: requiredString(payload, "taskStatus") } : {}) },
      orderBy: { updatedAt: "desc" },
      take: take(payload.take),
    }),
  ]);
  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      status: session.status,
      mode: session.mode,
      title: session.title,
      counts: session._count,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })),
    plans: plans.map(serializePlan),
    tasks: tasks.map(serializeTask),
  };
}

export async function readAgentTrace(accountId: number, payload: JsonRecord) {
  const sessionId = numberOrNull(payload.sessionId);
  const planId = numberOrNull(payload.planId);
  if (!sessionId && !planId) throw new Error("Action payload sessionId or planId is required.");
  const sessionWhere = sessionId ? { id: sessionId, accountId } : { accountId, plans: { some: { id: planId ?? 0 } } };
  const session = await prisma.crmAgentSession.findFirst({
    where: sessionWhere,
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
      states: { orderBy: { updatedAt: "desc" }, take: 20 },
      plans: { where: planId ? { id: planId } : {}, orderBy: { createdAt: "desc" }, take: 20, include: { steps: { orderBy: { order: "asc" } } } },
      artifacts: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!session) throw new Error("CRM Agent trace not found.");
  const toolCalls = await prisma.crmAgentToolCall.findMany({
    where: { accountId, ...(sessionId ? { sessionId: session.id } : {}) },
    orderBy: { startedAt: "desc" },
    take: take(payload.take),
  });
  const actions = await prisma.crmAgentAction.findMany({
    where: { accountId, ...(sessionId ? { sessionId: session.id } : {}) },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
  });
  return {
    session: {
      id: session.id,
      userId: session.userId,
      status: session.status,
      mode: session.mode,
      title: session.title,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    messages: session.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() })),
    states: session.states.map((state) => ({ ...state, createdAt: state.createdAt.toISOString(), updatedAt: state.updatedAt.toISOString() })),
    plans: session.plans.map((plan) => ({ ...serializePlan(plan), steps: plan.steps.map(serializePlanStep) })),
    artifacts: session.artifacts.map((artifact) => ({ ...artifact, createdAt: artifact.createdAt.toISOString() })),
    toolCalls: toolCalls.map((call) => ({
      ...call,
      startedAt: call.startedAt.toISOString(),
      finishedAt: call.finishedAt?.toISOString() ?? null,
    })),
    actions: actions.map((action) => ({
      ...action,
      expiresAt: action.expiresAt?.toISOString() ?? null,
      confirmedAt: action.confirmedAt?.toISOString() ?? null,
      executedAt: action.executedAt?.toISOString() ?? null,
      createdAt: action.createdAt.toISOString(),
      updatedAt: action.updatedAt.toISOString(),
    })),
  };
}

export async function executeAgentTaskStatus(payload: JsonRecord, ctx: CrmAgentActionContext, status: string) {
  const taskId = requiredNumber(payload.taskId, "taskId");
  const updated = await prisma.crmAgentTask.updateMany({ where: { id: taskId, accountId: ctx.accountId }, data: { status } });
  if (!updated.count) throw new Error("CRM Agent task not found.");
  return { status: "DONE" as const, data: { taskId, taskStatus: status } };
}

async function resolvePreviewBefore(payload: JsonRecord, accountId: number) {
  const key = optionalString(payload, "key");
  if (key) {
    const [memory, policy] = await Promise.all([
      prisma.crmAgentMemory.findUnique({ where: { accountId_key: { accountId, key } } }),
      prisma.crmAgentPolicy.findUnique({ where: { accountId_key: { accountId, key } } }),
    ]);
    if (policy) return serializePolicy(policy);
    if (memory) return serializeMemory(memory);
  }
  return null;
}

async function upsertPolicy(accountId: number, key: string, value: unknown) {
  return prisma.crmAgentPolicy.upsert({
    where: { accountId_key: { accountId, key } },
    create: { accountId, key, value: inputJson(value) },
    update: { value: inputJson(value) },
  });
}

function serializeMemory(memory: { id: number; key: string; value: Prisma.JsonValue; source: string | null; confidence: Prisma.Decimal; createdAt: Date; updatedAt: Date }) {
  return {
    id: memory.id,
    key: memory.key,
    value: memory.value,
    source: memory.source,
    confidence: memory.confidence.toString(),
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

function serializePolicy(policy: { id: number; key: string; value: Prisma.JsonValue; createdAt: Date; updatedAt: Date }) {
  return {
    id: policy.id,
    key: policy.key,
    value: policy.value,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

function serializePlan(plan: {
  id: number;
  sessionId: number;
  accountId: number;
  goalType: string;
  goal: Prisma.JsonValue;
  status: string;
  result: Prisma.JsonValue | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    sessionId: plan.sessionId,
    goalType: plan.goalType,
    goal: plan.goal,
    status: plan.status,
    result: plan.result,
    error: plan.error,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function serializePlanStep(step: {
  id: number;
  planId: number;
  order: number;
  type: string;
  toolName: string | null;
  args: Prisma.JsonValue | null;
  result: Prisma.JsonValue | null;
  status: string;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...step,
    startedAt: step.startedAt?.toISOString() ?? null,
    finishedAt: step.finishedAt?.toISOString() ?? null,
    createdAt: step.createdAt.toISOString(),
  };
}

function serializeTask(task: { id: number; sessionId: number | null; type: string; title: string; description: string | null; payload: Prisma.JsonValue; status: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: task.id,
    sessionId: task.sessionId,
    type: task.type,
    title: task.title,
    description: task.description,
    payload: task.payload,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function confidence(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.min(Math.max(value, 0), 1);
  return 1;
}

function take(value: unknown) {
  return Math.min(Math.max(Math.trunc(numberOrNull(value) ?? 50), 1), 100);
}
