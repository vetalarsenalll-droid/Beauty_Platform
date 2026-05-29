import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentCommentAdd, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentAddCommentAction = defineCrmAgentAction({
  name: "appointment.add_comment",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.appointments.update",
  confirmation: "never",
  requiredSlots: ["appointmentId", "comment"],
  optionalSlots: [],
  description: "Добавить комментарий.",
  plannerHints: ["Use appointment.add_comment to append a comment to an appointment."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentCommentAdd,
});
