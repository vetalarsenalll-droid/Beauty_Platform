import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdatePublicDescriptionAction = defineCrmAgentAction({
  name: "account.update_public_description",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить публичное описание салона.",
  plannerHints: ["Use account.update_public_description only after required slots are resolved and the user intent matches: Изменить публичное описание салона."],
  preview: (payload, ctx) => previewAccountAction("account.update_public_description", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_public_description", payload, ctx),
});
