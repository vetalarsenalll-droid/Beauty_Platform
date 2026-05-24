import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CrmAgentScope, CrmAgentToolDefinition } from "@/lib/crm-agent-types";

function asObject(args: Prisma.JsonObject | undefined): Prisma.JsonObject {
  return args && typeof args === "object" && !Array.isArray(args) ? args : {};
}

function stringArg(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberArg(args: Prisma.JsonObject, key: string) {
  const value = args[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateArg(args: Prisma.JsonObject, key: string) {
  const value = stringArg(args, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

function takeArg(args: Prisma.JsonObject, fallback = 20, max = 100) {
  const value = numberArg(args, "take") ?? fallback;
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function hasPermission(scope: CrmAgentScope, permission?: string) {
  return !permission || scope.permissions.includes("crm.all") || scope.permissions.includes(permission);
}

function assertToolPermission(tool: CrmAgentToolDefinition, scope: CrmAgentScope) {
  if (!hasPermission(scope, tool.requiredPermission)) {
    throw new Error(`Missing permission: ${tool.requiredPermission}`);
  }
}

function toMoney(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : value.toString();
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

export async function searchCrmAgentClients(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const query = stringArg(args, "query");
  const take = takeArg(args);

  const clients = await prisma.client.findMany({
    where: {
      accountId: scope.accountId,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      birthDate: true,
      createdAt: true,
      updatedAt: true,
      tags: { select: { tag: { select: { name: true } } }, take: 10 },
      appointments: {
        orderBy: { startAt: "desc" },
        take: 3,
        select: { id: true, startAt: true, status: true, priceTotal: true },
      },
    },
  });

  return toJsonValue({
    clients: clients.map((client) => ({
      ...client,
      tags: client.tags.map((item) => item.tag.name),
      appointments: client.appointments.map((appointment) => ({
        ...appointment,
        priceTotal: toMoney(appointment.priceTotal),
      })),
    })),
  });
}

export async function searchCrmAgentAppointments(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const dateFrom = dateArg(args, "dateFrom");
  const dateTo = dateArg(args, "dateTo");
  const clientId = numberArg(args, "clientId");
  const specialistId = numberArg(args, "specialistId");
  const locationId = numberArg(args, "locationId");
  const status = stringArg(args, "status");
  const take = takeArg(args, 50);

  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: scope.accountId,
      ...(dateFrom || dateTo ? { startAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
      ...(clientId ? { clientId } : {}),
      ...(specialistId ? { specialistId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { startAt: "asc" },
    take,
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      priceTotal: true,
      durationTotalMin: true,
      source: true,
      comment: true,
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      location: { select: { id: true, name: true } },
      specialist: {
        select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
      },
      services: { select: { service: { select: { id: true, name: true } }, price: true, durationMin: true } },
    },
  });

  return toJsonValue({
    appointments: appointments.map((appointment) => ({
      ...appointment,
      priceTotal: toMoney(appointment.priceTotal),
      services: appointment.services.map((item) => ({
        id: item.service.id,
        name: item.service.name,
        price: toMoney(item.price),
        durationMin: item.durationMin,
      })),
    })),
  });
}

export async function findCrmAgentAvailableSlots(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const serviceId = numberArg(args, "serviceId");
  const specialistId = numberArg(args, "specialistId");
  const locationId = numberArg(args, "locationId");
  const durationArg = numberArg(args, "durationMin");
  const now = new Date();
  const dateFrom = startOfDay(dateArg(args, "dateFrom") ?? now);
  const dateTo = endOfDay(dateArg(args, "dateTo") ?? addDays(dateFrom, 14));
  const take = takeArg(args, 30, 100);

  const service = serviceId
    ? await prisma.service.findFirst({
        where: { id: serviceId, accountId: scope.accountId, isActive: true },
        select: { id: true, baseDurationMin: true, name: true },
      })
    : null;
  const durationMin = durationArg ?? service?.baseDurationMin ?? 60;
  const stepMin = Math.max(15, Math.min(durationMin, 30));

  const scheduleEntries = await prisma.scheduleEntry.findMany({
    where: {
      accountId: scope.accountId,
      type: "WORKING",
      date: { gte: dateFrom, lte: dateTo },
      ...(specialistId ? { specialistId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(serviceId
        ? {
            specialist: { services: { some: { serviceId } } },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 500,
    select: {
      id: true,
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
        accountId: scope.accountId,
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
        accountId: scope.accountId,
        startAt: { lte: dateTo },
        endAt: { gte: dateFrom },
        ...(specialistId ? { OR: [{ specialistId }, { specialistId: null }] } : {}),
        ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
      },
      select: { startAt: true, endAt: true, specialistId: true, locationId: true, reason: true },
      take: 2000,
    }),
  ]);

  const slots = [];
  for (const entry of scheduleEntries) {
    const startMin = minutesFromTime(entry.startTime);
    const endMin = minutesFromTime(entry.endTime);
    if (startMin == null || endMin == null || endMin - startMin < durationMin) continue;

    for (let minute = startMin; minute + durationMin <= endMin; minute += stepMin) {
      const startAt = dateWithMinutes(entry.date, minute);
      const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      if (endAt <= now) continue;

      const hasBreak = entry.breaks.some((item) => {
        const breakStart = minutesFromTime(item.startTime);
        const breakEnd = minutesFromTime(item.endTime);
        if (breakStart == null || breakEnd == null) return false;
        return minute < breakEnd && minute + durationMin > breakStart;
      });
      if (hasBreak) continue;

      const hasAppointment = appointments.some(
        (appointment) =>
          appointment.specialistId === entry.specialistId &&
          (!entry.locationId || appointment.locationId === entry.locationId) &&
          rangesOverlap(startAt, endAt, appointment.startAt, appointment.endAt),
      );
      if (hasAppointment) continue;

      const hasBlockedSlot = blockedSlots.some(
        (slot) =>
          (!slot.specialistId || slot.specialistId === entry.specialistId) &&
          (!slot.locationId || !entry.locationId || slot.locationId === entry.locationId) &&
          rangesOverlap(startAt, endAt, slot.startAt, slot.endAt),
      );
      if (hasBlockedSlot) continue;

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

      if (slots.length >= take) return toJsonValue({ slots, durationMin, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() });
    }
  }

  return toJsonValue({ slots, durationMin, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() });
}

export async function searchCrmAgentServices(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const query = stringArg(args, "query");
  const take = takeArg(args, 50);

  const services = await prisma.service.findMany({
    where: {
      accountId: scope.accountId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take,
    select: {
      id: true,
      name: true,
      description: true,
      baseDurationMin: true,
      basePrice: true,
      isActive: true,
      bookingType: true,
      category: { select: { id: true, name: true } },
      specialists: { select: { specialistId: true }, take: 20 },
      locations: { select: { locationId: true }, take: 20 },
    },
  });

  return toJsonValue({
    services: services.map((service) => ({
      ...service,
      basePrice: toMoney(service.basePrice),
      specialistIds: service.specialists.map((item) => item.specialistId),
      locationIds: service.locations.map((item) => item.locationId),
      specialists: undefined,
      locations: undefined,
    })),
  });
}

export async function searchCrmAgentSpecialists(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const query = stringArg(args, "query");
  const take = takeArg(args, 50);

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: scope.accountId,
      ...(query
        ? {
            user: {
              profile: {
                OR: [
                  { firstName: { contains: query, mode: "insensitive" } },
                  { lastName: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
    },
    orderBy: [{ isPublic: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      bio: true,
      isPublic: true,
      createdAt: true,
      user: { select: { profile: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      services: { select: { service: { select: { id: true, name: true } } }, take: 30 },
      locations: { select: { location: { select: { id: true, name: true } } }, take: 30 },
    },
  });

  return toJsonValue({
    specialists: specialists.map((specialist) => ({
      id: specialist.id,
      bio: specialist.bio,
      isPublic: specialist.isPublic,
      createdAt: specialist.createdAt,
      profile: specialist.user.profile,
      services: specialist.services.map((item) => item.service),
      locations: specialist.locations.map((item) => item.location),
    })),
  });
}

export async function searchCrmAgentLocations(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const query = stringArg(args, "query");
  const take = takeArg(args, 50);

  const locations = await prisma.location.findMany({
    where: {
      accountId: scope.accountId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      name: true,
      address: true,
      description: true,
      phone: true,
      status: true,
      hours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  });

  return toJsonValue({ locations });
}

export async function searchCrmAgentPromos(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const activeOnly = args.activeOnly !== false;
  const take = takeArg(args, 50);

  const promotions = await prisma.promotion.findMany({
    where: {
      accountId: scope.accountId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
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

  return toJsonValue({
    promotions: promotions.map((promotion) => ({
      ...promotion,
      value: toMoney(promotion.value),
    })),
  });
}

export async function searchCrmAgentReviews(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const minRating = numberArg(args, "minRating");
  const maxRating = numberArg(args, "maxRating");
  const status = stringArg(args, "status");
  const take = takeArg(args, 50);

  const reviews = await prisma.review.findMany({
    where: {
      accountId: scope.accountId,
      ...(status ? { status: status as never } : {}),
      ...(minRating || maxRating ? { rating: { ...(minRating ? { gte: minRating } : {}), ...(maxRating ? { lte: maxRating } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
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

  return toJsonValue({
    reviews,
    negativeCount: reviews.filter((review) => review.rating <= 3).length,
    unansweredCount: reviews.filter((review) => !review.replyText).length,
  });
}

export async function getCrmAgentWorkload(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const dateFrom = dateArg(args, "dateFrom") ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dateTo = dateArg(args, "dateTo") ?? new Date();

  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: scope.accountId,
      startAt: { gte: dateFrom, lte: dateTo },
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      startAt: true,
      specialistId: true,
      locationId: true,
      priceTotal: true,
      durationTotalMin: true,
      status: true,
    },
  });

  const byDay = new Map<string, { appointments: number; revenue: number; durationMin: number }>();
  const bySpecialist = new Map<string, { appointments: number; revenue: number; durationMin: number }>();

  for (const appointment of appointments) {
    const dayKey = appointment.startAt.toISOString().slice(0, 10);
    const day = byDay.get(dayKey) ?? { appointments: 0, revenue: 0, durationMin: 0 };
    day.appointments += 1;
    day.revenue += Number(appointment.priceTotal);
    day.durationMin += appointment.durationTotalMin;
    byDay.set(dayKey, day);

    const specialistKey = String(appointment.specialistId);
    const specialist = bySpecialist.get(specialistKey) ?? { appointments: 0, revenue: 0, durationMin: 0 };
    specialist.appointments += 1;
    specialist.revenue += Number(appointment.priceTotal);
    specialist.durationMin += appointment.durationTotalMin;
    bySpecialist.set(specialistKey, specialist);
  }

  return toJsonValue({
    range: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    totals: {
      appointments: appointments.length,
      revenue: appointments.reduce((sum, appointment) => sum + Number(appointment.priceTotal), 0),
      durationMin: appointments.reduce((sum, appointment) => sum + appointment.durationTotalMin, 0),
    },
    byDay: Object.fromEntries(byDay),
    bySpecialist: Object.fromEntries(bySpecialist),
  });
}

export async function getCrmAgentRetention(argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const args = asObject(argsInput);
  const days = numberArg(args, "days") ?? 60;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const take = takeArg(args, 50);

  const clients = await prisma.client.findMany({
    where: {
      accountId: scope.accountId,
      appointments: {
        some: { startAt: { lt: cutoff }, status: "DONE" },
        none: { startAt: { gte: cutoff }, status: { not: "CANCELLED" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      birthDate: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 1,
        select: { id: true, startAt: true, priceTotal: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });

  return toJsonValue({
    days,
    cutoff: cutoff.toISOString(),
    clients: clients.map((client) => ({
      ...client,
      lastAppointment: client.appointments[0]
        ? {
            ...client.appointments[0],
            priceTotal: toMoney(client.appointments[0].priceTotal),
            services: client.appointments[0].services.map((item) => item.service),
          }
        : null,
      appointments: undefined,
    })),
  });
}

export async function getCrmAgentSiteHealth(_argsInput: Prisma.JsonObject, scope: CrmAgentScope) {
  const [account, servicesWithoutDescription, publicSpecialistsWithoutBio, locationsWithoutAddress, activeServices, publicSpecialists] =
    await Promise.all([
      prisma.account.findUnique({
        where: { id: scope.accountId },
        select: { id: true, name: true, profile: { select: { description: true, phone: true, email: true, address: true } } },
      }),
      prisma.service.count({ where: { accountId: scope.accountId, isActive: true, OR: [{ description: null }, { description: "" }] } }),
      prisma.specialistProfile.count({ where: { accountId: scope.accountId, isPublic: true, OR: [{ bio: null }, { bio: "" }] } }),
      prisma.location.count({ where: { accountId: scope.accountId, status: "ACTIVE", OR: [{ address: "" }] } }),
      prisma.service.count({ where: { accountId: scope.accountId, isActive: true } }),
      prisma.specialistProfile.count({ where: { accountId: scope.accountId, isPublic: true } }),
    ]);

  return toJsonValue({
    account,
    checks: {
      servicesWithoutDescription,
      publicSpecialistsWithoutBio,
      locationsWithoutAddress,
      activeServices,
      publicSpecialists,
      accountProfileMissing: !account?.profile?.description || !account.profile.phone,
    },
  });
}

export function attachCrmAgentDomainHandlers(tools: CrmAgentToolDefinition[]): CrmAgentToolDefinition[] {
  const handlers: Record<string, CrmAgentToolDefinition["handler"]> = {
    "appointments.search": searchCrmAgentAppointments,
    "appointments.findAvailableSlots": findCrmAgentAvailableSlots,
    "clients.search": searchCrmAgentClients,
    "services.search": searchCrmAgentServices,
    "specialists.search": searchCrmAgentSpecialists,
    "locations.search": searchCrmAgentLocations,
    "promos.search": searchCrmAgentPromos,
    "reviews.search": searchCrmAgentReviews,
    "analytics.workload": getCrmAgentWorkload,
    "analytics.retention": getCrmAgentRetention,
    "site.health": getCrmAgentSiteHealth,
  };

  return tools.map((tool) => ({ ...tool, handler: handlers[tool.name] ?? tool.handler }));
}

export async function executeCrmAgentReadTool(input: {
  tool: CrmAgentToolDefinition;
  args: Prisma.JsonObject;
  scope: CrmAgentScope;
}) {
  assertToolPermission(input.tool, input.scope);
  if (!input.tool.handler) throw new Error(`Tool handler is not registered: ${input.tool.name}`);
  return input.tool.handler(input.args, input.scope);
}
