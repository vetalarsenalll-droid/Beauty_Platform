import { defineCrmAgentAction } from "../define-action";
import { readNotifications } from "./notification-helpers";

export const notificationSearchAction = defineCrmAgentAction({
  name: "notification.search",
  domain: "notifications",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.notifications.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["userId", "take"],
  description: "Найти уведомления.",
  plannerHints: ["Use notification.search to inspect in-app notifications."],
  read: async (payload, ctx) => readNotifications(ctx.accountId, payload),
});
