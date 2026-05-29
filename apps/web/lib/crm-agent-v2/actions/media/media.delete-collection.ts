import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaDeleteCollectionAction = defineCrmAgentAction({
  name: "media.delete_collection",
  domain: "media",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.media.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Удалить коллекцию.",
  plannerHints: ["Use media.delete_collection only after required slots are resolved and the user intent matches: Удалить коллекцию."],
  preview: (payload, ctx) => previewMediaAction("media.delete_collection", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.delete_collection", payload, ctx),
});
