import { defineCrmAgentAction } from "../define-action";
import { revenueAnalytics } from "./analytics-read-helpers";

export const analyticsRevenueAction = defineCrmAgentAction({
  name: "analytics.revenue",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.finance.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Анализ выручки.",
  plannerHints: ["Use analytics.revenue when the user asks to inspect: Анализ выручки."],
  read: async (payload, ctx) => ({ revenue: await revenueAnalytics(ctx.accountId, payload) }),
});
