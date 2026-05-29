import { defineCrmAgentAction } from "../define-action";
import { emptyWindowsAnalytics } from "./analytics-read-helpers";

export const analyticsEmptyWindowsAction = defineCrmAgentAction({
  name: "analytics.empty_windows",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Анализ пустых окон.",
  plannerHints: ["Use analytics.empty_windows when the user asks to inspect: Анализ пустых окон."],
  read: async (payload, ctx) => ({ emptyWindows: await emptyWindowsAnalytics(ctx.accountId, payload) }),
});
