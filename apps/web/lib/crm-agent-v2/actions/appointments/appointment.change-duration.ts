import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentDurationChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangeDurationAction = defineCrmAgentAction({
  name: "appointment.change_duration",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.appointments.update",
  confirmation: "medium_plus",
  requiredSlots: ["appointmentId", "durationTotalMin"],
  optionalSlots: ["comment"],
  description: "Сменить длительность.",
  plannerHints: ["Use appointment.change_duration when duration in minutes is known."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentDurationChange,
});
