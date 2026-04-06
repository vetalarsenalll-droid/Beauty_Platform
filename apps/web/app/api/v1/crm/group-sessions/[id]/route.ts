import { NextResponse } from "next/server";
import { GroupSessionStatus } from "@prisma/client";
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

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await requireCrmPermission("crm.calendar.read");
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  const groupSession = await prisma.groupSession.findFirst({
    where: { id: sessionId, accountId: session.accountId },
    include: {
      service: { select: { id: true, name: true } },
      participants: {
        include: { client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!groupSession) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    id: groupSession.id,
    locationId: groupSession.locationId,
    specialistId: groupSession.specialistId,
    serviceId: groupSession.serviceId,
    serviceName: groupSession.service.name,
    startAt: groupSession.startAt.toISOString(),
    endAt: groupSession.endAt.toISOString(),
    status: groupSession.status,
    capacity: groupSession.capacity,
    bookedCount: groupSession.bookedCount,
    pricePerClient: groupSession.pricePerClient ? groupSession.pricePerClient.toString() : null,
    comment: groupSession.comment ?? null,
    participants: groupSession.participants.map((p) => ({
      id: p.id,
      clientId: p.clientId,
      status: p.status,
      price: p.price ? p.price.toString() : null,
      clientName: `${p.client.firstName ?? ""} ${p.client.lastName ?? ""}`.trim(),
      clientPhone: p.client.phone ?? "",
      clientEmail: p.client.email ?? "",
    })),
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await requireCrmPermission("crm.calendar.read");
  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) {
    return NextResponse.json({ message: "INVALID_ID" }, { status: 400 });
  }

  const existing = await prisma.groupSession.findFirst({
    where: { id: sessionId, accountId: session.accountId },
  });
  if (!existing) {
    return NextResponse.json({ message: "NOT_FOUND" }, { status: 404 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ message: "INVALID_BODY" }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  const nextLocationId = body.locationId !== undefined ? toNum(body.locationId) : null;
  const nextSpecialistId = body.specialistId !== undefined ? toNum(body.specialistId) : null;
  const nextServiceId = body.serviceId !== undefined ? toNum(body.serviceId) : null;
  const nextStartAtRaw = body.startAt !== undefined ? toStr(body.startAt) : null;
  const nextEndAtRaw = body.endAt !== undefined ? toStr(body.endAt) : null;

  if (body.status !== undefined) {
    if (!isGroupSessionStatus(body.status)) {
      return NextResponse.json({ message: "INVALID_STATUS" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.capacity !== undefined) {
    const cap = toNum(body.capacity);
    if (!cap || !Number.isInteger(cap) || cap < existing.bookedCount) {
      return NextResponse.json({ message: "INVALID_CAPACITY" }, { status: 400 });
    }
    data.capacity = cap;
  }
  if (body.pricePerClient !== undefined) {
    const price = toStr(body.pricePerClient);
    data.pricePerClient = price || null;
  }
  if (body.comment !== undefined) {
    data.comment = toStr(body.comment) ?? null;
  }

  let nextStartAt = existing.startAt;
  let nextEndAt = existing.endAt;
  let nextLocation = existing.locationId;
  let nextSpecialist = existing.specialistId;
  let nextService = existing.serviceId;

  if (nextStartAtRaw) {
    const parsed = new Date(nextStartAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ message: "INVALID_START" }, { status: 400 });
    }
    nextStartAt = parsed;
    data.startAt = parsed;
  }
  if (nextEndAtRaw) {
    const parsed = new Date(nextEndAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ message: "INVALID_END" }, { status: 400 });
    }
    nextEndAt = parsed;
    data.endAt = parsed;
  }
  if (nextLocationId != null) {
    if (!Number.isInteger(nextLocationId) || nextLocationId <= 0) {
      return NextResponse.json({ message: "INVALID_LOCATION" }, { status: 400 });
    }
    nextLocation = nextLocationId;
    data.locationId = nextLocationId;
  }
  if (nextSpecialistId != null) {
    if (!Number.isInteger(nextSpecialistId) || nextSpecialistId <= 0) {
      return NextResponse.json({ message: "INVALID_SPECIALIST" }, { status: 400 });
    }
    nextSpecialist = nextSpecialistId;
    data.specialistId = nextSpecialistId;
  }
  if (nextServiceId != null) {
    if (!Number.isInteger(nextServiceId) || nextServiceId <= 0) {
      return NextResponse.json({ message: "INVALID_SERVICE" }, { status: 400 });
    }
    nextService = nextServiceId;
    data.serviceId = nextServiceId;
  }

  if (nextStartAt.getTime() >= nextEndAt.getTime()) {
    return NextResponse.json({ message: "INVALID_RANGE" }, { status: 400 });
  }

  const now = new Date();
  if ((nextStartAtRaw || nextEndAtRaw) && nextStartAt.getTime() < now.getTime()) {
    return NextResponse.json({ message: "PAST_TIME" }, { status: 400 });
  }

  if (
    nextStartAtRaw ||
    nextEndAtRaw ||
    nextLocationId != null ||
    nextSpecialistId != null ||
    nextServiceId != null
  ) {
    const [location, specialist, service] = await Promise.all([
      prisma.location.findFirst({
        where: { id: nextLocation, accountId: session.accountId, status: "ACTIVE" },
        select: {
          id: true,
          hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
          exceptions: { select: { date: true, isClosed: true, startTime: true, endTime: true } },
        },
      }),
      prisma.specialistProfile.findFirst({
        where: { id: nextSpecialist, accountId: session.accountId },
        select: { id: true, locations: { select: { locationId: true } } },
      }),
      prisma.service.findFirst({
        where: { id: nextService, accountId: session.accountId, isActive: true, bookingType: "GROUP" },
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
    if (!scheduleEntry || scheduleEntry.type !== "WORKING") {
      return NextResponse.json({ message: "NO_WORKDAY" }, { status: 400 });
    }
    if (scheduleEntry.locationId && scheduleEntry.locationId !== location.id) {
      return NextResponse.json({ message: "SCHEDULE_LOCATION_MISMATCH" }, { status: 400 });
    }

    const entryStart = parseTimeToMinutes(scheduleEntry.startTime);
    const entryEnd = parseTimeToMinutes(scheduleEntry.endTime);
    if (entryStart == null || entryEnd == null || entryStart >= entryEnd) {
      return NextResponse.json({ message: "INVALID_SCHEDULE_WINDOW" }, { status: 400 });
    }
    const startMinutes = nextStartAt.getHours() * 60 + nextStartAt.getMinutes();
    const endMinutes = nextEndAt.getHours() * 60 + nextEndAt.getMinutes();
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
          startAt: { lt: nextEndAt },
          endAt: { gt: nextStartAt },
        },
        select: { id: true },
      }),
      prisma.groupSession.findFirst({
        where: {
          accountId: session.accountId,
          specialistId: specialist.id,
          status: { not: "CANCELLED" },
          startAt: { lt: nextEndAt },
          endAt: { gt: nextStartAt },
          NOT: { id: existing.id },
        },
        select: { id: true },
      }),
      prisma.blockedSlot.findFirst({
        where: {
          accountId: session.accountId,
          startAt: { lt: nextEndAt },
          endAt: { gt: nextStartAt },
          OR: [{ locationId: nextLocation }, { specialistId: specialist.id }],
        },
        select: { id: true },
      }),
    ]);
    if (appointmentConflict || sessionConflict || blockedConflict) {
      return NextResponse.json({ message: "SLOT_BUSY" }, { status: 409 });
    }
  }

  const updated = await prisma.groupSession.update({
    where: { id: existing.id },
    data,
  });

  return NextResponse.json({
    id: updated.id,
    startAt: updated.startAt.toISOString(),
    endAt: updated.endAt.toISOString(),
    status: updated.status,
    capacity: updated.capacity,
    bookedCount: updated.bookedCount,
    pricePerClient: updated.pricePerClient ? updated.pricePerClient.toString() : null,
    comment: updated.comment ?? null,
  });
}
