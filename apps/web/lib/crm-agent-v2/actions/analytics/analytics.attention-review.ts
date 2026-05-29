import { defineCrmAgentAction } from "../define-action";
import { attentionReviewAnalytics } from "./analytics-read-helpers";

export const analyticsAttentionReviewAction = defineCrmAgentAction({
  name: "analytics.attention_review",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Что требует внимания.",
  plannerHints: ["Use analytics.attention_review when the user asks to inspect: Что требует внимания."],
  read: async (payload, ctx) => ({ attentionReview: await attentionReviewAnalytics(ctx.accountId, payload) }),
});
