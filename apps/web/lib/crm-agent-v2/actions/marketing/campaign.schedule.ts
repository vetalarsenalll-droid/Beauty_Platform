import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignScheduleAction = defineCrmAgentAction({
  name: "campaign.schedule",
  domain: "marketing",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: ["campaignId", "scheduledAt"],
  optionalSlots: [],
  description: "Запланировать отправку.",
  plannerHints: ["Use campaign.schedule when campaignId and scheduledAt are known."],
  preview: (payload, ctx) => previewCampaignAction("campaign.schedule", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.schedule", payload, ctx),
});
