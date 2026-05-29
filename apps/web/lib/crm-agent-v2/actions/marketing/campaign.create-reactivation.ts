import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCreateReactivationAction = defineCrmAgentAction({
  name: "campaign.create_reactivation",
  domain: "marketing",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "goal", "audience", "clientIds", "segment", "offer", "content", "message", "subject", "channels"],
  description: "Создать reactivation-кампанию.",
  plannerHints: ["Use campaign.create_reactivation to create a DRAFT campaign for inactive clients."],
  preview: (payload, ctx) => previewCampaignAction("campaign.create_reactivation", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.create_reactivation", payload, ctx),
});
