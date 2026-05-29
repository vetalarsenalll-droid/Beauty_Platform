import { defineCrmAgentAction } from "../define-action";
import { executeSpecialistProfileUpdate, previewSpecialistProfileUpdate } from "./specialist-write-helpers";

export const specialistUpdateAvatarAction = defineCrmAgentAction({
  name: "specialist.update_avatar",
  domain: "specialists",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.specialists.update",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId", "avatarUrl"],
  optionalSlots: [],
  description: "Изменить фото/аватар специалиста.",
  plannerHints: ["Use specialist.update_avatar only after required slots are resolved and the user intent matches: Изменить фото/аватар специалиста."],
  preview: previewSpecialistProfileUpdate,
  execute: executeSpecialistProfileUpdate,
});
