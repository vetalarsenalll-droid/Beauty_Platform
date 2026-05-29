import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalDate, requiredDate, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const appointmentViewConflictsAction = defineCrmAgentAction({
  name: "appointment.view_conflicts",
  domain: "appointments",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.calendar.read",
  confirmation: "never",
  requiredSlots: ["startAt", "endAt"],
  optionalSlots: ["specialistId", "locationId", "appointmentId"],
  description: "Показать конфликты записи/слота.",
  plannerHints: ["Use appointment.view_conflicts when the user asks to inspect: Показать конфликты записи/слота."],
  read: async (payload: JsonRecord, ctx) => {
    const startAt = requiredDate(payload, "startAt");
    const endAt = optionalDate(payload, "endAt") ?? new Date(startAt.getTime() + 60 * 60 * 1000);
    const specialistId = numberOrNull(payload.specialistId);
    const locationId = numberOrNull(payload.locationId);
    const appointmentId = numberOrNull(payload.appointmentId ?? payload.id);
    const [appointments, blockedSlots] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          accountId: ctx.accountId,
          ...(appointmentId ? { id: { not: appointmentId } } : {}),
          ...(specialistId ? { specialistId } : {}),
          ...(locationId ? { locationId } : {}),
          status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        orderBy: { startAt: "asc" },
        take: 50,
        select: {
          id: true,
          startAt: true,
          endAt: true,
          status: true,
          client: { select: { id: true, firstName: true, lastName: true, phone: true } },
          specialistId: true,
          locationId: true,
        },
      }),
      prisma.blockedSlot.findMany({
        where: {
          accountId: ctx.accountId,
          ...(specialistId ? { OR: [{ specialistId }, { specialistId: null }] } : {}),
          ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
        orderBy: { startAt: "asc" },
        take: 50,
        select: { id: true, specialistId: true, locationId: true, startAt: true, endAt: true, reason: true },
      }),
    ]);
    return {
      slot: { startAt: startAt.toISOString(), endAt: endAt.toISOString(), specialistId, locationId },
      hasConflicts: appointments.length > 0 || blockedSlots.length > 0,
      appointments: appointments.map((appointment) => ({
        ...appointment,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        client: {
          ...appointment.client,
          displayName: [appointment.client.firstName, appointment.client.lastName].filter(Boolean).join(" ").trim() || null,
        },
      })),
      blockedSlots: blockedSlots.map((slot) => ({ ...slot, startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() })),
    };
  },
});
