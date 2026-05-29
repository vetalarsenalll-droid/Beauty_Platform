import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceMediaDetach } from "./service-write-helpers";

export const serviceDetachMediaAction = defineCrmAgentAction({
  name: "service.detach_media",
  domain: "services",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "assetId"],
  optionalSlots: [],
  description: "Открепить медиа от услуги.",
  plannerHints: ["Use service.detach_media only after required slots are resolved and the user intent matches: Открепить медиа от услуги."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, attached: false } }),
  execute: executeServiceMediaDetach,
});
