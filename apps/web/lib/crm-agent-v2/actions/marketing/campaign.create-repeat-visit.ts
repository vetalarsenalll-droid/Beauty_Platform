import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCreateRepeatVisitAction = defineCrmAgentAction({
  name: "campaign.create_repeat_visit",
  domain: "marketing",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "goal", "audience", "clientIds", "segment", "offer", "content", "message", "subject", "channels"],
  description: "Создать кампанию повторного визита.",
  plannerHints: ["Use campaign.create_repeat_visit to create a DRAFT campaign for repeat visits."],
  preview: (payload, ctx) => previewCampaignAction("campaign.create_repeat_visit", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.create_repeat_visit", payload, ctx),
});
