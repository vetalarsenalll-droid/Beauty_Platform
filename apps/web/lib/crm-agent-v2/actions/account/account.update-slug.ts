import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateSlugAction = defineCrmAgentAction({
  name: "account.update_slug",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить slug аккаунта/публичного URL, проверить уникальность.",
  plannerHints: ["Use account.update_slug only after required slots are resolved and the user intent matches: Изменить slug аккаунта/публичного URL, проверить уникальность."],
  preview: (payload, ctx) => previewAccountAction("account.update_slug", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_slug", payload, ctx),
});
