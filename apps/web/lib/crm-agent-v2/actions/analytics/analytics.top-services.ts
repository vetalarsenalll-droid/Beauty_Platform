import { defineCrmAgentAction } from "../define-action";
import { topServicesAnalytics } from "./analytics-read-helpers";

export const analyticsTopServicesAction = defineCrmAgentAction({
  name: "analytics.top_services",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Топ услуг.",
  plannerHints: ["Use analytics.top_services when the user asks to inspect: Топ услуг."],
  read: async (payload, ctx) => ({ topServices: await topServicesAnalytics(ctx.accountId, payload) }),
});
