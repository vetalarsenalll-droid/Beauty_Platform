import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaUpdateAltAction = defineCrmAgentAction({
  name: "media.update_alt",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.media.update",
  confirmation: "never",
  requiredSlots: ["assetId", "altText"],
  optionalSlots: [],
  description: "Изменить alt-текст.",
  plannerHints: ["Use media.update_alt after assetId and altText are known."],
  preview: (payload, ctx) => previewMediaAction("media.update_alt", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.update_alt", payload, ctx),
});
