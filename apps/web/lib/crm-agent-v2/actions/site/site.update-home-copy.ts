import { defineCrmAgentAction } from "../define-action";
import { executeUpdateHomeCopy, previewSitePayload } from "./site-helpers";

export const siteUpdateHomeCopyAction = defineCrmAgentAction({
  name: "site.update_home_copy",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: ["description", "phone", "email", "address", "websiteUrl", "instagramUrl", "whatsappUrl", "telegramUrl", "maxUrl", "vkUrl"],
  description: "Изменить текст главной.",
  plannerHints: ["Use site.update_home_copy to update public account profile copy and contacts."],
  preview: previewSitePayload,
  execute: executeUpdateHomeCopy,
});
