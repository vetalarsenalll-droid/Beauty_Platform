import { defineCrmAgentAction } from "../define-action";
import { executeUserChangeRole, previewUserPayload } from "./users-helpers";

export const userChangeRoleAction = defineCrmAgentAction({
  name: "user.change_role",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.users.roles.update",
  confirmation: "always",
  requiredSlots: ["userId"],
  optionalSlots: ["roleId", "roleName", "name"],
  description: "Изменить роль пользователя.",
  plannerHints: ["Use user.change_role with roleId or one of OWNER, MANAGER, SPECIALIST, READONLY."],
  preview: previewUserPayload,
  execute: executeUserChangeRole,
});
