import { prisma } from "@/lib/prisma";
import { optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { appointmentSelect, appointmentWhere, clampTake, serializeAppointment } from "./appointment-read-helpers";

export const appointmentResolveAction = defineCrmAgentAction({
  name: "appointment.resolve",
  domain: "appointments",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.calendar.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["appointmentId", "clientId", "specialistId", "locationId", "dateFrom", "dateTo", "query", "take"],
  description: "Разрешить неоднозначную запись.",
  plannerHints: ["Use appointment.resolve when the user asks to inspect: Разрешить неоднозначную запись."],
  read: async (payload: JsonRecord, ctx) => {
    const query = optionalString(payload, "query");
    const rows = await prisma.appointment.findMany({
      where: appointmentWhere(payload, ctx.accountId),
      orderBy: { startAt: "desc" },
      take: clampTake(payload.take, 8, 30),
      select: appointmentSelect,
    });
    const candidates = rows.map(serializeAppointment).filter((appointment) => {
      if (!query) return true;
      return [
        String(appointment.id),
        appointment.client.displayName,
        appointment.client.phone,
        appointment.specialist.displayName,
        appointment.location.name,
        ...appointment.services.map((item) => item.service.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(query.toLocaleLowerCase("ru-RU")));
    });
    return { resolved: candidates.length === 1 ? candidates[0] : null, candidates, ambiguous: candidates.length !== 1 };
  },
});
