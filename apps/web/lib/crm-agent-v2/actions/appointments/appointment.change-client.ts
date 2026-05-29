import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentClientChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangeClientAction = defineCrmAgentAction({
  name: "appointment.change_client",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.update",
  confirmation: "always",
  requiredSlots: ["appointmentId", "clientId"],
  optionalSlots: ["comment"],
  description: "Сменить клиента записи.",
  plannerHints: ["Use appointment.change_client only after both appointment and replacement client are confirmed."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentClientChange,
});
