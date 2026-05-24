import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { updateAccountInsightStatus, writeAgentAudit } from "@/lib/crm-agent-persistence";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.insights.manage");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const insightId = Number(id);
  if (!Number.isInteger(insightId) || insightId <= 0) {
    return jsonError("INVALID_INSIGHT_ID", "Invalid insight id.", null, 400);
  }

  await updateAccountInsightStatus({
    accountId: auth.session.accountId,
    insightId,
    status: "DISMISSED",
  });

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.insight.dismiss",
    targetType: "ai_account_insight",
    targetId: String(insightId),
  });

  const response = jsonOk({ id: insightId, status: "DISMISSED" });
  return applyCrmAccessCookie(response, auth);
}
