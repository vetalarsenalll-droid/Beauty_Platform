import { defineCrmAgentAction } from "../define-action";
import { createTemplate, previewSchedule } from "./schedule-helpers";

export const scheduleCreateTemplateAction = defineCrmAgentAction({
  name: "schedule.create_template",
  domain: "schedule",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["name"],
  optionalSlots: ["workingHours", "breaks"],
  description: "Создать шаблон графика.",
  plannerHints: ["Use schedule.create_template to save reusable working hours."],
  preview: previewSchedule,
  execute: createTemplate,
});
