import { defineCrmAgentAction } from "../define-action";
import { workloadAnalytics } from "./analytics-read-helpers";

export const analyticsWorkloadAction = defineCrmAgentAction({
  name: "analytics.workload",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Анализ загрузки.",
  plannerHints: ["Use analytics.workload when the user asks to inspect: Анализ загрузки."],
  read: async (payload, ctx) => ({ workload: await workloadAnalytics(ctx.accountId, payload) }),
});
