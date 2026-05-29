import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalDate, type JsonRecord } from "../action-helpers";

export function analyticsRange(payload: JsonRecord, fallbackDays = 30) {
  const dateTo = optionalDate(payload, "dateTo") ?? new Date();
  const dateFrom = optionalDate(payload, "dateFrom") ?? addDays(dateTo, -fallbackDays);
  return { dateFrom, dateTo };
}

export function analyticsTake(value: unknown, fallback = 10, max = 50) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export async function workloadAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const appointments = await prisma.appointment.findMany({
    where: { accountId, startAt: { gte: dateFrom, lte: dateTo } },
    select: { id: true, startAt: true, status: true, specialistId: true, locationId: true, priceTotal: true, durationTotalMin: true },
  });
  return {
    range: serializeRange(dateFrom, dateTo),
    totals: {
      appointments: appointments.length,
      activeAppointments: appointments.filter((item) => item.status !== "CANCELLED").length,
      revenue: appointments.filter((item) => item.status !== "CANCELLED").reduce((sum, item) => sum + Number(item.priceTotal), 0),
      durationMin: appointments.filter((item) => item.status !== "CANCELLED").reduce((sum, item) => sum + item.durationTotalMin, 0),
    },
    byDay: groupBy(appointments, (item) => item.startAt.toISOString().slice(0, 10), (items) => ({
      appointments: items.length,
      revenue: items.reduce((sum, item) => sum + Number(item.priceTotal), 0),
    })),
    bySpecialist: groupBy(appointments, (item) => String(item.specialistId), (items) => ({ appointments: items.length })),
    byLocation: groupBy(appointments, (item) => String(item.locationId), (items) => ({ appointments: items.length })),
  };
}

export async function revenueAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const appointments = await prisma.appointment.findMany({
    where: { accountId, startAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
    select: { priceTotal: true, startAt: true, locationId: true, specialistId: true },
  });
  const total = appointments.reduce((sum, item) => sum + Number(item.priceTotal), 0);
  return {
    range: serializeRange(dateFrom, dateTo),
    totals: { appointments: appointments.length, revenue: total, averageTicket: appointments.length ? total / appointments.length : 0 },
    byDay: groupBy(appointments, (item) => item.startAt.toISOString().slice(0, 10), moneyGroup),
    byLocation: groupBy(appointments, (item) => String(item.locationId), moneyGroup),
    bySpecialist: groupBy(appointments, (item) => String(item.specialistId), moneyGroup),
  };
}

export async function retentionAnalytics(accountId: number, payload: JsonRecord) {
  const days = numberOrNull(payload.days) ?? 60;
  const cutoff = addDays(new Date(), -days);
  const clients = await prisma.client.findMany({
    where: {
      accountId,
      appointments: {
        some: { startAt: { lt: cutoff }, status: "DONE" },
        none: { startAt: { gte: cutoff }, status: { not: "CANCELLED" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: analyticsTake(payload.take, 20, 100),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      appointments: { orderBy: { startAt: "desc" }, take: 1, select: { id: true, startAt: true, priceTotal: true } },
    },
  });
  return {
    days,
    cutoff: cutoff.toISOString(),
    clients: clients.map((client) => ({
      id: client.id,
      displayName: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || null,
      phone: client.phone,
      email: client.email,
      lastAppointment: client.appointments[0]
        ? {
            id: client.appointments[0].id,
            startAt: client.appointments[0].startAt.toISOString(),
            priceTotal: client.appointments[0].priceTotal.toString(),
          }
        : null,
    })),
  };
}

export async function topServicesAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const rows = await prisma.appointmentService.findMany({
    where: { appointment: { accountId, startAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } } },
    select: { serviceId: true, price: true, service: { select: { id: true, name: true } } },
  });
  return {
    range: serializeRange(dateFrom, dateTo),
    services: Object.values(
      rows.reduce<Record<string, { service: { id: number; name: string }; bookings: number; revenue: number }>>((acc, row) => {
        const key = String(row.serviceId);
        acc[key] ??= { service: row.service, bookings: 0, revenue: 0 };
        acc[key].bookings += 1;
        acc[key].revenue += Number(row.price);
        return acc;
      }, {}),
    )
      .sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings)
      .slice(0, analyticsTake(payload.take)),
  };
}

export async function topClientsAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const clients = await prisma.client.findMany({
    where: { accountId, appointments: { some: { startAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } } } },
    take: 300,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      appointments: {
        where: { startAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
        select: { priceTotal: true },
      },
    },
  });
  return {
    range: serializeRange(dateFrom, dateTo),
    clients: clients
      .map((client) => ({
        id: client.id,
        displayName: [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || null,
        phone: client.phone,
        appointments: client.appointments.length,
        revenue: client.appointments.reduce((sum, item) => sum + Number(item.priceTotal), 0),
      }))
      .sort((a, b) => b.revenue - a.revenue || b.appointments - a.appointments)
      .slice(0, analyticsTake(payload.take)),
  };
}

export async function cancellationAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const rows = await prisma.appointment.findMany({
    where: { accountId, startAt: { gte: dateFrom, lte: dateTo } },
    select: { status: true, specialistId: true, locationId: true },
  });
  const cancelled = rows.filter((item) => item.status === "CANCELLED");
  return {
    range: serializeRange(dateFrom, dateTo),
    total: rows.length,
    cancelled: cancelled.length,
    cancellationRate: rows.length ? cancelled.length / rows.length : 0,
    bySpecialist: groupBy(cancelled, (item) => String(item.specialistId), (items) => ({ cancelled: items.length })),
    byLocation: groupBy(cancelled, (item) => String(item.locationId), (items) => ({ cancelled: items.length })),
  };
}

export async function noShowAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const rows = await prisma.appointment.findMany({
    where: { accountId, startAt: { gte: dateFrom, lte: dateTo } },
    select: { status: true, specialistId: true },
  });
  const noShows = rows.filter((item) => item.status === "NO_SHOW");
  return {
    range: serializeRange(dateFrom, dateTo),
    total: rows.length,
    noShows: noShows.length,
    noShowRate: rows.length ? noShows.length / rows.length : 0,
    bySpecialist: groupBy(noShows, (item) => String(item.specialistId), (items) => ({ noShows: items.length })),
  };
}

export async function reviewAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const reviews = await prisma.review.findMany({
    where: { accountId, createdAt: { gte: dateFrom, lte: dateTo } },
    orderBy: { createdAt: "desc" },
    take: analyticsTake(payload.take, 50, 200),
    select: { id: true, rating: true, comment: true, replyText: true, createdAt: true, client: { select: { firstName: true, lastName: true } } },
  });
  return {
    range: serializeRange(dateFrom, dateTo),
    total: reviews.length,
    averageRating: reviews.length ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length : 0,
    negative: reviews.filter((item) => item.rating <= 3).length,
    unanswered: reviews.filter((item) => !item.replyText).length,
    recent: reviews.slice(0, 20).map((review) => ({
      ...review,
      createdAt: review.createdAt.toISOString(),
      client: { displayName: [review.client.firstName, review.client.lastName].filter(Boolean).join(" ").trim() || null },
    })),
    keywords: topWords(reviews.map((item) => item.comment).filter((item): item is string => Boolean(item))),
  };
}

export async function emptyWindowsAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload, 14);
  const [workingEntries, appointments] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { accountId, type: "WORKING", date: { gte: dateFrom, lte: dateTo } },
      select: { specialistId: true, locationId: true, date: true, startTime: true, endTime: true },
      take: 500,
    }),
    prisma.appointment.findMany({
      where: { accountId, startAt: { gte: dateFrom, lte: dateTo }, status: { not: "CANCELLED" } },
      select: { specialistId: true, locationId: true, durationTotalMin: true },
      take: 2000,
    }),
  ]);
  const capacityMin = workingEntries.reduce((sum, entry) => sum + Math.max(0, (minutes(entry.endTime) ?? 0) - (minutes(entry.startTime) ?? 0)), 0);
  const bookedMin = appointments.reduce((sum, appointment) => sum + appointment.durationTotalMin, 0);
  return {
    range: serializeRange(dateFrom, dateTo),
    capacityMin,
    bookedMin,
    emptyMin: Math.max(0, capacityMin - bookedMin),
    utilization: capacityMin ? bookedMin / capacityMin : 0,
  };
}

export async function underloadedSpecialistsAnalytics(accountId: number, payload: JsonRecord) {
  const workload = await workloadAnalytics(accountId, payload);
  const specialists = await prisma.specialistProfile.findMany({
    where: { accountId },
    select: { id: true, user: { select: { profile: true } } },
    take: 200,
  });
  return {
    range: workload.range,
    specialists: specialists
      .map((specialist) => {
        const appointments = Number((workload.bySpecialist[String(specialist.id)] as { appointments?: number } | undefined)?.appointments ?? 0);
        const profile = specialist.user.profile;
        return {
          specialistId: specialist.id,
          displayName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
          appointments,
        };
      })
      .sort((a, b) => a.appointments - b.appointments)
      .slice(0, analyticsTake(payload.take)),
  };
}

export async function campaignConversionAnalytics(accountId: number, payload: JsonRecord) {
  const { dateFrom, dateTo } = analyticsRange(payload);
  const promos = await prisma.promotion.findMany({
    where: { accountId, createdAt: { lte: dateTo } },
    select: {
      id: true,
      name: true,
      isActive: true,
      promoCodes: {
        select: {
          code: true,
          redemptions: { where: { createdAt: { gte: dateFrom, lte: dateTo } }, select: { id: true, status: true } },
        },
      },
    },
    take: analyticsTake(payload.take, 20, 100),
  });
  return {
    range: serializeRange(dateFrom, dateTo),
    campaigns: promos.map((promo) => ({
      id: promo.id,
      name: promo.name,
      isActive: promo.isActive,
      codes: promo.promoCodes.length,
      redemptions: promo.promoCodes.reduce((sum, code) => sum + code.redemptions.length, 0),
      applied: promo.promoCodes.reduce((sum, code) => sum + code.redemptions.filter((item) => item.status === "APPLIED").length, 0),
    })),
  };
}

export async function attentionReviewAnalytics(accountId: number, payload: JsonRecord) {
  const [brief, retention, emptyWindows, growthOpportunities] = await Promise.all([
    briefAnalytics(accountId, payload, 7),
    retentionAnalytics(accountId, payload),
    emptyWindowsAnalytics(accountId, payload),
    growthOpportunitiesAnalytics(accountId, payload),
  ]);
  return {
    brief,
    retention,
    emptyWindows,
    growthOpportunities,
    attentionItems: [
      ...(brief.cancellations.cancellationRate > 0.15
        ? [{ type: "cancellations", priority: "high", rate: brief.cancellations.cancellationRate }]
        : []),
      ...(brief.reviews.negative > 0 ? [{ type: "negative_reviews", priority: "high", count: brief.reviews.negative }] : []),
      ...(brief.reviews.unanswered > 0 ? [{ type: "unanswered_reviews", priority: "medium", count: brief.reviews.unanswered }] : []),
      ...(retention.clients.length ? [{ type: "retention", priority: "medium", clients: retention.clients.slice(0, 5) }] : []),
      ...(emptyWindows.utilization < 0.5 && emptyWindows.capacityMin > 0
        ? [{ type: "underutilized_capacity", priority: "medium", utilization: emptyWindows.utilization }]
        : []),
      ...growthOpportunities.opportunities.slice(0, 5),
    ],
  };
}

export async function briefAnalytics(accountId: number, payload: JsonRecord, days: number) {
  const scopedPayload = { ...payload, dateFrom: addDays(new Date(), -days).toISOString(), dateTo: new Date().toISOString() };
  const [workload, revenue, cancellations, reviews] = await Promise.all([
    workloadAnalytics(accountId, scopedPayload),
    revenueAnalytics(accountId, scopedPayload),
    cancellationAnalytics(accountId, scopedPayload),
    reviewAnalytics(accountId, scopedPayload),
  ]);
  return { workload, revenue, cancellations, reviews };
}

export async function decliningServicesAnalytics(accountId: number, payload: JsonRecord) {
  const now = new Date();
  const current = await topServicesAnalytics(accountId, { ...payload, dateFrom: addDays(now, -30).toISOString(), dateTo: now.toISOString(), take: 50 });
  const previous = await topServicesAnalytics(accountId, { ...payload, dateFrom: addDays(now, -60).toISOString(), dateTo: addDays(now, -30).toISOString(), take: 50 });
  const previousById = new Map(previous.services.map((item) => [item.service.id, item]));
  return {
    currentRange: current.range,
    previousRange: previous.range,
    services: current.services
      .map((service) => {
        const old = previousById.get(service.service.id);
        return { service: service.service, currentBookings: service.bookings, previousBookings: old?.bookings ?? 0, delta: service.bookings - (old?.bookings ?? 0) };
      })
      .filter((item) => item.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, analyticsTake(payload.take)),
  };
}

export async function growthOpportunitiesAnalytics(accountId: number, payload: JsonRecord) {
  const [underloaded, reviews, topServices, emptyWindows] = await Promise.all([
    underloadedSpecialistsAnalytics(accountId, payload),
    reviewAnalytics(accountId, payload),
    topServicesAnalytics(accountId, payload),
    emptyWindowsAnalytics(accountId, payload),
  ]);
  return {
    opportunities: [
      ...(emptyWindows.emptyMin > 0 ? [{ type: "capacity", priority: "medium", data: emptyWindows }] : []),
      ...(reviews.unanswered > 0 ? [{ type: "reviews", priority: "high", unanswered: reviews.unanswered }] : []),
      ...(underloaded.specialists.length ? [{ type: "specialists", priority: "medium", specialists: underloaded.specialists.slice(0, 5) }] : []),
      ...(topServices.services.length ? [{ type: "top_services", priority: "low", services: topServices.services.slice(0, 5) }] : []),
    ],
  };
}

export async function forecastAnalytics(accountId: number, payload: JsonRecord) {
  const revenue = await revenueAnalytics(accountId, payload);
  const daily = Object.values(revenue.byDay as Record<string, { revenue: number; count: number }>);
  const avgDailyRevenue = daily.length ? daily.reduce((sum, item) => sum + Number(item.revenue ?? 0), 0) / daily.length : 0;
  return {
    sourceRange: revenue.range,
    avgDailyRevenue,
    next7DaysRevenue: avgDailyRevenue * 7,
    next30DaysRevenue: avgDailyRevenue * 30,
  };
}

function moneyGroup(items: Array<{ priceTotal: { toString(): string } }>) {
  const revenue = items.reduce((sum, item) => sum + Number(item.priceTotal), 0);
  return { count: items.length, revenue };
}

function groupBy<T, R>(items: T[], keyFn: (item: T) => string, valueFn: (items: T[]) => R) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return Object.fromEntries([...map.entries()].map(([key, rows]) => [key, valueFn(rows)]));
}

function topWords(texts: string[]) {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const word of text.toLocaleLowerCase("ru-RU").split(/[^\p{L}\p{N}]+/u)) {
      if (word.length < 4) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));
}

function minutes(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function serializeRange(dateFrom: Date, dateTo: Date) {
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
