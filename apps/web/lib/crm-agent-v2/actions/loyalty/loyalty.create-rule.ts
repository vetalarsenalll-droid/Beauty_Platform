import { defineCrmAgentAction } from "../define-action";
import { executeCreateRule, previewLoyaltyPayload } from "./loyalty-helpers";

export const loyaltyCreateRuleAction = defineCrmAgentAction({
  name: "loyalty.create_rule",
  domain: "loyalty",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.loyalty.manage",
  confirmation: "medium_plus",
  requiredSlots: ["name", "type", "value"],
  optionalSlots: ["isActive"],
  description: "Создать правило лояльности.",
  plannerHints: ["Use loyalty.create_rule to create a loyalty earning/spending rule."],
  preview: previewLoyaltyPayload,
  execute: executeCreateRule,
});
