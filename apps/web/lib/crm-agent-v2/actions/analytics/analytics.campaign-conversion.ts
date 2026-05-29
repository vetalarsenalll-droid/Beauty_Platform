import { defineCrmAgentAction } from "../define-action";
import { campaignConversionAnalytics } from "./analytics-read-helpers";

export const analyticsCampaignConversionAction = defineCrmAgentAction({
  name: "analytics.campaign_conversion",
  domain: "analytics",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "take"],
  description: "Конверсия кампаний.",
  plannerHints: ["Use analytics.campaign_conversion when the user asks to inspect: Конверсия кампаний."],
  read: async (payload, ctx) => ({ campaignConversion: await campaignConversionAnalytics(ctx.accountId, payload) }),
});
