import { jsonError, jsonOk } from "@/lib/api";
import { getCrmAgentExecuteToolHandler } from "@/lib/crm-agent-v2/core/execute-tools";
import { parsePositiveInt, requireCrmAgentApi, withCrmAgentAuthCookie } from "../../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.write");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parsePositiveInt(id, "id");
  if ("error" in parsed) return parsed.error;

  const handler = getCrmAgentExecuteToolHandler("actions.confirm");
  if (!handler) return jsonError("TOOL_UNAVAILABLE", "Action confirmation tool is unavailable.", null, 500);

  const result = await handler(
    { actionId: parsed.value },
    {
      accountId: auth.session.accountId,
      userId: auth.session.userId,
      permissions: auth.session.permissions,
    },
  );

  return withCrmAgentAuthCookie(jsonOk(result), auth);
}
