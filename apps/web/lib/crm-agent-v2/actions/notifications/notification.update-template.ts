import { defineCrmAgentAction } from "../define-action";
import { previewNotificationTemplate, updateTemplate } from "./notification-helpers";

export const notificationUpdateTemplateAction = defineCrmAgentAction({
  name: "notification.update_template",
  domain: "notifications",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.notifications.manage",
  confirmation: "medium_plus",
  requiredSlots: ["templateId"],
  optionalSlots: ["name", "channel", "locale", "subject", "bodyText", "bodyHtml", "variables"],
  description: "Изменить шаблон.",
  plannerHints: ["Use notification.update_template to change an existing account notification template."],
  preview: previewNotificationTemplate,
  execute: updateTemplate,
});
