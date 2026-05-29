import { defineCrmAgentAction } from "../define-action";
import { executeUserInvite, previewUserPayload } from "./users-helpers";

export const userInviteAction = defineCrmAgentAction({
  name: "user.invite",
  domain: "users",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.users.invite",
  confirmation: "medium_plus",
  requiredSlots: ["email"],
  optionalSlots: ["phone", "firstName", "lastName", "avatarUrl", "roleId", "roleName"],
  description: "Отправить приглашение сотруднику.",
  plannerHints: ["Use user.invite to create or attach an INVITED staff user and enqueue an invitation event."],
  preview: previewUserPayload,
  execute: executeUserInvite,
});
