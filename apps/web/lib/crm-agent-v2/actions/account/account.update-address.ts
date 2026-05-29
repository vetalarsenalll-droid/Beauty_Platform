import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateAddressAction = defineCrmAgentAction({
  name: "account.update_address",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить основной адрес организации.",
  plannerHints: ["Use account.update_address only after required slots are resolved and the user intent matches: Изменить основной адрес организации."],
  preview: (payload, ctx) => previewAccountAction("account.update_address", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_address", payload, ctx),
});
