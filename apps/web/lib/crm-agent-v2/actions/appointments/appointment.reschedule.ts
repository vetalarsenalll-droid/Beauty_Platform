import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentTimeChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentRescheduleAction = defineCrmAgentAction({
  name: "appointment.reschedule",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.reschedule",
  confirmation: "always",
  requiredSlots: ["appointmentId", "startAt"],
  optionalSlots: ["endAt", "comment"],
  description: "Перенести запись.",
  plannerHints: ["Use appointment.reschedule after a concrete new slot is selected."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentTimeChange,
});
