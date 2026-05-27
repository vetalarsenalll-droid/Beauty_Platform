import { jsonError, jsonOk } from "@/lib/api";
import { getCrmAgentExecuteToolHandler } from "@/lib/crm-agent-v2/core/execute-tools";
import { parsePositiveInt, requireCrmAgentApi, withCrmAgentAuthCookie } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.write");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parsePositiveInt(id, "id");
  if ("error" in parsed) return parsed.error;

  const body = await request.json().catch(() => null);
  const reason = body && typeof body === "object" && typeof (body as { reason?: unknown }).reason === "string" ? (body as { reason: string }).reason : undefined;

  const handler = getCrmAgentExecuteToolHandler("actions.reject");
  if (!handler) return jsonError("TOOL_UNAVAILABLE", "Action rejection tool is unavailable.", null, 500);

  const result = await handler(
    { actionId: parsed.value, ...(reason ? { reason } : {}) },
    {
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      permissions: auth.session.permissions,
    },
  );

  return withCrmAgentAuthCookie(jsonOk(result), auth);
}
