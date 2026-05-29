import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { getReviewById, serializeReview } from "./review-read-helpers";

export const reviewViewAction = defineCrmAgentAction({
  name: "review.view",
  domain: "reviews",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.reviews.read",
  confirmation: "never",
  requiredSlots: ["reviewId"],
  optionalSlots: [],
  description: "Показать отзыв.",
  plannerHints: ["Use review.view when the user asks to inspect: Показать отзыв."],
  read: async (payload: JsonRecord, ctx) => {
    const reviewId = requiredNumber(payload.reviewId ?? payload.id, "reviewId");
    const review = await getReviewById(ctx.accountId, reviewId);
    if (!review) throw new Error("Review not found.");
    return { review: serializeReview(review) };
  },
});
