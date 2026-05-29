import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateDepositRulesAction = defineCrmAgentAction({
  name: "account.update_deposit_rules",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить правила депозитов/предоплаты.",
  plannerHints: ["Use account.update_deposit_rules only after required slots are resolved and the user intent matches: Изменить правила депозитов/предоплаты."],
  preview: (payload, ctx) => previewAccountAction("account.update_deposit_rules", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_deposit_rules", payload, ctx),
});
