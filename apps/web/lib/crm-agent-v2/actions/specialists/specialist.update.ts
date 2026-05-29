import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistProfileUpdate, previewSpecialistProfileUpdate } from "./specialist-write-helpers";

export const specialistUpdateAction = defineCrmAgentAction({
  name: "specialist.update",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId"],
  optionalSlots: ["firstName", "lastName", "bio", "avatarUrl", "isPublic", "levelId"],
  description: "Изменить карточку специалиста.",
  plannerHints: ["Use specialist.update only after required slots are resolved and the user intent matches: Изменить карточку специалиста."],
  preview: previewSpecialistProfileUpdate,
  execute: executeSpecialistProfileUpdate,
});
