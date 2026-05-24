import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import {
  createBirthdayCampaignDraft,
  createEmptyWindowCampaignDraft,
  createReactivationCampaignDraft,
  createRetentionCampaignDraft,
  createRepeatVisitCampaignDraft,
  createSeasonalCampaignDraft,
} from "@/lib/crm-agent-campaigns";
import { createAgentCampaign, listAgentCampaigns, writeAgentAudit } from "@/lib/crm-agent-persistence";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.assistant.campaigns.manage");
  if ("response" in auth) return auth.response;

  const campaigns = await listAgentCampaigns({ accountId: auth.session.accountId, take: 50 });
  const response = jsonOk({ campaigns });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.campaigns.manage");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  if (body.template === "retention") {
    const result = await createRetentionCampaignDraft({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      days: typeof body.days === "number" ? body.days : undefined,
      channel: typeof body.channel === "string" ? body.channel : undefined,
      offerText: typeof body.offerText === "string" ? body.offerText : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    const response = jsonOk(result, 201);
    return applyCrmAccessCookie(response, auth);
  }

  if (body.template === "repeat_visit" || body.template === "repeatVisit") {
    const result = await createRepeatVisitCampaignDraft({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      daysFrom: typeof body.daysFrom === "number" ? body.daysFrom : undefined,
      daysTo: typeof body.daysTo === "number" ? body.daysTo : undefined,
      channel: typeof body.channel === "string" ? body.channel : undefined,
      offerText: typeof body.offerText === "string" ? body.offerText : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    const response = jsonOk(result, 201);
    return applyCrmAccessCookie(response, auth);
  }

  if (body.template === "reactivation") {
    const result = await createReactivationCampaignDraft({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      days: typeof body.days === "number" ? body.days : undefined,
      channel: typeof body.channel === "string" ? body.channel : undefined,
      offerText: typeof body.offerText === "string" ? body.offerText : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    const response = jsonOk(result, 201);
    return applyCrmAccessCookie(response, auth);
  }

  if (body.template === "seasonal") {
    const result = await createSeasonalCampaignDraft({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      channel: typeof body.channel === "string" ? body.channel : undefined,
      offerText: typeof body.offerText === "string" ? body.offerText : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    const response = jsonOk(result, 201);
    return applyCrmAccessCookie(response, auth);
  }

  if (body.template === "birthday" || body.template === "birthdays") {
    const result = await createBirthdayCampaignDraft({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      days: typeof body.days === "number" ? body.days : undefined,
      channel: typeof body.channel === "string" ? body.channel : undefined,
      offerText: typeof body.offerText === "string" ? body.offerText : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    const response = jsonOk(result, 201);
    return applyCrmAccessCookie(response, auth);
  }

  if (body.template === "empty_windows") {
    const result = await createEmptyWindowCampaignDraft({
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      days: typeof body.days === "number" ? body.days : undefined,
      minFreeMinutes: typeof body.minFreeMinutes === "number" ? body.minFreeMinutes : undefined,
      offerText: typeof body.offerText === "string" ? body.offerText : undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });
    const response = jsonOk(result, 201);
    return applyCrmAccessCookie(response, auth);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (!title || !goal) {
    return jsonError("VALIDATION_FAILED", "title and goal are required.", null, 400);
  }

  const campaign = await createAgentCampaign({
    accountId: auth.session.accountId,
    title,
    goal,
    audience: (body.audience ?? {}) as Prisma.InputJsonValue,
    offer: (body.offer ?? null) as Prisma.InputJsonValue,
    content: (body.content ?? {}) as Prisma.InputJsonValue,
    channels: Array.isArray(body.channels) ? body.channels.filter((channel: unknown) => typeof channel === "string") : [],
    scheduledAt: typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null,
  });

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.campaign.create",
    targetType: "ai_agent_campaign",
    targetId: String(campaign.id),
    data: { goal: campaign.goal },
  });

  const response = jsonOk({ campaign }, 201);
  return applyCrmAccessCookie(response, auth);
}
