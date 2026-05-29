import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateContactsAction = defineCrmAgentAction({
  name: "account.update_contacts",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить телефон, email, сайт и контакты.",
  plannerHints: ["Use account.update_contacts only after required slots are resolved and the user intent matches: Изменить телефон, email, сайт и контакты."],
  preview: (payload, ctx) => previewAccountAction("account.update_contacts", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_contacts", payload, ctx),
});
