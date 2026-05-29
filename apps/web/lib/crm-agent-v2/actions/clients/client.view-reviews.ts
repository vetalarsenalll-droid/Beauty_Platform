import { defineCrmAgentAction } from "../define-action";
import { readClientReviews } from "./client-write-helpers";

export const clientViewReviewsAction = defineCrmAgentAction({
  name: "client.view_reviews",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Показать отзывы клиента.",
  plannerHints: ["Use client.view_reviews when the user asks for reviews left by one client."],
  read: async (payload, ctx) => readClientReviews(ctx.accountId, payload),
});
