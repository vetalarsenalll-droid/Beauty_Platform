import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationMediaDetach } from "./location-write-helpers";

export const locationDetachMediaAction = defineCrmAgentAction({
  name: "location.detach_media",
  domain: "locations",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId", "assetId"],
  optionalSlots: [],
  description: "Открепить медиа от филиала.",
  plannerHints: ["Use location.detach_media only after required slots are resolved and the user intent matches: Открепить медиа от филиала."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, attached: false } }),
  execute: executeLocationMediaDetach,
});
