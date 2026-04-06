import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import {
  verifyHoldProofToken,
  BOOKING_HOLD_COOKIE,
  ensureHoldProofSecretConfigured,
  HoldProofSecretMissingError,
} from "@/lib/public-booking-hold-proof";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  getLocationWorkWindowForDate,
  getNowInTimeZone,
  isPastDateOrTimeInTz,
  resolvePublicAccount,
  toMinutes,
  zonedDayRangeUtc,
  zonedTimeToUtc,
} from "@/lib/public-booking";

type Window = { start: number; end: number };
const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  try {
    ensureHoldProofSecretConfigured();
  } catch (error) {
    if (error instanceof HoldProofSecretMissingError) {
      return jsonError(
        "SERVER_MISCONFIGURED",
        "Подтверждение резерва временно недоступно.",
        null,
        500
      );
    }
    throw error;
  }

  const limited = enforceRateLimit({
    request,
    scope: `booking:appointments:${resolved.account.id}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const tz = resolved.account.timeZone;
  const nowTz = getNowInTimeZone(tz);

  const body = (await request.json().catch(() => null)) as {
    locationId?: number;
    specialistId?: number;
    serviceId?: number;
    serviceIds?: number[];
    date?: string;
    time?: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    comment?: string;
    legalVersionIds?: number[];
    holdId?: number;
    sessionKey?: string;
    groupBookingId?: string;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const locationId = Number(body.locationId);
  let specialistId = Number(body.specialistId);
  const serviceId = Number(body.serviceId);
  const serviceIds = Array.isArray(body.serviceIds)
    ? body.serviceIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const selectedServiceIds = Array.from(
    new Set([...(Number.isInteger(serviceId) && serviceId > 0 ? [serviceId] : []), ...serviceIds])
  );
  const dateValue = String(body.date ?? "").trim();
  const timeValue = String(body.time ?? "").trim();

  const clientName = String(body.clientName ?? "").trim();
  const clientPhoneRaw = String(body.clientPhone ?? "").trim();
  const clientPhone = normalizeRuPhone(clientPhoneRaw);
  const clientEmail = String(body.clientEmail ?? "").trim();
  const comment = String(body.comment ?? "").trim();
  const holdId = Number.isInteger(Number(body.holdId)) ? Number(body.holdId) : null;
  const sessionKeyRaw = String(body.sessionKey ?? "").trim();
  const sessionKey = sessionKeyRaw && sessionKeyRaw.length <= 128 ? sessionKeyRaw : "";
  const groupBookingIdRaw = String(body.groupBookingId ?? "").trim();
  const groupBookingId =
    groupBookingIdRaw && groupBookingIdRaw.length <= 64 ? groupBookingIdRaw : null;

  const legalVersionIds = Array.isArray(body.legalVersionIds)
    ? body.legalVersionIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const requestedLegalVersionIds = Array.from(new Set(legalVersionIds)).sort((a, b) => a - b);

  const rawIdempotencyKey =
    request.headers.get("idempotency-key") ?? request.headers.get("Idempotency-Key");
  const idempotencyKey = rawIdempotencyKey?.trim() || "";

  if (!Number.isInteger(specialistId) || specialistId <= 0) {
    specialistId = NaN;
  }

  if (!Number.isInteger(specialistId) && holdId) {
    const holdSpecialist = await prisma.appointmentHold.findFirst({
      where: { id: holdId, accountId: resolved.account.id },
      select: { specialistId: true, startAt: true, endAt: true, expiresAt: true },
    });
    if (holdSpecialist?.specialistId) {
      specialistId = holdSpecialist.specialistId;
    }
  }

  if (
    !Number.isInteger(locationId) ||
    locationId <= 0 ||
    !Number.isInteger(specialistId) ||
    specialistId <= 0 ||
    selectedServiceIds.length === 0 ||
    !dateValue ||
    !timeValue
  ) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }
  if (!holdId) {
    return jsonError("HOLD_REQUIRED", "Сначала зарезервируйте слот.", null, 400);
  }

  if (clientName.length < 2 || !clientPhone) {
    return jsonError("CLIENT_REQUIRED", "Укажите корректные имя и телефон клиента.", null, 400);
  }

  if (dateValue < nowTz.ymd) {
    return jsonError("PAST_DATE", "Нельзя записаться на прошедшую дату.", null, 400);
  }
  if (isPastDateOrTimeInTz(dateValue, timeValue, tz)) {
    return jsonError("PAST_TIME", "Нельзя записаться на прошедшее время.", null, 400);
  }

  const range = zonedDayRangeUtc(dateValue, tz);
  if (!range) {
    return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  }
  const { dayStartUtc, dayEndUtc } = range;

  const startAtUtc = zonedTimeToUtc(dateValue, timeValue, tz);
  if (!startAtUtc || Number.isNaN(startAtUtc.getTime())) {
    return jsonError("INVALID_TIME", "Некорректное время.", null, 400);
  }

  const [location, specialist, services, scheduleEntry] = await Promise.all([
    prisma.location.findFirst({
      where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
      select: {
        id: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
      },
    }),
    prisma.specialistProfile.findFirst({
      where: {
        id: specialistId,
        accountId: resolved.account.id,
        locations: { some: { locationId } },
        AND: selectedServiceIds.map((id) => ({ services: { some: { serviceId: id } } })),
      },
      select: { id: true, levelId: true },
    }),
    prisma.service.findMany({
      where: {
        id: { in: selectedServiceIds },
        accountId: resolved.account.id,
        isActive: true,
        locations: { some: { locationId } },
      },
      select: {
        id: true,
        baseDurationMin: true,
        basePrice: true,
        allowMultiServiceBooking: true,
        bookingType: true,
        groupCapacityDefault: true,
        specialists: {
          select: {
            specialistId: true,
            priceOverride: true,
            durationOverrideMin: true,
          },
        },
        levelConfigs: {
          select: {
            levelId: true,
            price: true,
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
  ]);

  if (!location) return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  if (!specialist) return jsonError("SPECIALIST_NOT_FOUND", "Специалист не найден.", null, 404);
  if (!services || services.length !== selectedServiceIds.length) {
    return jsonError("SERVICE_NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  if (selectedServiceIds.length > 1 && services.some((s) => !s.allowMultiServiceBooking)) {
    return jsonError(
      "MULTI_SERVICE_NOT_ALLOWED",
      "Выбранные услуги нельзя записывать вместе.",
      null,
      400
    );
  }
  if (services.some((s) => s.bookingType === "GROUP")) {
    return jsonError(
      "GROUP_SERVICE_NOT_ALLOWED",
      "Эта услуга доступна только как групповая запись.",
      null,
      400
    );
  }


  const locationWindow = getLocationWorkWindowForDate(location, dateValue);
  if (locationWindow.isClosed) {
    return jsonError(
      "LOCATION_CLOSED",
      "На выбранную дату локация закрыта (учтены исключения и праздники).",
      null,
      400
    );
  }

  const computedServices = services.map((service) => {
    const override = service.specialists.find((item) => item.specialistId === specialist.id);
    const levelConfig = specialist.levelId
      ? service.levelConfigs.find((item) => item.levelId === specialist.levelId)
      : null;

    const durationMin =
      override?.durationOverrideMin ?? levelConfig?.durationMin ?? service.baseDurationMin;
    const price =
      toNumber(override?.priceOverride) ||
      toNumber(levelConfig?.price) ||
      toNumber(service.basePrice);

    return { service, durationMin, price };
  });

  const durationMin = computedServices.reduce(
    (sum, item) => sum + (Number.isFinite(item.durationMin) ? Number(item.durationMin) : 0),
    0
  );
  const priceTotal = computedServices.reduce((sum, item) => sum + toNumber(item.price), 0);

  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    return jsonError(
      "INVALID_DURATION",
      "Некорректная длительность услуги.",
      null,
      400
    );
  }

  if (!scheduleEntry || scheduleEntry.type !== "WORKING") {
    return jsonError("NO_WORKDAY", "У специалиста нет рабочего дня на выбранную дату.", null, 400);
  }

  if (scheduleEntry.locationId !== locationId) {
    return jsonError(
      "NO_WORKDAY",
      "У специалиста нет рабочего дня в выбранной локации на эту дату.",
      null,
      400
    );
  }

  const entryStart = toMinutes(scheduleEntry.startTime ?? "");
  const entryEnd = toMinutes(scheduleEntry.endTime ?? "");
  const startMinutes = toMinutes(timeValue);

  if (
    entryStart == null ||
    entryEnd == null ||
    startMinutes == null ||
    startMinutes < entryStart ||
    startMinutes + durationMin > entryEnd ||
    startMinutes < locationWindow.startMinutes ||
    startMinutes + durationMin > locationWindow.endMinutes
  ) {
    return jsonError(
      "OUT_OF_WORKING_HOURS",
      "Выбранное время выходит за пределы режима работы локации или графика специалиста.",
      null,
      400
    );
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

  const cookieStore = await cookies();
  const holdProof = cookieStore.get(BOOKING_HOLD_COOKIE)?.value ?? "";
  const holdProofValid = verifyHoldProofToken(holdProof, {
    holdId,
    accountId: resolved.account.id,
    specialistId,
    startAt: startAtUtc,
    endAt: endAtUtc,
  });
  if (!holdProofValid) {
    const response = jsonError(
      "HOLD_INVALID",
      "Резерв времени не подтвержден. Пожалуйста, выберите слот снова.",
      null,
      409
    );
    response.cookies.delete(BOOKING_HOLD_COOKIE);
    return response;
  }

  const [requiredDocs, allowedVersions] = await Promise.all([
    prisma.legalDocument.findMany({
      where: { accountId: resolved.account.id, isRequired: true },
      select: {
        id: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    requestedLegalVersionIds.length > 0
      ? prisma.legalDocumentVersion.findMany({
          where: {
            id: { in: requestedLegalVersionIds },
            isActive: true,
            document: { accountId: resolved.account.id },
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const requiredVersionIds = requiredDocs
    .map((doc) => doc.versions[0]?.id)
    .filter((id): id is number => Number.isInteger(id));

  const allowedSet = new Set(allowedVersions.map((v) => v.id));
  const normalizedLegalVersionIds = requestedLegalVersionIds.filter((id) => allowedSet.has(id));

  if (requiredVersionIds.length > 0) {
    const provided = new Set(normalizedLegalVersionIds);
    const missing = requiredVersionIds.filter((id) => !provided.has(id));
    if (missing.length > 0) {
      return jsonError(
        "LEGAL_REQUIRED",
        "Необходимо согласие с обязательными документами.",
        { missingVersionIds: missing },
        400
      );
    }
  }

  let idempotencyRecordId: number | null = null;
  let requestHash: string | null = null;

  if (idempotencyKey) {
    requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          locationId,
          specialistId,
          serviceId,
          serviceIds: selectedServiceIds,
          groupBookingId,
          date: dateValue,
          time: timeValue,
          clientName,
          clientPhone,
          clientEmail,
          comment,
          legalVersionIds: requestedLegalVersionIds,
        })
      )
      .digest("hex");

    try {
      const created = await prisma.idempotencyKey.create({
        data: {
          accountId: resolved.account.id,
          key: idempotencyKey,
          requestHash,
          status: "PROCESSING",
        },
        select: { id: true },
      });
      idempotencyRecordId = created.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await prisma.idempotencyKey.findUnique({
          where: {
            accountId_key: {
              accountId: resolved.account.id,
              key: idempotencyKey,
            },
          },
        });

        if (!existing) {
          return jsonError("IDEMPOTENCY_CONFLICT", "Конфликт идемпотентности.", null, 409);
        }

        if (existing.requestHash !== requestHash) {
          return jsonError(
            "IDEMPOTENCY_CONFLICT",
            "Другой запрос с тем же ключом идемпотентности.",
            null,
            409
          );
        }

        if (existing.response) {
          return NextResponse.json(existing.response);
        }

        return jsonError(
          "IDEMPOTENCY_IN_PROGRESS",
          "Запрос с этим ключом уже выполняется.",
          null,
          409
        );
      }

      throw error;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const conflictAppt = await tx.appointment.findFirst({
        where: {
          accountId: resolved.account.id,
          locationId,
          specialistId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startAt: { lt: endAtUtc },
          endAt: { gt: startAtUtc },
        },
        select: { id: true },
      });

      if (conflictAppt) {
        return {
          ok: false as const,
          error: jsonError("TIME_BUSY", "Выбранное время уже занято.", null, 409),
        };
      }
      const conflictGroup = await tx.groupSession.findFirst({
        where: {
          accountId: resolved.account.id,
          locationId,
          specialistId,
          status: { not: "CANCELLED" },
          startAt: { lt: endAtUtc },
          endAt: { gt: startAtUtc },
        },
        select: { id: true },
      });

      if (conflictGroup) {
        return {
          ok: false as const,
          error: jsonError("TIME_BUSY", "Выбранное время уже занято.", null, 409),
        };
      }


      const conflictBlock = await tx.blockedSlot.findFirst({
        where: {
          accountId: resolved.account.id,
          startAt: { lt: endAtUtc },
          endAt: { gt: startAtUtc },
          OR: [{ locationId }, { specialistId }],
        },
        select: { id: true },
      });

      if (conflictBlock) {
        return {
          ok: false as const,
          error: jsonError("TIME_BLOCKED", "Выбранное время недоступно.", null, 409),
        };
      }

      const conflictHold = await tx.appointmentHold.findFirst({
        where: {
          accountId: resolved.account.id,
          specialistId,
          expiresAt: { gt: new Date() },
          startAt: { lt: endAtUtc },
          endAt: { gt: startAtUtc },
          ...(holdId ? { id: { not: holdId } } : {}),
        },
        select: { id: true },
      });

      if (conflictHold) {
        return {
          ok: false as const,
          error: jsonError("TIME_HELD", "Это время сейчас резервируется другим клиентом.", null, 409),
        };
      }

      if (holdId) {
        const ownHold = await tx.appointmentHold.findFirst({
          where: {
            id: holdId,
            accountId: resolved.account.id,
            specialistId,
            startAt: startAtUtc,
            endAt: endAtUtc,
            expiresAt: { gt: new Date() },
          },
          select: { id: true, specialistId: true },
        });

        if (!ownHold) {
          return {
            ok: false as const,
            error: jsonError("HOLD_EXPIRED", "Резерв времени истек или не найден.", null, 409),
          };
        }

        specialistId = ownHold.specialistId;
      }

      const clientByPhone = clientPhone
        ? await tx.client.findFirst({
            where: { accountId: resolved.account.id, phone: clientPhone },
          })
        : null;
      const clientByEmail = clientEmail
        ? await tx.client.findFirst({
            where: { accountId: resolved.account.id, email: clientEmail },
          })
        : null;

      if (clientByPhone && clientByEmail && clientByPhone.id !== clientByEmail.id) {
        return {
          ok: false as const,
          error: jsonError(
            "CLIENT_CONFLICT",
            "Телефон и email принадлежат разным клиентам. Проверьте контактные данные.",
            null,
            409
          ),
        };
      }

      let client = clientByPhone ?? clientByEmail;
      if (!client) {
        client = await tx.client.create({
          data: {
            accountId: resolved.account.id,
            firstName: clientName || null,
            phone: clientPhone || null,
            email: clientEmail || null,
          },
        });
      } else {
        await tx.client.update({
          where: { id: client.id },
          data: {
            firstName: client.firstName ?? (clientName || null),
            phone: client.phone ?? (clientPhone || null),
            email: client.email ?? (clientEmail || null),
          },
        });
      }

      const finalSpecialistId = Number(specialistId);
      if (!Number.isInteger(finalSpecialistId) || finalSpecialistId <= 0) {
        return {
          ok: false as const,
          error: jsonError("SPECIALIST_REQUIRED", "Специалист не выбран.", null, 400),
        };
      }

      const appointment = await tx.appointment.create({
        data: {
          accountId: resolved.account.id,
          locationId,
          specialistId: finalSpecialistId,
          clientId: client.id,
          startAt: startAtUtc,
          endAt: endAtUtc,
          status: "NEW",
          priceTotal,
          durationTotalMin: durationMin,
          source: "online",
          groupBookingId,
          comment: comment || null,
        },
        select: { id: true },
      });

      for (let index = 0; index < computedServices.length; index += 1) {
        const item = computedServices[index];
        await tx.$executeRaw`
          INSERT INTO "public"."AppointmentService"
            ("appointmentId", "serviceId", "price", "durationMin", "orderIndex", "specialistId")
          VALUES
            (${appointment.id}, ${item.service.id}, ${toNumber(item.price)}, ${
          Number.isFinite(item.durationMin) ? Number(item.durationMin) : 0
        }, ${index}, ${finalSpecialistId})
        `;
      }

      if (sessionKey) {
        const sessionTimestamp = new Date();
        const txAny = tx as any;
        await txAny.onlineBookingSession.upsert({
          where: {
            accountId_sessionKey: {
              accountId: resolved.account.id,
              sessionKey,
            },
          },
          create: {
            accountId: resolved.account.id,
            sessionKey,
            startedAt: sessionTimestamp,
            lastSeenAt: sessionTimestamp,
            appointmentId: appointment.id,
            clientId: client.id,
          },
          update: {
            lastSeenAt: sessionTimestamp,
            appointmentId: appointment.id,
            clientId: client.id,
          },
        });
      }

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          actorType: "client",
          actorId: null,
          fromStatus: null,
          toStatus: "NEW",
          comment: null,
        },
      });

      if (normalizedLegalVersionIds.length > 0) {
        const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? null;
        const userAgent = request.headers.get("user-agent") ?? null;

        await tx.legalAcceptance.createMany({
          data: normalizedLegalVersionIds.map((versionId) => ({
            accountId: resolved.account.id,
            documentVersionId: versionId,
            appointmentId: appointment.id,
            clientId: client.id,
            source: "public_booking",
            ip,
            userAgent,
          })),
        });
      }

      if (holdId) {
        await tx.appointmentHold.deleteMany({
          where: { id: holdId, accountId: resolved.account.id },
        });
      }

      return { ok: true as const, appointmentId: appointment.id };
    });

    if (!result.ok) {
      if (idempotencyRecordId) {
        await prisma.idempotencyKey.delete({ where: { id: idempotencyRecordId } }).catch(() => {});
      }
      return result.error;
    }

    const responsePayload = { data: { appointmentId: result.appointmentId } };

    if (idempotencyRecordId) {
      await prisma.idempotencyKey.update({
        where: { id: idempotencyRecordId },
        data: {
          status: "DONE",
          response: responsePayload,
        },
      });
    }

    const response = NextResponse.json(responsePayload);
    response.cookies.delete(BOOKING_HOLD_COOKIE);
    return response;
  } catch (error) {
    if (idempotencyRecordId) {
      await prisma.idempotencyKey.delete({ where: { id: idempotencyRecordId } }).catch(() => {});
    }
    throw error;
  }
}


