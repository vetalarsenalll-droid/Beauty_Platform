import { defineCrmAgentAction } from "../define-action";
import { executeApplySiteChanges, previewSitePayload } from "./site-helpers";

export const siteApplyChangesAction = defineCrmAgentAction({
  name: "site.apply_changes",
  domain: "site",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Применить подготовленные изменения сайта.",
  plannerHints: ["Use site.apply_changes to publish the current public page draft as a new version."],
  preview: previewSitePayload,
  execute: executeApplySiteChanges,
});
