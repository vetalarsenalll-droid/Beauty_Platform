import { defineCrmAgentAction } from "../define-action";
import { executeUserResetPassword, previewUserPayload } from "./users-helpers";

export const userResetPasswordAction = defineCrmAgentAction({
  name: "user.reset_password",
  domain: "users",
  kind: "system",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.users.security.update",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["userId", "email"],
  optionalSlots: [],
  description: "Запустить reset-flow, не задавать пароль напрямую.",
  plannerHints: ["Use user.reset_password to create a reset token and enqueue a reset notification."],
  preview: previewUserPayload,
  execute: executeUserResetPassword,
});
