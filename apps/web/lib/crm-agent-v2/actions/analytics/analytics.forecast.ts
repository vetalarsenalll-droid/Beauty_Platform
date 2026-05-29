import { defineCrmAgentAction } from "../define-action";
import { forecastAnalytics } from "./analytics-read-helpers";

export const analyticsForecastAction = defineCrmAgentAction({
  name: "analytics.forecast",
  domain: "analytics",
  kind: "generate",
  intent: "execute",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Прогноз.",
  plannerHints: ["Use analytics.forecast only after required slots are resolved and the user intent matches: Прогноз."],
  read: async (payload, ctx) => ({ forecast: await forecastAnalytics(ctx.accountId, payload) }),
});
