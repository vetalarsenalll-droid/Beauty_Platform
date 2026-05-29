import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaUnlinkAction = defineCrmAgentAction({
  name: "media.unlink",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Отвязать медиа.",
  plannerHints: ["Use media.unlink only after required slots are resolved and the user intent matches: Отвязать медиа."],
  preview: (payload, ctx) => previewMediaAction("media.unlink", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.unlink", payload, ctx),
});
