import { defineCrmAgentAction } from "../define-action";
import { executeUpdateSection, previewSitePayload } from "./site-helpers";

export const siteUpdateSectionAction = defineCrmAgentAction({
  name: "site.update_section",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["sectionId"],
  optionalSlots: ["key", "title", "sortOrder", "isVisible", "layoutPreset"],
  description: "Изменить секцию.",
  plannerHints: ["Use site.update_section to change title, order, layout or visibility."],
  preview: previewSitePayload,
  execute: executeUpdateSection,
});
