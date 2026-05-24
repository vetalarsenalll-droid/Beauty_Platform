import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { getPendingActionForAccount, rejectPendingAction, writeAgentAudit } from "@/lib/crm-agent-persistence";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.actions.confirm");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const actionId = Number(id);
  if (!Number.isInteger(actionId) || actionId <= 0) {
    return jsonError("INVALID_ACTION_ID", "Invalid action id.", null, 400);
  }

  const action = await getPendingActionForAccount({ accountId: auth.session.accountId, actionId });
  if (!action) return jsonError("NOT_FOUND", "Action not found.", null, 404);

  const result = await rejectPendingAction({ accountId: auth.session.accountId, actionId });
  if (!result.count) {
    return jsonError("ACTION_NOT_PENDING", "Action is already processed.", null, 409);
  }

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.action.reject",
    targetType: "ai_pending_action",
    targetId: String(actionId),
    data: { actionType: action.actionType },
  });

  const response = jsonOk({ id: actionId, status: "REJECTED" });
  return applyCrmAccessCookie(response, auth);
}
