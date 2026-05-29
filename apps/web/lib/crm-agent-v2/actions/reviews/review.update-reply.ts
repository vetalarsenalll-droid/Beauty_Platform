import { defineCrmAgentAction } from "../define-action";
import { executeReviewReplyUpdate, previewReviewMutation } from "./review-write-helpers";

export const reviewUpdateReplyAction = defineCrmAgentAction({
  name: "review.update_reply",
  domain: "reviews",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.reviews.manage",
  confirmation: "medium_plus",
  requiredSlots: ["reviewId", "replyText"],
  optionalSlots: [],
  description: "Изменить ответ на отзыв.",
  plannerHints: ["Use review.update_reply when replacing or editing an existing reply."],
  preview: previewReviewMutation,
  execute: executeReviewReplyUpdate,
});
