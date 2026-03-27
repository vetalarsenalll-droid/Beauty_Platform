import { NextResponse } from "next/server";
import { AppointmentStatus, ScheduleEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import { getAccountSlotStepMinutes } from "@/lib/public-booking";

const NON_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const toNum = (value: string | null): number | null => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTimeToMinutes = (value: string | null) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const toTimeLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const isOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB && endA > startB;

export async function GET(request: Request) {
  const session = await requireCrmPermission("crm.calendar.read");

  const { searchParams } = new URL(request.url);
  const specialistId = toNum(searchParams.get("specialistId"));
  const locationId = toNum(searchParams.get("locationId"));
  const durationMinRaw = toNum(searchParams.get("durationMin"));
  const dateRaw = searchParams.get("date");
  const appointmentId = toNum(searchParams.get("appointmentId"));
  const serviceIdsRaw = searchParams.get("serviceIds");

  if (!specialistId || !locationId || !dateRaw) {
    return NextResponse.json({ slots: [], message: "MISSING_PARAMS" }, { status: 400 });
  }

  const durationMin = Math.max(5, Math.round(durationMinRaw ?? 0));
  if (durationMin <= 0) {
    return NextResponse.json({ slots: [], message: "INVALID_DURATION" }, { status: 400 });
  }

  const dateLocal = new Date(`${dateRaw}T00:00:00`);
  if (Number.isNaN(dateLocal.getTime())) {
    return NextResponse.json({ slots: [], message: "INVALID_DATE" }, { status: 400 });
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId: session.accountId },
    select: { id: true },
  });
  if (!specialist) {
    return NextResponse.json({ slots: [] }, { status: 200 });
  }

  const serviceIds = (serviceIdsRaw ?? "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (serviceIds.length > 0 && !appointmentId) {
    const services = await prisma.service.findMany({
      where: {
        accountId: session.accountId,
        id: { in: serviceIds },
      },
      include: {
        locations: true,
        specialists: true,
      },
    });
    const servicesById = new Map(services.map((service) => [service.id, service]));
    const knownServices = serviceIds
      .map((serviceId) => servicesById.get(serviceId))
      .filter((item): item is (typeof services)[number] => Boolean(item));
    const invalid = knownServices.some((service) => {
      const hasLocation = service.locations.some((item) => item.locationId === locationId);
      const hasSpecialist = service.specialists.some((item) => item.specialistId === specialistId);
      return !hasLocation || !hasSpecialist;
    });
    if (invalid) {
      return NextResponse.json(
        { slots: [], message: "SPECIALIST_SERVICES_MISMATCH" },
        { status: 200 }
      );
    }
  }

  const scheduleDayStartUtc = new Date(`${dateRaw}T00:00:00.000Z`);
  const scheduleDayEndUtc = new Date(scheduleDayStartUtc);
  scheduleDayEndUtc.setUTCDate(scheduleDayEndUtc.getUTCDate() + 1);

  const scheduleEntry = await prisma.scheduleEntry.findFirst({
    where: {
      specialistId,
      date: { gte: scheduleDayStartUtc, lt: scheduleDayEndUtc },
    },
    include: { breaks: true },
    orderBy: { date: "asc" },
  });
  if (!scheduleEntry || scheduleEntry.type !== ScheduleEntryType.WORKING) {
    return NextResponse.json({ slots: [], message: "NO_WORKING_SCHEDULE" }, { status: 200 });
  }
  if (scheduleEntry.locationId && scheduleEntry.locationId !== locationId) {
    return NextResponse.json({ slots: [], message: "SCHEDULE_LOCATION_MISMATCH" }, { status: 200 });
  }

  const dayStart = parseTimeToMinutes(scheduleEntry.startTime ?? null);
  const dayEnd = parseTimeToMinutes(scheduleEntry.endTime ?? null);
  if (dayStart == null || dayEnd == null || dayStart >= dayEnd) {
    return NextResponse.json({ slots: [], message: "INVALID_SCHEDULE_WINDOW" }, { status: 200 });
  }

  const dayStartAt = new Date(dateLocal);
  dayStartAt.setHours(0, 0, 0, 0);
  const dayEndAt = new Date(dayStartAt);
  dayEndAt.setDate(dayEndAt.getDate() + 1);

  const [appointments, blockedSlots] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        accountId: session.accountId,
        specialistId,
        status: { notIn: NON_BLOCKING_STATUSES },
        startAt: { lt: dayEndAt },
        endAt: { gt: dayStartAt },
        ...(appointmentId ? { id: { not: appointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.blockedSlot.findMany({
      where: {
        accountId: session.accountId,
        startAt: { lt: dayEndAt },
        endAt: { gt: dayStartAt },
        OR: [
          { specialistId: null, locationId: null },
          { specialistId, locationId: null },
          { specialistId: null, locationId },
          { specialistId, locationId },
        ],
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const appointmentRanges = appointments.map((item) => ({
    start: item.startAt.getHours() * 60 + item.startAt.getMinutes(),
    end: item.endAt.getHours() * 60 + item.endAt.getMinutes(),
  }));
  const blockedRanges = blockedSlots.map((item) => ({
    start: item.startAt.getHours() * 60 + item.startAt.getMinutes(),
    end: item.endAt.getHours() * 60 + item.endAt.getMinutes(),
  }));
  const breakRanges = scheduleEntry.breaks
    .map((item) => ({
      start: parseTimeToMinutes(item.startTime),
      end: parseTimeToMinutes(item.endTime),
    }))
    .filter((item): item is { start: number; end: number } => item.start != null && item.end != null);

  const maxStart = dayEnd - durationMin;
  const slotStepMin = await getAccountSlotStepMinutes(session.accountId);
  const slots: string[] = [];

  for (let start = dayStart; start <= maxStart; start += slotStepMin) {
    const end = start + durationMin;
    const intersectsBreak = breakRanges.some((item) => isOverlap(start, end, item.start, item.end));
    if (intersectsBreak) continue;
    const intersectsBlocked = blockedRanges.some((item) => isOverlap(start, end, item.start, item.end));
    if (intersectsBlocked) continue;
    const intersectsAppointment = appointmentRanges.some((item) => isOverlap(start, end, item.start, item.end));
    if (intersectsAppointment) continue;
    slots.push(toTimeLabel(start));
  }

  return NextResponse.json({ slots, message: slots.length > 0 ? "OK" : "NO_FREE_SLOTS" });
}
