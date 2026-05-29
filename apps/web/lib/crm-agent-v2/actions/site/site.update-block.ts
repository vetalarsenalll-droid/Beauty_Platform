import { defineCrmAgentAction } from "../define-action";
import { executeUpdateBlock, previewSitePayload } from "./site-helpers";

export const siteUpdateBlockAction = defineCrmAgentAction({
  name: "site.update_block",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.settings.update",
  confirmation: "medium_plus",
  requiredSlots: ["blockId"],
  optionalSlots: ["type", "contentJson", "sortOrder"],
  description: "Изменить блок.",
  plannerHints: ["Use site.update_block to update one public page block."],
  preview: previewSitePayload,
  execute: executeUpdateBlock,
});
