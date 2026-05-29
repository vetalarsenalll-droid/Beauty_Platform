import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaLinkToAccountAction = defineCrmAgentAction({
  name: "media.link_to_account",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Привязать медиа к аккаунту.",
  plannerHints: ["Use media.link_to_account only after required slots are resolved and the user intent matches: Привязать медиа к аккаунту."],
  preview: (payload, ctx) => previewMediaAction("media.link_to_account", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.link_to_account", payload, ctx),
});
