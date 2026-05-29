import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeLocationMediaAttach } from "./location-write-helpers";

export const locationAttachMediaAction = defineCrmAgentAction({
  name: "location.attach_media",
  domain: "locations",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.locations.update",
  confirmation: "medium_plus",
  requiredSlots: ["locationId", "assetId"],
  optionalSlots: ["sortOrder", "isCover"],
  description: "Прикрепить медиа к филиалу.",
  plannerHints: ["Use location.attach_media only after required slots are resolved and the user intent matches: Прикрепить медиа к филиалу."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, attached: true } }),
  execute: executeLocationMediaAttach,
});
