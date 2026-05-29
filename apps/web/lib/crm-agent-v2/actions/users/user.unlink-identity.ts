import { defineCrmAgentAction } from "../define-action";
import { executeUserUnlinkIdentity, previewUserPayload } from "./users-helpers";

export const userUnlinkIdentityAction = defineCrmAgentAction({
  name: "user.unlink_identity",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.users.security.update",
  confirmation: "always",
  requiredSlots: ["userId", "identityId"],
  optionalSlots: [],
  description: "Отвязать внешний identity provider.",
  plannerHints: ["Use user.unlink_identity to remove a specific identity from an account user."],
  preview: previewUserPayload,
  execute: executeUserUnlinkIdentity,
});
