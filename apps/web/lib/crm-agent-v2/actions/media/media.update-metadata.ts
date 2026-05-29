import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaUpdateMetadataAction = defineCrmAgentAction({
  name: "media.update_metadata",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: ["assetId"],
  optionalSlots: ["metadata"],
  description: "Изменить metadata.",
  plannerHints: ["Use media.update_metadata after assetId is known."],
  preview: (payload, ctx) => previewMediaAction("media.update_metadata", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.update_metadata", payload, ctx),
});
