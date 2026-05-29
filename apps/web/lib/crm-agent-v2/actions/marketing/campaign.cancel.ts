import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCancelAction = defineCrmAgentAction({
  name: "campaign.cancel",
  domain: "marketing",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: ["campaignId"],
  optionalSlots: [],
  description: "Отменить кампанию.",
  plannerHints: ["Use campaign.cancel when campaignId is known."],
  preview: (payload, ctx) => previewCampaignAction("campaign.cancel", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.cancel", payload, ctx),
});
