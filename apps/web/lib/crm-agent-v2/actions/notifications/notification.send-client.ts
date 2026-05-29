import { defineCrmAgentAction } from "../define-action";
import { previewNotification, sendClient } from "./notification-helpers";

export const notificationSendClientAction = defineCrmAgentAction({
  name: "notification.send_client",
  domain: "notifications",
  kind: "write",
  intent: "notify",
  status: "implemented",
  risk: "high",
  permission: "crm.notifications.send",
  confirmation: "always",
  requiredSlots: ["clientId", "bodyText"],
  optionalSlots: ["channel", "subject", "title", "data"],
  description: "Отправить клиенту уведомление.",
  plannerHints: ["Use notification.send_client to enqueue one client notification in outbox."],
  preview: previewNotification,
  execute: sendClient,
});
