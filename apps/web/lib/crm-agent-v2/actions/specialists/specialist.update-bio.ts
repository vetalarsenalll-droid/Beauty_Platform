import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistProfileUpdate, previewSpecialistProfileUpdate } from "./specialist-write-helpers";

export const specialistUpdateBioAction = defineCrmAgentAction({
  name: "specialist.update_bio",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId", "bio"],
  optionalSlots: [],
  description: "Изменить био специалиста.",
  plannerHints: ["Use specialist.update_bio only after required slots are resolved and the user intent matches: Изменить био специалиста."],
  preview: previewSpecialistProfileUpdate,
  execute: executeSpecialistProfileUpdate,
});
