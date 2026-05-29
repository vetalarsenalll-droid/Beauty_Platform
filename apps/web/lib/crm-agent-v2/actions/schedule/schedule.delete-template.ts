import { defineCrmAgentAction } from "../define-action";
import { deleteTemplate, previewSchedule } from "./schedule-helpers";

export const scheduleDeleteTemplateAction = defineCrmAgentAction({
  name: "schedule.delete_template",
  domain: "schedule",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["templateId"],
  optionalSlots: [],
  description: "Удалить шаблон графика.",
  plannerHints: ["Use schedule.delete_template only after templateId is confirmed."],
  preview: previewSchedule,
  execute: deleteTemplate,
});
