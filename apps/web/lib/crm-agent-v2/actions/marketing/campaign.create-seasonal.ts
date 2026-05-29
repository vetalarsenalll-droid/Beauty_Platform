import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCreateSeasonalAction = defineCrmAgentAction({
  name: "campaign.create_seasonal",
  domain: "marketing",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "goal", "audience", "clientIds", "segment", "offer", "content", "message", "subject", "channels"],
  description: "Создать сезонную кампанию.",
  plannerHints: ["Use campaign.create_seasonal to create a DRAFT campaign for seasonal messaging."],
  preview: (payload, ctx) => previewCampaignAction("campaign.create_seasonal", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.create_seasonal", payload, ctx),
});
