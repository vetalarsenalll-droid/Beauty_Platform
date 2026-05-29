import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentPriceChange, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentChangePriceAction = defineCrmAgentAction({
  name: "appointment.change_price",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.update",
  confirmation: "always",
  requiredSlots: ["appointmentId", "priceTotal"],
  optionalSlots: ["comment"],
  description: "Сменить цену.",
  plannerHints: ["Use appointment.change_price only after the final amount is explicit."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentPriceChange,
});
