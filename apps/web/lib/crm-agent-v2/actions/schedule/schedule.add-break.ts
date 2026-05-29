import { defineCrmAgentAction } from "../define-action";
import { addBreak, previewSchedule } from "./schedule-helpers";

export const scheduleAddBreakAction = defineCrmAgentAction({
  name: "schedule.add_break",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["startTime", "endTime"],
  optionalSlots: ["entryId", "specialistId", "date", "locationId", "entryStartTime", "entryEndTime"],
  description: "Добавить перерыв.",
  plannerHints: ["Use schedule.add_break against an existing schedule entry or one specialist/date."],
  preview: previewSchedule,
  execute: addBreak,
});
