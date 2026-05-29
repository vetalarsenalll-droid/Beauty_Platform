import { defineCrmAgentAction } from "../define-action";
import { executeMembershipUpdate, previewLoyaltyPayload } from "./loyalty-helpers";

export const membershipUpdateAction = defineCrmAgentAction({
  name: "membership.update",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.memberships.manage",
  confirmation: "always",
  requiredSlots: ["membershipId"],
  optionalSlots: ["name", "type", "totalUses", "validFrom", "validTo"],
  description: "Изменить абонемент.",
  plannerHints: ["Use membership.update to edit membership fields."],
  preview: previewLoyaltyPayload,
  execute: executeMembershipUpdate,
});
