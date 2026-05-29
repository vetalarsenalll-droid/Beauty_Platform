import { defineCrmAgentAction } from "../define-action";
import { cancellationAnalytics } from "./analytics-read-helpers";

export const analyticsCancellationsAction = defineCrmAgentAction({
  name: "analytics.cancellations",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Анализ отмен.",
  plannerHints: ["Use analytics.cancellations when the user asks to inspect: Анализ отмен."],
  read: async (payload, ctx) => ({ cancellations: await cancellationAnalytics(ctx.accountId, payload) }),
});
