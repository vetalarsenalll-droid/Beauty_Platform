import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentHold, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentHoldSlotAction = defineCrmAgentAction({
  name: "appointment.hold_slot",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.appointments.create",
  confirmation: "medium_plus",
  requiredSlots: ["specialistId", "startAt", "endAt"],
  optionalSlots: ["clientId", "expiresAt"],
  description: "Поставить временный hold на слот.",
  plannerHints: ["Use appointment.hold_slot to temporarily reserve a concrete specialist time window."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentHold,
});
