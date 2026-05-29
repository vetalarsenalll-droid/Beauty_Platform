import { defineCrmAgentAction } from "../define-action";
import { executeUpdateBookingSettings, previewSitePayload } from "./site-helpers";

export const siteUpdateBookingSettingsAction = defineCrmAgentAction({
  name: "site.update_booking_settings",
  domain: "site",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.settings.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: ["slotStepMinutes", "requireDeposit", "requirePaymentToConfirm", "cancellationWindowHours", "rescheduleWindowHours", "holdTtlMinutes"],
  description: "Изменить настройки онлайн-записи сайта.",
  plannerHints: ["Use site.update_booking_settings to change public booking policy fields."],
  preview: previewSitePayload,
  execute: executeUpdateBookingSettings,
});
