import { defineCrmAgentAction } from "../define-action";
import { executeRoleCreate, previewRolePayload } from "./users-helpers";

export const roleCreateAction = defineCrmAgentAction({
  name: "role.create",
  domain: "users",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.roles.manage",
  confirmation: "always",
  requiredSlots: ["name"],
  optionalSlots: ["roleName"],
  description: "Создать роль.",
  plannerHints: ["Use role.create for one of the supported role names: OWNER, MANAGER, SPECIALIST, READONLY."],
  preview: previewRolePayload,
  execute: executeRoleCreate,
});
