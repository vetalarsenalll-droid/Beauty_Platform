import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalDate, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { addDays, clampTake, endOfDay, startOfDay } from "./appointment-read-helpers";

export const appointmentFindSlotsAction = defineCrmAgentAction({
  name: "appointment.find_slots",
  domain: "appointments",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["serviceId", "specialistId", "locationId", "durationMin", "dateFrom", "dateTo", "take"],
  description: "Найти свободные окна.",
  plannerHints: ["Use appointment.find_slots when the user asks to inspect: Найти свободные окна."],
  read: async (payload: JsonRecord, ctx) => {
    const serviceId = numberOrNull(payload.serviceId);
    const specialistId = numberOrNull(payload.specialistId);
    const locationId = numberOrNull(payload.locationId);
    const dateFrom = startOfDay(optionalDate(payload, "dateFrom") ?? new Date());
    const dateTo = endOfDay(optionalDate(payload, "dateTo") ?? addDays(dateFrom, 14));
    const take = clampTake(payload.take, 20, 100);
    const service = serviceId
      ? await prisma.service.findFirst({
          where: { id: serviceId, accountId: ctx.accountId, isActive: true },
          select: { id: true, name: true, baseDurationMin: true },
        })
      : null;
    const durationMin = numberOrNull(payload.durationMin) ?? service?.baseDurationMin ?? 60;
    const stepMin = Math.max(15, Math.min(durationMin, 30));
    const entries = await prisma.scheduleEntry.findMany({
      where: {
        accountId: ctx.accountId,
        type: "WORKING",
        date: { gte: dateFrom, lte: dateTo },
        ...(specialistId ? { specialistId } : {}),
        ...(locationId ? { locationId } : {}),
        ...(serviceId ? { specialist: { services: { some: { serviceId } } } } : {}),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 500,
      select: {
        date: true,
        specialistId: true,
        locationId: true,
        startTime: true,
        endTime: true,
        breaks: { select: { startTime: true, endTime: true } },
        specialist: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
        location: { select: { id: true, name: true } },
      },
    });
    const [appointments, blockedSlots] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          accountId: ctx.accountId,
          startAt: { lte: dateTo },
          endAt: { gte: dateFrom },
          status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
          ...(specialistId ? { specialistId } : {}),
          ...(locationId ? { locationId } : {}),
        },
        select: { startAt: true, endAt: true, specialistId: true, locationId: true },
        take: 2000,
      }),
      prisma.blockedSlot.findMany({
        where: {
          accountId: ctx.accountId,
          startAt: { lte: dateTo },
          endAt: { gte: dateFrom },
          ...(specialistId ? { OR: [{ specialistId }, { specialistId: null }] } : {}),
          ...(locationId ? { OR: [{ locationId }, { locationId: null }] } : {}),
        },
        select: { startAt: true, endAt: true, specialistId: true, locationId: true, reason: true },
        take: 2000,
      }),
    ]);
    const now = new Date();
    const slots = [];
    for (const entry of entries) {
      const startMin = minutesFromTime(entry.startTime);
      const endMin = minutesFromTime(entry.endTime);
      if (startMin == null || endMin == null || endMin - startMin < durationMin) continue;
      for (let minute = startMin; minute + durationMin <= endMin; minute += stepMin) {
        const startAt = dateWithMinutes(entry.date, minute);
        const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
        if (endAt <= now) continue;
        if (hasEntryBreak(entry.breaks, minute, durationMin)) continue;
        if (
          appointments.some(
            (appointment) =>
              appointment.specialistId === entry.specialistId &&
              (!entry.locationId || appointment.locationId === entry.locationId) &&
              rangesOverlap(startAt, endAt, appointment.startAt, appointment.endAt),
          )
        ) {
          continue;
        }
        if (
          blockedSlots.some(
            (slot) =>
              (!slot.specialistId || slot.specialistId === entry.specialistId) &&
              (!slot.locationId || !entry.locationId || slot.locationId === entry.locationId) &&
              rangesOverlap(startAt, endAt, slot.startAt, slot.endAt),
          )
        ) {
          continue;
        }
        const profile = entry.specialist.user.profile;
        slots.push({
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          durationMin,
          specialistId: entry.specialistId,
          specialistName: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() || null,
          locationId: entry.locationId,
          locationName: entry.location?.name ?? null,
          serviceId: service?.id ?? null,
          serviceName: service?.name ?? null,
        });
        if (slots.length >= take) return { slots, durationMin, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
      }
    }
    return { slots, durationMin, dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
  },
});

function minutesFromTime(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dateWithMinutes(day: Date, minutes: number) {
  const result = startOfDay(day);
  result.setMinutes(minutes);
  return result;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function hasEntryBreak(breaks: Array<{ startTime: string; endTime: string }>, minute: number, durationMin: number) {
  return breaks.some((item) => {
    const breakStart = minutesFromTime(item.startTime);
    const breakEnd = minutesFromTime(item.endTime);
    if (breakStart == null || breakEnd == null) return false;
    return minute < breakEnd && minute + durationMin > breakStart;
  });
}
