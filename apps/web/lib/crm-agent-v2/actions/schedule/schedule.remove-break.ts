import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, removeBreak } from "./schedule-helpers";

export const scheduleRemoveBreakAction = defineCrmAgentAction({
  name: "schedule.remove_break",
  domain: "schedule",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["breakId"],
  optionalSlots: [],
  description: "Удалить перерыв.",
  plannerHints: ["Use schedule.remove_break when breakId is known."],
  preview: previewSchedule,
  execute: removeBreak,
});
