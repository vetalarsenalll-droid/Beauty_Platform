import { defineCrmAgentAction } from "../define-action";
import { executeAccountAction, previewAccountAction } from "./account-helpers";

export const accountUpdateReviewRulesAction = defineCrmAgentAction({
  name: "account.update_review_rules",
  domain: "account",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить правила отзывов/публикации.",
  plannerHints: ["Use account.update_review_rules only after required slots are resolved and the user intent matches: Изменить правила отзывов/публикации."],
  preview: (payload, ctx) => previewAccountAction("account.update_review_rules", payload, ctx),
  execute: (payload, ctx) => executeAccountAction("account.update_review_rules", payload, ctx),
});
