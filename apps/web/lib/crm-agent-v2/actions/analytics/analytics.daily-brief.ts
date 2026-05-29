import { defineCrmAgentAction } from "../define-action";
import { briefAnalytics } from "./analytics-read-helpers";

export const analyticsDailyBriefAction = defineCrmAgentAction({
  name: "analytics.daily_brief",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["take"],
  description: "Дневной бриф.",
  plannerHints: ["Use analytics.daily_brief when the user asks to inspect: Дневной бриф."],
  read: async (payload, ctx) => ({ dailyBrief: await briefAnalytics(ctx.accountId, payload, 1) }),
});
