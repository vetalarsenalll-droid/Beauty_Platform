import { defineCrmAgentAction } from "../define-action";
import { executeReviewReplyDelete, previewReviewMutation } from "./review-write-helpers";

export const reviewDeleteReplyAction = defineCrmAgentAction({
  name: "review.delete_reply",
  domain: "reviews",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.reviews.manage",
  confirmation: "always",
  requiredSlots: ["reviewId"],
  optionalSlots: [],
  description: "Удалить ответ на отзыв.",
  plannerHints: ["Use review.delete_reply only after review identity is confirmed."],
  preview: previewReviewMutation,
  execute: executeReviewReplyDelete,
});
