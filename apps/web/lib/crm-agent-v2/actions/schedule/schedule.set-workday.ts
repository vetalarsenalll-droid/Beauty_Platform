import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, setWorkday } from "./schedule-helpers";

export const scheduleSetWorkdayAction = defineCrmAgentAction({
  name: "schedule.set_workday",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["specialistId", "date", "startTime", "endTime"],
  optionalSlots: ["locationId", "notes"],
  description: "Поставить рабочий день.",
  plannerHints: ["Use schedule.set_workday for one specialist/date working interval."],
  preview: previewSchedule,
  execute: setWorkday,
});
