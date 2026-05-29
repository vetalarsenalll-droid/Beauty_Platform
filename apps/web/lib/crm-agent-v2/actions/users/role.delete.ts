import { defineCrmAgentAction } from "../define-action";
import { executeRoleDelete, previewRolePayload } from "./users-helpers";

export const roleDeleteAction = defineCrmAgentAction({
  name: "role.delete",
  domain: "users",
  kind: "system",
  intent: "delete",
  status: "implemented",
  risk: "critical",
  permission: "crm.roles.manage",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["roleId"],
  optionalSlots: [],
  description: "Удалить роль, если нет критичных привязок.",
  plannerHints: ["Use role.delete only when the role has no assigned users and is not OWNER."],
  preview: previewRolePayload,
  execute: executeRoleDelete,
});
