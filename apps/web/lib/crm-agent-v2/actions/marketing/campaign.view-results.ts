import { defineCrmAgentAction } from "../define-action";
import { readCampaignAction } from "./marketing-helpers";

export const campaignViewResultsAction = defineCrmAgentAction({
  name: "campaign.view_results",
  domain: "marketing",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.marketing.read",
  confirmation: "never",
  requiredSlots: ["campaignId"],
  optionalSlots: [],
  description: "Показать результаты.",
  plannerHints: ["Use campaign.view_results when campaignId is known and the user wants delivery or result details."],
  read: (payload, ctx) => readCampaignAction("campaign.view_results", payload, ctx),
});
