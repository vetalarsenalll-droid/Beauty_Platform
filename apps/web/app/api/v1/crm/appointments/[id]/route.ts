import { NextResponse } from "next/server";
import { AppointmentStatus, Prisma, ScheduleEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import { requireCrmPermission } from "@/lib/auth";

type ServiceItemPayload = {
  serviceId: number;
  price?: string;
  durationMin?: number;
};

type AppointmentPayload = {
  staffId?: number;
  locationId?: number;
  clientId?: number | null;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  startAt?: string;
  endAt?: string;
  status?: AppointmentStatus;
  priceTotal?: string;
  serviceId?: number | null;
  serviceIds?: number[];
  serviceItems?: ServiceItemPayload[];
};

const NON_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.NEW]: [
    AppointmentStatus.NEW,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.DONE,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.CONFIRMED]: [
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.DONE,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.IN_PROGRESS]: [
    AppointmentStatus.DONE,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ],
  [AppointmentStatus.DONE]: [AppointmentStatus.DONE],
  [AppointmentStatus.CANCELLED]: [AppointmentStatus.CANCELLED],
  [AppointmentStatus.NO_SHOW]: [AppointmentStatus.NO_SHOW],
};

const TERMINAL_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.DONE,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const toStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const toNum = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const isAppointmentStatus = (v: unknown): v is AppointmentStatus =>
  typeof v === "string" &&
  (Object.values(AppointmentStatus) as string[]).includes(v);

function parseTimeToMinutes(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

function serializeAppointment(appointment: {
  id: number;
  specialistId: number;
  locationId: number;
  clientId: number;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  source: string;
  priceTotal: Prisma.Decimal;
  durationTotalMin: number;
  client: { firstName: string | null; lastName: string | null; phone: string | null; email: string | null };
  services: { serviceId: number; price: Prisma.Decimal; durationMin: number; service: { id: number; name: string } }[];
}) {
  const clientName = `${appointment.client.firstName ?? ""} ${appointment.client.lastName ?? ""}`
    .trim()
    .replace(/\s+/g, " ");
  return {
    id: appointment.id,
    specialistId: appointment.specialistId,
    locationId: appointment.locationId,
    clientId: appointment.clientId,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status,
    source: appointment.source,
    clientName: clientName || appointment.client.phone || "Без клиента",
    clientPhone: appointment.client.phone ?? "",
    clientEmail: appointment.client.email ?? "",
    serviceItems: appointment.services.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.service.name,
      price: item.price.toString(),
      durationMin: item.durationMin,
    })),
    serviceNames: appointment.services.map((item) => item.service.name),
    serviceIds: appointment.services.map((item) => item.service.id),
    priceTotal: appointment.priceTotal.toString(),
    durationMin: appointment.durationTotalMin,
  };
}

function parsePayload(raw: unknown): AppointmentPayload {
  if (!isRecord(raw)) return {};

  const staffId = toNum(raw.staffId) ?? undefined;
  const locationId = toNum(raw.locationId) ?? undefined;
  const clientId = raw.clientId === null ? null : (toNum(raw.clientId) ?? undefined);

  const clientName = toStr(raw.clientName) ?? undefined;
  const clientPhone = normalizeRuPhone(toStr(raw.clientPhone)) ?? undefined;
  const clientEmail = toStr(raw.clientEmail) ?? undefined;

  const startAt = toStr(raw.startAt) ?? undefined;
  const endAt = toStr(raw.endAt) ?? undefined;

  const status = isAppointmentStatus(raw.status) ? raw.status : undefined;

  const priceTotal = toStr(raw.priceTotal) ?? undefined;

  const serviceId =
    raw.serviceId === null ? null : (toNum(raw.serviceId) ?? undefined);
  const serviceIds = Array.isArray(raw.serviceIds)
    ? Array.from(
        new Set(
          raw.serviceIds
            .map((value) => toNum(value))
            .filter((value): value is number => Number.isInteger(value) && value > 0)
        )
      )
    : undefined;
  const serviceItems = Array.isArray(raw.serviceItems)
    ? raw.serviceItems
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const serviceId = toNum(entry.serviceId);
          if (!Number.isInteger(serviceId) || serviceId <= 0) return null;
          const priceRaw = toStr(entry.price);
          const durationRaw = toNum(entry.durationMin);
          return {
            serviceId,
            price: priceRaw ?? undefined,
            durationMin:
              Number.isFinite(durationRaw) && durationRaw !== null
                ? Math.max(0, Math.round(durationRaw))
                : undefined,
          } satisfies ServiceItemPayload;
        })
        .filter((item): item is ServiceItemPayload => Boolean(item))
    : undefined;

  return {
    staffId,
    locationId,
    clientId,
    clientName,
    clientPhone,
    clientEmail,
    startAt,
    endAt,
    status,
    priceTotal,
    serviceId,
    serviceIds,
    serviceItems,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCrmPermission("crm.calendar.read");

  const resolvedParams = await params;
  const appointmentId = Number(resolvedParams.id);
  if (!Number.isInteger(appointmentId)) {
    return NextResponse.json(
      { message: "Некорректный идентификатор записи." },
      { status: 400 }
    );
  }

  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId: session.accountId },
    include: { services: { include: { service: true } } },
  });
  if (!existing) {
    return NextResponse.json({ message: "Запись не найдена." }, { status: 404 });
  }

  const bodyRaw: unknown = await request.json().catch(() => null);
  const body = parsePayload(bodyRaw);

  if (TERMINAL_STATUSES.includes(existing.status)) {
    return NextResponse.json(
      { message: "Запись с финальным статусом нельзя изменять." },
      { status: 409 }
    );
  }

  if (body.status === AppointmentStatus.IN_PROGRESS) {
    return NextResponse.json(
      { message: "Статус 'Пришел' больше не используется." },
      { status: 400 }
    );
  }

  if (body.status) {
    const allowed = STATUS_TRANSITIONS[existing.status] ?? [existing.status];
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { message: "Недопустимый переход статуса." },
        { status: 400 }
      );
    }
  }

  const data: Prisma.AppointmentUpdateInput = {};

  const nextStaffId = body.staffId ?? existing.specialistId;
  const nextLocationId = body.locationId ?? existing.locationId;
  const nextStartAt = body.startAt ? new Date(body.startAt) : existing.startAt;
  const nextEndAt = body.endAt ? new Date(body.endAt) : existing.endAt;

  const shouldValidate =
    body.staffId != null ||
    body.locationId != null ||
    body.startAt != null ||
    body.endAt != null ||
    body.serviceItems !== undefined ||
    body.serviceId !== undefined ||
    body.serviceIds !== undefined;

  if (!(nextStartAt.getTime() < nextEndAt.getTime())) {
    return NextResponse.json(
      { message: "Некорректный интервал записи." },
      { status: 400 }
    );
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: nextStaffId, accountId: session.accountId },
    select: { id: true, levelId: true },
  });
  if (!specialist) {
    return NextResponse.json({ message: "Специалист не найден." }, { status: 404 });
  }

  const requestedServiceIds =
    body.serviceItems !== undefined
      ? body.serviceItems.map((item) => item.serviceId)
      : body.serviceIds !== undefined
      ? body.serviceIds
      : body.serviceId !== undefined
        ? body.serviceId
          ? [body.serviceId]
          : []
        : undefined;

  let selectedServices: Array<{
    id: number;
    basePrice: Prisma.Decimal;
    baseDurationMin: number;
    levelConfigs: { levelId: number; price: Prisma.Decimal | null; durationMin: number | null }[];
    specialists: { specialistId: number; priceOverride: Prisma.Decimal | null; durationOverrideMin: number | null }[];
    locations: { locationId: number }[];
  }> = [];

  if (requestedServiceIds !== undefined) {
    if (requestedServiceIds.length === 0) {
      return NextResponse.json({ message: "Выберите хотя бы одну услугу." }, { status: 400 });
    }

    selectedServices = await prisma.service.findMany({
      where: { id: { in: requestedServiceIds }, accountId: session.accountId, isActive: true },
      include: { locations: true, specialists: true, levelConfigs: true },
    });
    if (selectedServices.length !== requestedServiceIds.length) {
      return NextResponse.json({ message: "Одна или несколько услуг не найдены." }, { status: 404 });
    }

    for (const service of selectedServices) {
      const hasLocation = service.locations.some((item) => item.locationId === nextLocationId);
      const hasSpecialist = service.specialists.some((item) => item.specialistId === specialist.id);
      if (!hasLocation || !hasSpecialist) {
        return NextResponse.json(
          { message: "Одна или несколько услуг не привязаны к выбранной локации или специалисту." },
          { status: 400 }
        );
      }
    }
  }
  const selectedServiceById = new Map(selectedServices.map((service) => [service.id, service]));
  const serviceItemsOrdered: ServiceItemPayload[] | undefined =
    requestedServiceIds !== undefined
      ? Array.isArray(body.serviceItems) && body.serviceItems.length > 0
        ? body.serviceItems.filter((item) => selectedServiceById.has(item.serviceId))
        : requestedServiceIds.map((serviceId) => ({ serviceId }))
      : undefined;

  if (shouldValidate) {
    const scheduleDayStartUtc = new Date(
      Date.UTC(nextStartAt.getUTCFullYear(), nextStartAt.getUTCMonth(), nextStartAt.getUTCDate())
    );
    const scheduleDayEndUtc = new Date(scheduleDayStartUtc);
    scheduleDayEndUtc.setUTCDate(scheduleDayEndUtc.getUTCDate() + 1);
    const scheduleEntry = await prisma.scheduleEntry.findFirst({
      where: {
        specialistId: specialist.id,
        date: { gte: scheduleDayStartUtc, lt: scheduleDayEndUtc },
      },
      include: { breaks: true },
      orderBy: { date: "asc" },
    });

    // ✅ если день не проставлен — он НЕ рабочий
    if (!scheduleEntry || scheduleEntry.type !== ScheduleEntryType.WORKING) {
      return NextResponse.json(
        { message: "У специалиста нет рабочего дня на выбранную дату." },
        { status: 400 }
      );
    }

    if (scheduleEntry.locationId && scheduleEntry.locationId !== nextLocationId) {
      return NextResponse.json(
        { message: "Рабочий день специалиста настроен для другой локации." },
        { status: 400 }
      );
    }

    const entryStart = parseTimeToMinutes(scheduleEntry.startTime ?? null);
    const entryEnd = parseTimeToMinutes(scheduleEntry.endTime ?? null);
    if (entryStart === null || entryEnd === null) {
      return NextResponse.json(
        { message: "В графике работы не указано время смены." },
        { status: 400 }
      );
    }

    const startMinutes = nextStartAt.getHours() * 60 + nextStartAt.getMinutes();
    const endMinutes = nextEndAt.getHours() * 60 + nextEndAt.getMinutes();

    if (startMinutes < entryStart || endMinutes > entryEnd) {
      return NextResponse.json(
        { message: "Запись выходит за пределы рабочего времени специалиста." },
        { status: 400 }
      );
    }

    for (const entryBreak of scheduleEntry.breaks) {
      const breakStart = parseTimeToMinutes(entryBreak.startTime);
      const breakEnd = parseTimeToMinutes(entryBreak.endTime);
      if (
        breakStart !== null &&
        breakEnd !== null &&
        isOverlap(startMinutes, endMinutes, breakStart, breakEnd)
      ) {
        return NextResponse.json(
          { message: "Запись пересекается с перерывом специалиста." },
          { status: 400 }
        );
      }
    }

    const blockedSlot = await prisma.blockedSlot.findFirst({
      where: {
        accountId: session.accountId,
        startAt: { lt: nextEndAt },
        endAt: { gt: nextStartAt },
        OR: [
          { specialistId: null, locationId: null },
          { specialistId: specialist.id, locationId: null },
          { specialistId: null, locationId: nextLocationId },
          { specialistId: specialist.id, locationId: nextLocationId },
        ],
      },
    });
    if (blockedSlot) {
      return NextResponse.json(
        { message: "Выбранное время заблокировано." },
        { status: 400 }
      );
    }

    const overlap = await prisma.appointment.findFirst({
      where: {
        accountId: session.accountId,
        specialistId: specialist.id,
        id: { not: appointmentId },
        status: { notIn: NON_BLOCKING_STATUSES },
        startAt: { lt: nextEndAt },
        endAt: { gt: nextStartAt },
      },
    });
    if (overlap) {
      return NextResponse.json(
        { message: "В это время у специалиста уже есть запись." },
        { status: 400 }
      );
    }
  }

  if (body.staffId) data.specialist = { connect: { id: body.staffId } };
  if (body.locationId) data.location = { connect: { id: body.locationId } };
  if (body.clientId) data.client = { connect: { id: body.clientId } };

  if (body.status) data.status = body.status;
  if (body.startAt) data.startAt = nextStartAt;
  if (body.endAt) data.endAt = nextEndAt;

  if (body.startAt || body.endAt) {
    data.durationTotalMin = Math.max(
      15,
      Math.round((nextEndAt.getTime() - nextStartAt.getTime()) / (60 * 1000))
    );
  }

  let priceTotal: Prisma.Decimal | null = null;
  if (body.priceTotal) {
    priceTotal = new Prisma.Decimal(body.priceTotal);
  } else if ((serviceItemsOrdered?.length ?? 0) > 0) {
    priceTotal = (serviceItemsOrdered ?? []).reduce((sum, item) => {
      const service = selectedServiceById.get(item.serviceId);
      if (!service) return sum;
      if (item.price) return sum.plus(new Prisma.Decimal(item.price));
      const override = service.specialists.find((entry) => entry.specialistId === specialist.id);
      const levelConfig =
        specialist.levelId != null
          ? service.levelConfigs.find((entry) => entry.levelId === specialist.levelId)
          : null;
      const computedPrice = override?.priceOverride ?? levelConfig?.price ?? service.basePrice;
      return sum.plus(computedPrice);
    }, new Prisma.Decimal(0));
  }
  if (priceTotal) data.priceTotal = priceTotal;

  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data,
    include: { client: true, services: { include: { service: true } } },
  });

  if (requestedServiceIds !== undefined) {
    await prisma.appointmentService.deleteMany({ where: { appointmentId } });

    for (let index = 0; index < (serviceItemsOrdered ?? []).length; index += 1) {
      const item = (serviceItemsOrdered ?? [])[index];
      const service = selectedServiceById.get(item.serviceId);
      if (!service) continue;
      const override = service.specialists.find((entry) => entry.specialistId === specialist.id);
      const levelConfig =
        specialist.levelId != null
          ? service.levelConfigs.find((entry) => entry.levelId === specialist.levelId)
          : null;
      const servicePrice = item.price
        ? new Prisma.Decimal(item.price)
        : (override?.priceOverride ?? levelConfig?.price ?? service.basePrice);
      const serviceDuration =
        item.durationMin ?? override?.durationOverrideMin ?? levelConfig?.durationMin ?? service.baseDurationMin;

      await prisma.$executeRaw`
        INSERT INTO "public"."AppointmentService"
          ("appointmentId", "serviceId", "price", "durationMin", "orderIndex", "specialistId")
        VALUES
          (${appointmentId}, ${service.id}, ${servicePrice}, ${serviceDuration}, ${index}, ${specialist.id})
      `;
    }
  }

  const refreshed = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: true, services: { include: { service: true } } },
  });

  return NextResponse.json(serializeAppointment(refreshed ?? appointment));
}

