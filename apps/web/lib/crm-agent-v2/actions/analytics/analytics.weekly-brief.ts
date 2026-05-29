import { defineCrmAgentAction } from "../define-action";
import { briefAnalytics } from "./analytics-read-helpers";

export const analyticsWeeklyBriefAction = defineCrmAgentAction({
  name: "analytics.weekly_brief",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["take"],
  description: "Недельный бриф.",
  plannerHints: ["Use analytics.weekly_brief when the user asks to inspect: Недельный бриф."],
  read: async (payload, ctx) => ({ weeklyBrief: await briefAnalytics(ctx.accountId, payload, 7) }),
});
