import { prisma } from "@/lib/prisma";
import { buildCrmAgentMemoryHints } from "@/lib/crm-agent-memory";
import { createAgentCampaign, createAgentTask, createNotificationDraft, writeAgentAudit } from "@/lib/crm-agent-persistence";

function clientName(client: { firstName: string | null; lastName: string | null }) {
  return [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || "клиент";
}

function daysUntilBirthday(birthDate: Date, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const next = new Date(today);
  next.setMonth(birthDate.getMonth(), birthDate.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export async function createRetentionCampaignDraft(input: {
  accountId: number;
  userId: number;
  days?: number;
  channel?: string;
  offerText?: string;
  limit?: number;
}) {
  const days = input.days ?? 60;
  const channel = input.channel ?? "SMS";
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const memoryHints = await buildCrmAgentMemoryHints(input.accountId);

  const clients = await prisma.client.findMany({
    where: {
      accountId: input.accountId,
      appointments: {
        some: { startAt: { lt: cutoff }, status: "DONE" },
        none: { startAt: { gte: cutoff }, status: { not: "CANCELLED" } },
      },
      OR: [{ phone: { not: null } }, { email: { not: null } }],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 1,
        select: { startAt: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });

  const offerText = input.offerText ?? (memoryHints.preferredOffer || "Будем рады видеть вас снова на этой неделе.");
  const campaign = await createAgentCampaign({
    accountId: input.accountId,
    title: `Возврат клиентов без визитов ${days}+ дней`,
    goal: "Возврат клиентов",
    audience: {
      type: "inactive_clients",
      days,
      clientIds: clients.map((client) => client.id),
      size: clients.length,
    },
    offer: { text: offerText },
    content: {
      template: "retention",
      bodyText: `{{name}}, ${offerText}`,
      memoryHints,
    },
    channels: [channel],
  });

  const draft = await createNotificationDraft({
    accountId: input.accountId,
    campaignId: campaign.id,
    title: campaign.title,
    channel,
    audience: {
      clientIds: clients.map((client) => client.id),
      recipients: clients.map((client) => ({
        id: client.id,
        name: clientName(client),
        phone: client.phone,
        email: client.email,
        lastService: client.appointments[0]?.services[0]?.service.name ?? null,
      })),
    },
    bodyText: `{{name}}, ${offerText}`,
  });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.campaign.retention_draft",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: { draftId: draft.id, days, audienceSize: clients.length, memoryUsed: Boolean(memoryHints.campaignInstruction || memoryHints.preferredOffer) },
  });

  return { campaign, draft, audienceSize: clients.length };
}

export async function createRepeatVisitCampaignDraft(input: {
  accountId: number;
  userId: number;
  daysFrom?: number;
  daysTo?: number;
  channel?: string;
  offerText?: string;
  limit?: number;
}) {
  const daysFrom = Math.min(Math.max(input.daysFrom ?? 14, 1), 120);
  const daysTo = Math.min(Math.max(input.daysTo ?? 45, daysFrom), 180);
  const channel = input.channel ?? "SMS";
  const limit = Math.min(Math.max(input.limit ?? 150, 1), 700);
  const now = new Date();
  const visitedBefore = new Date(now.getTime() - daysFrom * 24 * 60 * 60 * 1000);
  const visitedAfter = new Date(now.getTime() - daysTo * 24 * 60 * 60 * 1000);
  const memoryHints = await buildCrmAgentMemoryHints(input.accountId);

  const clients = await prisma.client.findMany({
    where: {
      accountId: input.accountId,
      OR: [{ phone: { not: null } }, { email: { not: null } }],
      appointments: {
        some: { startAt: { gte: visitedAfter, lte: visitedBefore }, status: "DONE" },
        none: { startAt: { gt: now }, status: { not: "CANCELLED" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 1,
        select: { startAt: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });

  const offerText = input.offerText ?? (memoryHints.preferredOffer || "Самое время запланировать повторный визит и поддержать результат.");
  const campaign = await createAgentCampaign({
    accountId: input.accountId,
    title: `Повторный визит после ${daysFrom}-${daysTo} дней`,
    goal: "Повторный визит",
    audience: {
      type: "repeat_visit_clients",
      daysFrom,
      daysTo,
      clientIds: clients.map((client) => client.id),
      size: clients.length,
    },
    offer: { text: offerText },
    content: {
      template: "repeat_visit",
      bodyText: `{{name}}, ${offerText}`,
      memoryHints,
    },
    channels: [channel],
  });

  const draft = await createNotificationDraft({
    accountId: input.accountId,
    campaignId: campaign.id,
    title: campaign.title,
    channel,
    audience: {
      clientIds: clients.map((client) => client.id),
      recipients: clients.map((client) => ({
        id: client.id,
        name: clientName(client),
        phone: client.phone,
        email: client.email,
        lastVisitAt: client.appointments[0]?.startAt.toISOString() ?? null,
        lastService: client.appointments[0]?.services[0]?.service.name ?? null,
      })),
    },
    bodyText: `{{name}}, ${offerText}`,
  });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.campaign.repeat_visit_draft",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: { draftId: draft.id, audienceSize: clients.length, daysFrom, daysTo, memoryUsed: Boolean(memoryHints.campaignInstruction || memoryHints.preferredOffer) },
  });

  return { campaign, draft, audienceSize: clients.length };
}

export async function createReactivationCampaignDraft(input: {
  accountId: number;
  userId: number;
  days?: number;
  channel?: string;
  offerText?: string;
  limit?: number;
}) {
  const days = Math.min(Math.max(input.days ?? 180, 90), 730);
  const channel = input.channel ?? "SMS";
  const limit = Math.min(Math.max(input.limit ?? 120, 1), 500);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const memoryHints = await buildCrmAgentMemoryHints(input.accountId);

  const clients = await prisma.client.findMany({
    where: {
      accountId: input.accountId,
      OR: [{ phone: { not: null } }, { email: { not: null } }],
      appointments: {
        some: { startAt: { lt: cutoff }, status: "DONE" },
        none: { startAt: { gte: cutoff }, status: { not: "CANCELLED" } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 1,
        select: { startAt: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });

  const offerText = input.offerText ?? (memoryHints.preferredOffer || "Мы давно вас не видели: подготовили повод вернуться и подобрать удобное время.");
  const campaign = await createAgentCampaign({
    accountId: input.accountId,
    title: `Реактивация клиентов без визитов ${days}+ дней`,
    goal: "Реактивация клиентов",
    audience: {
      type: "reactivation_clients",
      days,
      clientIds: clients.map((client) => client.id),
      size: clients.length,
    },
    offer: { text: offerText },
    content: {
      template: "reactivation",
      bodyText: `{{name}}, ${offerText}`,
      memoryHints,
    },
    channels: [channel],
  });

  const draft = await createNotificationDraft({
    accountId: input.accountId,
    campaignId: campaign.id,
    title: campaign.title,
    channel,
    audience: {
      clientIds: clients.map((client) => client.id),
      recipients: clients.map((client) => ({
        id: client.id,
        name: clientName(client),
        phone: client.phone,
        email: client.email,
        lastVisitAt: client.appointments[0]?.startAt.toISOString() ?? null,
        lastService: client.appointments[0]?.services[0]?.service.name ?? null,
      })),
    },
    bodyText: `{{name}}, ${offerText}`,
  });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.campaign.reactivation_draft",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: { draftId: draft.id, audienceSize: clients.length, days, memoryUsed: Boolean(memoryHints.campaignInstruction || memoryHints.preferredOffer) },
  });

  return { campaign, draft, audienceSize: clients.length };
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
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function createEmptyWindowCampaignDraft(input: {
  accountId: number;
  userId: number;
  days?: number;
  minFreeMinutes?: number;
  offerText?: string;
  limit?: number;
}) {
  const days = Math.min(Math.max(input.days ?? 7, 1), 30);
  const minFreeMinutes = Math.min(Math.max(input.minFreeMinutes ?? 180, 60), 480);
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const now = new Date();
  const memoryHints = await buildCrmAgentMemoryHints(input.accountId);
  const dateTo = new Date(now);
  dateTo.setDate(now.getDate() + days);

  const [scheduleEntries, appointments] = await Promise.all([
    prisma.scheduleEntry.findMany({
      where: { accountId: input.accountId, date: { gte: startOfDay(now), lte: endOfDay(dateTo) }, type: "WORKING" },
      select: {
        id: true,
        date: true,
        specialistId: true,
        locationId: true,
        startTime: true,
        endTime: true,
        specialist: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        location: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 500,
    }),
    prisma.appointment.findMany({
      where: {
        accountId: input.accountId,
        startAt: { gte: startOfDay(now), lte: endOfDay(dateTo) },
        status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS", "DONE"] },
      },
      select: { startAt: true, endAt: true, specialistId: true },
      take: 1000,
    }),
  ]);

  const windows = [];
  for (const entry of scheduleEntries) {
    const startMin = minutesFromTime(entry.startTime);
    const endMin = minutesFromTime(entry.endTime);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    const bookedMinutes = appointments
      .filter((appointment) => appointment.specialistId === entry.specialistId && dateKey(appointment.startAt) === dateKey(entry.date))
      .reduce((sum, appointment) => {
        const start = Math.max(startMin, appointment.startAt.getHours() * 60 + appointment.startAt.getMinutes());
        const end = Math.min(endMin, appointment.endAt.getHours() * 60 + appointment.endAt.getMinutes());
        return sum + Math.max(0, end - start);
      }, 0);
    const freeMinutes = Math.max(0, endMin - startMin - bookedMinutes);
    if (freeMinutes >= minFreeMinutes) {
      const profile = entry.specialist.user.profile;
      windows.push({
        date: dateKey(entry.date),
        specialistId: entry.specialistId,
        specialistName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
        locationId: entry.locationId,
        locationName: entry.location?.name ?? null,
        startTime: entry.startTime,
        endTime: entry.endTime,
        freeMinutes,
      });
    }
    if (windows.length >= limit) break;
  }

  const offerText = input.offerText ?? (memoryHints.preferredOffer || "Короткое предложение для заполнения свободных окон в графике");
  const campaign = await createAgentCampaign({
    accountId: input.accountId,
    title: `Заполнить свободные окна на ближайшие ${days} дней`,
    goal: "Заполнение свободных окон",
    audience: { type: "schedule_empty_windows", days, minFreeMinutes, windows, size: windows.length },
    offer: { text: offerText },
    content: {
      template: "empty_windows",
      bodyText: offerText,
      suggestedSegments: ["давно не были", "повторный визит", "клиенты рядом с локацией"],
      memoryHints,
    },
    channels: [],
  });

  const task = await createAgentTask({
    accountId: input.accountId,
    type: "campaign.empty_windows.prepare",
    title: `Подготовить кампанию для свободных окон: ${windows.length}`,
    description: "Проверьте свободные окна, выберите сегмент клиентов и создайте черновик уведомления с учётом согласий.",
    payload: { campaignId: campaign.id, windows },
  });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.campaign.empty_windows_draft",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: { taskId: task.id, windows: windows.length, days, minFreeMinutes, memoryUsed: Boolean(memoryHints.campaignInstruction || memoryHints.preferredOffer) },
  });

  return { campaign, task, windowsCount: windows.length };
}

function seasonalDefaultOffer(now = new Date()) {
  const month = now.getMonth() + 1;
  if ([12, 1, 2].includes(month)) return "Зимний уход и восстановление: подберите удобное время на этой неделе.";
  if ([3, 4, 5].includes(month)) return "Весеннее обновление: освежите образ и забронируйте удобное время.";
  if ([6, 7, 8].includes(month)) return "Летний уход: подготовьте образ к отпуску и тёплым дням.";
  return "Осеннее восстановление: запишитесь на уход после активного сезона.";
}

export async function createSeasonalCampaignDraft(input: {
  accountId: number;
  userId: number;
  channel?: string;
  offerText?: string;
  limit?: number;
}) {
  const channel = input.channel ?? "SMS";
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
  const memoryHints = await buildCrmAgentMemoryHints(input.accountId);
  const offerText = input.offerText ?? (memoryHints.preferredOffer || seasonalDefaultOffer());

  const clients = await prisma.client.findMany({
    where: {
      accountId: input.accountId,
      OR: [{ phone: { not: null } }, { email: { not: null } }],
      appointments: { some: { status: "DONE" } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      appointments: {
        orderBy: { startAt: "desc" },
        take: 1,
        select: { startAt: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });

  const campaign = await createAgentCampaign({
    accountId: input.accountId,
    title: "Сезонное предложение для клиентов",
    goal: "Сезонная кампания",
    audience: {
      type: "seasonal_clients",
      clientIds: clients.map((client) => client.id),
      size: clients.length,
    },
    offer: { text: offerText },
    content: {
      template: "seasonal",
      bodyText: `{{name}}, ${offerText}`,
      memoryHints,
    },
    channels: [channel],
  });

  const draft = await createNotificationDraft({
    accountId: input.accountId,
    campaignId: campaign.id,
    title: campaign.title,
    channel,
    audience: {
      clientIds: clients.map((client) => client.id),
      recipients: clients.map((client) => ({
        id: client.id,
        name: clientName(client),
        phone: client.phone,
        email: client.email,
        lastService: client.appointments[0]?.services[0]?.service.name ?? null,
      })),
    },
    bodyText: `{{name}}, ${offerText}`,
  });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.campaign.seasonal_draft",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: { draftId: draft.id, audienceSize: clients.length, memoryUsed: Boolean(memoryHints.campaignInstruction || memoryHints.preferredOffer) },
  });

  return { campaign, draft, audienceSize: clients.length };
}

export async function createBirthdayCampaignDraft(input: {
  accountId: number;
  userId: number;
  days?: number;
  channel?: string;
  offerText?: string;
  limit?: number;
}) {
  const days = Math.min(Math.max(input.days ?? 14, 1), 60);
  const channel = input.channel ?? "SMS";
  const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000);
  const memoryHints = await buildCrmAgentMemoryHints(input.accountId);
  const offerText =
    input.offerText ?? (memoryHints.preferredOffer || "Подарок ко дню рождения: подберите удобное время для визита.");

  const clientsRaw = await prisma.client.findMany({
    where: {
      accountId: input.accountId,
      birthDate: { not: null },
      OR: [{ phone: { not: null } }, { email: { not: null } }],
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
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
        select: { startAt: true, services: { select: { service: { select: { id: true, name: true } } } } },
      },
    },
  });
  const clients = clientsRaw
    .map((client) => ({
      ...client,
      daysUntilBirthday: client.birthDate ? daysUntilBirthday(client.birthDate) : 999,
    }))
    .filter((client) => client.daysUntilBirthday <= days)
    .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)
    .slice(0, limit);

  const campaign = await createAgentCampaign({
    accountId: input.accountId,
    title: `Дни рождения клиентов на ближайшие ${days} дней`,
    goal: "Поздравления и возврат клиентов",
    audience: {
      type: "birthday_clients",
      days,
      clientIds: clients.map((client) => client.id),
      size: clients.length,
    },
    offer: { text: offerText },
    content: {
      template: "birthday",
      bodyText: `{{name}}, ${offerText}`,
      memoryHints,
    },
    channels: [channel],
  });

  const draft = await createNotificationDraft({
    accountId: input.accountId,
    campaignId: campaign.id,
    title: campaign.title,
    channel,
    audience: {
      clientIds: clients.map((client) => client.id),
      recipients: clients.map((client) => ({
        id: client.id,
        name: clientName(client),
        phone: client.phone,
        email: client.email,
        birthDate: client.birthDate ? client.birthDate.toISOString().slice(0, 10) : null,
        daysUntilBirthday: client.daysUntilBirthday,
        lastService: client.appointments[0]?.services[0]?.service.name ?? null,
      })),
    },
    bodyText: `{{name}}, ${offerText}`,
  });

  await writeAgentAudit({
    accountId: input.accountId,
    userId: input.userId,
    action: "ai_agent.campaign.birthday_draft",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: {
      draftId: draft.id,
      audienceSize: clients.length,
      days,
      memoryUsed: Boolean(memoryHints.campaignInstruction || memoryHints.preferredOffer),
    },
  });

  return { campaign, draft, audienceSize: clients.length };
}
