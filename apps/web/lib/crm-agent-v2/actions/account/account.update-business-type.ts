import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateBusinessTypeAction = defineCrmAgentAction({
  name: "account.update_business_type",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить тип бизнеса для настроек и шаблонов.",
  plannerHints: ["Use account.update_business_type only after required slots are resolved and the user intent matches: Изменить тип бизнеса для настроек и шаблонов."],
  preview: (payload, ctx) => previewAccountAction("account.update_business_type", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_business_type", payload, ctx),
});
