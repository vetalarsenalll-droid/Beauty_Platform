import { defineCrmAgentAction } from "../define-action";
import { topClientsAnalytics } from "./analytics-read-helpers";

export const analyticsTopClientsAction = defineCrmAgentAction({
  name: "analytics.top_clients",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Топ клиентов.",
  plannerHints: ["Use analytics.top_clients when the user asks to inspect: Топ клиентов."],
  read: async (payload, ctx) => ({ topClients: await topClientsAnalytics(ctx.accountId, payload) }),
});
