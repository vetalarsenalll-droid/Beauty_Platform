import { defineCrmAgentAction } from "../define-action";
import { executeReviewReplyMediaAttach, previewReviewMutation } from "./review-write-helpers";

export const reviewAttachReplyMediaAction = defineCrmAgentAction({
  name: "review.attach_reply_media",
  domain: "reviews",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.reviews.manage",
  confirmation: "medium_plus",
  requiredSlots: ["reviewId", "assetId"],
  optionalSlots: ["sortOrder"],
  description: "Прикрепить медиа к ответу.",
  plannerHints: ["Use review.attach_reply_media to link an existing media asset to a review reply."],
  preview: previewReviewMutation,
  execute: executeReviewReplyMediaAttach,
});
