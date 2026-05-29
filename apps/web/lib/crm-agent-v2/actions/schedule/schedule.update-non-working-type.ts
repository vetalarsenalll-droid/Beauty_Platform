import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, updateNonWorkingType } from "./schedule-helpers";

export const scheduleUpdateNonWorkingTypeAction = defineCrmAgentAction({
  name: "schedule.update_non_working_type",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["customTypeId"],
  optionalSlots: ["name", "color", "isArchived"],
  description: "Изменить тип нерабочего времени.",
  plannerHints: ["Use schedule.update_non_working_type when customTypeId is known."],
  preview: previewSchedule,
  execute: updateNonWorkingType,
});
