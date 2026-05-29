import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignPauseAction = defineCrmAgentAction({
  name: "campaign.pause",
  domain: "marketing",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.marketing.manage",
  confirmation: "medium_plus",
  requiredSlots: ["campaignId"],
  optionalSlots: [],
  description: "Поставить кампанию на паузу.",
  plannerHints: ["Use campaign.pause when campaignId is known."],
  preview: (payload, ctx) => previewCampaignAction("campaign.pause", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.pause", payload, ctx),
});
