import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateRescheduleRulesAction = defineCrmAgentAction({
  name: "account.update_reschedule_rules",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить правила переноса.",
  plannerHints: ["Use account.update_reschedule_rules only after required slots are resolved and the user intent matches: Изменить правила переноса."],
  preview: (payload, ctx) => previewAccountAction("account.update_reschedule_rules", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_reschedule_rules", payload, ctx),
});
