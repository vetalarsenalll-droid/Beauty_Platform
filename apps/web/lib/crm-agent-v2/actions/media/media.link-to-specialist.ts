import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaLinkToSpecialistAction = defineCrmAgentAction({
  name: "media.link_to_specialist",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Привязать медиа к специалисту.",
  plannerHints: ["Use media.link_to_specialist only after required slots are resolved and the user intent matches: Привязать медиа к специалисту."],
  preview: (payload, ctx) => previewMediaAction("media.link_to_specialist", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.link_to_specialist", payload, ctx),
});
