import { defineCrmAgentAction } from "../define-action";
import { decliningServicesAnalytics } from "./analytics-read-helpers";

export const analyticsDecliningServicesAction = defineCrmAgentAction({
  name: "analytics.declining_services",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["take"],
  description: "Найти услуги с падением спроса.",
  plannerHints: ["Use analytics.declining_services when the user asks to inspect: Найти услуги с падением спроса."],
  read: async (payload, ctx) => ({ decliningServices: await decliningServicesAnalytics(ctx.accountId, payload) }),
});
