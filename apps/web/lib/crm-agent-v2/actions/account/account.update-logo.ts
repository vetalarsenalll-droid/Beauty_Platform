import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateLogoAction = defineCrmAgentAction({
  name: "account.update_logo",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Заменить логотип аккаунта.",
  plannerHints: ["Use account.update_logo only after required slots are resolved and the user intent matches: Заменить логотип аккаунта."],
  preview: (payload, ctx) => previewAccountAction("account.update_logo", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_logo", payload, ctx),
});
