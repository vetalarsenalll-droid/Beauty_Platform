import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignUpdateMessageAction = defineCrmAgentAction({
  name: "campaign.update_message",
  domain: "marketing",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.marketing.manage",
  confirmation: "medium_plus",
  requiredSlots: ["campaignId"],
  optionalSlots: ["content", "message", "subject"],
  description: "Изменить сообщение.",
  plannerHints: ["Use campaign.update_message after campaignId is known."],
  preview: (payload, ctx) => previewCampaignAction("campaign.update_message", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.update_message", payload, ctx),
});
