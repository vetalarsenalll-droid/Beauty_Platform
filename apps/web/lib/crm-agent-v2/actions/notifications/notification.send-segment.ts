import { defineCrmAgentAction } from "../define-action";
import { previewNotification, sendSegment } from "./notification-helpers";

export const notificationSendSegmentAction = defineCrmAgentAction({
  name: "notification.send_segment",
  domain: "notifications",
  kind: "write",
  intent: "notify",
  status: "implemented",
  risk: "high",
  permission: "crm.notifications.send",
  confirmation: "always",
  requiredSlots: ["bodyText"],
  optionalSlots: ["channel", "subject", "title", "data", "segment"],
  description: "Отправить сегменту.",
  plannerHints: ["Use notification.send_segment to enqueue a segment notification in outbox."],
  preview: previewNotification,
  execute: sendSegment,
});
