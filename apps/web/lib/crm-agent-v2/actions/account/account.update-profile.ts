import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateProfileAction = defineCrmAgentAction({
  name: "account.update_profile",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить общий профиль организации.",
  plannerHints: ["Use account.update_profile only after required slots are resolved and the user intent matches: Изменить общий профиль организации."],
  preview: (payload, ctx) => previewAccountAction("account.update_profile", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_profile", payload, ctx),
});
