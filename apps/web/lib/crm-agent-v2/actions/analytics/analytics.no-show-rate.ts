import { defineCrmAgentAction } from "../define-action";
import { noShowAnalytics } from "./analytics-read-helpers";

export const analyticsNoShowRateAction = defineCrmAgentAction({
  name: "analytics.no_show_rate",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Анализ неявок.",
  plannerHints: ["Use analytics.no_show_rate when the user asks to inspect: Анализ неявок."],
  read: async (payload, ctx) => ({ noShowRate: await noShowAnalytics(ctx.accountId, payload) }),
});
