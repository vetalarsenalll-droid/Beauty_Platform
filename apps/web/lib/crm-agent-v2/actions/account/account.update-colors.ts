import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateColorsAction = defineCrmAgentAction({
  name: "account.update_colors",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить фирменные цвета.",
  plannerHints: ["Use account.update_colors only after required slots are resolved and the user intent matches: Изменить фирменные цвета."],
  preview: (payload, ctx) => previewAccountAction("account.update_colors", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_colors", payload, ctx),
});
