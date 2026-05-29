import { defineCrmAgentAction } from "../define-action";
import { executeReviewReplyMediaRemove, previewReviewMutation } from "./review-write-helpers";

export const reviewRemoveReplyMediaAction = defineCrmAgentAction({
  name: "review.remove_reply_media",
  domain: "reviews",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.reviews.manage",
  confirmation: "medium_plus",
  requiredSlots: ["reviewId", "assetId"],
  optionalSlots: [],
  description: "Убрать медиа из ответа.",
  plannerHints: ["Use review.remove_reply_media to unlink media from a review reply."],
  preview: previewReviewMutation,
  execute: executeReviewReplyMediaRemove,
});
