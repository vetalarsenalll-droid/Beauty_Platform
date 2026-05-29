import { defineCrmAgentAction } from "../define-action";
import { readCampaignAction } from "./marketing-helpers";

export const campaignPreviewAudienceAction = defineCrmAgentAction({
  name: "campaign.preview_audience",
  domain: "marketing",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "medium",
  permission: "crm.marketing.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["audience", "clientIds", "segment", "channels"],
  description: "Показать аудиторию кампании.",
  plannerHints: ["Use campaign.preview_audience to inspect a consent-aware client audience before creating or sending a campaign."],
  read: (payload, ctx) => readCampaignAction("campaign.preview_audience", payload, ctx),
});
