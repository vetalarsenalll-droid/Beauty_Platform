import { defineCrmAgentAction } from "../define-action";
import { previewNotificationPreferences, updatePreferences } from "./notification-helpers";

export const notificationUpdatePreferencesAction = defineCrmAgentAction({
  name: "notification.update_preferences",
  domain: "notifications",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.notifications.manage",
  confirmation: "always",
  requiredSlots: ["eventName", "audience", "channel"],
  optionalSlots: ["scope", "userId", "enabled", "reminderOffsetMinutes", "templateId"],
  description: "Изменить настройки уведомлений.",
  plannerHints: ["Use notification.update_preferences to enable, disable or retarget one event/channel preference."],
  preview: previewNotificationPreferences,
  execute: updatePreferences,
});
