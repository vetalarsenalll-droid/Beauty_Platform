import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignUpdateOfferAction = defineCrmAgentAction({
  name: "campaign.update_offer",
  domain: "marketing",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.marketing.manage",
  confirmation: "medium_plus",
  requiredSlots: ["campaignId"],
  optionalSlots: ["offer"],
  description: "Изменить оффер.",
  plannerHints: ["Use campaign.update_offer after campaignId is known."],
  preview: (payload, ctx) => previewCampaignAction("campaign.update_offer", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.update_offer", payload, ctx),
});
