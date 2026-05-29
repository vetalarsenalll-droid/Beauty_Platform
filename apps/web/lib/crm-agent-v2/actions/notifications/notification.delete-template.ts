import { defineCrmAgentAction } from "../define-action";
import { deleteTemplate, previewDeleteNotificationTemplate } from "./notification-helpers";

export const notificationDeleteTemplateAction = defineCrmAgentAction({
  name: "notification.delete_template",
  domain: "notifications",
  kind: "write",
  intent: "delete",
  status: "implemented",
  risk: "high",
  permission: "crm.notifications.manage",
  confirmation: "always",
  requiredSlots: ["templateId"],
  optionalSlots: [],
  description: "Удалить шаблон.",
  plannerHints: ["Use notification.delete_template only for a non-system account template."],
  preview: previewDeleteNotificationTemplate,
  execute: deleteTemplate,
});
