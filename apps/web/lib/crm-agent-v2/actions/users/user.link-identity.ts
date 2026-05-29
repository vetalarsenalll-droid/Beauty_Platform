import { defineCrmAgentAction } from "../define-action";
import { executeUserLinkIdentity, previewUserPayload } from "./users-helpers";

export const userLinkIdentityAction = defineCrmAgentAction({
  name: "user.link_identity",
  domain: "users",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.users.security.update",
  confirmation: "always",
  requiredSlots: ["userId", "provider"],
  optionalSlots: ["providerUserId", "email", "phone", "displayName", "username", "avatarUrl", "metadataJson"],
  description: "Привязать внешний identity provider.",
  plannerHints: ["Use user.link_identity for EMAIL, PHONE, TELEGRAM, MAX, VK, or YANDEX identities."],
  preview: previewUserPayload,
  execute: executeUserLinkIdentity,
});
