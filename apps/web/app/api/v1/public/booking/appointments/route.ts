import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount, toMinutes } from "@/lib/public-booking";

type Window = { start: number; end: number };
const overlaps = (a: Window, b: Window) => a.start < b.end && b.start < a.end;

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const body = (await request.json().catch(() => null)) as {
    locationId?: number;
    specialistId?: number;
    serviceId?: number;
    date?: string;
    time?: string;
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);
  }

  const locationId = Number(body.locationId);
  const specialistId = Number(body.specialistId);
  const serviceId = Number(body.serviceId);
  const dateValue = String(body.date ?? "");
  const timeValue = String(body.time ?? "");
  const clientName = String(body.clientName ?? "").trim();
  const clientPhone = String(body.clientPhone ?? "").trim();
  const clientEmail = String(body.clientEmail ?? "").trim();

  if (
    !Number.isInteger(locationId) ||
    !Number.isInteger(specialistId) ||
    !Number.isInteger(serviceId) ||
    !dateValue ||
    !timeValue
  ) {
    return jsonError("INVALID_REQUEST", "Некорректные параметры.", null, 400);
  }

  if (!clientName && !clientPhone && !clientEmail) {
    return jsonError("CLIENT_REQUIRED", "Укажите данные клиента.", null, 400);
  }

  const dayStart = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) {
    return jsonError("INVALID_DATE", "Некорректная дата.", null, 400);
  }
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  const startAt = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(startAt.getTime())) {
    return jsonError("INVALID_TIME", "Некорректное время.", null, 400);
  }

  const [location, specialist, service, scheduleCandidates] = await Promise.all([
    prisma.location.findFirst({
      where: {
        id: locationId,
        accountId: resolved.account.id,
        status: "ACTIVE",
      },
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
    // ✅ график только выбранной локации (или общий null)
    prisma.scheduleEntry.findMany({
      where: {
        accountId: resolved.account.id,
        specialistId,
        date: { gte: dayStart, lt: dayEnd },
        OR: [{ locationId }, { locationId: null }],
      },
      include: { breaks: true },
    }),
  ]);

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }
  if (!specialist) {
    return jsonError("SPECIALIST_NOT_FOUND", "Специалист не найден.", null, 404);
  }
  if (!service) {
    return jsonError("SERVICE_NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  const scheduleEntry =
    scheduleCandidates.find((e) => e.locationId === locationId) ??
    scheduleCandidates.find((e) => e.locationId == null) ??
    null;

  const override = service.specialists.find(
    (item) => item.specialistId === specialist.id
  );
  const levelConfig = specialist.levelId
    ? service.levelConfigs.find((item) => item.levelId === specialist.levelId)
    : null;

  const durationMin =
    override?.durationOverrideMin ??
    levelConfig?.durationMin ??
    service.baseDurationMin;

  const priceTotal =
    toNumber(override?.priceOverride) ||
    toNumber(levelConfig?.price) ||
    toNumber(service.basePrice);

  const endAt = new Date(startAt);
  endAt.setMinutes(endAt.getMinutes() + durationMin);

  if (!scheduleEntry || scheduleEntry.type !== "WORKING") {
    return jsonError(
      "NO_WORKDAY",
      "У специалиста нет рабочего дня на выбранную дату.",
      null,
      400
    );
  }

  // ✅ если вдруг попал график “не той” локации — режем
  if (scheduleEntry.locationId != null && scheduleEntry.locationId !== locationId) {
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
    entryStart === null ||
    entryEnd === null ||
    startMinutes === null ||
    startMinutes < entryStart ||
    startMinutes + durationMin > entryEnd
  ) {
    return jsonError(
      "OUT_OF_WORKING_HOURS",
      "У специалиста нет рабочих часов на выбранное время.",
      null,
      400
    );
  }

  const candidate: Window = { start: startMinutes, end: startMinutes + durationMin };

  const breaks = scheduleEntry.breaks
    .map((item) => ({
      start: toMinutes(item.startTime) ?? 0,
      end: toMinutes(item.endTime) ?? 0,
    }))
    .filter((item) => item.start < item.end);

  if (breaks.some((br) => overlaps(candidate, br))) {
    return jsonError(
      "OVERLAP_BREAK",
      "Выбранное время попадает на перерыв.",
      null,
      400
    );
  }

  const [appointments, blockedSlots] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        accountId: resolved.account.id,
        locationId,
        specialistId,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.blockedSlot.findMany({
      where: {
        accountId: resolved.account.id,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
        OR: [{ locationId }, { specialistId }],
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  if (
    appointments.some((appt) =>
      overlaps(candidate, {
        start: appt.startAt.getHours() * 60 + appt.startAt.getMinutes(),
        end: appt.endAt.getHours() * 60 + appt.endAt.getMinutes(),
      })
    )
  ) {
    return jsonError("TIME_BUSY", "Выбранное время уже занято.", null, 409);
  }

  if (
    blockedSlots.some((slot) =>
      overlaps(candidate, {
        start: slot.startAt.getHours() * 60 + slot.startAt.getMinutes(),
        end: slot.endAt.getHours() * 60 + slot.endAt.getMinutes(),
      })
    )
  ) {
    return jsonError("TIME_BLOCKED", "Выбранное время недоступно.", null, 409);
  }

  let client =
    (clientPhone
      ? await prisma.client.findFirst({
          where: { accountId: resolved.account.id, phone: clientPhone },
        })
      : null) ??
    (clientEmail
      ? await prisma.client.findFirst({
          where: { accountId: resolved.account.id, email: clientEmail },
        })
      : null);

  if (!client) {
    client = await prisma.client.create({
      data: {
        accountId: resolved.account.id,
        firstName: clientName || null,
        phone: clientPhone || null,
        email: clientEmail || null,
      },
    });
  }

  const appointment = await prisma.appointment.create({
    data: {
      accountId: resolved.account.id,
      locationId,
      specialistId,
      clientId: client.id,
      startAt,
      endAt,
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
  });

  return jsonOk({ appointmentId: appointment.id });
}
