import { defineCrmAgentAction } from "../define-action";
import { previewPromoSuggestion } from "./promo-helpers";

export const promoSuggestForRetentionAction = defineCrmAgentAction({
  name: "promo.suggest_for_retention",
  domain: "promos",
  kind: "generate",
  intent: "analyze",
  status: "draft_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "tagName", "take"],
  description: "Предложить акцию для возврата клиентов.",
  plannerHints: ["Use promo.suggest_for_retention to draft a comeback offer."],
  preview: (payload) => previewPromoSuggestion(payload, "retention"),
});
