import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateBrandingAction = defineCrmAgentAction({
  name: "account.update_branding",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить брендовые настройки.",
  plannerHints: ["Use account.update_branding only after required slots are resolved and the user intent matches: Изменить брендовые настройки."],
  preview: (payload, ctx) => previewAccountAction("account.update_branding", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_branding", payload, ctx),
});
