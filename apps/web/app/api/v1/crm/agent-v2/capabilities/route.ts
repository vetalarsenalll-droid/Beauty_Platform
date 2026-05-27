import { jsonOk } from "@/lib/api";
import { listCrmAgentActionsForPermissions } from "@/lib/crm-agent-v2/core/actions";
import { listCrmAgentSkillsForPermissions } from "@/lib/crm-agent-v2/core/skills";
import { listCrmAgentToolsForPermissions } from "@/lib/crm-agent-v2/core/tools";
import { requireCrmAgentApi, withCrmAgentAuthCookie } from "../_shared";

export async function GET() {
  const auth = await requireCrmAgentApi("crm.assistant.agent.use");
  if ("response" in auth) return auth.response;

  const permissions = auth.session.permissions;
  const response = jsonOk({
    skills: listCrmAgentSkillsForPermissions(permissions),
    tools: listCrmAgentToolsForPermissions(permissions),
    actions: listCrmAgentActionsForPermissions(permissions),
  });

  return withCrmAgentAuthCookie(response, auth);
}
