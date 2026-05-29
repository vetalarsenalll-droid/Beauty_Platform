import type { CrmAgentActionContext, CrmAgentActionDefinition } from "./types";
import { CrmAgentPermissionError } from "./action-errors";

export function canUseCrmAgentCatalogAction(action: CrmAgentActionDefinition, permissions: string[]) {
  if (action.permission === "self") return true;
  return permissions.includes("crm.all") || permissions.includes(action.permission);
}

export function assertActionPermission(action: CrmAgentActionDefinition, ctx: CrmAgentActionContext) {
  if (canUseCrmAgentCatalogAction(action, ctx.permissions)) return;
  throw new CrmAgentPermissionError(`Missing permission for action ${action.name}.`, {
    actionName: action.name,
    permission: action.permission,
  });
}
