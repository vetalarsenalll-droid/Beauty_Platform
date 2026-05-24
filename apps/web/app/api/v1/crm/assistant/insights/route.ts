import { jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { generateCrmAgentInsights } from "@/lib/crm-agent-insights";
import { listAccountInsights } from "@/lib/crm-agent-persistence";

const allowedStatuses = new Set(["NEW", "VIEWED", "ACCEPTED", "DISMISSED", "EXPIRED"]);

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.assistant.insights.read");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const insights = await listAccountInsights({
    accountId: auth.session.accountId,
    status: status && allowedStatuses.has(status) ? (status as "NEW") : undefined,
    take: 50,
  });

  const response = jsonOk({
    insights: insights.map((insight) => ({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      summary: insight.summary,
      data: insight.data,
      priority: insight.priority,
      status: insight.status,
      expiresAt: insight.expiresAt?.toISOString() ?? null,
      createdAt: insight.createdAt.toISOString(),
      updatedAt: insight.updatedAt.toISOString(),
    })),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function POST() {
  const auth = await requireCrmApiPermission("crm.assistant.insights.manage");
  if ("response" in auth) return auth.response;

  const result = await generateCrmAgentInsights(auth.session.accountId);
  const response = jsonOk(result, 201);
  return applyCrmAccessCookie(response, auth);
}
