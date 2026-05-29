import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentStatus, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentConfirmAction = defineCrmAgentAction({
  name: "appointment.confirm",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.appointments.update",
  confirmation: "medium_plus",
  requiredSlots: ["appointmentId"],
  optionalSlots: ["comment"],
  description: "Подтвердить запись.",
  plannerHints: ["Use appointment.confirm after the appointment id is known."],
  preview: previewAppointmentUpdate,
  execute: (payload, ctx) => executeAppointmentStatus(payload, ctx, "CONFIRMED"),
});
