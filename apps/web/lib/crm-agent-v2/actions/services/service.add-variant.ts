import { buildActionPreview } from "../action-preview";
import { defineCrmAgentAction } from "../define-action";
import { executeServiceVariantAdd } from "./service-write-helpers";

export const serviceAddVariantAction = defineCrmAgentAction({
  name: "service.add_variant",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "name"],
  optionalSlots: ["durationMin", "price"],
  description: "Добавить вариант услуги.",
  plannerHints: ["Use service.add_variant only after required slots are resolved and the user intent matches: Добавить вариант услуги."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: executeServiceVariantAdd,
});
