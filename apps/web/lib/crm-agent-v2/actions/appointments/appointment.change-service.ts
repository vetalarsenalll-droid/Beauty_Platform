import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentServiceChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangeServiceAction = defineCrmAgentAction({
  name: "appointment.change_service",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.update",
  confirmation: "always",
  requiredSlots: ["appointmentId", "serviceId"],
  optionalSlots: ["priceTotal", "durationTotalMin", "comment"],
  description: "Сменить услугу записи.",
  plannerHints: ["Use appointment.change_service only after service, specialist and location compatibility are confirmed."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentServiceChange,
});
