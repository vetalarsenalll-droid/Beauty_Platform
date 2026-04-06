import { NextResponse } from "next/server";
import { GroupSessionStatus, ScheduleEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

const toNum = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

const toStr = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isGroupSessionStatus = (value: unknown): value is GroupSessionStatus =>
  typeof value === "string" &&
  (Object.values(GroupSessionStatus) as string[]).includes(value);

const parseTimeToMinutes = (value: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

type Payload = {
  locationId: number;
  specialistId: number;
  serviceId: number;
  startAt: string;
  endAt: string;
  capacity: number;
  pricePerClient?: string | null;
  status?: GroupSessionStatus;
  comment?: string | null;
  source?: string | null;
};

function parsePayload(raw: unknown): Payload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const locationId = toNum(body.locationId);
  const specialistId = toNum(body.specialistId);
  const serviceId = toNum(body.serviceId);
  const startAt = toStr(body.startAt);
  const endAt = toStr(body.endAt);
  const capacity = toNum(body.capacity);
  const pricePerClient = body.pricePerClient != null ? String(body.pricePerClient).trim() : null;
  const status = isGroupSessionStatus(body.status) ? body.status : undefined;
  const comment = toStr(body.comment) ?? null;
  const source = toStr(body.source) ?? null;

  if (!locationId || !specialistId || !serviceId || !startAt || !endAt || !capacity) {
    return null;
  }

  return {
    locationId,
    specialistId,
    serviceId,
    startAt,
    endAt,
    capacity,
    pricePerClient,
    status,
    comment,
    source,
  };
}

export async function GET(request: Request) {
  const session = await requireCrmPermission("crm.calendar.read");

  const { searchParams } = new URL(request.url);
  const startAtRaw = searchParams.get("startAt");
  const endAtRaw = searchParams.get("endAt");
  const locationId = toNum(searchParams.get("locationId"));

  const startAt = startAtRaw ? new Date(startAtRaw) : null;
  const endAt = endAtRaw ? new Date(endAtRaw) : null;
  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ message: "INVALID_RANGE" }, { status: 400 });
  }

  const sessions = await prisma.groupSession.findMany({
    where: {
      accountId: session.accountId,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(locationId ? { locationId } : {}),
    },
    include: {
      service: { select: { id: true, name: true } },
      specialist: { select: { id: true } },
      participants: { select: { id: true, clientId: true, status: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      locationId: s.locationId,
      specialistId: s.specialistId,
      serviceId: s.serviceId,
      serviceName: s.service.name,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      status: s.status,
      capacity: s.capacity,
      bookedCount: s.bookedCount,
      pricePerClient: s.pricePerClient ? s.pricePerClient.toString() : null,
      comment: s.comment ?? null,
      participants: s.participants,
    })),
  });
}

export async function POST(request: Request) {
  const session = await requireCrmPermission("crm.calendar.read");

  const raw = await request.json().catch(() => null);
  const body = parsePayload(raw);
  if (!body) {
    return NextResponse.json({ message: "MISSING_FIELDS" }, { status: 400 });
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  const now = new Date();

  if (!(startAt.getTime() < endAt.getTime())) {
    return NextResponse.json({ message: "INVALID_RANGE" }, { status: 400 });
  }
  if (startAt.getTime() < now.getTime()) {
    return NextResponse.json({ message: "PAST_TIME" }, { status: 400 });
  }
  if (!Number.isInteger(body.capacity) || body.capacity <= 0) {
    return NextResponse.json({ message: "INVALID_CAPACITY" }, { status: 400 });
  }

  const [location, specialist, service] = await Promise.all([
    prisma.location.findFirst({
      where: { id: body.locationId, accountId: session.accountId, status: "ACTIVE" },
      select: {
        id: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
      },
    }),
    prisma.specialistProfile.findFirst({
      where: { id: body.specialistId, accountId: session.accountId },
      select: { id: true, levelId: true, locations: { select: { locationId: true } } },
    }),
    prisma.service.findFirst({
      where: { id: body.serviceId, accountId: session.accountId, isActive: true, bookingType: "GROUP" },
      select: { id: true },
    }),
  ]);

  if (!location || !specialist || !service) {
    return NextResponse.json({ message: "INVALID_RELATIONS" }, { status: 404 });
  }

  const specialistLocationIds = specialist.locations.map((x) => x.locationId);
  if (!specialistLocationIds.includes(location.id)) {
    return NextResponse.json({ message: "SPECIALIST_LOCATION_MISMATCH" }, { status: 400 });
  }

  const scheduleDayStartUtc = new Date(
    Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), startAt.getUTCDate())
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

  if (!scheduleEntry || scheduleEntry.type !== ScheduleEntryType.WORKING) {
    return NextResponse.json({ message: "NO_WORKDAY" }, { status: 400 });
  }
  if (scheduleEntry.locationId && scheduleEntry.locationId !== location.id) {
    return NextResponse.json({ message: "SCHEDULE_LOCATION_MISMATCH" }, { status: 400 });
  }

  const entryStart = parseTimeToMinutes(scheduleEntry.startTime ?? null);
  const entryEnd = parseTimeToMinutes(scheduleEntry.endTime ?? null);
  if (entryStart == null || entryEnd == null || entryStart >= entryEnd) {
    return NextResponse.json({ message: "INVALID_SCHEDULE_WINDOW" }, { status: 400 });
  }

  const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();
  const endMinutes = endAt.getHours() * 60 + endAt.getMinutes();
  if (startMinutes < entryStart || endMinutes > entryEnd) {
    return NextResponse.json({ message: "OUT_OF_WORKING_HOURS" }, { status: 400 });
  }

  const hasBreakOverlap = scheduleEntry.breaks.some((br) => {
    const brStart = parseTimeToMinutes(br.startTime);
    const brEnd = parseTimeToMinutes(br.endTime);
    if (brStart == null || brEnd == null) return false;
    return startMinutes < brEnd && endMinutes > brStart;
  });
  if (hasBreakOverlap) {
    return NextResponse.json({ message: "BREAK_OVERLAP" }, { status: 400 });
  }

  const [appointmentConflict, sessionConflict, blockedConflict] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        accountId: session.accountId,
        specialistId: specialist.id,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    }),
    prisma.groupSession.findFirst({
      where: {
        accountId: session.accountId,
        specialistId: specialist.id,
        status: { not: "CANCELLED" },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    }),
    prisma.blockedSlot.findFirst({
      where: {
        accountId: session.accountId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        OR: [{ locationId: location.id }, { specialistId: specialist.id }],
      },
      select: { id: true },
    }),
  ]);

  if (appointmentConflict || sessionConflict || blockedConflict) {
    return NextResponse.json({ message: "SLOT_BUSY" }, { status: 409 });
  }

  const created = await prisma.groupSession.create({
    data: {
      accountId: session.accountId,
      locationId: location.id,
      specialistId: specialist.id,
      serviceId: service.id,
      startAt,
      endAt,
      status: body.status ?? "NEW",
      capacity: body.capacity,
      bookedCount: 0,
      pricePerClient: body.pricePerClient ? body.pricePerClient : null,
      source: body.source ?? "crm",
      comment: body.comment ?? null,
    },
  });

  return NextResponse.json({
    id: created.id,
    startAt: created.startAt.toISOString(),
    endAt: created.endAt.toISOString(),
  });
}
