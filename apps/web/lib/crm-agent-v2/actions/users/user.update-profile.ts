import { defineCrmAgentAction } from "../define-action";
import { executeUserUpdateProfile, previewUserPayload } from "./users-helpers";

export const userUpdateProfileAction = defineCrmAgentAction({
  name: "user.update_profile",
  domain: "users",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.users.update",
  confirmation: "medium_plus",
  requiredSlots: ["userId"],
  optionalSlots: ["firstName", "lastName", "avatarUrl"],
  description: "Изменить имя, аватар, профиль пользователя.",
  plannerHints: ["Use user.update_profile for name and avatar changes on an account user."],
  preview: previewUserPayload,
  execute: executeUserUpdateProfile,
});
