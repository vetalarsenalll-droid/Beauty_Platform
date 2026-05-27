import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCrmAgentAction, getMissingCrmAgentActionSlots, isCrmAgentExecutableAction } from "./actions";
import { createCrmAgentAction, getCrmAgentAction as getPersistedCrmAgentAction } from "./persistence";
import type { CrmAgentToolContext, CrmAgentToolDefinition, CrmAgentToolHandler } from "./types";

type JsonRecord = Record<string, unknown>;

const draftToolHandlers: Partial<Record<string, CrmAgentToolHandler<JsonRecord, unknown>>> = {
  "actions.prepare": prepareAction,
  "actions.preview": previewAction,
};

export function attachCrmAgentDraftToolHandlers<T extends CrmAgentToolDefinition>(tools: T[]): T[] {
  return tools.map((tool) => {
    const handler = draftToolHandlers[tool.name];
    return handler ? { ...tool, handler } : tool;
  });
}

export function getCrmAgentDraftToolHandler(name: string) {
  return draftToolHandlers[name] ?? null;
}

export async function buildCrmAgentActionPreview(actionType: string, payload: JsonRecord, ctx: CrmAgentToolContext) {
  return buildActionPreview(actionType, payload, ctx);
}

async function prepareAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionType = stringArg(args.actionType);
  if (!actionType) throw new Error("actions.prepare requires actionType.");

  const definition = getCrmAgentAction(actionType);
  if (!definition) throw new Error(`Unknown action type: ${actionType}.`);
  if (!isCrmAgentExecutableAction(definition.name)) throw new Error(`Action is not executable yet: ${definition.name}.`);
  if (!canUsePermission(ctx.permissions, definition.permission)) {
    throw new Error(`Missing permission: ${definition.permission}`);
  }

  const payload = recordArg(args.payload) ?? {};
  const missingSlots = getMissingCrmAgentActionSlots(definition.name, payload);
  if (missingSlots.length) {
    return {
      status: "NEEDS_SLOTS",
      actionType: definition.name,
      missingSlots,
      requiredSlots: definition.requiredSlots,
      optionalSlots: definition.optionalSlots,
    };
  }

  const action = await createCrmAgentAction({
    accountId: ctx.accountId,
    userId: ctx.userId ?? null,
    sessionId: ctx.sessionId ?? null,
    actionType: definition.name,
    summary: stringArg(args.summary) || definition.description,
    payload: payload as Prisma.InputJsonValue,
    riskLevel: definition.risk,
    permission: definition.permission,
    expiresAt: dateArg(args.expiresAt),
  });
  const preview = await buildActionPreview(definition.name, payload, ctx);

  return {
    status: action.status,
    actionId: action.id,
    actionType: action.actionType,
    summary: action.summary,
    riskLevel: action.riskLevel,
    permission: action.permission,
    confirmation: definition.confirmation,
    payload: action.payload,
    preview,
  };
}

async function previewAction(args: JsonRecord, ctx: CrmAgentToolContext) {
  const actionId = numberArg(args.actionId);
  const action = actionId ? await getPersistedCrmAgentAction({ accountId: ctx.accountId, actionId }) : null;

  if (action) {
    const payload = recordArg(action.payload) ?? {};
    const preview = await buildActionPreview(action.actionType, payload, ctx);
    return {
      actionId: action.id,
      actionType: action.actionType,
      summary: action.summary,
      riskLevel: action.riskLevel,
      permission: action.permission,
      status: action.status,
      preview,
    };
  }

  const actionType = stringArg(args.actionType);
  if (!actionType) throw new Error("actions.preview requires actionId or actionType.");
  const definition = getCrmAgentAction(actionType);
  if (!definition) throw new Error(`Unknown action type: ${actionType}.`);
  if (!isCrmAgentExecutableAction(definition.name)) throw new Error(`Action is not executable yet: ${definition.name}.`);
  const payload = recordArg(args.payload) ?? {};
  const preview = await buildActionPreview(definition.name, payload, ctx);
  return {
    actionType: definition.name,
    summary: stringArg(args.summary) || definition.description,
    riskLevel: definition.risk,
    permission: definition.permission,
    status: "DRAFT",
    preview,
  };
}

async function buildActionPreview(actionType: string, payload: JsonRecord, ctx: CrmAgentToolContext) {
  const before = await loadActionBefore(actionType, payload, ctx);
  const after = buildActionAfter(actionType, payload, before);
  return {
    before,
    after,
    diff: buildFlatDiff(before, after),
  };
}

async function loadActionBefore(actionType: string, payload: JsonRecord, ctx: CrmAgentToolContext): Promise<Record<string, unknown> | null> {
  if (actionType === "client.update") {
    const clientId = numberArg(payload.clientId);
    if (!clientId) return null;
    const client = await prisma.client.findFirst({
      where: { id: clientId, accountId: ctx.accountId },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, birthDate: true },
    });
    return client ? { ...client, birthDate: client.birthDate?.toISOString() ?? null } : null;
  }

  if (actionType === "appointment.cancel") {
    const appointmentId = numberArg(payload.appointmentId);
    if (!appointmentId) return null;
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: ctx.accountId },
      select: { id: true, status: true, startAt: true, endAt: true, clientId: true, specialistId: true, locationId: true, comment: true },
    });
    return appointment
      ? { ...appointment, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString() }
      : null;
  }

  if (actionType === "service.update" || actionType === "service.archive" || actionType === "site.service.copy.update") {
    const serviceId = numberArg(payload.serviceId);
    if (!serviceId) return null;
    const service = await prisma.service.findFirst({
      where: { id: serviceId, accountId: ctx.accountId },
      select: { id: true, categoryId: true, name: true, description: true, baseDurationMin: true, basePrice: true, isActive: true },
    });
    return service ? { ...service, basePrice: service.basePrice.toString() } : null;
  }

  if (actionType === "location.update") {
    const locationId = numberArg(payload.locationId);
    if (!locationId) return null;
    return prisma.location.findFirst({
      where: { id: locationId, accountId: ctx.accountId },
      select: { id: true, name: true, address: true, description: true, phone: true, status: true },
    });
  }

  if (actionType === "review.reply") {
    const reviewId = numberArg(payload.reviewId);
    if (!reviewId) return null;
    const review = await prisma.review.findFirst({
      where: { id: reviewId, accountId: ctx.accountId },
      select: { id: true, rating: true, comment: true, replyText: true, repliedAt: true },
    });
    return review ? { ...review, repliedAt: review.repliedAt?.toISOString() ?? null } : null;
  }

  if (actionType === "memory.update" || actionType === "autopilot.setting.update") {
    const key = stringArg(payload.key);
    if (!key) return null;
    const memory = await prisma.crmAgentMemory.findUnique({
      where: { accountId_key: { accountId: ctx.accountId, key } },
      select: { id: true, key: true, value: true, source: true, confidence: true, updatedAt: true },
    });
    return memory
      ? { ...memory, confidence: memory.confidence.toString(), updatedAt: memory.updatedAt.toISOString() }
      : null;
  }

  return null;
}

function buildActionAfter(actionType: string, payload: JsonRecord, before: Record<string, unknown> | null) {
  if (actionType === "appointment.cancel") {
    return { ...(before ?? {}), ...payload, status: "CANCELLED" };
  }
  if (actionType === "service.archive") {
    return { ...(before ?? {}), ...payload, isActive: false };
  }
  if (actionType === "review.reply") {
    return { ...(before ?? {}), ...payload, repliedAt: "on_execute" };
  }
  return { ...(before ?? {}), ...payload };
}

function buildFlatDiff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  return [...fields].map((field) => ({
    field,
    before: before?.[field] ?? null,
    after: after[field] ?? null,
  }));
}

function canUsePermission(permissions: string[], permission: string) {
  return permissions.includes("crm.all") || permissions.includes(permission);
}

function stringArg(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberArg(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function dateArg(value: unknown) {
  const raw = stringArg(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recordArg(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
