import { defineCrmAgentAction } from "../define-action";
import { executeUserUpdateEmail, previewUserPayload } from "./users-helpers";

export const userUpdateEmailAction = defineCrmAgentAction({
  name: "user.update_email",
  domain: "users",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.users.update",
  confirmation: "always",
  requiredSlots: ["userId", "email"],
  optionalSlots: [],
  description: "Изменить email пользователя, проверить уникальность.",
  plannerHints: ["Use user.update_email for account users; Prisma enforces global email uniqueness."],
  preview: previewUserPayload,
  execute: executeUserUpdateEmail,
});
