import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCreateBirthdayAction = defineCrmAgentAction({
  name: "campaign.create_birthday",
  domain: "marketing",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "goal", "audience", "clientIds", "segment", "offer", "content", "message", "subject", "channels"],
  description: "Создать birthday-кампанию.",
  plannerHints: ["Use campaign.create_birthday to create a DRAFT campaign for birthday messaging."],
  preview: (payload, ctx) => previewCampaignAction("campaign.create_birthday", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.create_birthday", payload, ctx),
});
