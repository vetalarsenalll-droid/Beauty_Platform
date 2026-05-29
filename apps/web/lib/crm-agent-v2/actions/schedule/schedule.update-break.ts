import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, updateBreak } from "./schedule-helpers";

export const scheduleUpdateBreakAction = defineCrmAgentAction({
  name: "schedule.update_break",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["breakId"],
  optionalSlots: ["startTime", "endTime"],
  description: "Изменить перерыв.",
  plannerHints: ["Use schedule.update_break when breakId is known."],
  preview: previewSchedule,
  execute: updateBreak,
});
