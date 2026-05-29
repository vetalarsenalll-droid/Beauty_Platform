import { defineCrmAgentAction } from "../define-action";
import { executeUpdateHomeCopy, previewSitePayload } from "./site-helpers";

export const siteUpdateContactsAction = defineCrmAgentAction({
  name: "site.update_contacts",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: ["phone", "email", "address", "websiteUrl", "instagramUrl", "whatsappUrl", "telegramUrl", "maxUrl", "vkUrl", "viberUrl", "pinterestUrl"],
  description: "Изменить контакты сайта.",
  plannerHints: ["Use site.update_contacts to update public contact fields."],
  preview: previewSitePayload,
  execute: executeUpdateHomeCopy,
});
