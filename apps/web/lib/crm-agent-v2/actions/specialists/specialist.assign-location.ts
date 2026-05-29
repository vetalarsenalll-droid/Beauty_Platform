import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistLocationAssign, previewSpecialistRelation } from "./specialist-write-helpers";

export const specialistAssignLocationAction = defineCrmAgentAction({
  name: "specialist.assign_location",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId", "locationId"],
  optionalSlots: [],
  description: "Привязать филиал к специалисту.",
  plannerHints: ["Use specialist.assign_location only after required slots are resolved and the user intent matches: Привязать филиал к специалисту."],
  preview: (payload, ctx) => previewSpecialistRelation(payload, ctx, { locationId: payload.locationId, assigned: true }),
  execute: executeSpecialistLocationAssign,
});
