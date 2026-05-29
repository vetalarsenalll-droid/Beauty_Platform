import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaUploadAction = defineCrmAgentAction({
  name: "media.upload",
  domain: "media",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.upload",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Загрузить медиа.",
  plannerHints: ["Use media.upload only after required slots are resolved and the user intent matches: Загрузить медиа."],
  preview: (payload, ctx) => previewMediaAction("media.upload", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.upload", payload, ctx),
});
