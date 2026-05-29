import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateCancellationRulesAction = defineCrmAgentAction({
  name: "account.update_cancellation_rules",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить правила отмены.",
  plannerHints: ["Use account.update_cancellation_rules only after required slots are resolved and the user intent matches: Изменить правила отмены."],
  preview: (payload, ctx) => previewAccountAction("account.update_cancellation_rules", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_cancellation_rules", payload, ctx),
});
