import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { canExecuteCrmAgentAction, executeConfirmedCrmAgentAction } from "@/lib/crm-agent-action-executor";
import { confirmPendingAction, writeAgentAudit } from "@/lib/crm-agent-persistence";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const siteActionTypes = new Set([
  "site.service.copy.update",
  "site.specialist.copy.update",
  "site.home.copy.update",
  "site.seo.update",
]);

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.settings.update");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId <= 0) {
    return jsonError("INVALID_DRAFT_ID", "Некорректный номер черновика.", null, 400);
  }

  const draft = await prisma.aiAgentSiteDraft.findFirst({
    where: { id: draftId, accountId: auth.session.accountId },
    select: { id: true, status: true, summary: true },
  });
  if (!draft) return jsonError("NOT_FOUND", "Черновик не найден.", null, 404);
  if (draft.status === "APPLIED") {
    return jsonError("DRAFT_ALREADY_APPLIED", "Черновик уже применён.", null, 409);
  }

  const action = await prisma.aiPendingAction.findFirst({
    where: {
      accountId: auth.session.accountId,
      status: "PENDING",
      actionType: { in: Array.from(siteActionTypes) },
      payload: { path: ["draftId"], equals: draftId },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!action) return jsonError("ACTION_NOT_FOUND", "Для черновика нет действия на подтверждение.", null, 404);
  if (!isJsonObject(action.payload)) return jsonError("INVALID_ACTION_PAYLOAD", "Некорректные данные действия.", null, 409);
  if (action.permission && !auth.session.permissions.includes("crm.all") && !auth.session.permissions.includes(action.permission)) {
    return jsonError("FORBIDDEN", "Недостаточно прав для применения черновика.", { permission: action.permission }, 403);
  }
  if (!canExecuteCrmAgentAction(action.actionType)) {
    return jsonError("ACTION_NOT_EXECUTABLE", "Действие черновика нельзя выполнить автоматически.", null, 409);
  }

  const confirmed = await confirmPendingAction({
    accountId: auth.session.accountId,
    actionId: action.id,
    userId: auth.session.userId,
  });
  if (!confirmed.count) return jsonError("ACTION_NOT_PENDING", "Действие уже обработано или истекло.", null, 409);

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.site_draft.apply",
    targetType: "ai_agent_site_draft",
    targetId: String(draftId),
    data: { actionId: action.id, actionType: action.actionType },
  });

  const execution = await executeConfirmedCrmAgentAction({
    accountId: auth.session.accountId,
    actionId: action.id,
    userId: auth.session.userId,
  });

  const response = jsonOk({ draftId, actionId: action.id, status: execution?.status ?? "CONFIRMED", execution });
  return applyCrmAccessCookie(response, auth);
}
