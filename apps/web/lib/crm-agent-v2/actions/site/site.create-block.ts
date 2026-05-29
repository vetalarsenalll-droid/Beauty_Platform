import { defineCrmAgentAction } from "../define-action";
import { executeCreateBlock, previewSitePayload } from "./site-helpers";

export const siteCreateBlockAction = defineCrmAgentAction({
  name: "site.create_block",
  domain: "site",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["sectionId", "type"],
  optionalSlots: ["contentJson", "sortOrder"],
  description: "Создать блок.",
  plannerHints: ["Use site.create_block to add a block to an existing public page section."],
  preview: previewSitePayload,
  execute: executeCreateBlock,
});
