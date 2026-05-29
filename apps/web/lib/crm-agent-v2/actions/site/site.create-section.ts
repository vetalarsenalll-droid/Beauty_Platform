import { defineCrmAgentAction } from "../define-action";
import { executeCreateSection, previewSitePayload } from "./site-helpers";

export const siteCreateSectionAction = defineCrmAgentAction({
  name: "site.create_section",
  domain: "site",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["key"],
  optionalSlots: ["title", "sortOrder", "isVisible", "layoutPreset"],
  description: "Создать секцию страницы.",
  plannerHints: ["Use site.create_section to add a structured public page section."],
  preview: previewSitePayload,
  execute: executeCreateSection,
});
