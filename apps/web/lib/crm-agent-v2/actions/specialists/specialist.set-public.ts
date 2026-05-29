import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistProfileUpdate, previewSpecialistProfileUpdate } from "./specialist-write-helpers";

export const specialistSetPublicAction = defineCrmAgentAction({
  name: "specialist.set_public",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId", "isPublic"],
  optionalSlots: [],
  description: "Сделать специалиста публичным.",
  plannerHints: ["Use specialist.set_public only after required slots are resolved and the user intent matches: Сделать специалиста публичным."],
  preview: previewSpecialistProfileUpdate,
  execute: executeSpecialistProfileUpdate,
});
