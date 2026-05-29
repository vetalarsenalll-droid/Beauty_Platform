import { defineCrmAgentAction } from "../define-action";
import { executeUserStatus, previewUserPayload } from "./users-helpers";

export const userActivateAction = defineCrmAgentAction({
  name: "user.activate",
  domain: "users",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.users.update",
  confirmation: "medium_plus",
  requiredSlots: ["userId"],
  optionalSlots: [],
  description: "Активировать пользователя.",
  plannerHints: ["Use user.activate to set an account user's status to ACTIVE."],
  preview: previewUserPayload,
  execute: (payload, ctx) => executeUserStatus(payload, ctx, "ACTIVE"),
});
