import { defineCrmAgentAction } from "../define-action";
import { executeUserStatus, previewUserPayload } from "./users-helpers";

export const userDeactivateAction = defineCrmAgentAction({
  name: "user.deactivate",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.users.update",
  confirmation: "always",
  requiredSlots: ["userId"],
  optionalSlots: [],
  description: "Отключить пользователя.",
  plannerHints: ["Use user.deactivate to set an account user's status to DISABLED."],
  preview: previewUserPayload,
  execute: (payload, ctx) => executeUserStatus(payload, ctx, "DISABLED"),
});
