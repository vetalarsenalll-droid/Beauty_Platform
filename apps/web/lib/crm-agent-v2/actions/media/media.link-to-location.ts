import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaLinkToLocationAction = defineCrmAgentAction({
  name: "media.link_to_location",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Привязать медиа к филиалу.",
  plannerHints: ["Use media.link_to_location only after required slots are resolved and the user intent matches: Привязать медиа к филиалу."],
  preview: (payload, ctx) => previewMediaAction("media.link_to_location", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.link_to_location", payload, ctx),
});
