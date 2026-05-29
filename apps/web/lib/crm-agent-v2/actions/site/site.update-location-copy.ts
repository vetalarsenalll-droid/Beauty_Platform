import { defineCrmAgentAction } from "../define-action";
import { executeUpdateLocationCopy, previewSitePayload } from "./site-helpers";

export const siteUpdateLocationCopyAction = defineCrmAgentAction({
  name: "site.update_location_copy",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId"],
  optionalSlots: ["name", "description", "phone", "address", "websiteUrl", "instagramUrl", "whatsappUrl", "telegramUrl", "maxUrl", "vkUrl", "viberUrl", "pinterestUrl"],
  description: "Изменить текст филиала на сайте.",
  plannerHints: ["Use site.update_location_copy to update location public copy and contact fields."],
  preview: previewSitePayload,
  execute: executeUpdateLocationCopy,
});
