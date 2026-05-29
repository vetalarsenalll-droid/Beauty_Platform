import { defineCrmAgentAction } from "../define-action";
import { executeMembershipCreate, previewLoyaltyPayload } from "./loyalty-helpers";

export const membershipCreateAction = defineCrmAgentAction({
  name: "membership.create",
  domain: "loyalty",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.memberships.manage",
  confirmation: "always",
  requiredSlots: ["name", "type"],
  optionalSlots: ["totalUses", "validFrom", "validTo"],
  description: "Создать абонемент.",
  plannerHints: ["Use membership.create to create a membership product record."],
  preview: previewLoyaltyPayload,
  execute: executeMembershipCreate,
});
