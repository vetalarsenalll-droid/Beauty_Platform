import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  minutesToTime,
  resolvePublicAccount,
  toLocalMinutes,
  toMinutes,
} from "@/lib/public-booking";

const SLOT_STEP_MIN = 15;

type Window = { start: number; end: number };

const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;

const toRange = (startAt: Date, endAt: Date) => ({
  start: toLocalMinutes(startAt),
  end: toLocalMinutes(endAt),
});

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const { searchParams } = new URL(request.url);
  const locationId = Number(searchParams.get("locationId"));
  const dateValue = String(searchParams.get("date") ?? "");
  const serviceId = Number(searchParams.get("serviceId") ?? "");
  const specialistId = Number(searchParams.get("specialistId") ?? "");

  if (!Number.isInteger(locationId) || !dateValue) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const dayStart = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) {
    return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  }
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      accountId: resolved.account.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
      ...(Number.isInteger(serviceId)
        ? { services: { some: { serviceId } } }
        : {}),
      ...(Number.isInteger(specialistId) ? { id: specialistId } : {}),
    },
    select: {
      id: true,
      levelId: true,
    },
  });

  if (!specialists.length) {
    return jsonOk({ slots: [] });
  }

  const specialistIds = specialists.map((item) => item.id);

  const [scheduleEntries, appointments, blockedSlots, service] =
    await Promise.all([
      // ✅ ВАЖНО: график только для выбранной локации (или общий locationId=null)
      prisma.scheduleEntry.findMany({
        where: {
          accountId: resolved.account.id,
          specialistId: { in: specialistIds },
          date: { gte: dayStart, lt: dayEnd },
          OR: [{ locationId }, { locationId: null }],
        },
        include: { breaks: true },
      }),

      prisma.appointment.findMany({
        where: {
          accountId: resolved.account.id,
          locationId,
          specialistId: { in: specialistIds },
          startAt: { gte: dayStart, lt: dayEnd },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        select: {
          specialistId: true,
          startAt: true,
          endAt: true,
        },
      }),

      prisma.blockedSlot.findMany({
        where: {
          accountId: resolved.account.id,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
          OR: [{ locationId }, { specialistId: { in: specialistIds } }],
        },
        select: {
          locationId: true,
          specialistId: true,
          startAt: true,
          endAt: true,
        },
      }),

      Number.isInteger(serviceId)
        ? prisma.service.findFirst({
            where: { id: serviceId, accountId: resolved.account.id },
            select: {
              id: true,
              baseDurationMin: true,
              specialists: {
                select: {
                  specialistId: true,
                  durationOverrideMin: true,
                },
              },
              levelConfigs: {
                select: {
                  levelId: true,
                  durationMin: true,
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);

  // ✅ Выбор графика с приоритетом: locationId (точно) > null (общий)
  const scheduleBySpecialist = new Map<number, (typeof scheduleEntries)[number]>();
  scheduleEntries.forEach((entry) => {
    const existing = scheduleBySpecialist.get(entry.specialistId);
    if (!existing) {
      scheduleBySpecialist.set(entry.specialistId, entry);
      return;
    }
    const existingLoc = existing.locationId;
    const nextLoc = entry.locationId;

    // если сейчас в мапе "общий" (null), а пришел "точный" (locationId) — заменяем
    if (existingLoc == null && nextLoc === locationId) {
      scheduleBySpecialist.set(entry.specialistId, entry);
    }
  });

  const appointmentsBySpecialist = new Map<number, Window[]>();
  appointments.forEach((appt) => {
    const list = appointmentsBySpecialist.get(appt.specialistId) ?? [];
    list.push(toRange(appt.startAt, appt.endAt));
    appointmentsBySpecialist.set(appt.specialistId, list);
  });

  const blockedBySpecialist = new Map<number, Window[]>();
  blockedSlots.forEach((slot) => {
    const window = toRange(slot.startAt, slot.endAt);
    if (slot.specialistId) {
      const list = blockedBySpecialist.get(slot.specialistId) ?? [];
      list.push(window);
      blockedBySpecialist.set(slot.specialistId, list);
      return;
    }
    // location-wide блокировка: применяем ко всем специалистам в выборке
    specialists.forEach((item) => {
      const list = blockedBySpecialist.get(item.id) ?? [];
      list.push(window);
      blockedBySpecialist.set(item.id, list);
    });
  });

  const slots: Array<{ time: string; specialistId: number }> = [];

  specialists.forEach((specialist) => {
    const entry = scheduleBySpecialist.get(specialist.id);

    // ✅ Доп. защита: если entry всё же не совпал по локации — не используем
    if (!entry || entry.type !== "WORKING") return;
    if (entry.locationId != null && entry.locationId !== locationId) return;

    const entryStart = toMinutes(entry.startTime ?? "");
    const entryEnd = toMinutes(entry.endTime ?? "");
    if (entryStart === null || entryEnd === null) return;

    const durationMin = service
      ? service.specialists.find((item) => item.specialistId === specialist.id)
          ?.durationOverrideMin ??
        service.levelConfigs.find((item) => item.levelId === specialist.levelId)
          ?.durationMin ??
        service.baseDurationMin
      : SLOT_STEP_MIN;

    const breaks = entry.breaks
      .map((item) => ({
        start: toMinutes(item.startTime) ?? 0,
        end: toMinutes(item.endTime) ?? 0,
      }))
      .filter((item) => item.start < item.end);

    const appointmentWindows =
      appointmentsBySpecialist.get(specialist.id) ?? [];
    const blockedWindows = blockedBySpecialist.get(specialist.id) ?? [];

    for (
      let start = entryStart;
      start + durationMin <= entryEnd;
      start += SLOT_STEP_MIN
    ) {
      const candidate = { start, end: start + durationMin };
      if (breaks.some((br) => overlaps(candidate, br))) continue;
      if (appointmentWindows.some((appt) => overlaps(candidate, appt))) continue;
      if (blockedWindows.some((blocked) => overlaps(candidate, blocked))) continue;

      slots.push({ time: minutesToTime(start), specialistId: specialist.id });
    }
  });

  return jsonOk({ slots });
}
