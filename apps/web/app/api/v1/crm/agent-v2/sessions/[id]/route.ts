import { jsonOk } from "@/lib/api";
import { closeCrmAgentSession, getCrmAgentSession } from "@/lib/crm-agent-v2/core/persistence";
import { parsePositiveInt, requireCrmAgentApi, withCrmAgentAuthCookie } from "../../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parsePositiveInt(id, "id");
  if ("error" in parsed) return parsed.error;

  const session = await getCrmAgentSession({ accountId: auth.session.accountId, sessionId: parsed.value });
  if (!session) return jsonOk(null, 404);

  return withCrmAgentAuthCookie(jsonOk(session), auth);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parsePositiveInt(id, "id");
  if ("error" in parsed) return parsed.error;

  await closeCrmAgentSession({ accountId: auth.session.accountId, sessionId: parsed.value });
  return withCrmAgentAuthCookie(jsonOk({ id: parsed.value, status: "CLOSED" }), auth);
}
