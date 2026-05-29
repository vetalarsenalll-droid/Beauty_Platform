import { defineCrmAgentAction } from "../define-action";
import { executeUserRevokeSessions, previewUserPayload } from "./users-helpers";

export const userRevokeSessionsAction = defineCrmAgentAction({
  name: "user.revoke_sessions",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.users.security.update",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["userId"],
  optionalSlots: [],
  description: "Отозвать активные сессии пользователя.",
  plannerHints: ["Use user.revoke_sessions to delete CRM sessions for an account user."],
  preview: previewUserPayload,
  execute: executeUserRevokeSessions,
});
