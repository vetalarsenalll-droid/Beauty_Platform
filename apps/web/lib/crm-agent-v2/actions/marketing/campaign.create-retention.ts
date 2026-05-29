import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCreateRetentionAction = defineCrmAgentAction({
  name: "campaign.create_retention",
  domain: "marketing",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "goal", "audience", "clientIds", "segment", "offer", "content", "message", "subject", "channels"],
  description: "Создать retention-кампанию.",
  plannerHints: ["Use campaign.create_retention to create a DRAFT campaign for retention messaging."],
  preview: (payload, ctx) => previewCampaignAction("campaign.create_retention", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.create_retention", payload, ctx),
});
