import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentLocationChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangeLocationAction = defineCrmAgentAction({
  name: "appointment.change_location",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.update",
  confirmation: "always",
  requiredSlots: ["appointmentId", "locationId"],
  optionalSlots: ["comment"],
  description: "Сменить филиал.",
  plannerHints: ["Use appointment.change_location only after the new location is confirmed."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentLocationChange,
});
