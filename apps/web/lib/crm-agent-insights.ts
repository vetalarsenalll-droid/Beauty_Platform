import { prisma } from "@/lib/prisma";
import { buildCrmAgentMemoryHints } from "@/lib/crm-agent-memory";
import { createAccountInsight, listAccountInsights } from "@/lib/crm-agent-persistence";

const BUSY_STATUSES = ["NEW", "CONFIRMED", "IN_PROGRESS", "DONE"] as const;
const LOST_STATUSES = ["CANCELLED", "NO_SHOW"] as const;

function insightKey(type: string, scope: string) {
  return `${type}:${scope}`;
}

async function hasOpenInsight(accountId: number, type: string, scope: string) {
  const insights = await listAccountInsights({ accountId, status: "NEW", take: 100 });
  const key = insightKey(type, scope);
  return insights.some((insight) => {
    const data = insight.data;
    return typeof data === "object" && data !== null && !Array.isArray(data) && data.key === key;
  });
}

async function createUniqueInsight(input: {
  accountId: number;
  type: string;
  scope: string;
  title: string;
  summary: string;
  priority: number;
  data: Record<string, unknown>;
}) {
  if (await hasOpenInsight(input.accountId, input.type, input.scope)) return null;
  return createAccountInsight({
    accountId: input.accountId,
    type: input.type,
    title: input.title,
    summary: input.summary,
    priority: input.priority,
    data: { ...input.data, key: insightKey(input.type, input.scope) },
  });
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

function minutesFromTime(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayName(dateKeyValue: string) {
  const date = new Date(`${dateKeyValue}T12:00:00.000Z`);
  return date.toLocaleDateString("ru-RU", { weekday: "long" });
}

function percent(value: number) {
  return Math.round(value * 100);
}

const complaintPatterns = [
  { key: "waiting", label: "ожидание и задержки", words: ["ждал", "ждала", "ждать", "ожид", "задерж", "опозд"] },
  { key: "price", label: "цена и доплаты", words: ["дорого", "цена", "стоимость", "доплат", "переплат"] },
  { key: "service", label: "общение и сервис", words: ["груб", "хам", "невеж", "администратор", "сервис", "общен"] },
  { key: "quality", label: "качество результата", words: ["качество", "результат", "плохо", "испорт", "передел", "неровн"] },
  { key: "cleanliness", label: "чистота", words: ["гряз", "чист", "стерил", "запах", "пыль"] },
  { key: "pain", label: "дискомфорт или боль", words: ["больно", "боль", "жжет", "жгло", "царап", "порез"] },
  { key: "booking", label: "запись и переносы", words: ["запис", "перенес", "отмен", "окно", "время"] },
] as const;

function recurringComplaintThemes(reviews: Array<{ id: number; rating: number; comment: string | null; createdAt: Date }>) {
  const themes = complaintPatterns
    .map((pattern) => {
      const matched = reviews.filter((review) => {
        const comment = review.comment?.toLowerCase() ?? "";
        return pattern.words.some((word) => comment.includes(word));
      });
      return {
        key: pattern.key,
        label: pattern.label,
        count: matched.length,
        reviewIds: matched.map((review) => review.id).slice(0, 8),
        examples: matched
          .map((review) => review.comment?.trim())
          .filter((comment): comment is string => Boolean(comment))
          .slice(0, 3),
      };
    })
    .filter((theme) => theme.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return themes;
}

export async function generateCrmAgentInsights(accountId: number) {
  const now = new Date();
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyToThirtyDaysAgo = new Date(now);
  sixtyToThirtyDaysAgo.setDate(now.getDate() - 60);
  const nextSevenDays = new Date(now);
  nextSevenDays.setDate(now.getDate() + 7);

  const [
    memoryHints,
    activePromos,
    servicesWithoutDescription,
    specialistsWithoutBio,
    negativeReviews,
    recentNegativeReviewRows,
    retentionClients,
    upcomingAppointments,
    recentAppointments,
    previousAppointments,
    upcomingSchedule,
    upcomingBusyAppointments,
    activeSpecialists,
  ] = await Promise.all([
    buildCrmAgentMemoryHints(accountId),
    prisma.promotion.count({ where: { accountId, isActive: true } }),
    prisma.service.count({ where: { accountId, isActive: true, OR: [{ description: null }, { description: "" }] } }),
    prisma.specialistProfile.count({ where: { accountId, isPublic: true, OR: [{ bio: null }, { bio: "" }] } }),
    prisma.review.count({ where: { accountId, rating: { lte: 3 }, createdAt: { gte: sevenDaysAgo } } }),
    prisma.review.findMany({
      where: { accountId, rating: { lte: 3 }, status: "PUBLISHED", createdAt: { gte: thirtyDaysAgo }, comment: { not: null } },
      select: { id: true, rating: true, comment: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.client.count({
      where: {
        accountId,
        appointments: {
          some: { startAt: { lt: sixtyDaysAgo }, status: "DONE" },
          none: { startAt: { gte: sixtyDaysAgo }, status: { not: "CANCELLED" } },
        },
      },
    }),
    prisma.appointment.count({
      where: {
        accountId,
        startAt: { gte: now },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.appointment.findMany({
      where: { accountId, startAt: { gte: thirtyDaysAgo, lte: now } },
      select: {
        id: true,
        startAt: true,
        specialistId: true,
        status: true,
        priceTotal: true,
        durationTotalMin: true,
        services: { select: { serviceId: true, service: { select: { name: true } } } },
      },
    }),
    prisma.appointment.findMany({
      where: { accountId, startAt: { gte: sixtyToThirtyDaysAgo, lt: thirtyDaysAgo }, status: { in: [...BUSY_STATUSES] } },
      select: {
        id: true,
        services: { select: { serviceId: true, service: { select: { name: true } } } },
      },
    }),
    prisma.scheduleEntry.findMany({
      where: { accountId, date: { gte: startOfDay(now), lte: endOfDay(nextSevenDays) }, type: "WORKING" },
      select: { id: true, date: true, specialistId: true, locationId: true, startTime: true, endTime: true },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 400,
    }),
    prisma.appointment.findMany({
      where: {
        accountId,
        startAt: { gte: startOfDay(now), lte: endOfDay(nextSevenDays) },
        status: { in: [...BUSY_STATUSES] },
      },
      select: { id: true, startAt: true, endAt: true, specialistId: true, locationId: true, status: true },
      orderBy: { startAt: "asc" },
      take: 1000,
    }),
    prisma.specialistProfile.findMany({
      where: { accountId, isPublic: true },
      select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } },
      take: 300,
    }),
  ]);

  const created = [];
  const memorySuffix = memoryHints.recommendationSuffix ? ` ${memoryHints.recommendationSuffix}` : "";

  if (activePromos === 0) {
    const insight = await createUniqueInsight({
      accountId,
      type: "promo.missing",
      scope: "active",
      title: "Нет активных акций",
      summary: `Сейчас нет ни одной активной акции. Можно подготовить точечное предложение под слабые дни или свободные окна.${memorySuffix}`,
      priority: 50,
      data: { activePromos, memoryHints },
    });
    if (insight) created.push(insight);
  }

  if (servicesWithoutDescription > 0) {
    const insight = await createUniqueInsight({
      accountId,
      type: "site.services.missing_description",
      scope: "active_services",
      title: "У части услуг нет описания",
      summary: `${servicesWithoutDescription} активных услуг нужно дополнить описанием, чтобы повысить доверие перед записью и видимость в поиске.`,
      priority: 40,
      data: { servicesWithoutDescription },
    });
    if (insight) created.push(insight);
  }

  if (specialistsWithoutBio > 0) {
    const insight = await createUniqueInsight({
      accountId,
      type: "site.specialists.missing_bio",
      scope: "public_specialists",
      title: "У части сотрудников нет описания",
      summary: `${specialistsWithoutBio} публичных карточек сотрудников нужно дополнить описанием, чтобы клиентам было проще выбрать мастера.`,
      priority: 35,
      data: { specialistsWithoutBio },
    });
    if (insight) created.push(insight);
  }

  if (negativeReviews > 0) {
    const insight = await createUniqueInsight({
      accountId,
      type: "reviews.negative_recent",
      scope: "last_7_days",
      title: "Есть свежие негативные отзывы",
      summary: `За последние 7 дней появилось негативных отзывов: ${negativeReviews}. Стоит подготовить ответы и проверить повторяющиеся причины.`,
      priority: 80,
      data: { negativeReviews, days: 7 },
    });
    if (insight) created.push(insight);
  }

  const complaintThemes = recurringComplaintThemes(recentNegativeReviewRows);
  if (complaintThemes.length) {
    const topTheme = complaintThemes[0];
    const insight = await createUniqueInsight({
      accountId,
      type: "reviews.recurring_complaints",
      scope: "last_30_days",
      title: "Повторяются причины недовольства в отзывах",
      summary: `В негативных отзывах за 30 дней чаще всего повторяется тема «${topTheme.label}» (${topTheme.count} раза). Стоит проверить процесс и подготовить ответы клиентам.`,
      priority: 82,
      data: { days: 30, themes: complaintThemes },
    });
    if (insight) created.push(insight);
  }

  if (retentionClients > 0) {
    const insight = await createUniqueInsight({
      accountId,
      type: "clients.retention_opportunity",
      scope: "60_days",
      title: "Есть клиенты для возврата",
      summary: `${retentionClients} клиентов не были на визите больше 60 дней. Их можно выделить в сегмент для возвращающей кампании.${memorySuffix}`,
      priority: 70,
      data: { retentionClients, days: 60, memoryHints },
    });
    if (insight) created.push(insight);
  }

  if (upcomingAppointments === 0) {
    const insight = await createUniqueInsight({
      accountId,
      type: "schedule.no_upcoming_appointments",
      scope: "future",
      title: "Нет будущих записей",
      summary: `Будущих записей пока нет. Проверьте настройку онлайн-записи и подготовьте короткую кампанию для возврата клиентов.${memorySuffix}`,
      priority: 85,
      data: { upcomingAppointments, memoryHints },
    });
    if (insight) created.push(insight);
  }

  const recentByDay = new Map<string, { appointments: number; revenue: number }>();
  const recentBySpecialist = new Map<number, { appointments: number; revenue: number; durationMin: number }>();
  let lostAppointments = 0;
  let noShowAppointments = 0;

  for (const appointment of recentAppointments) {
    const key = dateKey(appointment.startAt);
    const byDay = recentByDay.get(key) ?? { appointments: 0, revenue: 0 };
    byDay.appointments += 1;
    byDay.revenue += Number(appointment.priceTotal);
    recentByDay.set(key, byDay);

    const bySpecialist = recentBySpecialist.get(appointment.specialistId) ?? { appointments: 0, revenue: 0, durationMin: 0 };
    if ((BUSY_STATUSES as readonly string[]).includes(appointment.status)) {
      bySpecialist.appointments += 1;
      bySpecialist.revenue += Number(appointment.priceTotal);
      bySpecialist.durationMin += appointment.durationTotalMin;
    }
    recentBySpecialist.set(appointment.specialistId, bySpecialist);

    if ((LOST_STATUSES as readonly string[]).includes(appointment.status)) lostAppointments += 1;
    if (appointment.status === "NO_SHOW") noShowAppointments += 1;
  }

  const previousByService = new Map<number, { serviceId: number; name: string; appointments: number }>();
  for (const appointment of previousAppointments) {
    for (const item of appointment.services) {
      const current = previousByService.get(item.serviceId) ?? { serviceId: item.serviceId, name: item.service.name, appointments: 0 };
      current.appointments += 1;
      previousByService.set(item.serviceId, current);
    }
  }
  const recentByService = new Map<number, { serviceId: number; name: string; appointments: number }>();
  for (const appointment of recentAppointments) {
    if (!(BUSY_STATUSES as readonly string[]).includes(appointment.status)) continue;
    for (const item of appointment.services) {
      const current = recentByService.get(item.serviceId) ?? { serviceId: item.serviceId, name: item.service.name, appointments: 0 };
      current.appointments += 1;
      recentByService.set(item.serviceId, current);
    }
  }
  const decliningServices = Array.from(previousByService.values())
    .map((previous) => {
      const recent = recentByService.get(previous.serviceId)?.appointments ?? 0;
      const declineRate = previous.appointments ? (previous.appointments - recent) / previous.appointments : 0;
      return { ...previous, previousAppointments: previous.appointments, recentAppointments: recent, declineRate };
    })
    .filter((service) => service.previousAppointments >= 3 && service.declineRate >= 0.5)
    .sort((a, b) => b.declineRate - a.declineRate)
    .slice(0, 5);
  if (decliningServices.length) {
    const insight = await createUniqueInsight({
      accountId,
      type: "services.declining",
      scope: "last_30_vs_previous_30",
      title: "Есть услуги с просевшим спросом",
      summary: `${decliningServices.length} услуг заметно просели по записям за последние 30 дней по сравнению с предыдущими 30 днями. Можно проверить цены, описание и подготовить точечное предложение.`,
      priority: 64,
      data: { decliningServices },
    });
    if (insight) created.push(insight);
  }

  const dayRows = Array.from(recentByDay.entries()).map(([day, value]) => ({ day, ...value }));
  const averageAppointmentsPerActiveDay = dayRows.length
    ? dayRows.reduce((sum, row) => sum + row.appointments, 0) / dayRows.length
    : 0;
  const weakDays = dayRows
    .filter((row) => averageAppointmentsPerActiveDay >= 3 && row.appointments <= Math.max(1, Math.floor(averageAppointmentsPerActiveDay * 0.45)))
    .sort((a, b) => a.appointments - b.appointments)
    .slice(0, 3);

  if (weakDays.length) {
    const insight = await createUniqueInsight({
      accountId,
      type: "schedule.weak_days",
      scope: "last_30_days",
      title: "Найдены слабые дни по записям",
      summary: `${weakDays.length} дней за последние 30 дней заметно ниже среднего. Можно подготовить предложение для похожих дней недели.`,
      priority: 62,
      data: { weakDays: weakDays.map((day) => ({ ...day, weekday: dayName(day.day) })), averageAppointmentsPerActiveDay },
    });
    if (insight) created.push(insight);
  }

  const activeSpecialistIds = new Set(activeSpecialists.map((specialist) => specialist.id));
  const underloadedSpecialists = Array.from(activeSpecialistIds)
    .map((specialistId) => {
      const stats = recentBySpecialist.get(specialistId) ?? { appointments: 0, revenue: 0, durationMin: 0 };
      const specialist = activeSpecialists.find((item) => item.id === specialistId);
      const profile = specialist?.user.profile;
      return {
        specialistId,
        name: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || `Сотрудник #${specialistId}`,
        ...stats,
      };
    })
    .filter((item) => activeSpecialists.length >= 2 && item.appointments <= 2)
    .sort((a, b) => a.appointments - b.appointments)
    .slice(0, 5);

  if (underloadedSpecialists.length) {
    const insight = await createUniqueInsight({
      accountId,
      type: "specialists.underloaded",
      scope: "last_30_days",
      title: "Есть недозагруженные сотрудники",
      summary: `${underloadedSpecialists.length} публичных сотрудников получили очень мало записей за последние 30 дней.`,
      priority: 58,
      data: { underloadedSpecialists },
    });
    if (insight) created.push(insight);
  }

  const lostRate = recentAppointments.length ? lostAppointments / recentAppointments.length : 0;
  if (recentAppointments.length >= 10 && lostRate >= 0.18) {
    const insight = await createUniqueInsight({
      accountId,
      type: "appointments.loss_rate_high",
      scope: "last_30_days",
      title: "Много отмен и неявок",
      summary: `${percent(lostRate)}% записей за последние 30 дней отменены или отмечены как неявка.`,
      priority: noShowAppointments > 0 ? 76 : 66,
      data: { totalAppointments: recentAppointments.length, lostAppointments, noShowAppointments, lostRate },
    });
    if (insight) created.push(insight);
  }

  const emptyWindows = [];
  for (const entry of upcomingSchedule) {
    const startMin = minutesFromTime(entry.startTime);
    const endMin = minutesFromTime(entry.endTime);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    const bookedMinutes = upcomingBusyAppointments
      .filter((appointment) => appointment.specialistId === entry.specialistId && dateKey(appointment.startAt) === dateKey(entry.date))
      .reduce((sum, appointment) => {
        const start = Math.max(startMin, appointment.startAt.getHours() * 60 + appointment.startAt.getMinutes());
        const end = Math.min(endMin, appointment.endAt.getHours() * 60 + appointment.endAt.getMinutes());
        return sum + Math.max(0, end - start);
      }, 0);
    const freeMinutes = Math.max(0, endMin - startMin - bookedMinutes);
    if (freeMinutes >= 180) {
      emptyWindows.push({
        date: dateKey(entry.date),
        specialistId: entry.specialistId,
        locationId: entry.locationId,
        freeMinutes,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
    }
  }

  if (emptyWindows.length) {
    const insight = await createUniqueInsight({
      accountId,
      type: "schedule.empty_windows",
      scope: "next_7_days",
      title: "В графике есть большие свободные окна",
      summary: `На ближайшие 7 дней найдено свободных окон от 3 часов: ${emptyWindows.length}. Их можно закрыть точечной кампанией.`,
      priority: 72,
      data: { emptyWindows: emptyWindows.slice(0, 10) },
    });
    if (insight) created.push(insight);
  }

  return { createdCount: created.length, created };
}
