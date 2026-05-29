import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentSpecialistChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangeSpecialistAction = defineCrmAgentAction({
  name: "appointment.change_specialist",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.update",
  confirmation: "always",
  requiredSlots: ["appointmentId", "specialistId"],
  optionalSlots: ["comment"],
  description: "Сменить специалиста.",
  plannerHints: ["Use appointment.change_specialist only after availability and service compatibility are clear."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentSpecialistChange,
});
