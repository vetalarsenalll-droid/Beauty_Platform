import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentHoldRelease, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentReleaseHoldAction = defineCrmAgentAction({
  name: "appointment.release_hold",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.appointments.create",
  confirmation: "never",
  requiredSlots: ["holdId"],
  optionalSlots: [],
  description: "Снять hold.",
  plannerHints: ["Use appointment.release_hold when the temporary hold id is known."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentHoldRelease,
});
