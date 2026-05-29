import { defineCrmAgentAction } from "../define-action";
import { executeUserCreate, previewUserPayload } from "./users-helpers";

export const userCreateAction = defineCrmAgentAction({
  name: "user.create",
  domain: "users",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.users.create",
  confirmation: "always",
  requiredSlots: ["email"],
  optionalSlots: ["phone", "firstName", "lastName", "avatarUrl", "roleId", "roleName", "status"],
  description: "Создать пользователя без отправки пароля в открытую.",
  plannerHints: ["Use user.create to create or attach a STAFF user to the current account."],
  preview: previewUserPayload,
  execute: executeUserCreate,
});
