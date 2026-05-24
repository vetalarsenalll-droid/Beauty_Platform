import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { canExecuteCrmAgentAction, executeConfirmedCrmAgentAction } from "@/lib/crm-agent-action-executor";
import { confirmPendingAction, getPendingActionForAccount, writeAgentAudit } from "@/lib/crm-agent-persistence";

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
  if (action.permission && !auth.session.permissions.includes("crm.all") && !auth.session.permissions.includes(action.permission)) {
    return jsonError("FORBIDDEN", "Insufficient permissions to confirm this action.", { permission: action.permission }, 403);
  }

  const result = await confirmPendingAction({
    accountId: auth.session.accountId,
    actionId,
    userId: auth.session.userId,
  });
  if (!result.count) {
    return jsonError("ACTION_NOT_PENDING", "Action is already processed or expired.", null, 409);
  }

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.action.confirm",
    targetType: "ai_pending_action",
    targetId: String(actionId),
    data: { actionType: action.actionType },
  });

  const execution = canExecuteCrmAgentAction(action.actionType)
    ? await executeConfirmedCrmAgentAction({
        accountId: auth.session.accountId,
        actionId,
        userId: auth.session.userId,
      })
    : null;

  const response = jsonOk({ id: actionId, status: execution?.status ?? "CONFIRMED", execution });
  return applyCrmAccessCookie(response, auth);
}
