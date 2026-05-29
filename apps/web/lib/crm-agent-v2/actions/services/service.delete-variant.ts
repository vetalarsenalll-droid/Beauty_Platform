import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceVariantDelete } from "./service-write-helpers";

export const serviceDeleteVariantAction = defineCrmAgentAction({
  name: "service.delete_variant",
  domain: "services",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.services.update",
  confirmation: "always",
  requiredSlots: ["serviceId", "variantId"],
  optionalSlots: [],
  description: "Удалить вариант услуги.",
  plannerHints: ["Use service.delete_variant only after required slots are resolved and the user intent matches: Удалить вариант услуги."],
  preview: async (payload) => buildActionPreview({ after: { ...payload, deleted: true } }),
  execute: executeServiceVariantDelete,
});
