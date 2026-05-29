import { defineCrmAgentAction } from "../define-action";
import { executeDeleteSection, previewSitePayload } from "./site-helpers";

export const siteDeleteSectionAction = defineCrmAgentAction({
  name: "site.delete_section",
  domain: "site",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: ["sectionId"],
  optionalSlots: [],
  description: "Удалить секцию.",
  plannerHints: ["Use site.delete_section to remove a section and its blocks."],
  preview: previewSitePayload,
  execute: executeDeleteSection,
});
