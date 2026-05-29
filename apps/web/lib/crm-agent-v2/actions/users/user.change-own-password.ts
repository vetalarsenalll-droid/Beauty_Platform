import { defineCrmAgentAction } from "../define-action";
import { executeUserChangeOwnPassword, previewUserPayload } from "./users-helpers";

export const userChangeOwnPasswordAction = defineCrmAgentAction({
  name: "user.change_own_password",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "critical",
  permission: "self",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["email", "newPassword"],
  optionalSlots: [],
  description: "Сменить пароль текущего пользователя.",
  plannerHints: ["Use user.change_own_password only for the authenticated user with a separate sensitive confirmation."],
  preview: previewUserPayload,
  execute: executeUserChangeOwnPassword,
});
