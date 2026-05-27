import type { Prisma } from "@prisma/client";
import { getAiAccountAccessByAccountIds, getAiAccountBalance } from "@/lib/ai-billing";
import { prisma } from "@/lib/prisma";
import type { CrmAgentPlannerMessage } from "./planner";

export type CrmAgentContext = {
  account: {
    id: number;
    name: string;
    slug: string;
    status: string;
    businessType: string | null;
    profile: {
      description: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
    } | null;
  } | null;
  user: {
    id: number | null;
    permissions: string[];
  };
  ai: {
    balanceRub: number;
    aiEnabled: boolean;
    crmAgentEnabled: boolean;
    dailySpendLimitRub: number | null;
    monthlySpendLimitRub: number | null;
    stopWhenBalanceBelowRub: number | null;
  };
  summary: {
    servicesCount: number;
    specialistsCount: number;
    locationsCount: number;
    clientsCount: number;
    appointmentsTodayAndTomorrow: number;
    activePromosCount: number;
    recentReviewsCount: number;
    activeInsightsCount: number;
    pendingActionsCount: number;
  };
  recentReviews: Array<{
    id: number;
    rating: number;
    status: string;
    comment: string | null;
    createdAt: string;
  }>;
  memory: Array<{
    key: string;
    value: Prisma.JsonValue;
    source: string | null;
    confidence: string;
    updatedAt: string;
  }>;
  insights: Array<{
    id: number;
    type: string;
    title: string;
    summary: string;
    priority: number;
    status: string;
    data: Prisma.JsonValue;
    createdAt: string;
  }>;
  pendingActions: Array<{
    id: number;
    actionType: string;
    summary: string;
    riskLevel: string;
    permission: string | null;
    createdAt: string;
  }>;
  history: CrmAgentPlannerMessage[];
};

export async function loadCrmAgentContext(input: {
  accountId: number;
  userId?: number | null;
  permissions: string[];
  sessionId?: number | null;
}): Promise<CrmAgentContext> {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(tomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const [
    account,
    servicesCount,
    specialistsCount,
    locationsCount,
    clientsCount,
    appointmentsSoonCount,
    activePromosCount,
    recentReviews,
    balanceRub,
    accessByAccount,
    memory,
    insights,
    pendingActions,
    messages,
  ] = await Promise.all([
    prisma.account.findUnique({
      where: { id: input.accountId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        businessType: true,
        profile: { select: { description: true, phone: true, email: true, address: true } },
      },
    }),
    prisma.service.count({ where: { accountId: input.accountId, isActive: true } }),
    prisma.specialistProfile.count({ where: { accountId: input.accountId, isPublic: true } }),
    prisma.location.count({ where: { accountId: input.accountId, status: "ACTIVE" } }),
    prisma.client.count({ where: { accountId: input.accountId } }),
    prisma.appointment.count({
      where: {
        accountId: input.accountId,
        startAt: { gte: startOfToday, lte: endOfTomorrow },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.promotion.count({ where: { accountId: input.accountId, isActive: true } }),
    prisma.review.findMany({
      where: { accountId: input.accountId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, rating: true, status: true, comment: true, createdAt: true },
    }),
    getAiAccountBalance(input.accountId),
    getAiAccountAccessByAccountIds([input.accountId]),
    prisma.crmAgentMemory.findMany({
      where: { accountId: input.accountId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { key: true, value: true, source: true, confidence: true, updatedAt: true },
    }),
    prisma.crmAgentInsight.findMany({
      where: { accountId: input.accountId, status: { in: ["NEW", "ACTIVE"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: { id: true, type: true, title: true, summary: true, data: true, priority: true, status: true, createdAt: true },
    }),
    prisma.crmAgentAction.findMany({
      where: { accountId: input.accountId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, actionType: true, summary: true, riskLevel: true, permission: true, createdAt: true },
    }),
    input.sessionId
      ? prisma.crmAgentMessage.findMany({
          where: { sessionId: input.sessionId, session: { accountId: input.accountId } },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { role: true, content: true, data: true },
        })
      : Promise.resolve([]),
  ]);

  const access = accessByAccount.get(input.accountId);

  return {
    account,
    user: {
      id: input.userId ?? null,
      permissions: input.permissions,
    },
    ai: {
      balanceRub,
      aiEnabled: access?.aiEnabled ?? true,
      crmAgentEnabled: access?.crmAgentEnabled ?? false,
      dailySpendLimitRub: decimalToNumber(access?.dailySpendLimitRub ?? null),
      monthlySpendLimitRub: decimalToNumber(access?.monthlySpendLimitRub ?? null),
      stopWhenBalanceBelowRub: decimalToNumber(access?.stopWhenBalanceBelowRub ?? null),
    },
    summary: {
      servicesCount,
      specialistsCount,
      locationsCount,
      clientsCount,
      appointmentsTodayAndTomorrow: appointmentsSoonCount,
      activePromosCount,
      recentReviewsCount: recentReviews.length,
      activeInsightsCount: insights.length,
      pendingActionsCount: pendingActions.length,
    },
    recentReviews: recentReviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      status: review.status,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    })),
    memory: memory.map((item) => ({
      key: item.key,
      value: item.value,
      source: item.source,
      confidence: item.confidence.toString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    insights: insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      summary: insight.summary,
      priority: insight.priority,
      status: insight.status,
      data: insight.data,
      createdAt: insight.createdAt.toISOString(),
    })),
    pendingActions: pendingActions.map((action) => ({
      id: action.id,
      actionType: action.actionType,
      summary: action.summary,
      riskLevel: action.riskLevel,
      permission: action.permission,
      createdAt: action.createdAt.toISOString(),
    })),
    history: messages.reverse().map((message) => ({
      role: plannerRole(message.role),
      content: message.content,
      data: message.data,
    })),
  };
}

export function compactCrmAgentContext(context: CrmAgentContext): Prisma.JsonObject {
  return {
    account: context.account,
    user: context.user,
    ai: context.ai,
    summary: context.summary,
    recentReviews: context.recentReviews,
    memory: context.memory,
    insights: context.insights,
    pendingActions: context.pendingActions,
  } satisfies Prisma.JsonObject;
}

function plannerRole(role: string): CrmAgentPlannerMessage["role"] {
  if (role === "assistant" || role === "tool" || role === "system") return role;
  return "user";
}

function decimalToNumber(value: Prisma.Decimal | number | null) {
  if (value == null) return null;
  return typeof value === "number" ? value : value.toNumber();
}
