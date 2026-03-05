import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BOOKING_HOLD_COOKIE,
  createHoldProofToken,
  verifyHoldProofToken,
} from "@/lib/public-booking-hold-proof";
import { enforceRateLimit } from "@/lib/rate-limit";
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
const readCookieValue = (request: Request, name: string) => {
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
};

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const limited = enforceRateLimit({
    request,
    scope: `booking:holds:${resolved.account.id}`,
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const tz = resolved.account.timeZone;
  const nowTz = getNowInTimeZone(tz);

  const body = (await request.json().catch(() => null)) as {
    locationId?: number;
    specialistId?: number;
    serviceId?: number;
    date?: string;
    time?: string;
    replaceHoldId?: number;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const locationId = Number(body.locationId);
  const specialistId = Number(body.specialistId);
  const serviceId = Number(body.serviceId);
  const dateValue = String(body.date ?? "").trim();
  const timeValue = String(body.time ?? "").trim();
  const replaceHoldId = Number.isInteger(Number(body.replaceHoldId)) ? Number(body.replaceHoldId) : null;
  const holdProofToken = readCookieValue(request, BOOKING_HOLD_COOKIE);
  const session = await getClientSession();
  const holdClientId =
    session?.clients.find((item) => item.accountId === resolved.account.id)?.clientId ??
    session?.clients.find((item) => item.accountSlug === resolved.account.slug)?.clientId ??
    null;

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
        services: { some: { serviceId } },
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
          if (replaceHoldId && holdProofToken) {
            const replaceHold = await tx.appointmentHold.findFirst({
              where: { id: replaceHoldId, accountId: resolved.account.id },
              select: {
                id: true,
                specialistId: true,
                startAt: true,
                endAt: true,
              },
            });

            if (
              replaceHold &&
              verifyHoldProofToken(holdProofToken, {
                holdId: replaceHold.id,
                accountId: resolved.account.id,
                specialistId: replaceHold.specialistId,
                startAt: replaceHold.startAt,
                endAt: replaceHold.endAt,
              })
            ) {
              await tx.appointmentHold.deleteMany({
                where: { id: replaceHold.id, accountId: resolved.account.id },
              });
            }
          }

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
                ...(replaceHoldId ? { id: { not: replaceHoldId } } : {}),
                ...(holdClientId != null ? { NOT: { clientId: holdClientId } } : {}),
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
              clientId: holdClientId,
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

      const response = jsonOk({
        holdId: result.hold.id,
        expiresAt: result.hold.expiresAt.toISOString(),
        durationMin,
        priceTotal: toNumber(service.basePrice),
      });

      response.cookies.set(
        BOOKING_HOLD_COOKIE,
        createHoldProofToken({
          holdId: result.hold.id,
          accountId: resolved.account.id,
          specialistId,
          startAt: startAtUtc.toISOString(),
          endAt: endAtUtc.toISOString(),
          expiresAt: result.hold.expiresAt.toISOString(),
        }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          expires: result.hold.expiresAt,
        }
      );

      return response;
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


export async function DELETE(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const body = (await request.json().catch(() => null)) as { holdId?: number } | null;
  const holdId = Number.isInteger(Number(body?.holdId)) ? Number(body?.holdId) : null;
  if (!holdId) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  const holdProofToken = readCookieValue(request, BOOKING_HOLD_COOKIE);
  if (!holdProofToken) {
    return jsonError("HOLD_FORBIDDEN", "Резерв не подтвержден.", null, 403);
  }

  const hold = await prisma.appointmentHold.findFirst({
    where: { id: holdId, accountId: resolved.account.id },
    select: { id: true, specialistId: true, startAt: true, endAt: true },
  });

  if (!hold) {
    const response = jsonOk({ ok: true });
    response.cookies.set(BOOKING_HOLD_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const valid = verifyHoldProofToken(holdProofToken, {
    holdId: hold.id,
    accountId: resolved.account.id,
    specialistId: hold.specialistId,
    startAt: hold.startAt,
    endAt: hold.endAt,
  });
  if (!valid) {
    return jsonError("HOLD_FORBIDDEN", "Резерв не подтвержден.", null, 403);
  }

  await prisma.appointmentHold.deleteMany({
    where: { id: hold.id, accountId: resolved.account.id },
  });

  const response = jsonOk({ ok: true });
  response.cookies.set(BOOKING_HOLD_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
