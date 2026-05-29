import { defineCrmAgentAction } from "../define-action";
import { growthOpportunitiesAnalytics } from "./analytics-read-helpers";

export const analyticsFindGrowthOpportunitiesAction = defineCrmAgentAction({
  name: "analytics.find_growth_opportunities",
  domain: "analytics",
  kind: "generate",
  intent: "execute",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Найти точки роста.",
  plannerHints: ["Use analytics.find_growth_opportunities only after required slots are resolved and the user intent matches: Найти точки роста."],
  read: async (payload, ctx) => ({ growthOpportunities: await growthOpportunitiesAnalytics(ctx.accountId, payload) }),
});
