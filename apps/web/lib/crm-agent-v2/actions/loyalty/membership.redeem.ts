import { defineCrmAgentAction } from "../define-action";
import { executeMembershipRedeem, previewLoyaltyPayload } from "./loyalty-helpers";

export const membershipRedeemAction = defineCrmAgentAction({
  name: "membership.redeem",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.memberships.manage",
  confirmation: "always",
  requiredSlots: ["membershipId", "clientId"],
  optionalSlots: ["usedAt"],
  description: "Списать посещение/услугу по абонементу.",
  plannerHints: ["Use membership.redeem to record one membership redemption for a client."],
  preview: previewLoyaltyPayload,
  execute: executeMembershipRedeem,
});
