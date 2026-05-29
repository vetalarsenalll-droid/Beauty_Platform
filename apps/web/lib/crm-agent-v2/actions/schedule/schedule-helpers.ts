import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  assertLocationBelongsToAccount,
  assertSpecialistBelongsToAccount,
  optionalDate,
  optionalString,
  requiredDate,
  requiredNumber,
  requiredString,
  type JsonRecord,
} from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

type ScheduleEntryTypeValue = "WORKING" | "SICK" | "VACATION" | "UNPAID_OFF" | "NO_SHOW" | "PAID_OFF" | "CUSTOM";

export async function previewSchedule(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = await readScheduleRange(ctx.accountId, payload);
  return buildActionPreview({ before: { schedule: before }, after: payload });
}

export async function readScheduleRange(accountId: number, payload: JsonRecord) {
  const date = optionalDate(payload, "date");
  const dateFrom = optionalDate(payload, "dateFrom") ?? date ?? new Date();
  const dateTo = optionalDate(payload, "dateTo") ?? date ?? addDays(dateFrom, 7);
  const specialistId = numberOrNull(payload.specialistId);
  const locationId = numberOrNull(payload.locationId);
  const entries = await prisma.scheduleEntry.findMany({
    where: {
      accountId,
      date: { gte: startOfDay(dateFrom), lte: endOfDay(dateTo) },
      ...(specialistId ? { specialistId } : {}),
      ...(locationId ? { locationId } : {}),
    },
    orderBy: [{ date: "asc" }, { specialistId: "asc" }],
    take: take(payload.take, 100, 500),
    include: { breaks: true, customType: true },
  });
  return { range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() }, entries: entries.map(serializeEntry) };
}

export async function readEmptyWindows(accountId: number, payload: JsonRecord) {
  const schedule = await readScheduleRange(accountId, payload);
  const appointments = await prisma.appointment.findMany({
    where: { accountId, startAt: { gte: new Date(schedule.range.dateFrom), lte: new Date(schedule.range.dateTo) } },
    select: { specialistId: true, startAt: true, endAt: true, status: true },
  });
  const activeAppointments = appointments.filter((item) => item.status !== "CANCELLED" && item.status !== "NO_SHOW");
  return {
    emptyWindows: schedule.entries
      .filter((entry) => entry.type === "WORKING" && entry.startTime && entry.endTime)
      .map((entry) => ({ ...entry, activeAppointments: activeAppointments.filter((item) => item.specialistId === entry.specialistId).length })),
  };
}

export async function readOverlaps(accountId: number, payload: JsonRecord) {
  const schedule = await readScheduleRange(accountId, payload);
  const overlaps = [];
  for (const entry of schedule.entries) {
    if (!entry.startTime || !entry.endTime) continue;
    const sameDay = schedule.entries.filter((item) => item.id !== entry.id && item.specialistId === entry.specialistId && item.date === entry.date);
    for (const other of sameDay) {
      if (other.startTime && other.endTime && entry.startTime < other.endTime && entry.endTime > other.startTime) {
        overlaps.push({ entryId: entry.id, otherEntryId: other.id, date: entry.date, specialistId: entry.specialistId });
      }
    }
  }
  return { overlaps };
}

export async function setWorkday(payload: JsonRecord, ctx: CrmAgentActionContext) {
  return upsertScheduleEntry(payload, ctx, "WORKING", requiredString(payload, "startTime"), requiredString(payload, "endTime"));
}

export async function setDayOff(payload: JsonRecord, ctx: CrmAgentActionContext) {
  return upsertScheduleEntry(payload, ctx, numberOrNull(payload.customTypeId) ? "CUSTOM" : "PAID_OFF", null, null);
}

export async function setVacation(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = numberOrNull(payload.specialistId);
  const locationId = numberOrNull(payload.locationId);
  if (specialistId) await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  if (locationId) await assertLocationBelongsToAccount(ctx.accountId, locationId);
  const startAt = requiredDate(payload, "startAt");
  const endAt = requiredDate(payload, "endAt");
  const vacation = await prisma.vacation.create({ data: { specialistId, locationId, startAt, endAt } });
  if (specialistId) {
    for (const date of daysBetween(startAt, endAt)) {
      await upsertEntry(ctx.accountId, specialistId, date, { locationId, type: "VACATION", startTime: null, endTime: null, notes: optionalString(payload, "notes") });
    }
  }
  return { status: "DONE" as const, data: { vacationId: vacation.id } };
}

export async function addBreak(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const entryId = await resolveEntryId(payload, ctx);
  const item = await prisma.scheduleEntryBreak.create({ data: { entryId, startTime: requiredString(payload, "startTime"), endTime: requiredString(payload, "endTime") } });
  return { status: "DONE" as const, data: { breakId: item.id, entryId } };
}

export async function updateBreak(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const breakId = requiredNumber(payload.breakId, "breakId");
  const updated = await prisma.scheduleEntryBreak.updateMany({
    where: { id: breakId, entry: { accountId: ctx.accountId } },
    data: {
      ...(payload.startTime !== undefined ? { startTime: requiredString(payload, "startTime") } : {}),
      ...(payload.endTime !== undefined ? { endTime: requiredString(payload, "endTime") } : {}),
    },
  });
  if (!updated.count) throw new Error("Schedule break not found.");
  return { status: "DONE" as const, data: { breakId } };
}

export async function removeBreak(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const breakId = requiredNumber(payload.breakId, "breakId");
  const deleted = await prisma.scheduleEntryBreak.deleteMany({ where: { id: breakId, entry: { accountId: ctx.accountId } } });
  if (!deleted.count) throw new Error("Schedule break not found.");
  return { status: "DONE" as const, data: { breakId } };
}

export async function blockSlot(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const locationId = numberOrNull(payload.locationId);
  const specialistId = numberOrNull(payload.specialistId);
  if (locationId) await assertLocationBelongsToAccount(ctx.accountId, locationId);
  if (specialistId) await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  const blocked = await prisma.blockedSlot.create({
    data: { accountId: ctx.accountId, locationId, specialistId, startAt: requiredDate(payload, "startAt"), endAt: requiredDate(payload, "endAt"), reason: optionalString(payload, "reason") },
  });
  return { status: "DONE" as const, data: { blockedSlotId: blocked.id } };
}

export async function unblockSlot(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const blockedSlotId = requiredNumber(payload.blockedSlotId, "blockedSlotId");
  const deleted = await prisma.blockedSlot.deleteMany({ where: { id: blockedSlotId, accountId: ctx.accountId } });
  if (!deleted.count) throw new Error("Blocked slot not found.");
  return { status: "DONE" as const, data: { blockedSlotId } };
}

export async function createTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const template = await prisma.scheduleTemplate.create({ data: { accountId: ctx.accountId, name: requiredString(payload, "name") } });
  await replaceTemplateChildren(template.id, payload);
  return { status: "DONE" as const, data: { templateId: template.id } };
}

export async function updateTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const templateId = requiredNumber(payload.templateId, "templateId");
  await assertTemplate(ctx.accountId, templateId);
  if (payload.name !== undefined) await prisma.scheduleTemplate.update({ where: { id: templateId }, data: { name: requiredString(payload, "name") } });
  if (payload.workingHours !== undefined || payload.breaks !== undefined) await replaceTemplateChildren(templateId, payload);
  return { status: "DONE" as const, data: { templateId } };
}

export async function deleteTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const templateId = requiredNumber(payload.templateId, "templateId");
  await assertTemplate(ctx.accountId, templateId);
  await prisma.scheduleTemplate.delete({ where: { id: templateId } });
  return { status: "DONE" as const, data: { templateId } };
}

export async function applyTemplate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const templateId = requiredNumber(payload.templateId, "templateId");
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const locationId = numberOrNull(payload.locationId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  if (locationId) await assertLocationBelongsToAccount(ctx.accountId, locationId);
  const template = await prisma.scheduleTemplate.findFirst({ where: { id: templateId, accountId: ctx.accountId }, include: { workingHours: true } });
  if (!template) throw new Error("Schedule template not found.");
  const dateFrom = requiredDate(payload, "dateFrom");
  const dateTo = optionalDate(payload, "dateTo") ?? addDays(dateFrom, 7);
  let applied = 0;
  for (const date of daysBetween(dateFrom, dateTo)) {
    const day = date.getDay();
    for (const hour of template.workingHours.filter((item) => item.dayOfWeek === day)) {
      await upsertEntry(ctx.accountId, specialistId, date, { locationId, type: "WORKING", startTime: hour.startTime, endTime: hour.endTime, notes: optionalString(payload, "notes") });
      applied += 1;
    }
  }
  return { status: "DONE" as const, data: { templateId, specialistId, applied } };
}

export async function createNonWorkingType(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const type = await prisma.scheduleNonWorkingType.create({ data: { accountId: ctx.accountId, name: requiredString(payload, "name"), color: optionalString(payload, "color") ?? "#64748b" } });
  return { status: "DONE" as const, data: { customTypeId: type.id } };
}

export async function updateNonWorkingType(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const customTypeId = requiredNumber(payload.customTypeId, "customTypeId");
  const updated = await prisma.scheduleNonWorkingType.updateMany({
    where: { id: customTypeId, accountId: ctx.accountId },
    data: {
      ...(payload.name !== undefined ? { name: requiredString(payload, "name") } : {}),
      ...(payload.color !== undefined ? { color: requiredString(payload, "color") } : {}),
      ...(payload.isArchived !== undefined ? { isArchived: Boolean(payload.isArchived) } : {}),
    },
  });
  if (!updated.count) throw new Error("Schedule non-working type not found.");
  return { status: "DONE" as const, data: { customTypeId } };
}

export async function deleteNonWorkingType(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const customTypeId = requiredNumber(payload.customTypeId, "customTypeId");
  const updated = await prisma.scheduleNonWorkingType.updateMany({ where: { id: customTypeId, accountId: ctx.accountId }, data: { isArchived: true } });
  if (!updated.count) throw new Error("Schedule non-working type not found.");
  return { status: "DONE" as const, data: { customTypeId, archived: true } };
}

export async function copyDay(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const sourceDate = requiredDate(payload, "sourceDate");
  const targetDate = requiredDate(payload, "targetDate");
  const entries = await prisma.scheduleEntry.findMany({ where: { accountId: ctx.accountId, specialistId, date: startOfDay(sourceDate) }, include: { breaks: true } });
  let copied = 0;
  for (const entry of entries) {
    const created = await upsertEntry(ctx.accountId, specialistId, targetDate, { locationId: entry.locationId, type: entry.type as ScheduleEntryTypeValue, customTypeId: entry.customTypeId, startTime: entry.startTime, endTime: entry.endTime, notes: entry.notes });
    await prisma.scheduleEntryBreak.deleteMany({ where: { entryId: created.id } });
    if (entry.breaks.length) await prisma.scheduleEntryBreak.createMany({ data: entry.breaks.map((item) => ({ entryId: created.id, startTime: item.startTime, endTime: item.endTime })) });
    copied += 1;
  }
  return { status: "DONE" as const, data: { specialistId, copied } };
}

export async function copyWeek(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const sourceWeekStart = requiredDate(payload, "sourceWeekStart");
  const targetWeekStart = requiredDate(payload, "targetWeekStart");
  let copied = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const result = await copyDay({ ...payload, sourceDate: addDays(sourceWeekStart, offset).toISOString(), targetDate: addDays(targetWeekStart, offset).toISOString() }, ctx);
    copied += Number(result.data.copied ?? 0);
  }
  return { status: "DONE" as const, data: { copied } };
}

async function upsertScheduleEntry(payload: JsonRecord, ctx: CrmAgentActionContext, type: ScheduleEntryTypeValue, startTime: string | null, endTime: string | null) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const locationId = numberOrNull(payload.locationId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  if (locationId) await assertLocationBelongsToAccount(ctx.accountId, locationId);
  const entry = await upsertEntry(ctx.accountId, specialistId, requiredDate(payload, "date"), {
    locationId,
    type,
    customTypeId: numberOrNull(payload.customTypeId),
    startTime,
    endTime,
    notes: optionalString(payload, "notes"),
  });
  return { status: "DONE" as const, data: { scheduleEntryId: entry.id } };
}

async function upsertEntry(accountId: number, specialistId: number, date: Date, data: { locationId?: number | null; type: ScheduleEntryTypeValue; customTypeId?: number | null; startTime: string | null; endTime: string | null; notes?: string | null }) {
  return prisma.scheduleEntry.upsert({
    where: { specialistId_date: { specialistId, date: startOfDay(date) } },
    create: { accountId, specialistId, date: startOfDay(date), ...data },
    update: data,
  });
}

async function resolveEntryId(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const entryId = numberOrNull(payload.entryId);
  if (entryId) {
    const entry = await prisma.scheduleEntry.findFirst({ where: { id: entryId, accountId: ctx.accountId }, select: { id: true } });
    if (!entry) throw new Error("Schedule entry not found.");
    return entry.id;
  }
  const entry = await upsertEntry(ctx.accountId, requiredNumber(payload.specialistId, "specialistId"), requiredDate(payload, "date"), {
    locationId: numberOrNull(payload.locationId),
    type: "WORKING",
    startTime: optionalString(payload, "entryStartTime"),
    endTime: optionalString(payload, "entryEndTime"),
  });
  return entry.id;
}

async function replaceTemplateChildren(templateId: number, payload: JsonRecord) {
  await prisma.$transaction(async (tx) => {
    if (payload.workingHours !== undefined) {
      await tx.workingHour.deleteMany({ where: { scheduleTemplateId: templateId } });
      const hours = parseRows(payload.workingHours);
      if (hours.length) await tx.workingHour.createMany({ data: hours.map((row) => ({ scheduleTemplateId: templateId, dayOfWeek: requiredNumber(row.dayOfWeek, "dayOfWeek"), startTime: requiredString(row, "startTime"), endTime: requiredString(row, "endTime") })) });
    }
    if (payload.breaks !== undefined) {
      await tx.break.deleteMany({ where: { scheduleTemplateId: templateId } });
      const rows = parseRows(payload.breaks);
      if (rows.length) await tx.break.createMany({ data: rows.map((row) => ({ scheduleTemplateId: templateId, startAt: requiredDate(row, "startAt"), endAt: requiredDate(row, "endAt") })) });
    }
  });
}

async function assertTemplate(accountId: number, templateId: number) {
  const template = await prisma.scheduleTemplate.findFirst({ where: { id: templateId, accountId }, select: { id: true } });
  if (!template) throw new Error("Schedule template not found.");
}

function serializeEntry(entry: {
  id: number;
  accountId: number;
  locationId: number | null;
  specialistId: number;
  date: Date;
  type: unknown;
  customTypeId: number | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  breaks: Array<{ id: number; startTime: string; endTime: string }>;
  customType: { id: number; name: string; color: string } | null;
}) {
  return { ...entry, date: entry.date.toISOString(), createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() };
}

function parseRows(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Action payload value must be an array.");
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) throw new Error("Action payload item must be an object.");
    return item as JsonRecord;
  });
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

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (let cursor = startOfDay(start); cursor <= endOfDay(end); cursor = addDays(cursor, 1)) days.push(new Date(cursor));
  return days;
}
