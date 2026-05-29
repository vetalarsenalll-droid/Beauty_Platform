import { defineCrmAgentAction } from "../define-action";
import { previewOutboxRetry, retryFailedOutbox } from "./notification-helpers";

export const notificationRetryFailedAction = defineCrmAgentAction({
  name: "notification.retry_failed",
  domain: "notifications",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.notifications.send",
  confirmation: "medium_plus",
  requiredSlots: ["outboxItemId"],
  optionalSlots: [],
  description: "Повторить неудачное уведомление.",
  plannerHints: ["Use notification.retry_failed for failed or dead outbox notification jobs."],
  preview: previewOutboxRetry,
  execute: retryFailedOutbox,
});
