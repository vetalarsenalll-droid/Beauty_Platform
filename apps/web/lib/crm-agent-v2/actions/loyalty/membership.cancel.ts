import { defineCrmAgentAction } from "../define-action";
import { executeMembershipCancel, previewLoyaltyPayload } from "./loyalty-helpers";

export const membershipCancelAction = defineCrmAgentAction({
  name: "membership.cancel",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.memberships.manage",
  confirmation: "always",
  requiredSlots: ["membershipId"],
  optionalSlots: [],
  description: "Отменить абонемент.",
  plannerHints: ["Use membership.cancel to close membership validity at the current time."],
  preview: previewLoyaltyPayload,
  execute: executeMembershipCancel,
});
