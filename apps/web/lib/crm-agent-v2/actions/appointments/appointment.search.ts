import { prisma } from "@/lib/prisma";
import { optionalString, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { appointmentSelect, appointmentWhere, clampTake, serializeAppointment } from "./appointment-read-helpers";

export const appointmentSearchAction = defineCrmAgentAction({
  name: "appointment.search",
  domain: "appointments",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.calendar.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["appointmentId", "clientId", "specialistId", "locationId", "dateFrom", "dateTo", "status", "query", "take"],
  description: "Найти записи.",
  plannerHints: ["Use appointment.search when the user asks to inspect: Найти записи."],
  read: async (payload: JsonRecord, ctx) => {
    const query = optionalString(payload, "query");
    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere(payload, ctx.accountId),
      orderBy: { startAt: "desc" },
      take: clampTake(payload.take, 20, 100),
      select: appointmentSelect,
    });
    const serialized = appointments.map(serializeAppointment);
    return {
      appointments: query
        ? serialized.filter((appointment) =>
            [
              String(appointment.id),
              appointment.client.displayName,
              appointment.client.phone,
              appointment.client.email,
              appointment.specialist.displayName,
              appointment.location.name,
              ...appointment.services.map((item) => item.service.name),
            ]
              .filter(Boolean)
              .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(query.toLocaleLowerCase("ru-RU"))),
          )
        : serialized,
    };
  },
});
