import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { getAppointmentById, serializeAppointment } from "./appointment-read-helpers";

export const appointmentViewAction = defineCrmAgentAction({
  name: "appointment.view",
  domain: "appointments",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.calendar.read",
  confirmation: "never",
  requiredSlots: ["appointmentId"],
  optionalSlots: [],
  description: "Показать запись.",
  plannerHints: ["Use appointment.view when the user asks to inspect: Показать запись."],
  read: async (payload: JsonRecord, ctx) => {
    const appointmentId = requiredNumber(payload.appointmentId ?? payload.id, "appointmentId");
    const appointment = await getAppointmentById(ctx.accountId, appointmentId);
    if (!appointment) throw new Error("Appointment not found.");
    return { appointment: serializeAppointment(appointment) };
  },
});
