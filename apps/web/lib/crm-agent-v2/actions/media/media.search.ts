import { defineCrmAgentAction } from "../define-action";
import { readMediaAction } from "./media-helpers";

export const mediaSearchAction = defineCrmAgentAction({
  name: "media.search",
  domain: "media",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.media.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Найти медиа.",
  plannerHints: ["Use media.search when the user asks to inspect: Найти медиа."],
  read: (payload, ctx) => readMediaAction("media.search", payload, ctx),
});
