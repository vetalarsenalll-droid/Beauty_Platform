import { defineCrmAgentAction } from "../define-action";
import { underloadedSpecialistsAnalytics } from "./analytics-read-helpers";

export const analyticsUnderloadedSpecialistsAction = defineCrmAgentAction({
  name: "analytics.underloaded_specialists",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Найти недозагруженных специалистов.",
  plannerHints: ["Use analytics.underloaded_specialists when the user asks to inspect: Найти недозагруженных специалистов."],
  read: async (payload, ctx) => ({ underloadedSpecialists: await underloadedSpecialistsAnalytics(ctx.accountId, payload) }),
});
