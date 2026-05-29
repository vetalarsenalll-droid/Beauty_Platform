import { defineCrmAgentAction } from "../define-action";
import { createTemplate, previewNotificationTemplate } from "./notification-helpers";

export const notificationCreateTemplateAction = defineCrmAgentAction({
  name: "notification.create_template",
  domain: "notifications",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "medium",
  permission: "crm.notifications.manage",
  confirmation: "medium_plus",
  requiredSlots: ["name", "channel"],
  optionalSlots: ["locale", "subject", "bodyText", "bodyHtml", "variables"],
  description: "Создать шаблон уведомления.",
  plannerHints: ["Use notification.create_template after name and channel are known."],
  preview: previewNotificationTemplate,
  execute: createTemplate,
});
