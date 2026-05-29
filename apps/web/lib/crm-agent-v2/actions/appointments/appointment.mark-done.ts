import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentStatus, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentMarkDoneAction = defineCrmAgentAction({
  name: "appointment.mark_done",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.appointments.update",
  confirmation: "medium_plus",
  requiredSlots: ["appointmentId"],
  optionalSlots: ["comment"],
  description: "Отметить выполненной.",
  plannerHints: ["Use appointment.mark_done after the appointment id is known."],
  preview: previewAppointmentUpdate,
  execute: (payload, ctx) => executeAppointmentStatus(payload, ctx, "DONE"),
});
