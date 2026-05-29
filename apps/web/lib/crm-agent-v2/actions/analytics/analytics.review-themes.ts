import { defineCrmAgentAction } from "../define-action";
import { reviewAnalytics } from "./analytics-read-helpers";

export const analyticsReviewThemesAction = defineCrmAgentAction({
  name: "analytics.review_themes",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Темы отзывов.",
  plannerHints: ["Use analytics.review_themes when the user asks to inspect: Темы отзывов."],
  read: async (payload, ctx) => ({ reviewThemes: await reviewAnalytics(ctx.accountId, payload) }),
});
