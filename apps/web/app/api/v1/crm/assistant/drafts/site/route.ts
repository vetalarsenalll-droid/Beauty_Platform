import type { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createPendingAction, createSiteDraft, listSiteDrafts } from "@/lib/crm-agent-persistence";

const siteActionTypes = new Set([
  "site.service.copy.update",
  "site.specialist.copy.update",
  "site.home.copy.update",
  "site.seo.update",
]);

export async function GET() {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const drafts = await listSiteDrafts({ accountId: auth.session.accountId, take: 50 });
  const response = jsonOk({ drafts });
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.update");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const targetType = typeof body.targetType === "string" ? body.targetType.trim() : "";
  const actionType = typeof body.actionType === "string" ? body.actionType.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!targetType || !actionType || !summary || !siteActionTypes.has(actionType)) {
    return jsonError("VALIDATION_FAILED", "targetType, supported actionType and summary are required.", null, 400);
  }

  const patch = (body.patch ?? {}) as Prisma.InputJsonValue;
  const draft = await createSiteDraft({
    accountId: auth.session.accountId,
    targetType,
    targetId: typeof body.targetId === "string" ? body.targetId : null,
    patch,
    summary,
  });
  const pendingAction = await createPendingAction({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    actionType,
    summary,
    payload: { ...(body.patch && typeof body.patch === "object" && !Array.isArray(body.patch) ? body.patch : {}), draftId: draft.id },
    riskLevel: "high",
    permission: "crm.settings.update",
  });

  const response = jsonOk({ draft, pendingActionId: pendingAction.id }, 201);
  return applyCrmAccessCookie(response, auth);
}
