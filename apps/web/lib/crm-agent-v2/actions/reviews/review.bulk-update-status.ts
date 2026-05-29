import { defineCrmAgentAction } from "../define-action";
import { executeReviewBulkStatusChange, previewReviewMutation } from "./review-write-helpers";

export const reviewBulkUpdateStatusAction = defineCrmAgentAction({
  name: "review.bulk_update_status",
  domain: "reviews",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.reviews.manage",
  confirmation: "always",
  requiredSlots: ["reviewIds", "status"],
  optionalSlots: ["moderationReason"],
  description: "Массово изменить статусы отзывов.",
  plannerHints: ["Use review.bulk_update_status only after the exact reviewIds set is confirmed."],
  preview: previewReviewMutation,
  execute: executeReviewBulkStatusChange,
});
