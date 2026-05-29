import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceVariantUpdate } from "./service-write-helpers";

export const serviceUpdateVariantAction = defineCrmAgentAction({
  name: "service.update_variant",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "variantId"],
  optionalSlots: ["name", "durationMin", "price"],
  description: "Изменить вариант услуги.",
  plannerHints: ["Use service.update_variant only after required slots are resolved and the user intent matches: Изменить вариант услуги."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeServiceVariantUpdate,
});
