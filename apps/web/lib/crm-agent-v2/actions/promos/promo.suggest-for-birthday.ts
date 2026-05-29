import { defineCrmAgentAction } from "../define-action";
import { previewPromoSuggestion } from "./promo-helpers";

export const promoSuggestForBirthdayAction = defineCrmAgentAction({
  name: "promo.suggest_for_birthday",
  domain: "promos",
  kind: "generate",
  intent: "analyze",
  status: "draft_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["month", "take"],
  description: "Предложить birthday-акцию.",
  plannerHints: ["Use promo.suggest_for_birthday to draft a birthday offer."],
  preview: (payload) => previewPromoSuggestion(payload, "birthday"),
});
