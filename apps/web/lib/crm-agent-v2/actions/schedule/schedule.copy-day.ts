import { defineCrmAgentAction } from "../define-action";
import { copyDay, previewSchedule } from "./schedule-helpers";

export const scheduleCopyDayAction = defineCrmAgentAction({
  name: "schedule.copy_day",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["specialistId", "sourceDate", "targetDate"],
  optionalSlots: [],
  description: "Скопировать день графика.",
  plannerHints: ["Use schedule.copy_day to copy one specialist's schedule day."],
  preview: previewSchedule,
  execute: copyDay,
});
