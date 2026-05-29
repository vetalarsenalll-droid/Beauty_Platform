import { defineCrmAgentAction } from "../define-action";
import { executeServiceRelationPreview, executeServiceSpecialistUnassign } from "./service-write-helpers";

export const serviceUnassignSpecialistAction = defineCrmAgentAction({
  name: "service.unassign_specialist",
  domain: "services",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.services.update",
  confirmation: "always",
  requiredSlots: ["serviceId", "specialistId"],
  optionalSlots: [],
  description: "Отвязать специалиста от услуги.",
  plannerHints: ["Use service.unassign_specialist only after required slots are resolved and the user intent matches: Отвязать специалиста от услуги."],
  preview: (payload, ctx) => executeServiceRelationPreview(payload, ctx, { specialistId: payload.specialistId, assigned: false }),
  execute: executeServiceSpecialistUnassign,
});
