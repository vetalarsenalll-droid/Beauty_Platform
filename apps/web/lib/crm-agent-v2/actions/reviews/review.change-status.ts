import { defineCrmAgentAction } from "../define-action";
import { executeReviewStatusChange, previewReviewMutation } from "./review-write-helpers";

export const reviewChangeStatusAction = defineCrmAgentAction({
  name: "review.change_status",
  domain: "reviews",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.reviews.manage",
  confirmation: "medium_plus",
  requiredSlots: ["reviewId", "status"],
  optionalSlots: ["moderationReason"],
  description: "Изменить статус отзыва.",
  plannerHints: ["Use review.change_status for one review moderation status change."],
  preview: previewReviewMutation,
  execute: executeReviewStatusChange,
});
