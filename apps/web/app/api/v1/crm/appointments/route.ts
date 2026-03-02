import { NextResponse } from "next/server";
import { AppointmentStatus, Prisma, ScheduleEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import { requireCrmPermission } from "@/lib/auth";

type AppointmentPayload = {
  staffId: number;
  locationId: number;
  clientId?: number | null;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  startAt: string;
  endAt: string;
  status?: AppointmentStatus;
  priceTotal?: string;
  serviceId?: number | null;
};

const NON_BLOCKING_STATUSES: AppointmentStatus[] = [
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

function toDateOnly(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

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
  client: { firstName: string | null; lastName: string | null; phone: string | null };
  services: { service: { id: number; name: string } }[];
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
    serviceNames: appointment.services.map((item) => item.service.name),
    serviceIds: appointment.services.map((item) => item.service.id),
    priceTotal: appointment.priceTotal.toString(),
    durationMin: appointment.durationTotalMin,
  };
}

function parsePayload(raw: unknown): AppointmentPayload | null {
  if (!isRecord(raw)) return null;

  const staffId = toNum(raw.staffId);
  const locationId = toNum(raw.locationId);
  const startAt = toStr(raw.startAt);
  const endAt = toStr(raw.endAt);

  if (!staffId || !locationId || !startAt || !endAt) return null;

  const clientId = raw.clientId === null ? null : (toNum(raw.clientId) ?? undefined);
  const clientName = toStr(raw.clientName) ?? undefined;
  const clientPhone = normalizeRuPhone(toStr(raw.clientPhone)) ?? undefined;
  const clientEmail = toStr(raw.clientEmail) ?? undefined;
  const status = isAppointmentStatus(raw.status) ? raw.status : undefined;
  const priceTotal = toStr(raw.priceTotal) ?? undefined;
  const serviceId = raw.serviceId === null ? null : (toNum(raw.serviceId) ?? undefined);

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
  };
}

export async function POST(request: Request) {
  const session = await requireCrmPermission("crm.calendar.read");

  const raw: unknown = await request.json().catch(() => null);
  const body = parsePayload(raw);

  if (!body) {
    return NextResponse.json(
      { message: "Не заполнены обязательные поля." },
      { status: 400 }
    );
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);

  if (!(startAt.getTime() < endAt.getTime())) {
    return NextResponse.json(
      { message: "Некорректный интервал записи." },
      { status: 400 }
    );
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: body.staffId, accountId: session.accountId },
    select: { id: true, levelId: true },
  });
  if (!specialist) {
    return NextResponse.json({ message: "Специалист не найден." }, { status: 404 });
  }

  const scheduleDate = toDateOnly(startAt);
  const scheduleEntry = await prisma.scheduleEntry.findUnique({
    where: { specialistId_date: { specialistId: specialist.id, date: scheduleDate } },
    include: { breaks: true },
  });

  // ✅ если день не проставлен — он НЕ рабочий
  if (!scheduleEntry || scheduleEntry.type !== ScheduleEntryType.WORKING) {
    return NextResponse.json(
      { message: "У специалиста нет рабочего дня на выбранную дату." },
      { status: 400 }
    );
  }

  if (scheduleEntry.locationId && scheduleEntry.locationId !== body.locationId) {
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

  const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();
  const endMinutes = endAt.getHours() * 60 + endAt.getMinutes();

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
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      OR: [
        { specialistId: null, locationId: null },
        { specialistId: specialist.id, locationId: null },
        { specialistId: null, locationId: body.locationId },
        { specialistId: specialist.id, locationId: body.locationId },
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
      status: { notIn: NON_BLOCKING_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (overlap) {
    return NextResponse.json(
      { message: "В это время у специалиста уже есть запись." },
      { status: 400 }
    );
  }

  let selectedService: {
    id: number;
    basePrice: Prisma.Decimal;
    baseDurationMin: number;
    levelConfigs: { levelId: number; price: Prisma.Decimal | null; durationMin: number | null }[];
    specialists: { specialistId: number; priceOverride: Prisma.Decimal | null; durationOverrideMin: number | null }[];
    locations: { locationId: number }[];
  } | null = null;

  if (body.serviceId) {
    selectedService = await prisma.service.findFirst({
      where: { id: body.serviceId, accountId: session.accountId, isActive: true },
      include: { locations: true, specialists: true, levelConfigs: true },
    });
    if (!selectedService) {
      return NextResponse.json({ message: "Услуга не найдена." }, { status: 404 });
    }

    const hasLocation = selectedService.locations.some(
      (item) => item.locationId === body.locationId
    );
    const hasSpecialist = selectedService.specialists.some(
      (item) => item.specialistId === specialist.id
    );
    if (!hasLocation || !hasSpecialist) {
      return NextResponse.json(
        { message: "Услуга не привязана к выбранной локации или специалисту." },
        { status: 400 }
      );
    }
  }

  let clientId = body.clientId ?? null;
  if (!clientId) {
    const name = body.clientName?.trim() ?? "";
    const [firstName, ...rest] = name.split(" ").filter(Boolean);
    const lastName = rest.join(" ");

    const createdClient = await prisma.client.create({
      data: {
        accountId: session.accountId,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: body.clientPhone ?? null,
        email: body.clientEmail?.trim() || null,
      },
    });
    clientId = createdClient.id;
  }

  const durationTotalMin = Math.max(
    15,
    Math.round((endAt.getTime() - startAt.getTime()) / (60 * 1000))
  );

  let priceTotal = body.priceTotal
    ? new Prisma.Decimal(body.priceTotal)
    : new Prisma.Decimal(0);

  if (selectedService) {
    const override = selectedService.specialists.find(
      (item) => item.specialistId === specialist.id
    );
    const levelConfig =
      specialist.levelId != null
        ? selectedService.levelConfigs.find((item) => item.levelId === specialist.levelId)
        : null;

    const computedPrice =
      override?.priceOverride ?? levelConfig?.price ?? selectedService.basePrice;

    priceTotal = body.priceTotal ? new Prisma.Decimal(body.priceTotal) : computedPrice;
  }

  const appointment = await prisma.appointment.create({
    data: {
      accountId: session.accountId,
      specialistId: body.staffId,
      locationId: body.locationId,
      clientId,
      startAt,
      endAt,
      status: body.status ?? AppointmentStatus.NEW,
      priceTotal,
      durationTotalMin,
      source: "crm",
    },
    include: { client: true, services: { include: { service: true } } },
  });

  if (selectedService) {
    await prisma.appointmentService.create({
      data: {
        appointmentId: appointment.id,
        serviceId: selectedService.id,
        price: priceTotal,
        durationMin: durationTotalMin,
      },
    });
  }

  const updated = await prisma.appointment.findUnique({
    where: { id: appointment.id },
    include: { client: true, services: { include: { service: true } } },
  });

  return NextResponse.json(serializeAppointment(updated ?? appointment));
}

