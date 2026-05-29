import { defineCrmAgentAction } from "../define-action";
import { executeUserUpdatePhone, previewUserPayload } from "./users-helpers";

export const userUpdatePhoneAction = defineCrmAgentAction({
  name: "user.update_phone",
  domain: "users",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.users.update",
  confirmation: "medium_plus",
  requiredSlots: ["userId", "phone"],
  optionalSlots: [],
  description: "Изменить телефон пользователя.",
  plannerHints: ["Use user.update_phone for account users; Russian phones are normalized when possible."],
  preview: previewUserPayload,
  execute: executeUserUpdatePhone,
});
