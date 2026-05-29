import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceMediaAttach } from "./service-write-helpers";

export const serviceAttachMediaAction = defineCrmAgentAction({
  name: "service.attach_media",
  domain: "services",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "assetId"],
  optionalSlots: ["sortOrder", "isCover"],
  description: "Прикрепить медиа к услуге.",
  plannerHints: ["Use service.attach_media only after required slots are resolved and the user intent matches: Прикрепить медиа к услуге."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, attached: true } }),
  execute: executeServiceMediaAttach,
});
