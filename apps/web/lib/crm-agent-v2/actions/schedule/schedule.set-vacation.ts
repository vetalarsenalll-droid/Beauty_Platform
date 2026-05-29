import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, setVacation } from "./schedule-helpers";

export const scheduleSetVacationAction = defineCrmAgentAction({
  name: "schedule.set_vacation",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["startAt", "endAt"],
  optionalSlots: ["specialistId", "locationId", "notes"],
  description: "Поставить отпуск.",
  plannerHints: ["Use schedule.set_vacation for a date range vacation or closure."],
  preview: previewSchedule,
  execute: setVacation,
});
