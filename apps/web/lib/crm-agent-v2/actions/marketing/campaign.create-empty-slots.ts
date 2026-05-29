import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignCreateEmptySlotsAction = defineCrmAgentAction({
  name: "campaign.create_empty_slots",
  domain: "marketing",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.marketing.manage",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["title", "goal", "audience", "clientIds", "segment", "offer", "content", "message", "subject", "channels"],
  description: "Создать кампанию на пустые окна.",
  plannerHints: ["Use campaign.create_empty_slots to create a DRAFT campaign for filling available schedule slots."],
  preview: (payload, ctx) => previewCampaignAction("campaign.create_empty_slots", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.create_empty_slots", payload, ctx),
});
