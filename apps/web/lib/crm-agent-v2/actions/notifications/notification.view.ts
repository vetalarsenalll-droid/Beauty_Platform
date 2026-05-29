import { defineCrmAgentAction } from "../define-action";
import { readNotification } from "./notification-helpers";

export const notificationViewAction = defineCrmAgentAction({
  name: "notification.view",
  domain: "notifications",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.notifications.read",
  confirmation: "never",
  requiredSlots: ["notificationId"],
  optionalSlots: [],
  description: "Показать уведомление.",
  plannerHints: ["Use notification.view when notificationId is known."],
  read: async (payload, ctx) => readNotification(ctx.accountId, payload),
});
