import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, setDayOff } from "./schedule-helpers";

export const scheduleSetDayOffAction = defineCrmAgentAction({
  name: "schedule.set_day_off",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["specialistId", "date"],
  optionalSlots: ["locationId", "customTypeId", "notes"],
  description: "Поставить выходной.",
  plannerHints: ["Use schedule.set_day_off for one specialist/date non-working entry."],
  preview: previewSchedule,
  execute: setDayOff,
});
