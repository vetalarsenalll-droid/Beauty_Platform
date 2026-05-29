import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { optionalDate, requiredDate, requiredNumber, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function previewGroupSessionAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = payload.groupSessionId ? await getGroupSession(ctx.accountId, requiredNumber(payload.groupSessionId, "groupSessionId")) : null;
  return buildActionPreview({ before, after: { actionName, ...payload } });
}

export async function readGroupSessionAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "group_session.view") {
    const groupSessionId = requiredNumber(payload.groupSessionId ?? payload.id, "groupSessionId");
    return { groupSession: await getGroupSession(ctx.accountId, groupSessionId) };
  }
  const from = optionalDate(payload, "from") ?? new Date(0);
  const to = optionalDate(payload, "to") ?? new Date("2999-12-31T00:00:00.000Z");
  const sessions = await prisma.groupSession.findMany({
    where: { accountId: ctx.accountId, startAt: { gte: from, lte: to } },
    orderBy: { startAt: "asc" },
    take: 100,
    include: groupSessionInclude,
  });
  return { groupSessions: sessions.map(serializeGroupSession) };
}

export async function executeGroupSessionAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "group_session.create") {
    const session = await prisma.groupSession.create({
      data: {
        accountId: ctx.accountId,
        locationId: requiredNumber(payload.locationId, "locationId"),
        specialistId: requiredNumber(payload.specialistId, "specialistId"),
        serviceId: requiredNumber(payload.serviceId, "serviceId"),
        startAt: requiredDate(payload, "startAt"),
        endAt: requiredDate(payload, "endAt"),
        capacity: requiredNumber(payload.capacity, "capacity"),
        pricePerClient: decimalOrNull(payload.pricePerClient),
        source: stringOrNull(payload.source) ?? "crm_agent",
        comment: stringOrNull(payload.comment),
      },
    });
    return { status: "DONE" as const, data: { groupSessionId: session.id } };
  }

  const groupSessionId = requiredNumber(payload.groupSessionId ?? payload.id, "groupSessionId");
  await assertGroupSession(ctx.accountId, groupSessionId);

  if (actionName === "group_session.cancel") {
    await prisma.groupSession.update({ where: { id: groupSessionId }, data: { status: "CANCELLED" } });
    return { status: "DONE" as const, data: { groupSessionId, status: "CANCELLED" } };
  }
  if (actionName === "group_session.change_capacity") {
    const capacity = requiredNumber(payload.capacity, "capacity");
    await prisma.groupSession.update({ where: { id: groupSessionId }, data: { capacity } });
    return { status: "DONE" as const, data: { groupSessionId, capacity } };
  }
  if (actionName === "group_session.change_price") {
    await prisma.groupSession.update({ where: { id: groupSessionId }, data: { pricePerClient: decimalOrNull(payload.pricePerClient) } });
    return { status: "DONE" as const, data: { groupSessionId, pricePerClient: payload.pricePerClient ?? null } };
  }
  if (actionName === "group_session.update") {
    await prisma.groupSession.update({
      where: { id: groupSessionId },
      data: {
        ...(payload.locationId !== undefined ? { locationId: requiredNumber(payload.locationId, "locationId") } : {}),
        ...(payload.specialistId !== undefined ? { specialistId: requiredNumber(payload.specialistId, "specialistId") } : {}),
        ...(payload.serviceId !== undefined ? { serviceId: requiredNumber(payload.serviceId, "serviceId") } : {}),
        ...(payload.startAt !== undefined ? { startAt: requiredDate(payload, "startAt") } : {}),
        ...(payload.endAt !== undefined ? { endAt: requiredDate(payload, "endAt") } : {}),
        ...(payload.capacity !== undefined ? { capacity: requiredNumber(payload.capacity, "capacity") } : {}),
        ...(payload.pricePerClient !== undefined ? { pricePerClient: decimalOrNull(payload.pricePerClient) } : {}),
        ...(payload.comment !== undefined ? { comment: stringOrNull(payload.comment) } : {}),
      },
    });
    return { status: "DONE" as const, data: { groupSessionId } };
  }
  if (actionName === "group_session.add_participant") {
    const clientId = requiredNumber(payload.clientId, "clientId");
    await prisma.groupSessionParticipant.upsert({
      where: { groupSessionId_clientId: { groupSessionId, clientId } },
      create: { groupSessionId, clientId, price: decimalOrNull(payload.price) },
      update: { price: decimalOrNull(payload.price) },
    });
    await prisma.groupSession.update({ where: { id: groupSessionId }, data: { bookedCount: { increment: 1 } } });
    return { status: "DONE" as const, data: { groupSessionId, clientId } };
  }
  if (actionName === "group_session.remove_participant") {
    const clientId = requiredNumber(payload.clientId, "clientId");
    await prisma.groupSessionParticipant.deleteMany({ where: { groupSessionId, clientId } });
    await prisma.groupSession.update({ where: { id: groupSessionId }, data: { bookedCount: { decrement: 1 } } });
    return { status: "DONE" as const, data: { groupSessionId, clientId } };
  }
  if (["group_session.update_participant_status", "group_session.mark_participant_done", "group_session.mark_participant_no_show"].includes(actionName)) {
    const clientId = requiredNumber(payload.clientId, "clientId");
    const status = actionName === "group_session.mark_participant_done" ? "DONE" : actionName === "group_session.mark_participant_no_show" ? "NO_SHOW" : statusValue(payload.status);
    await prisma.groupSessionParticipant.update({ where: { groupSessionId_clientId: { groupSessionId, clientId } }, data: { status } });
    return { status: "DONE" as const, data: { groupSessionId, clientId, participantStatus: status } };
  }
  throw new Error(`Unsupported group session action: ${actionName}.`);
}

const groupSessionInclude = {
  location: { select: { id: true, name: true } },
  specialist: { select: { id: true, user: { select: { profile: true } } } },
  service: { select: { id: true, name: true } },
  participants: { select: { clientId: true, status: true, price: true, createdAt: true }, take: 100 },
} as const;

async function getGroupSession(accountId: number, groupSessionId: number) {
  const session = await prisma.groupSession.findFirst({ where: { id: groupSessionId, accountId }, include: groupSessionInclude });
  if (!session) throw new Error("Group session not found.");
  return serializeGroupSession(session);
}

async function assertGroupSession(accountId: number, groupSessionId: number) {
  await getGroupSession(accountId, groupSessionId);
}

function serializeGroupSession(session: Awaited<ReturnType<typeof prisma.groupSession.findFirst>> & { location?: unknown }) {
  const value = session as NonNullable<typeof session> & {
    startAt: Date;
    endAt: Date;
    createdAt: Date;
    updatedAt: Date;
    pricePerClient: { toString(): string } | null;
    participants: Array<{ clientId: number; status: unknown; price: { toString(): string } | null; createdAt: Date }>;
  };
  return {
    ...value,
    startAt: value.startAt.toISOString(),
    endAt: value.endAt.toISOString(),
    pricePerClient: value.pricePerClient?.toString() ?? null,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    participants: value.participants.map((participant) => ({
      ...participant,
      price: participant.price?.toString() ?? null,
      createdAt: participant.createdAt.toISOString(),
    })),
  };
}

function statusValue(value: unknown) {
  if (value === "NEW" || value === "CONFIRMED" || value === "IN_PROGRESS" || value === "DONE" || value === "CANCELLED" || value === "NO_SHOW") return value;
  throw new Error("Action payload status is invalid.");
}

function decimalOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" || typeof value === "string") return value;
  throw new Error("Action payload price must be a number or string.");
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}
