import { defineCrmAgentAction } from "../define-action";
import { executeUpdateRule, previewLoyaltyPayload } from "./loyalty-helpers";

export const loyaltyUpdateRuleAction = defineCrmAgentAction({
  name: "loyalty.update_rule",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.loyalty.manage",
  confirmation: "medium_plus",
  requiredSlots: ["loyaltyRuleId"],
  optionalSlots: ["ruleId", "name", "type", "value", "isActive"],
  description: "Изменить правило лояльности.",
  plannerHints: ["Use loyalty.update_rule to edit an existing loyalty rule."],
  preview: previewLoyaltyPayload,
  execute: executeUpdateRule,
});
