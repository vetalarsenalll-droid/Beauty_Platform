import { defineCrmAgentAction } from "../define-action";
import { executePermissionAssign, previewRolePayload } from "./users-helpers";

export const permissionAssignAction = defineCrmAgentAction({
  name: "permission.assign",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "critical",
  permission: "crm.roles.manage",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["permissionKey"],
  optionalSlots: ["permissionId", "roleId", "roleName", "userId"],
  description: "Выдать permission роли/пользователю.",
  plannerHints: ["Use permission.assign with roleId, roleName, or userId; userId resolves to the user's account role."],
  preview: previewRolePayload,
  execute: executePermissionAssign,
});
