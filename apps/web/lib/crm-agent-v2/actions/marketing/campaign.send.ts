import { defineCrmAgentAction } from "../define-action";
import { executeCampaignAction, previewCampaignAction } from "./marketing-helpers";

export const campaignSendAction = defineCrmAgentAction({
  name: "campaign.send",
  domain: "marketing",
  kind: "system",
  intent: "notify",
  status: "implemented",
  risk: "critical",
  permission: "crm.marketing.send",
  confirmation: "separate_sensitive_confirm",
  requiredSlots: ["campaignId"],
  optionalSlots: [],
  description: "Отправить кампанию.",
  plannerHints: ["Use campaign.send only after explicit user confirmation; delivery is asynchronous through the CRM Agent campaign worker."],
  preview: (payload, ctx) => previewCampaignAction("campaign.send", payload, ctx),
  execute: (payload, ctx) => executeCampaignAction("campaign.send", payload, ctx),
});
