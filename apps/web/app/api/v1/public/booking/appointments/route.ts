import { createHash } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { verifyHoldProofToken, BOOKING_HOLD_COOKIE } from "@/lib/public-booking-hold-proof";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
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
    date?: string;
    time?: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    comment?: string;
    legalVersionIds?: number[];
    holdId?: number;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ Р·Р°РїСЂРѕСЃ.", null, 400);
  }

  const locationId = Number(body.locationId);
  const specialistId = Number(body.specialistId);
  const serviceId = Number(body.serviceId);
  const dateValue = String(body.date ?? "").trim();
  const timeValue = String(body.time ?? "").trim();

  const clientName = String(body.clientName ?? "").trim();
  const clientPhone = String(body.clientPhone ?? "").trim();
  const clientEmail = String(body.clientEmail ?? "").trim();
  const comment = String(body.comment ?? "").trim();
  const holdId = Number.isInteger(Number(body.holdId)) ? Number(body.holdId) : null;

  const legalVersionIds = Array.isArray(body.legalVersionIds)
    ? body.legalVersionIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const requestedLegalVersionIds = Array.from(new Set(legalVersionIds)).sort((a, b) => a - b);

  const rawIdempotencyKey =
    request.headers.get("idempotency-key") ?? request.headers.get("Idempotency-Key");
  const idempotencyKey = rawIdempotencyKey?.trim() || "";

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
    return jsonError("INVALID_REQUEST", "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹.", null, 400);
  }
  if (!holdId) {
    return jsonError("HOLD_REQUIRED", "РЎРЅР°С‡Р°Р»Р° Р·Р°СЂРµР·РµСЂРІРёСЂСѓР№С‚Рµ СЃР»РѕС‚.", null, 400);
  }

  if (clientName.length < 2 || clientPhone.length < 8) {
    return jsonError("CLIENT_REQUIRED", "РЈРєР°Р¶РёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Рµ РёРјСЏ Рё С‚РµР»РµС„РѕРЅ РєР»РёРµРЅС‚Р°.", null, 400);
  }

  if (dateValue < nowTz.ymd) {
    return jsonError("PAST_DATE", "РќРµР»СЊР·СЏ Р·Р°РїРёСЃР°С‚СЊСЃСЏ РЅР° РїСЂРѕС€РµРґС€СѓСЋ РґР°С‚Сѓ.", null, 400);
  }
  if (isPastDateOrTimeInTz(dateValue, timeValue, tz)) {
    return jsonError("PAST_TIME", "РќРµР»СЊР·СЏ Р·Р°РїРёСЃР°С‚СЊСЃСЏ РЅР° РїСЂРѕС€РµРґС€РµРµ РІСЂРµРјСЏ.", null, 400);
  }

  const range = zonedDayRangeUtc(dateValue, tz);
  if (!range) {
    return jsonError("INVALID_DATE", "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РґР°С‚Р°.", null, 400);
  }
  const { dayStartUtc, dayEndUtc } = range;

  const startAtUtc = zonedTimeToUtc(dateValue, timeValue, tz);
  if (!startAtUtc || Number.isNaN(startAtUtc.getTime())) {
    return jsonError("INVALID_TIME", "РќРµРєРѕСЂСЂРµРєС‚РЅРѕРµ РІСЂРµРјСЏ.", null, 400);
  }

  const [location, specialist, service, scheduleEntry] = await Promise.all([
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

  if (!location) return jsonError("LOCATION_NOT_FOUND", "Р›РѕРєР°С†РёСЏ РЅРµ РЅР°Р№РґРµРЅР°.", null, 404);
  if (!specialist) return jsonError("SPECIALIST_NOT_FOUND", "РЎРїРµС†РёР°Р»РёСЃС‚ РЅРµ РЅР°Р№РґРµРЅ.", null, 404);
  if (!service) return jsonError("SERVICE_NOT_FOUND", "РЈСЃР»СѓРіР° РЅРµ РЅР°Р№РґРµРЅР°.", null, 404);

  const override = service.specialists.find((item) => item.specialistId === specialist.id);
  const levelConfig = specialist.levelId
    ? service.levelConfigs.find((item) => item.levelId === specialist.levelId)
    : null;

  const durationMin =
    override?.durationOverrideMin ?? levelConfig?.durationMin ?? service.baseDurationMin;

  const priceTotal =
    toNumber(override?.priceOverride) ||
    toNumber(levelConfig?.price) ||
    toNumber(service.basePrice);

  if (!scheduleEntry || scheduleEntry.type !== "WORKING") {
    return jsonError("NO_WORKDAY", "РЈ СЃРїРµС†РёР°Р»РёСЃС‚Р° РЅРµС‚ СЂР°Р±РѕС‡РµРіРѕ РґРЅСЏ РЅР° РІС‹Р±СЂР°РЅРЅСѓСЋ РґР°С‚Сѓ.", null, 400);
  }

  if (scheduleEntry.locationId !== locationId) {
    return jsonError(
      "NO_WORKDAY",
      "РЈ СЃРїРµС†РёР°Р»РёСЃС‚Р° РЅРµС‚ СЂР°Р±РѕС‡РµРіРѕ РґРЅСЏ РІ РІС‹Р±СЂР°РЅРЅРѕР№ Р»РѕРєР°С†РёРё РЅР° СЌС‚Сѓ РґР°С‚Сѓ.",
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
    startMinutes + durationMin > entryEnd
  ) {
    return jsonError("OUT_OF_WORKING_HOURS", "РЈ СЃРїРµС†РёР°Р»РёСЃС‚Р° РЅРµС‚ СЂР°Р±РѕС‡РёС… С‡Р°СЃРѕРІ РЅР° РІС‹Р±СЂР°РЅРЅРѕРµ РІСЂРµРјСЏ.", null, 400);
  }

  const candidateLocal: Window = { start: startMinutes, end: startMinutes + durationMin };

  const breaks = scheduleEntry.breaks
    .map((item) => ({
      start: toMinutes(item.startTime) ?? 0,
      end: toMinutes(item.endTime) ?? 0,
    }))
    .filter((item) => item.start < item.end);

  if (breaks.some((br) => overlaps(candidateLocal, br))) {
    return jsonError("OVERLAP_BREAK", "Р’С‹Р±СЂР°РЅРЅРѕРµ РІСЂРµРјСЏ РїРѕРїР°РґР°РµС‚ РЅР° РїРµСЂРµСЂС‹РІ.", null, 400);
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
      "Р РµР·РµСЂРІ РІСЂРµРјРµРЅРё РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ СЃР»РѕС‚ СЃРЅРѕРІР°.",
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
        "РќРµРѕР±С…РѕРґРёРјРѕ СЃРѕРіР»Р°СЃРёРµ СЃ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹РјРё РґРѕРєСѓРјРµРЅС‚Р°РјРё.",
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
          return jsonError("IDEMPOTENCY_CONFLICT", "РљРѕРЅС„Р»РёРєС‚ РёРґРµРјРїРѕС‚РµРЅС‚РЅРѕСЃС‚Рё.", null, 409);
        }

        if (existing.requestHash !== requestHash) {
          return jsonError(
            "IDEMPOTENCY_CONFLICT",
            "Р”СЂСѓРіРѕР№ Р·Р°РїСЂРѕСЃ СЃ С‚РµРј Р¶Рµ РєР»СЋС‡РѕРј РёРґРµРјРїРѕС‚РµРЅС‚РЅРѕСЃС‚Рё.",
            null,
            409
          );
        }

        if (existing.response) {
          return NextResponse.json(existing.response);
        }

        return jsonError(
          "IDEMPOTENCY_IN_PROGRESS",
          "Р—Р°РїСЂРѕСЃ СЃ СЌС‚РёРј РєР»СЋС‡РѕРј СѓР¶Рµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ.",
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
          error: jsonError("TIME_BUSY", "Р’С‹Р±СЂР°РЅРЅРѕРµ РІСЂРµРјСЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ.", null, 409),
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
          error: jsonError("TIME_BLOCKED", "Р’С‹Р±СЂР°РЅРЅРѕРµ РІСЂРµРјСЏ РЅРµРґРѕСЃС‚СѓРїРЅРѕ.", null, 409),
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
          error: jsonError("TIME_HELD", "Р­С‚Рѕ РІСЂРµРјСЏ СЃРµР№С‡Р°СЃ СЂРµР·РµСЂРІРёСЂСѓРµС‚СЃСЏ РґСЂСѓРіРёРј РєР»РёРµРЅС‚РѕРј.", null, 409),
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
          select: { id: true },
        });

        if (!ownHold) {
          return {
            ok: false as const,
            error: jsonError("HOLD_EXPIRED", "Р РµР·РµСЂРІ РІСЂРµРјРµРЅРё РёСЃС‚РµРє РёР»Рё РЅРµ РЅР°Р№РґРµРЅ.", null, 409),
          };
        }
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
            "РўРµР»РµС„РѕРЅ Рё email РїСЂРёРЅР°РґР»РµР¶Р°С‚ СЂР°Р·РЅС‹Рј РєР»РёРµРЅС‚Р°Рј. РџСЂРѕРІРµСЂСЊС‚Рµ РєРѕРЅС‚Р°РєС‚РЅС‹Рµ РґР°РЅРЅС‹Рµ.",
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

      const appointment = await tx.appointment.create({
        data: {
          accountId: resolved.account.id,
          locationId,
          specialistId,
          clientId: client.id,
          startAt: startAtUtc,
          endAt: endAtUtc,
          status: "NEW",
          priceTotal,
          durationTotalMin: durationMin,
          source: "online",
          services: {
            create: [
              {
                serviceId: service.id,
                price: priceTotal,
                durationMin,
              },
            ],
          },
        },
        select: { id: true },
      });

      await tx.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          actorType: "client",
          actorId: null,
          fromStatus: null,
          toStatus: "NEW",
          comment: comment || null,
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

