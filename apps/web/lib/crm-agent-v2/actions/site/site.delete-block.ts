import { defineCrmAgentAction } from "../define-action";
import { executeDeleteBlock, previewSitePayload } from "./site-helpers";

export const siteDeleteBlockAction = defineCrmAgentAction({
  name: "site.delete_block",
  domain: "site",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: ["blockId"],
  optionalSlots: [],
  description: "Удалить блок.",
  plannerHints: ["Use site.delete_block to remove one public page block."],
  preview: previewSitePayload,
  execute: executeDeleteBlock,
});
