import { defineCrmAgentAction } from "../define-action";
import { copyWeek, previewSchedule } from "./schedule-helpers";

export const scheduleCopyWeekAction = defineCrmAgentAction({
  name: "schedule.copy_week",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["specialistId", "sourceWeekStart", "targetWeekStart"],
  optionalSlots: [],
  description: "Скопировать неделю графика.",
  plannerHints: ["Use schedule.copy_week to copy one specialist's seven-day schedule."],
  preview: previewSchedule,
  execute: copyWeek,
});
