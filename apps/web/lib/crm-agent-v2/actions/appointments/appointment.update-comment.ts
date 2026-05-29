import { defineCrmAgentAction } from "../define-action";
import { executeAppointmentCommentUpdate, previewAppointmentUpdate } from "./appointment-write-helpers";

export const appointmentUpdateCommentAction = defineCrmAgentAction({
  name: "appointment.update_comment",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "low",
  permission: "crm.appointments.update",
  confirmation: "never",
  requiredSlots: ["appointmentId", "comment"],
  optionalSlots: [],
  description: "Изменить комментарий.",
  plannerHints: ["Use appointment.update_comment to replace the appointment comment."],
  preview: previewAppointmentUpdate,
  execute: executeAppointmentCommentUpdate,
});
