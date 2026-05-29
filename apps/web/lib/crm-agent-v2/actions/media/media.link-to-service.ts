import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaLinkToServiceAction = defineCrmAgentAction({
  name: "media.link_to_service",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Привязать медиа к услуге.",
  plannerHints: ["Use media.link_to_service only after required slots are resolved and the user intent matches: Привязать медиа к услуге."],
  preview: (payload, ctx) => previewMediaAction("media.link_to_service", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.link_to_service", payload, ctx),
});
