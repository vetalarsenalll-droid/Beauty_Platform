import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getNowInTimeZone,
  isPastDateOrTimeInTz,
  resolvePublicAccount,
  toMinutes,
  zonedDayRangeUtc,
  zonedTimeToUtc,
} from "@/lib/public-booking";

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

type Window = { start: number; end: number };
const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const tz = resolved.account.timeZone;
  const nowTz = getNowInTimeZone(tz);

  const body = (await request.json().catch(() => null)) as {
    locationId?: number;
    specialistId?: number;
    serviceId?: number;
    date?: string;
    time?: string;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const locationId = Number(body.locationId);
  const specialistId = Number(body.specialistId);
  const serviceId = Number(body.serviceId);
  const dateValue = String(body.date ?? "").trim();
  const timeValue = String(body.time ?? "").trim();

  if (
    !Number.isInteger(locationId) ||
    locationId <= 0 ||
    !Number.isInteger(specialistId) ||
    specialistId <= 0 ||
    !Number.isInteger(serviceId) ||
    serviceId <= 0 ||
    !dateValue ||
    !timeValue
  ) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  if (dateValue < nowTz.ymd || isPastDateOrTimeInTz(dateValue, timeValue, tz)) {
    return jsonError("PAST_TIME", "Нельзя создать резерв в прошедшем времени.", null, 400);
  }

  const range = zonedDayRangeUtc(dateValue, tz);
  if (!range) return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  const { dayStartUtc, dayEndUtc } = range;

  const startAtUtc = zonedTimeToUtc(dateValue, timeValue, tz);
  if (!startAtUtc || Number.isNaN(startAtUtc.getTime())) {
    return jsonError("INVALID_TIME", "Некорректное время.", null, 400);
  }

  const [location, specialist, service, scheduleEntry, setting] = await Promise.all([
    prisma.location.findFirst({
      where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.specialistProfile.findFirst({
      where: {
        id: specialistId,
        accountId: resolved.account.id,
        locations: { some: { locationId } },
      },
      select: { id: true, levelId: true },
    }),
    prisma.service.findFirst({
      where: {
        id: serviceId,
        accountId: resolved.account.id,
        isActive: true,
        locations: { some: { locationId } },
      },
      select: {
        id: true,
        baseDurationMin: true,
        basePrice: true,
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
    }),
    prisma.scheduleEntry.findFirst({
      where: {
        accountId: resolved.account.id,
        specialistId,
        locationId,
        date: { gte: dayStartUtc, lt: dayEndUtc },
      },
      include: { breaks: true },
    }),
    prisma.accountSetting.findUnique({
      where: { accountId: resolved.account.id },
      select: { holdTtlMinutes: true },
    }),
  ]);

  if (!location) return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  if (!specialist) return jsonError("SPECIALIST_NOT_FOUND", "Специалист не найден.", null, 404);
  if (!service) return jsonError("SERVICE_NOT_FOUND", "Услуга не найдена.", null, 404);

  const override = service.specialists.find((item) => item.specialistId === specialist.id);
  const levelConfig = specialist.levelId
    ? service.levelConfigs.find((item) => item.levelId === specialist.levelId)
    : null;
  const durationMin = override?.durationOverrideMin ?? levelConfig?.durationMin ?? service.baseDurationMin;

  if (!scheduleEntry || scheduleEntry.type !== "WORKING" || scheduleEntry.locationId !== locationId) {
    return jsonError("NO_WORKDAY", "У специалиста нет рабочего дня в выбранной локации.", null, 400);
  }

  const entryStart = toMinutes(scheduleEntry.startTime ?? "");
  const entryEnd = toMinutes(scheduleEntry.endTime ?? "");
  const startMinutes = toMinutes(timeValue);
  if (
    entryStart == null ||
    entryEnd == null ||
    startMinutes == null ||
    startMinutes < entryStart ||
    startMinutes + durationMin > entryEnd
  ) {
    return jsonError("OUT_OF_WORKING_HOURS", "Выбранное время вне рабочего графика.", null, 400);
  }

  const candidateLocal: Window = { start: startMinutes, end: startMinutes + durationMin };
  const breaks = scheduleEntry.breaks
    .map((item) => ({
      start: toMinutes(item.startTime) ?? 0,
      end: toMinutes(item.endTime) ?? 0,
    }))
    .filter((item) => item.start < item.end);
  if (breaks.some((br) => overlaps(candidateLocal, br))) {
    return jsonError("OVERLAP_BREAK", "Выбранное время попадает на перерыв.", null, 400);
  }

  const endAtUtc = new Date(startAtUtc);
  endAtUtc.setUTCMinutes(endAtUtc.getUTCMinutes() + durationMin);

  const ttlMinutes = Math.min(Math.max(setting?.holdTtlMinutes ?? 5, 1), 30);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const [conflictAppt, conflictBlock, conflictHold] = await Promise.all([
            tx.appointment.findFirst({
              where: {
                accountId: resolved.account.id,
                locationId,
                specialistId,
                status: { notIn: ["CANCELLED", "NO_SHOW"] },
                startAt: { lt: endAtUtc },
                endAt: { gt: startAtUtc },
              },
              select: { id: true },
            }),
            tx.blockedSlot.findFirst({
              where: {
                accountId: resolved.account.id,
                startAt: { lt: endAtUtc },
                endAt: { gt: startAtUtc },
                OR: [{ locationId }, { specialistId }],
              },
              select: { id: true },
            }),
            tx.appointmentHold.findFirst({
              where: {
                accountId: resolved.account.id,
                specialistId,
                expiresAt: { gt: now },
                startAt: { lt: endAtUtc },
                endAt: { gt: startAtUtc },
              },
              select: { id: true },
            }),
          ]);

          if (conflictAppt || conflictBlock || conflictHold) {
            return { ok: false as const };
          }

          const hold = await tx.appointmentHold.create({
            data: {
              accountId: resolved.account.id,
              specialistId,
              startAt: startAtUtc,
              endAt: endAtUtc,
              expiresAt,
            },
            select: { id: true, expiresAt: true },
          });

          return { ok: true as const, hold };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      if (!result.ok) {
        return jsonError("TIME_BUSY", "Выбранное время недоступно.", null, 409);
      }

      return jsonOk({
        holdId: result.hold.id,
        expiresAt: result.hold.expiresAt.toISOString(),
        durationMin,
        priceTotal: toNumber(service.basePrice),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        continue;
      }
      throw error;
    }
  }

  return jsonError("TIME_BUSY", "Выбранное время недоступно.", null, 409);
}