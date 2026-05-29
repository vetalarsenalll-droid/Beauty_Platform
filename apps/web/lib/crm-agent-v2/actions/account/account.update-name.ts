import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateNameAction = defineCrmAgentAction({
  name: "account.update_name",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить публичное/внутреннее название аккаунта.",
  plannerHints: ["Use account.update_name only after required slots are resolved and the user intent matches: Изменить публичное/внутреннее название аккаунта."],
  preview: (payload, ctx) => previewAccountAction("account.update_name", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_name", payload, ctx),
});
