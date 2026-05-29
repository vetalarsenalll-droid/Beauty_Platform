import { defineCrmAgentAction } from "../define-action";
import { readCampaignAction } from "./marketing-helpers";

export const campaignAnalyzeConversionsAction = defineCrmAgentAction({
  name: "campaign.analyze_conversions",
  domain: "marketing",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["campaignId"],
  description: "Проанализировать конверсии.",
  plannerHints: ["Use campaign.analyze_conversions to inspect campaign conversion metrics."],
  read: (payload, ctx) => readCampaignAction("campaign.analyze_conversions", payload, ctx),
});
