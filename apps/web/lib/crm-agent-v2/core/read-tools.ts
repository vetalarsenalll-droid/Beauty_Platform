import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveCrmAgentAppointment,
  resolveCrmAgentClient,
  resolveCrmAgentLocation,
  resolveCrmAgentMemory,
  resolveCrmAgentService,
  resolveCrmAgentSpecialist,
} from "./resolvers";
import type { CrmAgentToolName } from "./tools";
import type { CrmAgentToolContext, CrmAgentToolDefinition, CrmAgentToolHandler } from "./types";

type JsonRecord = Record<string, unknown>;

const readToolHandlers: Partial<Record<CrmAgentToolName, CrmAgentToolHandler<JsonRecord, unknown>>> = {
  "clients.search": async (args, ctx) => resolveCrmAgentClient(toolCtx(ctx), normalizeResolveArgs(args)),
  "clients.get": async (args, ctx) => resolveCrmAgentClient(toolCtx(ctx), { id: idArg(args.id), take: 1 }),
  "services.search": async (args, ctx) => resolveCrmAgentService(toolCtx(ctx), normalizeResolveArgs(args)),
  "services.get": async (args, ctx) => resolveCrmAgentService(toolCtx(ctx), { id: idArg(args.id), take: 1 }),
  "specialists.search": async (args, ctx) => resolveCrmAgentSpecialist(toolCtx(ctx), normalizeResolveArgs(args)),
  "specialists.get": async (args, ctx) => resolveCrmAgentSpecialist(toolCtx(ctx), { id: idArg(args.id), take: 1 }),
  "locations.search": async (args, ctx) => resolveCrmAgentLocation(toolCtx(ctx), normalizeResolveArgs(args)),
  "appointments.search": searchAppointments,
  "appointments.findAvailableSlots": findAvailableSlots,
  "reviews.search": searchReviews,
  "promos.search": searchPromos,
  "analytics.workload": getWorkload,
  "analytics.retention": getRetention,
  "site.health": getSiteHealth,
  "memory.search": async (args, ctx) => resolveCrmAgentMemory(toolCtx(ctx), normalizeResolveArgs(args)),
};

const readToolPermissions: Partial<Record<CrmAgentToolName, string>> = {
  "clients.search": "crm.clients.read",
  "clients.get": "crm.clients.read",
  "services.search": "crm.services.read",
  "services.get": "crm.services.read",
  "specialists.search": "crm.specialists.read",
  "specialists.get": "crm.specialists.read",
  "locations.search": "crm.locations.read",
  "appointments.search": "crm.calendar.read",
  "appointments.findAvailableSlots": "crm.schedule.read",
  "reviews.search": "crm.reviews.read",
  "promos.search": "crm.promos.read",
  "analytics.workload": "crm.assistant.analytics.read",
  "analytics.retention": "crm.assistant.analytics.read",
  "site.health": "crm.settings.read",
  "memory.search": "crm.assistant.memory.manage",
};

export function attachCrmAgentReadToolHandlers<T extends CrmAgentToolDefinition>(tools: T[]): T[] {
  return tools.map((tool) => {
    const handler = readToolHandlers[tool.name as CrmAgentToolName];
    return handler ? { ...tool, handler } : tool;
  });
}

export function getCrmAgentReadToolHandler(name: string) {
  return readToolHandlers[name as CrmAgentToolName] ?? null;
}

export async function executeCrmAgentReadTool(input: {
  toolName: string;
  args?: JsonRecord;
  ctx: CrmAgentToolContext;
}) {
  const handler = getCrmAgentReadToolHandler(input.toolName);
  if (!handler) throw new Error(`Read tool handler is not registered: ${input.toolName}`);
  assertToolPermission(input.toolName, input.ctx);
  return handler(input.args ?? {}, input.ctx);
}

function toolCtx(ctx: CrmAgentToolContext) {
  return { accountId: ctx.accountId };
}

function normalizeResolveArgs(args: JsonRecord) {
  return {
    query: typeof args.query === "string" ? args.query : null,
    id: idArg(args.id),
    take: typeof args.take === "number" ? args.take : undefined,
    filters: isRecord(args.filters) ? args.filters : args,
  };
}

function assertToolPermission(toolName: string, ctx: CrmAgentToolContext) {
  const permission = readToolPermissions[toolName as CrmAgentToolName];
  if (permission && !ctx.permissions.includes("crm.all") && !ctx.permissions.includes(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

async function searchAppointments(args: JsonRecord, ctx: CrmAgentToolContext) {
  const result = await resolveCrmAgentAppointment(toolCtx(ctx), {
    query: typeof args.query === "string" ? args.query : null,
    id: idArg(args.id),
    take: typeof args.take === "number" ? args.take : undefined,
    filters: args,
  });
  return result;
}

async function findAvailableSlots(args: JsonRecord, ctx: CrmAgentToolContext) {
  const serviceId = numberArg(args.serviceId);
  const specialistId = numberArg(args.specialistId);
  const locationId = numberArg(args.locationId);
  const dateFrom = startOfDay(dateArg(args.dateFrom) ?? new Date());
  const dateTo = endOfDay(dateArg(args.dateTo) ?? addDays(dateFrom, 14));
  const take = clampTake(args.take, 20, 100);

  const service = serviceId
    ? await prisma.service.findFirst({
        where: { id: serviceId, accountId: ctx.accountId, isActive: true },
        select: { id: true, name: true, baseDurationMin: true },
      })
    : null;
  const durationMin = numberArg(args.durationMin) ?? service?.baseDurationMin ?? 60;
  const stepMin = Math.max(15, Math.min(durationMin, 30));

  const entries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: ctx.accountId,
      type: "WORKING",
      date: { gte: dateFrom, lte: dateTo },
      ...(specialistId ? { specialistId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(serviceId ? { specialist: { services: { some: { serviceId } } } } : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 500,
    select: {
      date: true,
      specialistId: true,
      locationId: true,
      startTime: true,
      endTime: true,
      breaks: { select: { startTime: true, endTime: true } },
      specialist: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      location: { select: { id: true, name: true } },
    },
  });

  const [appointments, blockedSlots] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        accountId: ctx.accountId,
        startAt: { lte: dateTo },
        endAt: { gte: dateFrom },
        status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
        ...(specialistId ? { specialistId } : {}),
        ...(locationId ? { locationId } : {}),
      },
      select: { startAt: true, endAt: true, specialistId: true, locationId: true },
      take: 2000,
    }),
    prisma.blockedSlot.findMany({
      where: {
        accountId: ctx.accountId,
        startAt: { lte: dateTo },
        endAt: { gte: dateFrom },
        ...(specialistId ? { OR: [{ specialistId }, { specialistId: null }] } : {}),
        ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
      },
      select: { startAt: true, endAt: true, specialistId: true, locationId: true, reason: true },
      take: 2000,
    }),
  ]);

  const now = new Date();
  const slots = [];
  for (const entry of entries) {
    const startMin = minutesFromTime(entry.startTime);
    const endMin = minutesFromTime(entry.endTime);
    if (startMin == null || endMin == null || endMin - startMin < durationMin) continue;

    for (let minute = startMin; minute + durationMin <= endMin; minute += stepMin) {
      const startAt = dateWithMinutes(entry.date, minute);
      const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      if (endAt <= now) continue;
      if (hasEntryBreak(entry.breaks, minute, durationMin)) continue;
      if (
        appointments.some(
          (appointment) =>
            appointment.specialistId === entry.specialistId &&
            (!entry.locationId || appointment.locationId === entry.locationId) &&
            rangesOverlap(startAt, endAt, appointment.startAt, appointment.endAt),
        )
      ) {
        continue;
      }
      if (
        blockedSlots.some(
          (slot) =>
            (!slot.specialistId || slot.specialistId === entry.specialistId) &&
            (!slot.locationId || !entry.locationId || slot.locationId === entry.locationId) &&
            rangesOverlap(startAt, endAt, slot.startAt, slot.endAt),
        )
      ) {
        continue;
      }

      const profile = entry.specialist.user.profile;
      slots.push({
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        durationMin,
        specialistId: entry.specialistId,
        specialistName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
        locationId: entry.locationId,
        locationName: entry.location?.name ?? null,
        serviceId: service?.id ?? null,
        serviceName: service?.name ?? null,
      });
      if (slots.length >= take) return { slots, durationMin, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
    }
  }

  return { slots, durationMin, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

async function searchReviews(args: JsonRecord, ctx: CrmAgentToolContext) {
  const minRating = numberArg(args.minRating);
  const maxRating = numberArg(args.maxRating);
  const status = typeof args.status === "string" ? args.status : null;
  const reviews = await prisma.review.findMany({
    where: {
      accountId: ctx.accountId,
      ...(status ? { status: status as never } : {}),
      ...(minRating || maxRating ? { rating: { ...(minRating ? { gte: minRating } : {}), ...(maxRating ? { lte: maxRating } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: clampTake(args.take, 30, 100),
    select: {
      id: true,
      rating: true,
      comment: true,
      status: true,
      replyText: true,
      repliedAt: true,
      createdAt: true,
      client: { select: { id: true, firstName: true, lastName: true } },
      appointment: { select: { id: true, startAt: true, specialistId: true } },
    },
  });
  return {
    reviews: reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString(), repliedAt: review.repliedAt?.toISOString() ?? null })),
    negativeCount: reviews.filter((review) => review.rating <= 3).length,
    unansweredCount: reviews.filter((review) => !review.replyText).length,
  };
}

async function searchPromos(args: JsonRecord, ctx: CrmAgentToolContext) {
  const activeOnly = args.activeOnly !== false;
  const promos = await prisma.promotion.findMany({
    where: { accountId: ctx.accountId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: { createdAt: "desc" },
    take: clampTake(args.take, 30, 100),
    select: {
      id: true,
      name: true,
      type: true,
      value: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      createdAt: true,
      promoCodes: { select: { code: true, maxUses: true, maxUsesPerClient: true }, take: 20 },
    },
  });
  return {
    promotions: promos.map((promo) => ({
      ...promo,
      value: promo.value.toString(),
      startsAt: promo.startsAt?.toISOString() ?? null,
      endsAt: promo.endsAt?.toISOString() ?? null,
      createdAt: promo.createdAt.toISOString(),
    })),
  };
}

async function getWorkload(args: JsonRecord, ctx: CrmAgentToolContext) {
  const dateFrom = dateArg(args.dateFrom) ?? addDays(new Date(), -7);
  const dateTo = dateArg(args.dateTo) ?? new Date();
  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: ctx.accountId,
      startAt: { gte: dateFrom, lte: dateTo },
      status: { not: "CANCELLED" },
    },
    select: { startAt: true, specialistId: true, locationId: true, priceTotal: true, durationTotalMin: true },
  });
  const byDay = new Map<string, { appointments: number; revenue: number; durationMin: number }>();
  const bySpecialist = new Map<string, { appointments: number; revenue: number; durationMin: number }>();

  for (const appointment of appointments) {
    addWorkload(byDay, appointment.startAt.toISOString().slice(0, 10), appointment);
    addWorkload(bySpecialist, String(appointment.specialistId), appointment);
  }

  return {
    range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    totals: {
      appointments: appointments.length,
      revenue: appointments.reduce((sum, appointment) => sum + Number(appointment.priceTotal), 0),
      durationMin: appointments.reduce((sum, appointment) => sum + appointment.durationTotalMin, 0),
    },
    byDay: Object.fromEntries(byDay),
    bySpecialist: Object.fromEntries(bySpecialist),
  };
}

async function getRetention(args: JsonRecord, ctx: CrmAgentToolContext) {
  const days = numberArg(args.days) ?? 60;
  const cutoff = addDays(new Date(), -days);
  const clients = await prisma.client.findMany({
    where: {
      accountId: ctx.accountId,
      appointments: {
        some: { startAt: { lt: cutoff }, status: "DONE" },
        none: { startAt: { gte: cutoff }, status: { not: "CANCELLED" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: clampTake(args.take, 30, 100),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 1,
        select: { id: true, startAt: true, priceTotal: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });
  return {
    days,
    cutoff: cutoff.toISOString(),
    clients: clients.map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      lastAppointment: client.appointments[0]
        ? {
            id: client.appointments[0].id,
            startAt: client.appointments[0].startAt.toISOString(),
            priceTotal: client.appointments[0].priceTotal.toString(),
            services: client.appointments[0].services.map((item) => item.service),
          }
        : null,
    })),
  };
}

async function getSiteHealth(_args: JsonRecord, ctx: CrmAgentToolContext) {
  const [account, activeServices, servicesWithoutDescription, publicSpecialists, publicSpecialistsWithoutBio, activeLocations] =
    await Promise.all([
      prisma.account.findUnique({
        where: { id: ctx.accountId },
        select: { id: true, name: true, profile: { select: { description: true, phone: true, email: true, address: true } } },
      }),
      prisma.service.count({ where: { accountId: ctx.accountId, isActive: true } }),
      prisma.service.count({ where: { accountId: ctx.accountId, isActive: true, OR: [{ description: null }, { description: "" }] } }),
      prisma.specialistProfile.count({ where: { accountId: ctx.accountId, isPublic: true } }),
      prisma.specialistProfile.count({ where: { accountId: ctx.accountId, isPublic: true, OR: [{ bio: null }, { bio: "" }] } }),
      prisma.location.count({ where: { accountId: ctx.accountId, status: "ACTIVE" } }),
    ]);
  return {
    account,
    checks: {
      activeServices,
      servicesWithoutDescription,
      publicSpecialists,
      publicSpecialistsWithoutBio,
      activeLocations,
      accountProfileMissing: !account?.profile?.description || !account.profile.phone,
    },
  };
}

function addWorkload(
  map: Map<string, { appointments: number; revenue: number; durationMin: number }>,
  key: string,
  appointment: { priceTotal: Prisma.Decimal; durationTotalMin: number },
) {
  const current = map.get(key) ?? { appointments: 0, revenue: 0, durationMin: 0 };
  current.appointments += 1;
  current.revenue += Number(appointment.priceTotal);
  current.durationMin += appointment.durationTotalMin;
  map.set(key, current);
}

function numberArg(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function idArg(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function dateArg(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampTake(value: unknown, fallback: number, max: number) {
  const take = numberArg(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
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

function minutesFromTime(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dateWithMinutes(day: Date, minutes: number) {
  const result = startOfDay(day);
  result.setMinutes(minutes);
  return result;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function hasEntryBreak(breaks: Array<{ startTime: string; endTime: string }>, minute: number, durationMin: number) {
  return breaks.some((item) => {
    const breakStart = minutesFromTime(item.startTime);
    const breakEnd = minutesFromTime(item.endTime);
    if (breakStart == null || breakEnd == null) return false;
    return minute < breakEnd && minute + durationMin > breakStart;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
