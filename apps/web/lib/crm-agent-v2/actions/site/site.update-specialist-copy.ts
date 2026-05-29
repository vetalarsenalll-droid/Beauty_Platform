import { defineCrmAgentAction } from "../define-action";
import { executeUpdateSpecialistCopy, previewSitePayload } from "./site-helpers";

export const siteUpdateSpecialistCopyAction = defineCrmAgentAction({
  name: "site.update_specialist_copy",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId"],
  optionalSlots: ["bio", "isPublic"],
  description: "Изменить текст специалиста на сайте.",
  plannerHints: ["Use site.update_specialist_copy to update specialist public bio or visibility."],
  preview: previewSitePayload,
  execute: executeUpdateSpecialistCopy,
});
