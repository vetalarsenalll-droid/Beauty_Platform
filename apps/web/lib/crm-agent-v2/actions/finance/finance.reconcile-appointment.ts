import { defineCrmAgentAction } from "../define-action";
import { executeReconcileAppointment, previewFinancePayload } from "./finance-write-helpers";

export const financeReconcileAppointmentAction = defineCrmAgentAction({
  name: "finance.reconcile_appointment",
  domain: "finance",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.finance.manage",
  confirmation: "always",
  requiredSlots: ["appointmentId"],
  optionalSlots: ["paymentIntentId", "amount", "currency", "scenario", "provider", "providerRef"],
  description: "Сверить оплату записи.",
  plannerHints: ["Use finance.reconcile_appointment to record a successful manual/offline payment for an appointment."],
  preview: previewFinancePayload,
  execute: executeReconcileAppointment,
});
