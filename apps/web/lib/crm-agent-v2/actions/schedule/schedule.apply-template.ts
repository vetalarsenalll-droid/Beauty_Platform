import { defineCrmAgentAction } from "../define-action";
import { applyTemplate, previewSchedule } from "./schedule-helpers";

export const scheduleApplyTemplateAction = defineCrmAgentAction({
  name: "schedule.apply_template",
  domain: "schedule",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.schedule.update",
  confirmation: "always",
  requiredSlots: ["templateId", "specialistId", "dateFrom"],
  optionalSlots: ["dateTo", "locationId", "notes"],
  description: "Применить шаблон.",
  plannerHints: ["Use schedule.apply_template to write template hours into a concrete range."],
  preview: previewSchedule,
  execute: applyTemplate,
});
