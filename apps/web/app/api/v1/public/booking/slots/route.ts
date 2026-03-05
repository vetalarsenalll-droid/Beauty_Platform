import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getAccountSlotStepMinutes,
  minutesToTime,
  resolvePublicAccount,
  toMinutes,
  toZonedLocalMinutes,
  zonedDayRangeUtc,
  parsePositiveInt,
  getNowInTimeZone,
} from "@/lib/public-booking";
import { BOOKING_HOLD_COOKIE, parseHoldProofToken } from "@/lib/public-booking-hold-proof";

type Window = { start: number; end: number };
const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;

const toRangeInTz = (startAt: Date, endAt: Date, timeZone: string) => ({
  start: toZonedLocalMinutes(startAt, timeZone),
  end: toZonedLocalMinutes(endAt, timeZone),
});

function readCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  if (!cookieHeader) return "";
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    if (key !== name) continue;
    return decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return "";
}

export async function GET(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const slotStepMinutes = await getAccountSlotStepMinutes(resolved.account.id);
  const nowTz = getNowInTimeZone(tz);

  const { searchParams } = new URL(request.url);

  const locationId = parsePositiveInt(searchParams.get("locationId"));
  const dateValue = String(searchParams.get("date") ?? "").trim();

  // если параметр отсутствует -> null, а не 0
  const serviceId = parsePositiveInt(searchParams.get("serviceId"));
  const specialistId = parsePositiveInt(searchParams.get("specialistId"));
  const holdOwnerMarkerRaw = Number(searchParams.get("holdOwnerMarker"));
  const holdOwnerMarker = Number.isInteger(holdOwnerMarkerRaw) ? holdOwnerMarkerRaw : null;
  const holdProofToken = readCookieValue(request, BOOKING_HOLD_COOKIE);
  const holdProofPayload = parseHoldProofToken(holdProofToken);
  const ownProofHoldId =
    holdProofPayload && holdProofPayload.accountId === resolved.account.id
      ? holdProofPayload.holdId
      : null;

  if (!locationId || !dateValue) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const range = zonedDayRangeUtc(dateValue, tz);
  if (!range) {
    return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  }
  const { dayStartUtc, dayEndUtc } = range;

  // серверная защита от прошлых дат
  if (dateValue < nowTz.ymd) {
    return jsonOk({ slots: [] });
  }

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
      ...(serviceId ? { services: { some: { serviceId } } } : {}),
      ...(specialistId ? { id: specialistId } : {}),
    },
    select: {
      id: true,
      levelId: true,
    },
  });

  if (!specialists.length) return jsonOk({ slots: [] });

  const specialistIds = specialists.map((s) => s.id);

  const [scheduleEntries, appointments, blockedSlots, holds, service] = await Promise.all([
    // ✅ ВАЖНО: ТОЛЬКО график выбранной локации (без locationId:null)
    prisma.scheduleEntry.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId: { in: specialistIds },
        date: { gte: dayStartUtc, lt: dayEndUtc },
        locationId,
      },
      include: { breaks: true },
    }),

    prisma.appointment.findMany({
      where: {
        accountId: resolved.account.id,
        locationId,
        specialistId: { in: specialistIds },
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),

    prisma.blockedSlot.findMany({
      where: {
        accountId: resolved.account.id,
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
        OR: [
          { locationId }, // блокировка на локацию
          { specialistId: { in: specialistIds } }, // блокировка на специалиста
        ],
      },
      select: { locationId: true, specialistId: true, startAt: true, endAt: true },
    }),
    prisma.appointmentHold.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId: { in: specialistIds },
        expiresAt: { gt: new Date() },
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
        ...(holdOwnerMarker != null ? { clientId: { not: holdOwnerMarker } } : {}),
        ...(ownProofHoldId ? { id: { not: ownProofHoldId } } : {}),
      },
      select: { specialistId: true, startAt: true, endAt: true },
    }),

    serviceId
      ? prisma.service.findFirst({
          where: {
            id: serviceId,
            accountId: resolved.account.id,
            isActive: true,
            locations: { some: { locationId } },
          },
          select: {
            id: true,
            baseDurationMin: true,
            specialists: {
              select: { specialistId: true, durationOverrideMin: true },
            },
            levelConfigs: {
              select: { levelId: true, durationMin: true },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (serviceId && !service) {
    return jsonOk({ slots: [] });
  }

  // ✅ Теперь график строго по локации: на специалиста должен быть максимум один entry на день.
  // Но на всякий случай оставим "последний победил" (если вдруг в БД дубликаты).
  const scheduleBySpecialist = new Map<number, (typeof scheduleEntries)[number]>();
  for (const entry of scheduleEntries) {
    scheduleBySpecialist.set(entry.specialistId, entry);
  }

  const appointmentsBySpecialist = new Map<number, Window[]>();
  for (const appt of appointments) {
    const list = appointmentsBySpecialist.get(appt.specialistId) ?? [];
    list.push(toRangeInTz(appt.startAt, appt.endAt, tz));
    appointmentsBySpecialist.set(appt.specialistId, list);
  }

  const blockedBySpecialist = new Map<number, Window[]>();
  for (const blk of blockedSlots) {
    const w = toRangeInTz(blk.startAt, blk.endAt, tz);

    if (blk.specialistId) {
      const list = blockedBySpecialist.get(blk.specialistId) ?? [];
      list.push(w);
      blockedBySpecialist.set(blk.specialistId, list);
      continue;
    }

    // location-wide блокировка: применяем ко всем специалистам (в выбранной локации)
    for (const sp of specialists) {
      const list = blockedBySpecialist.get(sp.id) ?? [];
      list.push(w);
      blockedBySpecialist.set(sp.id, list);
    }
  }

  const holdsBySpecialist = new Map<number, Window[]>();
  for (const item of holds) {
    const list = holdsBySpecialist.get(item.specialistId) ?? [];
    list.push(toRangeInTz(item.startAt, item.endAt, tz));
    holdsBySpecialist.set(item.specialistId, list);
  }

  const slots: Array<{ time: string; specialistId: number }> = [];

  for (const sp of specialists) {
    const entry = scheduleBySpecialist.get(sp.id);
    if (!entry || entry.type !== "WORKING") continue;

    // доп.защита: entry должен быть именно по этой локации
    if (entry.locationId !== locationId) continue;

    const entryStart = toMinutes(entry.startTime ?? "");
    const entryEnd = toMinutes(entry.endTime ?? "");
    if (entryStart == null || entryEnd == null) continue;

    const durationMin = service
      ? service.specialists.find((x) => x.specialistId === sp.id)?.durationOverrideMin ??
        service.levelConfigs.find((x) => x.levelId === sp.levelId)?.durationMin ??
        service.baseDurationMin
      : slotStepMinutes;

    const breaks = entry.breaks
      .map((b) => ({
        start: toMinutes(b.startTime) ?? 0,
        end: toMinutes(b.endTime) ?? 0,
      }))
      .filter((x) => x.start < x.end);

    const apptWindows = appointmentsBySpecialist.get(sp.id) ?? [];
    const blkWindows = blockedBySpecialist.get(sp.id) ?? [];
    const holdWindows = holdsBySpecialist.get(sp.id) ?? [];

    for (let start = entryStart; start + durationMin <= entryEnd; start += slotStepMinutes) {
      const candidate: Window = { start, end: start + durationMin };

      // запрет прошедшего времени на сегодня в TZ аккаунта
      if (dateValue === nowTz.ymd && start <= nowTz.minutes) continue;

      if (breaks.some((br) => overlaps(candidate, br))) continue;
      if (apptWindows.some((w) => overlaps(candidate, w))) continue;
      if (blkWindows.some((w) => overlaps(candidate, w))) continue;
      if (holdWindows.some((w) => overlaps(candidate, w))) continue;

      slots.push({ time: minutesToTime(start), specialistId: sp.id });
    }
  }

  return jsonOk({ slots });
}
