import { defineCrmAgentAction } from "../define-action";
import { executeUpdateServiceCopy, previewSitePayload } from "./site-helpers";

export const siteUpdateServiceCopyAction = defineCrmAgentAction({
  name: "site.update_service_copy",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId"],
  optionalSlots: ["name", "description", "searchKeywords", "synonyms"],
  description: "Изменить текст услуги на сайте.",
  plannerHints: ["Use site.update_service_copy to update service public name or description."],
  preview: previewSitePayload,
  execute: executeUpdateServiceCopy,
});
