import { defineCrmAgentAction } from "../define-action";
import { executeDisableRule, previewLoyaltyPayload } from "./loyalty-helpers";

export const loyaltyDisableRuleAction = defineCrmAgentAction({
  name: "loyalty.disable_rule",
  domain: "loyalty",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.loyalty.manage",
  confirmation: "medium_plus",
  requiredSlots: ["loyaltyRuleId"],
  optionalSlots: ["ruleId"],
  description: "Отключить правило лояльности.",
  plannerHints: ["Use loyalty.disable_rule to set one loyalty rule inactive."],
  preview: previewLoyaltyPayload,
  execute: executeDisableRule,
});
