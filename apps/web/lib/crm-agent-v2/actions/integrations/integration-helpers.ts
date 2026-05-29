import { DeliveryStatus, WebhookStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, numberOrNull, optionalString, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

const WEBHOOK_STATUSES: WebhookStatus[] = ["ACTIVE", "PAUSED", "DISABLED"];
const DELIVERY_STATUSES: DeliveryStatus[] = ["QUEUED", "SENT", "DELIVERED", "FAILED", "DEAD"];

export async function previewIntegrationPayload(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const endpointId = numberOrNull(payload.endpointId ?? payload.webhookEndpointId);
  const before = endpointId ? await findEndpoint(ctx.accountId, endpointId) : null;
  return buildActionPreview({ before: before ? serializeEndpoint(before) : null, after: payload });
}

export async function readWebhookEvents(accountId: number, payload: JsonRecord) {
  const endpointId = numberOrNull(payload.endpointId ?? payload.webhookEndpointId);
  if (endpointId) await assertEndpoint(accountId, endpointId);
  const [events, deliveries] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: payload.eventName !== undefined ? { eventName: requiredString(payload, "eventName") } : {},
      orderBy: { createdAt: "desc" },
      take: take(payload.take),
    }),
    prisma.webhookDelivery.findMany({
      where: {
        ...(endpointId ? { endpointId } : { endpoint: { accountId } }),
        ...(payload.status !== undefined ? { status: deliveryStatus(payload.status) } : {}),
        ...(payload.eventName !== undefined ? { eventName: requiredString(payload, "eventName") } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: take(payload.take),
      include: { endpoint: { select: { id: true, url: true, status: true } } },
    }),
  ]);
  return {
    events: events.map((event) => ({
      id: event.id,
      eventName: event.eventName,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    })),
    deliveries: deliveries.map(serializeWebhookDelivery),
  };
}

export async function readIntegrationDeliveryStatus(accountId: number, payload: JsonRecord) {
  const endpointId = numberOrNull(payload.endpointId ?? payload.webhookEndpointId);
  if (endpointId) await assertEndpoint(accountId, endpointId);
  const [webhookDeliveries, outboxDeliveries] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where: {
        ...(endpointId ? { endpointId } : { endpoint: { accountId } }),
        ...(payload.status !== undefined ? { status: deliveryStatus(payload.status) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: take(payload.take),
      include: { endpoint: { select: { id: true, url: true, status: true } } },
    }),
    prisma.deliveryLog.findMany({
      where: {
        outboxItem: { accountId },
        ...(payload.status !== undefined ? { status: deliveryStatus(payload.status) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: take(payload.take),
      include: { outboxItem: { select: { id: true, eventName: true, status: true } } },
    }),
  ]);
  return {
    webhookDeliveries: webhookDeliveries.map(serializeWebhookDelivery),
    outboxDeliveries: outboxDeliveries.map((delivery) => ({
      id: delivery.id,
      outboxItemId: delivery.outboxItemId,
      eventName: delivery.outboxItem.eventName,
      outboxStatus: delivery.outboxItem.status,
      channel: delivery.channel,
      target: delivery.target,
      status: delivery.status,
      attempt: delivery.attempt,
      errorCode: delivery.errorCode,
      errorMessage: delivery.errorMessage,
      providerMessageId: delivery.providerMessageId,
      sentAt: delivery.sentAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
    })),
  };
}

export async function executeWebhookCreateEndpoint(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      accountId: ctx.accountId,
      url: urlString(payload.url),
      secret: requiredString(payload, "secret"),
      events: stringArray(payload.events),
      status: webhookStatus(payload.status ?? "ACTIVE"),
    },
  });
  return { status: "DONE" as const, data: { endpointId: endpoint.id, status: endpoint.status } };
}

export async function executeWebhookUpdateEndpoint(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const endpointId = requiredNumber(payload.endpointId ?? payload.webhookEndpointId, "endpointId");
  await assertEndpoint(ctx.accountId, endpointId);
  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      ...(payload.url !== undefined ? { url: urlString(payload.url) } : {}),
      ...(payload.secret !== undefined ? { secret: requiredString(payload, "secret") } : {}),
      ...(payload.events !== undefined ? { events: stringArray(payload.events) } : {}),
      ...(payload.status !== undefined ? { status: webhookStatus(payload.status) } : {}),
    },
  });
  return { status: "DONE" as const, data: { endpointId: endpoint.id, status: endpoint.status } };
}

export async function executeWebhookDisableEndpoint(payload: JsonRecord, ctx: CrmAgentActionContext) {
  return updateEndpointStatus(payload, ctx, "DISABLED");
}

export async function executeIntegrationUnsubscribe(payload: JsonRecord, ctx: CrmAgentActionContext) {
  return updateEndpointStatus(payload, ctx, "DISABLED");
}

export async function executeWebhookDeleteEndpoint(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const endpointId = requiredNumber(payload.endpointId ?? payload.webhookEndpointId, "endpointId");
  await assertEndpoint(ctx.accountId, endpointId);
  await prisma.$transaction([
    prisma.webhookDelivery.deleteMany({ where: { endpointId } }),
    prisma.webhookEndpoint.delete({ where: { id: endpointId } }),
  ]);
  return { status: "DONE" as const, data: { endpointId, deleted: true } };
}

export async function executeWebhookRetryDelivery(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const deliveryId = requiredNumber(payload.deliveryId ?? payload.webhookDeliveryId, "deliveryId");
  const delivery = await prisma.webhookDelivery.findFirst({ where: { id: deliveryId, endpoint: { accountId: ctx.accountId } } });
  if (!delivery) throw new Error("Webhook delivery not found.");
  const updated = await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: "QUEUED", attempt: delivery.attempt + 1, nextRetryAt: ctx.now, sentAt: null },
  });
  await prisma.webhookEndpoint.update({ where: { id: delivery.endpointId }, data: { status: "ACTIVE", lastErrorAt: null } });
  return { status: "DONE" as const, data: { deliveryId: updated.id, endpointId: updated.endpointId, status: updated.status, attempt: updated.attempt } };
}

async function updateEndpointStatus(payload: JsonRecord, ctx: CrmAgentActionContext, status: WebhookStatus) {
  const endpointId = requiredNumber(payload.endpointId ?? payload.webhookEndpointId, "endpointId");
  await assertEndpoint(ctx.accountId, endpointId);
  const endpoint = await prisma.webhookEndpoint.update({ where: { id: endpointId }, data: { status } });
  return { status: "DONE" as const, data: { endpointId: endpoint.id, status: endpoint.status } };
}

async function assertEndpoint(accountId: number, endpointId: number) {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: endpointId, accountId }, select: { id: true } });
  if (!endpoint) throw new Error("Webhook endpoint not found.");
}

async function findEndpoint(accountId: number, endpointId: number) {
  return prisma.webhookEndpoint.findFirst({ where: { id: endpointId, accountId } });
}

function serializeEndpoint(endpoint: {
  id: number;
  url: string;
  events: string[];
  status: WebhookStatus;
  errorStreak: number;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    status: endpoint.status,
    errorStreak: endpoint.errorStreak,
    lastErrorAt: endpoint.lastErrorAt?.toISOString() ?? null,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

function serializeWebhookDelivery(delivery: {
  id: number;
  endpointId: number;
  eventName: string;
  payload: unknown;
  signature: string;
  status: DeliveryStatus;
  attempt: number;
  nextRetryAt: Date | null;
  createdAt: Date;
  sentAt: Date | null;
  endpoint: { id: number; url: string; status: WebhookStatus };
}) {
  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    endpoint: delivery.endpoint,
    eventName: delivery.eventName,
    payload: delivery.payload,
    signature: delivery.signature,
    status: delivery.status,
    attempt: delivery.attempt,
    nextRetryAt: delivery.nextRetryAt?.toISOString() ?? null,
    sentAt: delivery.sentAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
  };
}

function urlString(value: unknown) {
  const url = requiredString({ url: value }, "url");
  try {
    return new URL(url).toString();
  } catch {
    throw new Error("Webhook url must be a valid URL.");
  }
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Action payload events must be an array.");
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function webhookStatus(value: unknown): WebhookStatus {
  const status = String(value ?? "").trim().toUpperCase() as WebhookStatus;
  if (!WEBHOOK_STATUSES.includes(status)) throw new Error("Invalid webhook status.");
  return status;
}

function deliveryStatus(value: unknown): DeliveryStatus {
  const status = String(value ?? "").trim().toUpperCase() as DeliveryStatus;
  if (!DELIVERY_STATUSES.includes(status)) throw new Error("Invalid delivery status.");
  return status;
}

function take(value: unknown) {
  return Math.min(Math.max(Math.trunc(numberOrNull(value) ?? 50), 1), 100);
}
