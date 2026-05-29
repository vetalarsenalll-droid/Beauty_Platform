import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaArchiveAction = defineCrmAgentAction({
  name: "media.archive",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.media.update",
  confirmation: "always",
  requiredSlots: ["assetId"],
  optionalSlots: [],
  description: "Архивировать медиа.",
  plannerHints: ["Use media.archive only after the media asset is confirmed."],
  preview: (payload, ctx) => previewMediaAction("media.archive", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.archive", payload, ctx),
});
