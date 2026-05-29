import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistServiceUnassign, previewSpecialistRelation } from "./specialist-write-helpers";

export const specialistUnassignServiceAction = defineCrmAgentAction({
  name: "specialist.unassign_service",
  domain: "specialists",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.specialists.update",
  confirmation: "always",
  requiredSlots: ["specialistId", "serviceId"],
  optionalSlots: [],
  description: "Отвязать услугу от специалиста.",
  plannerHints: ["Use specialist.unassign_service only after required slots are resolved and the user intent matches: Отвязать услугу от специалиста."],
  preview: (payload, ctx) => previewSpecialistRelation(payload, ctx, { serviceId: payload.serviceId, assigned: false }),
  execute: executeSpecialistServiceUnassign,
});
