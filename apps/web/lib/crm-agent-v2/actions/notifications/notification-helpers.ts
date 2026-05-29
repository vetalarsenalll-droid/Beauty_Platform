import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

type NotificationChannelValue = "IN_APP" | "EMAIL" | "TELEGRAM" | "MAX" | "PUSH" | "SMS" | "WEBHOOK" | "SSE";
type AudienceTypeValue = "CLIENT" | "STAFF" | "PLATFORM_ADMIN";
type NotificationScopeValue = "PLATFORM" | "ACCOUNT" | "USER";

export async function previewNotification(payload: JsonRecord) {
  return buildActionPreview({ after: renderNotification(payload) });
}

export async function previewNotificationTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = await loadTemplate(ctx.accountId, numberOrNull(payload.templateId));
  return buildActionPreview({ before, after: { ...(before ?? {}), ...templatePreviewData(payload, ctx.accountId) } });
}

export async function previewDeleteNotificationTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const templateId = requiredNumber(payload.templateId, "templateId");
  const before = await loadTemplate(ctx.accountId, templateId);
  return buildActionPreview({ before, after: { templateId, deleted: true }, warnings: ["Template deletion cannot be undone."] });
}

export async function previewNotificationPreferences(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const scope = scopeValue(payload.scope ?? "ACCOUNT");
  const accountId = scope === "ACCOUNT" ? ctx.accountId : null;
  const userId = scope === "USER" ? requiredNumber(payload.userId, "userId") : null;
  const eventName = requiredString(payload, "eventName");
  const audience = audienceValue(payload.audience);
  const channelValue = channel(payload.channel);
  const before = await findPreference(scope, accountId, userId, eventName, audience, channelValue);
  return buildActionPreview({
    before: before ? serializePreference(before) : null,
    after: {
      scope,
      accountId,
      userId,
      eventName,
      audience,
      channel: channelValue,
      enabled: payload.enabled === undefined ? before?.enabled ?? true : Boolean(payload.enabled),
      reminderOffsetMinutes: payload.reminderOffsetMinutes === undefined ? before?.reminderOffsetMinutes ?? null : numberOrNull(payload.reminderOffsetMinutes),
      templateId: payload.templateId === undefined ? before?.templateId ?? null : numberOrNull(payload.templateId),
    },
  });
}

export async function previewOutboxRetry(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const outboxItemId = requiredNumber(payload.outboxItemId, "outboxItemId");
  const item = await prisma.outboxItem.findFirst({ where: { id: outboxItemId, accountId: ctx.accountId }, include: { deliveries: true } });
  if (!item) throw new Error("Outbox item not found.");
  return buildActionPreview({
    before: serializeOutbox(item),
    after: { outboxItemId, status: "PENDING", availableAt: ctx.now.toISOString(), processedAt: null },
  });
}

export async function readNotifications(accountId: number, payload: JsonRecord) {
  const userId = numberOrNull(payload.userId);
  const rows = await prisma.notification.findMany({
    where: { accountId, ...(userId ? { userId } : {}) },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
  });
  return { notifications: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null })) };
}

export async function readNotification(accountId: number, payload: JsonRecord) {
  const notificationId = requiredNumber(payload.notificationId, "notificationId");
  const row = await prisma.notification.findFirst({ where: { id: notificationId, accountId } });
  if (!row) throw new Error("Notification not found.");
  return { notification: { ...row, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null } };
}

export async function createTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const template = await prisma.notificationTemplate.create({
    data: templateData(payload, ctx.accountId),
  });
  return { status: "DONE" as const, data: { templateId: template.id } };
}

export async function updateTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const templateId = requiredNumber(payload.templateId, "templateId");
  const updated = await prisma.notificationTemplate.updateMany({
    where: { id: templateId, OR: [{ accountId: ctx.accountId }, { accountId: null, isSystem: false }] },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.channel !== undefined ? { channel: channel(payload.channel) } : {}),
      ...(payload.locale !== undefined ? { locale: requiredString(payload, "locale") } : {}),
      ...(payload.subject !== undefined ? { subject: optionalString(payload, "subject") } : {}),
      ...(payload.bodyText !== undefined ? { bodyText: optionalString(payload, "bodyText") } : {}),
      ...(payload.bodyHtml !== undefined ? { bodyHtml: optionalString(payload, "bodyHtml") } : {}),
      ...(payload.variables !== undefined ? { variables: inputJson(payload.variables) } : {}),
      version: { increment: 1 },
    },
  });
  if (!updated.count) throw new Error("Notification template not found.");
  return { status: "DONE" as const, data: { templateId } };
}

export async function deleteTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const templateId = requiredNumber(payload.templateId, "templateId");
  const deleted = await prisma.notificationTemplate.deleteMany({ where: { id: templateId, accountId: ctx.accountId, isSystem: false } });
  if (!deleted.count) throw new Error("Notification template not found.");
  return { status: "DONE" as const, data: { templateId } };
}

export async function updatePreferences(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const scope = scopeValue(payload.scope ?? "ACCOUNT");
  const accountId = scope === "ACCOUNT" ? ctx.accountId : null;
  const userId = scope === "USER" ? requiredNumber(payload.userId, "userId") : null;
  const eventName = requiredString(payload, "eventName");
  const audience = audienceValue(payload.audience);
  const channelValue = channel(payload.channel);
  const existing = await findPreference(scope, accountId, userId, eventName, audience, channelValue);
  const preference = existing
    ? await prisma.notificationPreference.update({
      where: { id: existing.id },
      data: {
      ...(payload.enabled !== undefined ? { enabled: Boolean(payload.enabled) } : {}),
      ...(payload.reminderOffsetMinutes !== undefined ? { reminderOffsetMinutes: numberOrNull(payload.reminderOffsetMinutes) } : {}),
      ...(payload.templateId !== undefined ? { templateId: numberOrNull(payload.templateId) } : {}),
      },
    })
    : await prisma.notificationPreference.create({
      data: {
        scope,
        accountId,
        userId,
        eventName,
        audience,
        channel: channelValue,
        enabled: payload.enabled === undefined ? true : Boolean(payload.enabled),
        reminderOffsetMinutes: numberOrNull(payload.reminderOffsetMinutes),
        templateId: numberOrNull(payload.templateId),
      },
    });
  return { status: "DONE" as const, data: { preferenceId: preference.id } };
}

export async function sendClient(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const clientId = requiredNumber(payload.clientId, "clientId");
  const client = await prisma.client.findFirst({ where: { id: clientId, accountId: ctx.accountId }, select: { id: true, userId: true } });
  if (!client) throw new Error("Client not found.");
  const outbox = await createOutbox(ctx, "notification.send_client", { ...renderNotification(payload), clientId }, client.userId ?? null);
  return { status: "DONE" as const, data: { outboxItemId: outbox.id, clientId } };
}

export async function sendSegment(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const outbox = await createOutbox(ctx, "notification.send_segment", renderNotification(payload), null);
  return { status: "DONE" as const, data: { outboxItemId: outbox.id } };
}

export async function readOutbox(accountId: number, payload: JsonRecord) {
  const rows = await prisma.outboxItem.findMany({
    where: { accountId, ...(optionalString(payload, "status") ? { status: optionalString(payload, "status") as never } : {}) },
    orderBy: { createdAt: "desc" },
    take: take(payload.take),
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return { outbox: rows.map(serializeOutbox) };
}

export async function retryOutbox(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const outboxItemId = requiredNumber(payload.outboxItemId, "outboxItemId");
  const updated = await prisma.outboxItem.updateMany({
    where: { id: outboxItemId, accountId: ctx.accountId },
    data: { status: "PENDING", availableAt: ctx.now, processedAt: null },
  });
  if (!updated.count) throw new Error("Outbox item not found.");
  return { status: "DONE" as const, data: { outboxItemId } };
}

export async function retryFailedOutbox(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const outboxItemId = requiredNumber(payload.outboxItemId, "outboxItemId");
  const updated = await prisma.outboxItem.updateMany({
    where: { id: outboxItemId, accountId: ctx.accountId, status: { in: ["FAILED", "DEAD"] } },
    data: { status: "PENDING", availableAt: ctx.now, processedAt: null },
  });
  if (!updated.count) throw new Error("Failed outbox item not found.");
  return { status: "DONE" as const, data: { outboxItemId } };
}

export async function readDeliveryStatus(accountId: number, payload: JsonRecord) {
  const outboxItemId = requiredNumber(payload.outboxItemId, "outboxItemId");
  const item = await prisma.outboxItem.findFirst({ where: { id: outboxItemId, accountId }, include: { deliveries: { orderBy: { createdAt: "desc" } } } });
  if (!item) throw new Error("Outbox item not found.");
  return { deliveryStatus: serializeOutbox(item) };
}

function templateData(payload: JsonRecord, accountId: number) {
  return {
    accountId,
    name: requiredString(payload, "name"),
    channel: channel(payload.channel),
    locale: optionalString(payload, "locale") ?? "ru-RU",
    subject: optionalString(payload, "subject"),
    bodyText: optionalString(payload, "bodyText"),
    bodyHtml: optionalString(payload, "bodyHtml"),
    variables: inputJson(payload.variables ?? {}),
    isSystem: false,
  };
}

function templatePreviewData(payload: JsonRecord, accountId: number) {
  return {
    accountId,
    ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
    ...(payload.channel !== undefined ? { channel: channel(payload.channel) } : {}),
    ...(payload.locale !== undefined ? { locale: requiredString(payload, "locale") } : {}),
    ...(payload.subject !== undefined ? { subject: optionalString(payload, "subject") } : {}),
    ...(payload.bodyText !== undefined ? { bodyText: optionalString(payload, "bodyText") } : {}),
    ...(payload.bodyHtml !== undefined ? { bodyHtml: optionalString(payload, "bodyHtml") } : {}),
    ...(payload.variables !== undefined ? { variables: payload.variables ?? {} } : {}),
  };
}

async function loadTemplate(accountId: number, templateId: number | null) {
  if (!templateId) return null;
  const template = await prisma.notificationTemplate.findFirst({
    where: { id: templateId, OR: [{ accountId }, { accountId: null, isSystem: false }] },
  });
  return template ? serializeTemplate(template) : null;
}

async function findPreference(
  scope: NotificationScopeValue,
  accountId: number | null,
  userId: number | null,
  eventName: string,
  audience: AudienceTypeValue,
  channelValue: NotificationChannelValue,
) {
  return prisma.notificationPreference.findFirst({
    where: { scope, accountId, userId, eventName, audience, channel: channelValue },
  });
}

async function createOutbox(ctx: CrmAgentActionContext, eventName: string, payload: Record<string, unknown>, userId: number | null) {
  return prisma.outboxItem.create({
    data: {
      scope: "ACCOUNT",
      accountId: ctx.accountId,
      userId,
      eventName,
      payload: inputJson(payload),
      status: "PENDING",
      dedupeKey: `crm-agent-v2:${ctx.accountId}:${eventName}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      availableAt: ctx.now,
    },
  });
}

function renderNotification(payload: JsonRecord) {
  return {
    channel: optionalString(payload, "channel") ?? "IN_APP",
    subject: optionalString(payload, "subject"),
    title: optionalString(payload, "title"),
    bodyText: requiredString(payload, "bodyText"),
    data: payload.data ?? {},
  };
}

function serializeOutbox(item: {
  id: number;
  scope: unknown;
  accountId: number | null;
  userId: number | null;
  eventName: string;
  payload: unknown;
  status: unknown;
  availableAt: Date;
  createdAt: Date;
  processedAt: Date | null;
  deliveries: Array<{ id: number; channel: unknown; target: string; status: unknown; attempt: number; errorCode: string | null; errorMessage: string | null; providerMessageId: string | null; sentAt: Date | null; createdAt: Date }>;
}) {
  return {
    ...item,
    availableAt: item.availableAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    processedAt: item.processedAt?.toISOString() ?? null,
    deliveries: item.deliveries.map((delivery) => ({
      ...delivery,
      sentAt: delivery.sentAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
    })),
  };
}

function serializeTemplate(template: {
  id: number;
  accountId: number | null;
  name: string;
  channel: unknown;
  locale: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  variables: unknown;
  version: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function serializePreference(preference: {
  id: number;
  scope: unknown;
  accountId: number | null;
  userId: number | null;
  eventName: string;
  audience: unknown;
  channel: unknown;
  enabled: boolean;
  reminderOffsetMinutes: number | null;
  templateId: number | null;
  createdAt: Date;
}) {
  return {
    ...preference,
    createdAt: preference.createdAt.toISOString(),
  };
}

function channel(value: unknown): NotificationChannelValue {
  if (value === "IN_APP" || value === "EMAIL" || value === "TELEGRAM" || value === "MAX" || value === "PUSH" || value === "SMS" || value === "WEBHOOK" || value === "SSE") return value;
  throw new Error("Action payload channel is invalid.");
}

function audienceValue(value: unknown): AudienceTypeValue {
  if (value === "CLIENT" || value === "STAFF" || value === "PLATFORM_ADMIN") return value;
  throw new Error("Action payload audience is invalid.");
}

function scopeValue(value: unknown): NotificationScopeValue {
  if (value === "PLATFORM" || value === "ACCOUNT" || value === "USER") return value;
  throw new Error("Action payload scope is invalid.");
}

function take(value: unknown, fallback = 20, max = 100) {
  const parsed = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
