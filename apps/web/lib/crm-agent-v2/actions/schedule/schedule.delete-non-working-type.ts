import { defineCrmAgentAction } from "../define-action";
import { deleteNonWorkingType, previewSchedule } from "./schedule-helpers";

export const scheduleDeleteNonWorkingTypeAction = defineCrmAgentAction({
  name: "schedule.delete_non_working_type",
  domain: "schedule",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["customTypeId"],
  optionalSlots: [],
  description: "Удалить тип нерабочего времени.",
  plannerHints: ["Use schedule.delete_non_working_type to archive a custom non-working type."],
  preview: previewSchedule,
  execute: deleteNonWorkingType,
});
