import { defineCrmAgentAction } from "../define-action";
import { previewProcessFix } from "./review-write-helpers";

export const reviewSuggestProcessFixAction = defineCrmAgentAction({
  name: "review.suggest_process_fix",
  domain: "reviews",
  kind: "generate",
  intent: "analyze",
  status: "draft_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "clientId", "appointmentId", "take"],
  description: "Предложить улучшения процесса по отзывам.",
  plannerHints: ["Use review.suggest_process_fix to draft operational recommendations from complaint themes."],
  preview: previewProcessFix,
});
