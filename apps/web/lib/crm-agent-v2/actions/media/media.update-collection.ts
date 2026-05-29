import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaUpdateCollectionAction = defineCrmAgentAction({
  name: "media.update_collection",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить коллекцию.",
  plannerHints: ["Use media.update_collection only after required slots are resolved and the user intent matches: Изменить коллекцию."],
  preview: (payload, ctx) => previewMediaAction("media.update_collection", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.update_collection", payload, ctx),
});
