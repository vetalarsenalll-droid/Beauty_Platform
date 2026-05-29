import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  optionalBoolean,
  optionalDate,
  optionalString,
  requiredDate,
  requiredNumber,
  requiredString,
  type JsonRecord,
} from "../action-helpers";
import type { CrmAgentActionContext, CrmAgentActionPreview } from "../types";

export async function previewLocationUpdate(payload: JsonRecord, ctx: CrmAgentActionContext): Promise<CrmAgentActionPreview> {
  const before = await loadLocationBefore(ctx.accountId, numberOrNull(payload.locationId));
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function executeLocationUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const updated = await prisma.location.updateMany({
    where: { id: locationId, accountId: ctx.accountId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.address !== undefined ? { address: requiredString(payload, "address") } : {}),
      ...(payload.description !== undefined ? { description: optionalString(payload, "description") } : {}),
      ...(payload.phone !== undefined ? { phone: optionalString(payload, "phone") } : {}),
      ...(payload.status !== undefined ? { status: requiredString(payload, "status") } : {}),
    },
  });
  if (!updated.count) throw new Error("Location not found.");
  return { status: "DONE" as const, data: { locationId } };
}

export async function executeLocationHoursUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  const hours = parseHours(payload.hours);
  await prisma.$transaction(async (tx) => {
    await tx.locationHour.deleteMany({ where: { locationId } });
    if (hours.length) await tx.locationHour.createMany({ data: hours.map((hour) => ({ locationId, ...hour })) });
  });
  return { status: "DONE" as const, data: { locationId, hours } };
}

export async function executeLocationExceptionAdd(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  const exception = await prisma.locationException.create({
    data: {
      locationId,
      date: requiredDate(payload, "date"),
      isClosed: optionalBoolean(payload, "isClosed") ?? false,
      startTime: optionalString(payload, "startTime"),
      endTime: optionalString(payload, "endTime"),
    },
  });
  return { status: "DONE" as const, data: { locationId, exceptionId: exception.id } };
}

export async function executeLocationExceptionRemove(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  const exceptionId = numberOrNull(payload.exceptionId);
  const date = optionalDate(payload, "date");
  if (exceptionId == null && !date) throw new Error("Action payload exceptionId or date is required.");
  await prisma.locationException.deleteMany({
    where: {
      locationId,
      ...(exceptionId != null ? { id: exceptionId } : {}),
      ...(date ? { date } : {}),
    },
  });
  return { status: "DONE" as const, data: { locationId, exceptionId, date: date?.toISOString() ?? null } };
}

export async function executeLocationManagerAssign(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const userId = requiredNumber(payload.userId, "userId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await assertUserBelongsToAccount(ctx.accountId, userId);
  await prisma.locationManager.upsert({
    where: { locationId_userId: { locationId, userId } },
    create: { accountId: ctx.accountId, locationId, userId },
    update: {},
  });
  return { status: "DONE" as const, data: { locationId, userId } };
}

export async function executeLocationManagerRemove(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const userId = requiredNumber(payload.userId, "userId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await assertUserBelongsToAccount(ctx.accountId, userId);
  await prisma.locationManager.deleteMany({ where: { locationId, userId, accountId: ctx.accountId } });
  return { status: "DONE" as const, data: { locationId, userId } };
}

export async function executeLocationMediaAttach(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const assetId = requiredNumber(payload.assetId, "assetId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await assertMediaAssetBelongsToAccount(ctx.accountId, assetId);
  const link = await prisma.mediaLink.create({
    data: {
      assetId,
      entityType: "location",
      entityId: String(locationId),
      sortOrder: numberOrNull(payload.sortOrder) ?? 0,
      isCover: optionalBoolean(payload, "isCover") ?? false,
    },
  });
  return { status: "DONE" as const, data: { locationId, assetId, mediaLinkId: link.id } };
}

export async function executeLocationMediaDetach(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const assetId = requiredNumber(payload.assetId, "assetId");
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  await assertMediaAssetBelongsToAccount(ctx.accountId, assetId);
  await prisma.mediaLink.deleteMany({ where: { assetId, entityType: "location", entityId: String(locationId) } });
  return { status: "DONE" as const, data: { locationId, assetId } };
}

export async function previewGeneratedLocationDescription(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  const before = await loadLocationBefore(ctx.accountId, locationId);
  if (!before) throw new Error("Location not found.");
  const description = `${before.name} - филиал по адресу ${before.address}. Здесь клиенты могут выбрать удобное время, получить консультацию и записаться на услуги салона.`;
  return buildActionPreview({ before, after: { ...before, description, generated: true } });
}

export async function loadLocationBefore(accountId: number, locationId: number | null) {
  if (!locationId) return null;
  return prisma.location.findFirst({
    where: { id: locationId, accountId },
    select: { id: true, name: true, address: true, description: true, phone: true, status: true },
  });
}

export async function readLocationSchedule(accountId: number, payload: JsonRecord) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertLocationBelongsToAccount(accountId, locationId);
  const dateFrom = optionalDate(payload, "dateFrom");
  const dateTo = optionalDate(payload, "dateTo");
  const [hours, exceptions, scheduleEntries] = await Promise.all([
    prisma.locationHour.findMany({ where: { locationId }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.locationException.findMany({
      where: { locationId, ...(dateFrom || dateTo ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}) },
      orderBy: { date: "asc" },
      take: 100,
    }),
    prisma.scheduleEntry.findMany({
      where: { accountId, locationId, ...(dateFrom || dateTo ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}) },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 200,
      select: { id: true, specialistId: true, date: true, type: true, startTime: true, endTime: true, notes: true },
    }),
  ]);
  return {
    locationId,
    hours,
    exceptions: exceptions.map((item) => ({ ...item, date: item.date.toISOString() })),
    scheduleEntries: scheduleEntries.map((item) => ({ ...item, date: item.date.toISOString() })),
  };
}

export async function readLocationWorkload(accountId: number, payload: JsonRecord) {
  const locationId = requiredNumber(payload.locationId, "locationId");
  await assertLocationBelongsToAccount(accountId, locationId);
  const dateTo = optionalDate(payload, "dateTo") ?? new Date();
  const dateFrom = optionalDate(payload, "dateFrom") ?? addDays(dateTo, -30);
  const appointments = await prisma.appointment.findMany({
    where: { accountId, locationId, startAt: { gte: dateFrom, lte: dateTo } },
    select: { id: true, startAt: true, status: true, specialistId: true, priceTotal: true, durationTotalMin: true },
  });
  const active = appointments.filter((item) => item.status !== "CANCELLED");
  return {
    locationId,
    range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    totals: {
      appointments: appointments.length,
      activeAppointments: active.length,
      revenue: active.reduce((sum, item) => sum + Number(item.priceTotal), 0),
      durationMin: active.reduce((sum, item) => sum + item.durationTotalMin, 0),
    },
    byDay: groupBy(active, (item) => item.startAt.toISOString().slice(0, 10), (items) => ({
      appointments: items.length,
      revenue: items.reduce((sum, item) => sum + Number(item.priceTotal), 0),
    })),
    bySpecialist: groupBy(active, (item) => String(item.specialistId), (items) => ({ appointments: items.length })),
  };
}

export function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function parseHours(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Action payload hours must be an array.");
  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Action payload hours item must be an object.");
    return {
      dayOfWeek: requiredNumber(item.dayOfWeek, "dayOfWeek"),
      startTime: requiredString(item, "startTime"),
      endTime: requiredString(item, "endTime"),
    };
  });
}

async function assertLocationBelongsToAccount(accountId: number, locationId: number) {
  const location = await prisma.location.findFirst({ where: { id: locationId, accountId }, select: { id: true } });
  if (!location) throw new Error("Location not found.");
}

async function assertUserBelongsToAccount(accountId: number, userId: number) {
  const assignment = await prisma.roleAssignment.findFirst({ where: { accountId, userId }, select: { id: true } });
  if (!assignment) throw new Error("User not found in account.");
}

async function assertMediaAssetBelongsToAccount(accountId: number, assetId: number) {
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, OR: [{ accountId }, { accountId: null }] }, select: { id: true } });
  if (!asset) throw new Error("Media asset not found.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function groupBy<T, R>(items: T[], keyFn: (item: T) => string, valueFn: (items: T[]) => R) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return Object.fromEntries([...map.entries()].map(([key, rows]) => [key, valueFn(rows)]));
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
