import { defineCrmAgentAction } from "../define-action";
import { executeServiceRelationPreview, executeServiceSpecialistAssign } from "./service-write-helpers";

export const serviceAssignSpecialistAction = defineCrmAgentAction({
  name: "service.assign_specialist",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.services.update",
  confirmation: "medium_plus",
  requiredSlots: ["serviceId", "specialistId"],
  optionalSlots: ["priceOverride", "durationOverrideMin"],
  description: "Привязать специалиста к услуге.",
  plannerHints: ["Use service.assign_specialist only after required slots are resolved and the user intent matches: Привязать специалиста к услуге."],
  preview: (payload, ctx) => executeServiceRelationPreview(payload, ctx, { specialistId: payload.specialistId, assigned: true }),
  execute: executeServiceSpecialistAssign,
});
