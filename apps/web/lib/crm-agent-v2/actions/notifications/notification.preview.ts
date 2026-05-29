import { defineCrmAgentAction } from "../define-action";
import { previewNotification } from "./notification-helpers";

export const notificationPreviewAction = defineCrmAgentAction({
  name: "notification.preview",
  domain: "notifications",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.notifications.read",
  confirmation: "never",
  requiredSlots: ["bodyText"],
  optionalSlots: ["channel", "subject", "title", "data"],
  description: "Показать preview уведомления.",
  plannerHints: ["Use notification.preview to render a message before send."],
  read: async (payload) => ({ preview: (await previewNotification(payload)).after }),
});
