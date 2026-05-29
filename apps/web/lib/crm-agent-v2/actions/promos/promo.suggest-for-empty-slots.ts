import { defineCrmAgentAction } from "../define-action";
import { previewPromoSuggestion } from "./promo-helpers";

export const promoSuggestForEmptySlotsAction = defineCrmAgentAction({
  name: "promo.suggest_for_empty_slots",
  domain: "promos",
  kind: "generate",
  intent: "analyze",
  status: "draft_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "locationId", "specialistId", "take"],
  description: "Предложить акцию на пустые окна.",
  plannerHints: ["Use promo.suggest_for_empty_slots to draft a low-load time offer."],
  preview: (payload) => previewPromoSuggestion(payload, "empty_slots"),
});
