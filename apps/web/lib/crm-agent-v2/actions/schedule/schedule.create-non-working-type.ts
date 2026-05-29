import { defineCrmAgentAction } from "../define-action";
import { createNonWorkingType, previewSchedule } from "./schedule-helpers";

export const scheduleCreateNonWorkingTypeAction = defineCrmAgentAction({
  name: "schedule.create_non_working_type",
  domain: "schedule",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["name"],
  optionalSlots: ["color"],
  description: "Создать тип нерабочего времени.",
  plannerHints: ["Use schedule.create_non_working_type for reusable custom non-working reasons."],
  preview: previewSchedule,
  execute: createNonWorkingType,
});
