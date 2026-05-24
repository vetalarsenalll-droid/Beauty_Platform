import { getAiAccountBalance, getAiAccountAccessByAccountIds } from "@/lib/ai-billing";
import { crmAgentAutopilotSettingsFromMemory } from "@/lib/crm-agent-autopilot";
import { getAccountMemory, listAccountInsights, listPendingActions } from "@/lib/crm-agent-persistence";
import { prisma } from "@/lib/prisma";

export async function buildCrmAgentAccountContext(input: {
  accountId: number;
  userId: number;
  permissions: string[];
}) {
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
    appointmentsSoonCount,
    activePromosCount,
    latestReviews,
    aiBalance,
    accessByAccount,
    memory,
    insights,
    pendingActions,
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
    getAccountMemory(input.accountId),
    listAccountInsights({ accountId: input.accountId, take: 10 }),
    listPendingActions({ accountId: input.accountId, take: 10 }),
  ]);

  const access = accessByAccount.get(input.accountId);
  const autopilot = crmAgentAutopilotSettingsFromMemory(memory);

  return {
    account,
    user: {
      id: input.userId,
      permissions: input.permissions,
    },
    ai: {
      balanceRub: aiBalance,
      aiEnabled: access?.aiEnabled ?? true,
      crmAgentEnabled: access?.crmAgentEnabled ?? false,
      dailySpendLimitRub: access?.dailySpendLimitRub ?? null,
      monthlySpendLimitRub: access?.monthlySpendLimitRub ?? null,
      stopWhenBalanceBelowRub: access?.stopWhenBalanceBelowRub ?? null,
    },
    autopilot,
    summary: {
      servicesCount,
      specialistsCount,
      locationsCount,
      appointmentsTodayAndTomorrow: appointmentsSoonCount,
      activePromosCount,
      latestReviewsCount: latestReviews.length,
      activeInsightsCount: insights.length,
      pendingActionsCount: pendingActions.length,
    },
    latestReviews,
    memory,
    insights,
    pendingActions,
  };
}
