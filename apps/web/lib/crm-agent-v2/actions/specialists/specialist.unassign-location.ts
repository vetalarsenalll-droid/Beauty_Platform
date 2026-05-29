import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistLocationUnassign, previewSpecialistRelation } from "./specialist-write-helpers";

export const specialistUnassignLocationAction = defineCrmAgentAction({
  name: "specialist.unassign_location",
  domain: "specialists",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.specialists.update",
  confirmation: "always",
  requiredSlots: ["specialistId", "locationId"],
  optionalSlots: [],
  description: "Отвязать филиал от специалиста.",
  plannerHints: ["Use specialist.unassign_location only after required slots are resolved and the user intent matches: Отвязать филиал от специалиста."],
  preview: (payload, ctx) => previewSpecialistRelation(payload, ctx, { locationId: payload.locationId, assigned: false }),
  execute: executeSpecialistLocationUnassign,
});
