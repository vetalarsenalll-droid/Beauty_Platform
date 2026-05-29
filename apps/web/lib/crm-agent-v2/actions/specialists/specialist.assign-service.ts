import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistServiceAssign, previewSpecialistRelation } from "./specialist-write-helpers";

export const specialistAssignServiceAction = defineCrmAgentAction({
  name: "specialist.assign_service",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId", "serviceId"],
  optionalSlots: ["priceOverride", "durationOverrideMin"],
  description: "Привязать услугу к специалисту.",
  plannerHints: ["Use specialist.assign_service only after required slots are resolved and the user intent matches: Привязать услугу к специалисту."],
  preview: (payload, ctx) => previewSpecialistRelation(payload, ctx, { serviceId: payload.serviceId, assigned: true }),
  execute: executeSpecialistServiceAssign,
});
