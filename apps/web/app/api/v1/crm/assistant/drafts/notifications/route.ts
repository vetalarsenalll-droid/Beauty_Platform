import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createNotificationDraft, createPendingAction, listNotificationDrafts } from "@/lib/crm-agent-persistence";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.assistant.campaigns.manage");
  if ("response" in auth) return auth.response;

  const drafts = await listNotificationDrafts({ accountId: auth.session.accountId, take: 50 });
  const response = jsonOk({ drafts });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.campaigns.manage");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  const bodyText = typeof body.bodyText === "string" ? body.bodyText.trim() : "";
  if (!title || !channel || !bodyText) {
    return jsonError("VALIDATION_FAILED", "title, channel and bodyText are required.", null, 400);
  }

  const draft = await createNotificationDraft({
    accountId: auth.session.accountId,
    campaignId: typeof body.campaignId === "number" ? body.campaignId : null,
    title,
    channel,
    audience: (body.audience ?? {}) as Prisma.InputJsonValue,
    bodyText,
  });

  const pendingAction = await createPendingAction({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    actionType: body.campaignId ? "notification.campaign.send" : "notification.send",
    summary: `Send notification draft: ${title}`,
    payload: body.campaignId
      ? { campaignId: body.campaignId, draftId: draft.id }
      : ({
          draftId: draft.id,
          clientId: body.clientId,
          channel,
          title,
          bodyText,
        } as Prisma.InputJsonValue),
    riskLevel: "high",
    permission: "crm.assistant.campaigns.manage",
  });

  const response = jsonOk({ draft, pendingActionId: pendingAction.id }, 201);
  return applyCrmAccessCookie(response, auth);
}
