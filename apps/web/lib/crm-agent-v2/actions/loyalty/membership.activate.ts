import { defineCrmAgentAction } from "../define-action";
import { executeMembershipActivate, previewLoyaltyPayload } from "./loyalty-helpers";

export const membershipActivateAction = defineCrmAgentAction({
  name: "membership.activate",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.memberships.manage",
  confirmation: "always",
  requiredSlots: ["membershipId"],
  optionalSlots: ["validFrom"],
  description: "Активировать абонемент.",
  plannerHints: ["Use membership.activate to clear validTo and set validFrom."],
  preview: previewLoyaltyPayload,
  execute: executeMembershipActivate,
});
