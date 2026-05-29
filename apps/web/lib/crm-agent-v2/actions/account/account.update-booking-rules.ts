import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateBookingRulesAction = defineCrmAgentAction({
  name: "account.update_booking_rules",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить правила онлайн-записи.",
  plannerHints: ["Use account.update_booking_rules only after required slots are resolved and the user intent matches: Изменить правила онлайн-записи."],
  preview: (payload, ctx) => previewAccountAction("account.update_booking_rules", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_booking_rules", payload, ctx),
});
