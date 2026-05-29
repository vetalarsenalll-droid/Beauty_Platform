import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentTimeChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangeTimeAction = defineCrmAgentAction({
  name: "appointment.change_time",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.reschedule",
  confirmation: "always",
  requiredSlots: ["appointmentId", "startAt"],
  optionalSlots: ["endAt", "comment"],
  description: "Сменить время.",
  plannerHints: ["Use appointment.change_time after checking slot availability."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentTimeChange,
});
