import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { inputJson, optionalDate, requiredDate, requiredNumber, requiredString, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

const DEFAULT_CHANNEL = "IN_APP";

export async function previewCampaignAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  const before = payload.campaignId ? await getCampaign(ctx.accountId, requiredNumber(payload.campaignId, "campaignId")) : null;
  return buildActionPreview({
    before,
    after: {
      actionName,
      title: campaignTitle(actionName, payload),
      goal: campaignGoal(actionName, payload),
      audience: audiencePayload(payload),
      offer: payload.offer ?? null,
      content: contentPayload(payload),
      channels: channels(payload),
      scheduledAt: optionalDate(payload, "scheduledAt")?.toISOString() ?? null,
    },
    warnings: actionName === "campaign.send" ? ["Campaign send queues recipients for the CRM Agent worker; provider delivery is asynchronous."] : [],
  });
}

export async function readCampaignAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName === "campaign.preview_audience") return previewAudience(ctx.accountId, payload);
  if (actionName === "campaign.view_results") {
    const campaign = await getCampaign(ctx.accountId, requiredNumber(payload.campaignId, "campaignId"));
    return { campaign };
  }
  if (actionName === "campaign.analyze_conversions") {
    const campaignId = payload.campaignId === undefined ? null : requiredNumber(payload.campaignId, "campaignId");
    const campaigns = await prisma.crmAgentCampaign.findMany({
      where: { accountId: ctx.accountId, ...(campaignId ? { id: campaignId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: campaignId ? 1 : 50,
      include: { recipients: true },
    });
    return {
      campaigns: campaigns.map((campaign) => ({
        ...serializeCampaign(campaign),
        recipients: campaign.recipients.length,
        sent: campaign.recipients.filter((recipient) => recipient.status === "SENT").length,
        failed: campaign.recipients.filter((recipient) => recipient.status === "FAILED").length,
        conversion: jsonObject(campaign.result)?.conversion ?? null,
      })),
    };
  }
  throw new Error(`Unsupported campaign read action: ${actionName}.`);
}

export async function executeCampaignAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  if (actionName.startsWith("campaign.create_")) {
    const campaign = await prisma.crmAgentCampaign.create({
      data: {
        accountId: ctx.accountId,
        title: campaignTitle(actionName, payload),
        goal: campaignGoal(actionName, payload),
        audience: inputJson(audiencePayload(payload)),
        offer: inputJson(payload.offer ?? {}),
        content: inputJson(contentPayload(payload)),
        channels: channels(payload),
        status: "DRAFT",
      },
    });
    return { status: "DONE" as const, data: { campaignId: campaign.id, status: campaign.status } };
  }

  const campaignId = requiredNumber(payload.campaignId, "campaignId");
  await assertCampaign(ctx.accountId, campaignId);

  if (actionName === "campaign.update_audience") {
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { audience: inputJson(audiencePayload(payload)) } });
    return { status: "DONE" as const, data: { campaignId: updated.id } };
  }
  if (actionName === "campaign.update_offer") {
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { offer: inputJson(payload.offer ?? {}) } });
    return { status: "DONE" as const, data: { campaignId: updated.id } };
  }
  if (actionName === "campaign.update_message") {
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { content: inputJson(contentPayload(payload)) } });
    return { status: "DONE" as const, data: { campaignId: updated.id } };
  }
  if (actionName === "campaign.schedule") {
    await ensureCampaignRecipients(ctx.accountId, campaignId);
    const scheduledAt = requiredDate(payload, "scheduledAt");
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { status: "SCHEDULED", scheduledAt } });
    return { status: "DONE" as const, data: { campaignId: updated.id, status: updated.status, scheduledAt: scheduledAt.toISOString() } };
  }
  if (actionName === "campaign.send") {
    const recipients = await ensureCampaignRecipients(ctx.accountId, campaignId);
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { status: "READY", scheduledAt: null, error: null } });
    return { status: "DONE" as const, data: { campaignId: updated.id, status: updated.status, recipients } };
  }
  if (actionName === "campaign.pause") {
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
    return { status: "DONE" as const, data: { campaignId: updated.id, status: updated.status } };
  }
  if (actionName === "campaign.cancel") {
    await prisma.crmAgentCampaignRecipient.updateMany({ where: { accountId: ctx.accountId, campaignId, status: "PENDING" }, data: { status: "CANCELLED" } });
    const updated = await prisma.crmAgentCampaign.update({ where: { id: campaignId }, data: { status: "CANCELLED" } });
    return { status: "DONE" as const, data: { campaignId: updated.id, status: updated.status } };
  }

  throw new Error(`Unsupported campaign action: ${actionName}.`);
}

async function previewAudience(accountId: number, payload: JsonRecord) {
  const clientIds = clientIdsFromPayload(payload);
  const clients = await prisma.client.findMany({
    where: { accountId, ...(clientIds.length ? { id: { in: clientIds } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, userId: true },
  });
  return {
    audience: {
      count: clients.length,
      clients,
      channels: channels(payload),
    },
  };
}

async function ensureCampaignRecipients(accountId: number, campaignId: number) {
  const existing = await prisma.crmAgentCampaignRecipient.count({ where: { accountId, campaignId } });
  if (existing > 0) return existing;

  const campaign = await prisma.crmAgentCampaign.findFirst({ where: { accountId, id: campaignId } });
  if (!campaign) throw new Error("Campaign not found.");
  const audience = jsonObject(campaign.audience) ?? {};
  const clientIds = Array.isArray(audience.clientIds) ? audience.clientIds.map(Number).filter(Number.isFinite) : [];
  const clients = await prisma.client.findMany({
    where: { accountId, ...(clientIds.length ? { id: { in: clientIds } } : {}) },
    take: 1000,
    select: { id: true, phone: true, email: true, userId: true },
  });
  const campaignChannels = campaign.channels.length ? campaign.channels : [DEFAULT_CHANNEL];
  const content = jsonObject(campaign.content) ?? {};
  const message = typeof content.message === "string" && content.message.trim() ? content.message.trim() : campaign.title;
  const data = clients.flatMap((client) =>
    campaignChannels.map((channel) => ({
      campaignId,
      accountId,
      clientId: client.id,
      channel,
      target: channel === "EMAIL" ? client.email : channel === "SMS" ? client.phone : client.userId ? String(client.userId) : client.phone ?? client.email,
      message,
    })),
  );
  if (!data.length) return 0;
  await prisma.crmAgentCampaignRecipient.createMany({ data, skipDuplicates: true });
  return data.length;
}

async function getCampaign(accountId: number, campaignId: number) {
  const campaign = await prisma.crmAgentCampaign.findFirst({ where: { accountId, id: campaignId }, include: { recipients: { take: 200, orderBy: { id: "asc" } } } });
  if (!campaign) throw new Error("Campaign not found.");
  return { ...serializeCampaign(campaign), recipients: campaign.recipients };
}

async function assertCampaign(accountId: number, campaignId: number) {
  await getCampaign(accountId, campaignId);
}

function campaignTitle(actionName: string, payload: JsonRecord) {
  if (typeof payload.title === "string" && payload.title.trim()) return payload.title.trim();
  return actionName.replace("campaign.create_", "").replaceAll("_", " ");
}

function campaignGoal(actionName: string, payload: JsonRecord) {
  if (typeof payload.goal === "string" && payload.goal.trim()) return payload.goal.trim();
  return actionName.replace("campaign.", "");
}

function audiencePayload(payload: JsonRecord) {
  return {
    ...(jsonObject(payload.audience) ?? {}),
    ...(Array.isArray(payload.clientIds) ? { clientIds: clientIdsFromPayload(payload) } : {}),
    ...(payload.segment !== undefined ? { segment: requiredString(payload, "segment") } : {}),
  };
}

function contentPayload(payload: JsonRecord) {
  return {
    ...(jsonObject(payload.content) ?? {}),
    ...(payload.message !== undefined ? { message: requiredString(payload, "message") } : {}),
    ...(payload.subject !== undefined ? { subject: requiredString(payload, "subject") } : {}),
  };
}

function channels(payload: JsonRecord) {
  if (!Array.isArray(payload.channels)) return [DEFAULT_CHANNEL];
  const values = payload.channels.map(String).map((value) => value.trim()).filter(Boolean);
  return values.length ? Array.from(new Set(values)) : [DEFAULT_CHANNEL];
}

function clientIdsFromPayload(payload: JsonRecord) {
  return Array.isArray(payload.clientIds) ? payload.clientIds.map(Number).filter(Number.isFinite).map(Math.trunc) : [];
}

function serializeCampaign(campaign: { id: number; accountId: number; title: string; goal: string; audience: unknown; offer: unknown; content: unknown; channels: string[]; status: string; scheduledAt: Date | null; sentAt: Date | null; result: unknown; error: string | null; createdAt: Date; updatedAt: Date }) {
  return {
    ...campaign,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

function jsonObject(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonRecord) : null;
}
