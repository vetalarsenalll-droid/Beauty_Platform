import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignUpdateAudienceAction = defineCrmAgentAction({
  name: "campaign.update_audience",
  domain: "marketing",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: ["campaignId"],
  optionalSlots: ["audience", "clientIds", "segment", "channels"],
  description: "Изменить аудиторию.",
  plannerHints: ["Use campaign.update_audience after campaignId is known."],
  preview: (payload, ctx) => previewCampaignAction("campaign.update_audience", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.update_audience", payload, ctx),
});
