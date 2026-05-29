import { defineCrmAgentAction } from "../define-action";
import { executeRoleUpdate, previewRolePayload } from "./users-helpers";

export const roleUpdateAction = defineCrmAgentAction({
  name: "role.update",
  domain: "users",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.roles.manage",
  confirmation: "always",
  requiredSlots: ["roleId", "name"],
  optionalSlots: ["roleName"],
  description: "Изменить роль.",
  plannerHints: ["Use role.update to rename a role to OWNER, MANAGER, SPECIALIST, or READONLY."],
  preview: previewRolePayload,
  execute: executeRoleUpdate,
});
