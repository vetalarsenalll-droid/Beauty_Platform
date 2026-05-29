import { defineCrmAgentAction } from "../define-action";
import { previewSchedule, updateTemplate } from "./schedule-helpers";

export const scheduleUpdateTemplateAction = defineCrmAgentAction({
  name: "schedule.update_template",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.schedule.update",
  confirmation: "medium_plus",
  requiredSlots: ["templateId"],
  optionalSlots: ["name", "workingHours", "breaks"],
  description: "Изменить шаблон графика.",
  plannerHints: ["Use schedule.update_template when templateId is known."],
  preview: previewSchedule,
  execute: updateTemplate,
});
