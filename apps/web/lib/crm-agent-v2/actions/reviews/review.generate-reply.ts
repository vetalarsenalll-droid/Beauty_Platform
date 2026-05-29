import { defineCrmAgentAction } from "../define-action";
import { previewGeneratedReply } from "./review-write-helpers";

export const reviewGenerateReplyAction = defineCrmAgentAction({
  name: "review.generate_reply",
  domain: "reviews",
  kind: "generate",
  intent: "update",
  status: "draft_only",
  risk: "medium",
  permission: "crm.reviews.manage",
  confirmation: "medium_plus",
  requiredSlots: ["reviewId"],
  optionalSlots: ["tone"],
  description: "Сгенерировать черновик ответа.",
  plannerHints: ["Use review.generate_reply to prepare a reply draft without publishing it."],
  preview: previewGeneratedReply,
});
