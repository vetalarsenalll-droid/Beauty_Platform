import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentStatus, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentMarkNoShowAction = defineCrmAgentAction({
  name: "appointment.mark_no_show",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.update",
  confirmation: "always",
  requiredSlots: ["appointmentId"],
  optionalSlots: ["comment"],
  description: "Отметить неявку.",
  plannerHints: ["Use appointment.mark_no_show only after the appointment id is confirmed."],
  preview: previewAppointmentUpdate,
  execute: (payload, ctx) => executeAppointmentStatus(payload, ctx, "NO_SHOW"),
});
