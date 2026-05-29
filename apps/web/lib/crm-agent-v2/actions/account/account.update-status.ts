import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateStatusAction = defineCrmAgentAction({
  name: "account.update_status",
  domain: "account",
  kind: "system",
  intent: "update",
  status: "implemented",
  risk: "critical",
  permission: "platform.accounts.update",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: [],
  optionalSlots: [],
  description: "Активировать/приостановить аккаунт.",
  plannerHints: ["Use account.update_status only after required slots are resolved and the user intent matches: Активировать/приостановить аккаунт."],
  preview: (payload, ctx) => previewAccountAction("account.update_status", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_status", payload, ctx),
});
