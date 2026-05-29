import { defineCrmAgentAction } from "../define-action";
import { readSpecialistInsightAction } from "./specialist-insight-helpers";

export const specialistViewReviewsAction = defineCrmAgentAction({
  name: "specialist.view_reviews",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать отзывы специалиста.",
  plannerHints: ["Use specialist.view_reviews when the user asks to inspect: Показать отзывы специалиста."],
  read: (payload, ctx) => readSpecialistInsightAction("specialist.view_reviews", payload, ctx),
});
