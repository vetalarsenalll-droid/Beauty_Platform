import { defineCrmAgentAction } from "../define-action";
import { executeMediaAction, previewMediaAction } from "./media-helpers";

export const mediaCreateCollectionAction = defineCrmAgentAction({
  name: "media.create_collection",
  domain: "media",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.media.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Создать коллекцию.",
  plannerHints: ["Use media.create_collection only after required slots are resolved and the user intent matches: Создать коллекцию."],
  preview: (payload, ctx) => previewMediaAction("media.create_collection", payload, ctx),
  execute: (payload, ctx) => executeMediaAction("media.create_collection", payload, ctx),
});
