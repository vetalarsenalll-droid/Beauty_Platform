import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { createAgentTask, updateAccountInsightStatus, writeAgentAudit } from "@/lib/crm-agent-persistence";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireCrmApiPermission("crm.assistant.insights.manage");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const insightId = Number(id);
  if (!Number.isInteger(insightId) || insightId <= 0) {
    return jsonError("INVALID_INSIGHT_ID", "Invalid insight id.", null, 400);
  }

  const body = await request.json().catch(() => null);
  await updateAccountInsightStatus({
    accountId: auth.session.accountId,
    insightId,
    status: "ACCEPTED",
  });

  const task = await createAgentTask({
    accountId: auth.session.accountId,
    type: typeof body?.taskType === "string" ? body.taskType : "insight.follow_up",
    title: typeof body?.title === "string" ? body.title : "Accepted assistant insight",
    description: typeof body?.description === "string" ? body.description : null,
    payload: { insightId, source: "insight.accept" },
    sourceInsightId: insightId,
  });

  await writeAgentAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "ai_agent.insight.accept",
    targetType: "ai_account_insight",
    targetId: String(insightId),
    data: { taskId: task.id },
  });

  const response = jsonOk({ id: insightId, status: "ACCEPTED", taskId: task.id });
  return applyCrmAccessCookie(response, auth);
}
