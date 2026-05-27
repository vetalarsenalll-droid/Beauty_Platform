import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BUSY_STATUSES = ["NEW", "CONFIRMED", "IN_PROGRESS", "DONE"];

function insightKey(type, scope) {
  return `${type}:${scope}`;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function jsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}

function moneySum(values) {
  return values.reduce((sum, value) => sum + Number(value || 0), 0);
}

async function expireCrmAgentV2Actions() {
  return prisma.crmAgentAction.updateMany({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      expiresAt: { lte: new Date() },
    },
    data: {
      status: "EXPIRED",
      error: "Action expired before confirmation.",
    },
  });
}

async function createCrmAgentV2InsightIfMissing(input) {
  const key = insightKey(input.type, input.scope);
  const existing = await prisma.crmAgentInsight.findFirst({
    where: {
      accountId: input.accountId,
      type: input.type,
      status: "NEW",
      data: { path: ["key"], equals: key },
    },
    select: { id: true },
  });
  if (existing) return null;

  return prisma.crmAgentInsight.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      title: input.title,
      summary: input.summary,
      priority: input.priority,
      data: { ...input.data, key },
      expiresAt: input.expiresAt ?? null,
    },
  });
}

async function generateCrmAgentV2Insights(accountId) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);
  const nextSevenDays = new Date(now);
  nextSevenDays.setDate(now.getDate() + 7);

  const [pendingActions, negativeReviews, retentionClients, upcomingAppointments, activePromos] = await Promise.all([
    prisma.crmAgentAction.count({
      where: {
        accountId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.review.count({ where: { accountId, rating: { lte: 3 }, createdAt: { gte: sevenDaysAgo } } }),
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
        startAt: { gte: startOfDay(now), lte: endOfDay(nextSevenDays) },
        status: { in: BUSY_STATUSES },
      },
    }),
    prisma.promotion.count({ where: { accountId, isActive: true } }),
  ]);

  const created = [];
  if (pendingActions > 0) {
    const insight = await createCrmAgentV2InsightIfMissing({
      accountId,
      type: "agent.pending_actions",
      scope: todayKey(),
      title: "Pending CRM Agent actions",
      summary: `CRM Agent v2 is waiting for decisions on ${pendingActions} action(s).`,
      priority: 90,
      data: { pendingActions },
    });
    if (insight) created.push(insight);
  }

  if (negativeReviews > 0) {
    const insight = await createCrmAgentV2InsightIfMissing({
      accountId,
      type: "reviews.negative_recent",
      scope: "last_7_days",
      title: "Recent negative reviews",
      summary: `${negativeReviews} negative review(s) appeared in the last 7 days.`,
      priority: 82,
      data: { negativeReviews, days: 7 },
    });
    if (insight) created.push(insight);
  }

  if (retentionClients > 0) {
    const insight = await createCrmAgentV2InsightIfMissing({
      accountId,
      type: "clients.retention_opportunity",
      scope: "60_days",
      title: "Client retention opportunity",
      summary: `${retentionClients} client(s) have not visited for more than 60 days.`,
      priority: 70,
      data: { retentionClients, days: 60 },
    });
    if (insight) created.push(insight);
  }

  if (upcomingAppointments === 0) {
    const insight = await createCrmAgentV2InsightIfMissing({
      accountId,
      type: "schedule.no_upcoming_appointments",
      scope: "next_7_days",
      title: "No upcoming appointments this week",
      summary: "There are no active appointments for the next 7 days.",
      priority: 68,
      data: { upcomingAppointments, days: 7 },
    });
    if (insight) created.push(insight);
  }

  if (activePromos === 0) {
    const insight = await createCrmAgentV2InsightIfMissing({
      accountId,
      type: "promo.missing",
      scope: "active",
      title: "No active promotions",
      summary: "There are no active promotions right now.",
      priority: 50,
      data: { activePromos },
    });
    if (insight) created.push(insight);
  }

  return created.length;
}

async function createCrmAgentV2BriefTask(accountId, period, createdInsights) {
  const date = todayKey();
  const type = `${period}_brief:${date}`;
  const existing = await prisma.crmAgentTask.findFirst({
    where: { accountId, type, status: { in: ["OPEN", "IN_PROGRESS", "DONE"] } },
    select: { id: true },
  });
  if (existing) return null;

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const [pendingActions, newInsights, appointmentsTodayAndTomorrow, negativeReviews] = await Promise.all([
    prisma.crmAgentAction.count({
      where: {
        accountId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.crmAgentInsight.count({ where: { accountId, status: "NEW" } }),
    prisma.appointment.count({
      where: {
        accountId,
        startAt: { gte: startOfDay(now), lte: endOfDay(tomorrow) },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.review.count({ where: { accountId, rating: { lte: 3 }, createdAt: { gte: sevenDaysAgo } } }),
  ]);

  return prisma.crmAgentTask.create({
    data: {
      accountId,
      type,
      title: `${period === "weekly" ? "Weekly" : "Daily"} CRM Agent v2 brief for ${date}`,
      description: [
        `Appointments today and tomorrow: ${appointmentsTodayAndTomorrow}.`,
        `New insights: ${newInsights}.`,
        `Actions pending confirmation: ${pendingActions}.`,
        `Negative reviews in 7 days: ${negativeReviews}.`,
      ].join(" "),
      payload: {
        period,
        date,
        createdInsights,
        pendingActions,
        newInsights,
        appointmentsTodayAndTomorrow,
        negativeReviews,
      },
    },
  });
}

async function refreshCrmAgentV2KnowledgeSnapshot(accountId) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setHours(now.getHours() + 6);

  const [clients, services, specialists, locations, upcomingAppointments] = await Promise.all([
    prisma.client.count({ where: { accountId } }),
    prisma.service.count({ where: { accountId, isActive: true } }),
    prisma.specialistProfile.count({ where: { accountId, isPublic: true } }),
    prisma.location.count({ where: { accountId, status: "ACTIVE" } }),
    prisma.appointment.count({ where: { accountId, startAt: { gte: now }, status: { in: BUSY_STATUSES } } }),
  ]);

  const data = { clients, services, specialists, locations, upcomingAppointments, refreshedAt: now.toISOString() };
  const existing = await prisma.crmAgentKnowledgeSnapshot.findFirst({
    where: { accountId, type: "account_summary" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, version: true },
  });
  if (existing) {
    await prisma.crmAgentKnowledgeSnapshot.update({
      where: { id: existing.id },
      data: { data, version: existing.version + 1, expiresAt },
    });
    return { updated: 1, created: 0 };
  }

  await prisma.crmAgentKnowledgeSnapshot.create({
    data: { accountId, type: "account_summary", data, expiresAt },
  });
  return { updated: 0, created: 1 };
}

async function sendCrmAgentV2Campaigns() {
  const campaigns = await prisma.crmAgentCampaign.findMany({
    where: {
      status: { in: ["READY", "SCHEDULED", "SENDING"] },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: {
      recipients: {
        where: { status: "PENDING" },
        orderBy: { id: "asc" },
        take: 200,
      },
    },
  });

  let campaignsChecked = 0;
  let recipientsSent = 0;
  for (const campaign of campaigns) {
    campaignsChecked += 1;
    await prisma.crmAgentCampaign.update({
      where: { id: campaign.id },
      data: { status: "SENDING", error: null },
    });

    for (const recipient of campaign.recipients) {
      await prisma.crmAgentCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          result: {
            provider: "crm_agent_v2_worker",
            mode: "local",
            channel: recipient.channel,
            target: recipient.target,
          },
          error: null,
        },
      });
      recipientsSent += 1;
    }

    const remaining = await prisma.crmAgentCampaignRecipient.count({
      where: { campaignId: campaign.id, status: "PENDING" },
    });
    if (remaining === 0) {
      await prisma.crmAgentCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          result: {
            ...(jsonObject(campaign.result) ?? {}),
            sentRecipients: campaign.recipients.length,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  return { campaignsChecked, recipientsSent };
}

async function syncCrmAgentV2CampaignConversions() {
  const campaigns = await prisma.crmAgentCampaign.findMany({
    where: { status: "SENT" },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      recipients: {
        where: { status: "SENT" },
        select: { clientId: true, sentAt: true },
      },
    },
  });

  let campaignsChecked = 0;
  let conversionsFound = 0;
  for (const campaign of campaigns) {
    const clientIds = Array.from(new Set(campaign.recipients.map((recipient) => recipient.clientId)));
    if (!clientIds.length) continue;
    campaignsChecked += 1;
    const attributionStart = campaign.sentAt ?? campaign.createdAt;
    const attributionEnd = new Date(attributionStart);
    attributionEnd.setDate(attributionEnd.getDate() + 30);

    const appointments = await prisma.appointment.findMany({
      where: {
        accountId: campaign.accountId,
        clientId: { in: clientIds },
        createdAt: { gte: attributionStart, lte: attributionEnd },
        status: { in: BUSY_STATUSES },
      },
      select: { id: true, clientId: true, priceTotal: true, createdAt: true },
      take: 1000,
    });
    conversionsFound += appointments.length;
    const convertedClientIds = Array.from(new Set(appointments.map((appointment) => appointment.clientId)));

    await prisma.crmAgentCampaign.update({
      where: { id: campaign.id },
      data: {
        result: {
          ...(jsonObject(campaign.result) ?? {}),
          conversion: {
            attributionWindowDays: 30,
            appointments: appointments.length,
            convertedClients: convertedClientIds.length,
            conversionRate: clientIds.length ? convertedClientIds.length / clientIds.length : 0,
            revenue: moneySum(appointments.map((appointment) => appointment.priceTotal)),
            appointmentIds: appointments.map((appointment) => appointment.id).slice(0, 200),
            convertedClientIds: convertedClientIds.slice(0, 200),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  return { campaignsChecked, conversionsFound };
}

async function retryCrmAgentV2Outbox() {
  const retryAt = new Date();
  retryAt.setMinutes(retryAt.getMinutes() - 15);
  const result = await prisma.crmAgentCampaignRecipient.updateMany({
    where: {
      status: "FAILED",
      createdAt: { lte: retryAt },
    },
    data: {
      status: "PENDING",
      error: null,
    },
  });
  return { recipientsRetried: result.count };
}

async function runCrmAgentV2BackgroundPass() {
  const accounts = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
    take: 500,
  });

  const [expiredActions, sentCampaigns, campaignConversions, retriedOutbox] = await Promise.all([
    expireCrmAgentV2Actions(),
    sendCrmAgentV2Campaigns(),
    syncCrmAgentV2CampaignConversions(),
    retryCrmAgentV2Outbox(),
  ]);

  let createdInsights = 0;
  let createdDailyBriefs = 0;
  let createdWeeklyBriefs = 0;
  let snapshotsCreated = 0;
  let snapshotsUpdated = 0;

  for (const account of accounts) {
    const accountCreatedInsights = await generateCrmAgentV2Insights(account.id);
    createdInsights += accountCreatedInsights;

    const dailyBrief = await createCrmAgentV2BriefTask(account.id, "daily", accountCreatedInsights);
    if (dailyBrief) createdDailyBriefs += 1;

    if (new Date().getDay() === 1) {
      const weeklyBrief = await createCrmAgentV2BriefTask(account.id, "weekly", accountCreatedInsights);
      if (weeklyBrief) createdWeeklyBriefs += 1;
    }

    const snapshot = await refreshCrmAgentV2KnowledgeSnapshot(account.id);
    snapshotsCreated += snapshot.created;
    snapshotsUpdated += snapshot.updated;
  }

  return {
    expiredActions: expiredActions.count,
    sentCampaigns,
    campaignConversions,
    retriedOutbox,
    accountsChecked: accounts.length,
    createdInsights,
    createdDailyBriefs,
    createdWeeklyBriefs,
    snapshotsCreated,
    snapshotsUpdated,
  };
}

runCrmAgentV2BackgroundPass()
  .then((result) => {
    console.log(JSON.stringify({ worker: "crm-agent-v2", result }));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
