import { defineCrmAgentAction } from "../define-action";
import { executePermissionRevoke, previewRolePayload } from "./users-helpers";

export const permissionRevokeAction = defineCrmAgentAction({
  name: "permission.revoke",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "critical",
  permission: "crm.roles.manage",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["permissionKey"],
  optionalSlots: ["permissionId", "roleId", "roleName", "userId"],
  description: "Отозвать permission.",
  plannerHints: ["Use permission.revoke with roleId, roleName, or userId; userId resolves to the user's account role."],
  preview: previewRolePayload,
  execute: executePermissionRevoke,
});
