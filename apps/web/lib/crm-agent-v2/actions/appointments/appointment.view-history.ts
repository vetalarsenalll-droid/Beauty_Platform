import { prisma } from "@/lib/prisma";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { getAppointmentById, serializeAppointment } from "./appointment-read-helpers";

export const appointmentViewHistoryAction = defineCrmAgentAction({
  name: "appointment.view_history",
  domain: "appointments",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.calendar.read",
  confirmation: "never",
  requiredSlots: ["appointmentId"],
  optionalSlots: [],
  description: "Показать историю записи.",
  plannerHints: ["Use appointment.view_history when the user asks to inspect: Показать историю записи."],
  read: async (payload: JsonRecord, ctx) => {
    const appointmentId = requiredNumber(payload.appointmentId ?? payload.id, "appointmentId");
    const appointment = await getAppointmentById(ctx.accountId, appointmentId);
    if (!appointment) throw new Error("Appointment not found.");
    const history = await prisma.appointmentStatusHistory.findMany({
      where: { appointmentId },
      orderBy: { createdAt: "asc" },
      select: { id: true, actorType: true, actorId: true, fromStatus: true, toStatus: true, reasonId: true, comment: true, createdAt: true },
    });
    return {
      appointment: serializeAppointment(appointment),
      history: history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  },
});
