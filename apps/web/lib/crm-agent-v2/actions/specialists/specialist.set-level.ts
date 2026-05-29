import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistLevelSet, previewSpecialistProfileUpdate } from "./specialist-write-helpers";

export const specialistSetLevelAction = defineCrmAgentAction({
  name: "specialist.set_level",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId"],
  optionalSlots: ["levelId"],
  description: "Назначить уровень специалиста.",
  plannerHints: ["Use specialist.set_level only after required slots are resolved and the user intent matches: Назначить уровень специалиста."],
  preview: previewSpecialistProfileUpdate,
  execute: executeSpecialistLevelSet,
});
