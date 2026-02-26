import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";

export async function getClientBookings(args: { accountId: number; clientId: number; limit?: number }) {
  const limit = args.limit ?? 7;
  return prisma.appointment.findMany({
    where: { accountId: args.accountId, clientId: args.clientId },
    orderBy: { startAt: "desc" },
    take: limit,
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      priceTotal: true,
      services: { select: { service: { select: { name: true } } }, take: 1 },
      specialist: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      location: { select: { name: true } },
    },
  });
}

export async function getClientStats(args: { accountId: number; clientId: number }) {
  const bookings = await prisma.appointment.findMany({
    where: { accountId: args.accountId, clientId: args.clientId },
    select: { status: true, priceTotal: true, services: { select: { service: { select: { name: true } } } } },
  });
  const total = bookings.length;
  const cancelled = bookings.filter((x) => x.status === "CANCELLED").length;
  const done = bookings.filter((x) => x.status === "DONE").length;
  const avgCheck =
    done > 0
      ? bookings
          .filter((x) => x.status === "DONE")
          .reduce((sum, x) => sum + Number(x.priceTotal || 0), 0) / done
      : 0;

  const serviceFreq = new Map<string, number>();
  for (const b of bookings) {
    for (const s of b.services) {
      const name = s.service.name;
      serviceFreq.set(name, (serviceFreq.get(name) ?? 0) + 1);
    }
  }
  const topService = [...serviceFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { total, done, cancelled, avgCheck, topService };
}

export async function findLatestUpcomingBooking(args: { accountId: number; clientId: number }) {
  const now = new Date();
  return prisma.appointment.findFirst({
    where: {
      accountId: args.accountId,
      clientId: args.clientId,
      status: { in: ["NEW", "CONFIRMED"] },
      startAt: { gte: now },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, locationId: true, specialistId: true, clientId: true, accountId: true },
  });
}

export async function getBookingPolicy(args: { accountId: number }) {
  const settings = await prisma.accountSetting.findUnique({
    where: { accountId: args.accountId },
    select: { cancellationWindowHours: true, rescheduleWindowHours: true },
  });
  return {
    cancellationWindowHours: settings?.cancellationWindowHours ?? null,
    rescheduleWindowHours: settings?.rescheduleWindowHours ?? null,
  };
}

export async function cancelClientBooking(args: { accountId: number; clientId: number; appointmentId: number }) {
  const policy = await getBookingPolicy({ accountId: args.accountId });
  const appt = await prisma.appointment.findFirst({
    where: { id: args.appointmentId, accountId: args.accountId, clientId: args.clientId },
    select: { id: true, status: true, startAt: true },
  });
  if (!appt) return { ok: false as const, reason: "not_found" as const };
  if (appt.status === "CANCELLED") return { ok: false as const, reason: "already_cancelled" as const };
  if (appt.status === "DONE") return { ok: false as const, reason: "already_done" as const };
  if (policy.cancellationWindowHours != null) {
    const hoursLeft = (appt.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < policy.cancellationWindowHours) {
      return {
        ok: false as const,
        reason: "cancellation_window_blocked" as const,
        policyHours: policy.cancellationWindowHours,
        hoursLeft: Math.max(0, Math.floor(hoursLeft)),
      };
    }
  }
  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" as AppointmentStatus } }),
    prisma.appointmentStatusHistory.create({
      data: { appointmentId: appt.id, actorType: "client_chat", fromStatus: appt.status, toStatus: "CANCELLED" },
    }),
  ]);
  return { ok: true as const };
}

export async function rescheduleClientBooking(args: {
  accountId: number;
  clientId: number;
  appointmentId: number;
  startAt: Date;
  endAt: Date;
}) {
  const policy = await getBookingPolicy({ accountId: args.accountId });
  const appt = await prisma.appointment.findFirst({
    where: { id: args.appointmentId, accountId: args.accountId, clientId: args.clientId },
    select: { id: true, status: true, specialistId: true, locationId: true, startAt: true },
  });
  if (!appt) return { ok: false as const, reason: "not_found" as const };
  if (appt.status === "CANCELLED" || appt.status === "DONE") return { ok: false as const, reason: "invalid_state" as const };
  if (policy.rescheduleWindowHours != null) {
    const hoursLeft = (appt.startAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft < policy.rescheduleWindowHours) {
      return {
        ok: false as const,
        reason: "reschedule_window_blocked" as const,
        policyHours: policy.rescheduleWindowHours,
        hoursLeft: Math.max(0, Math.floor(hoursLeft)),
      };
    }
  }
  const conflict = await prisma.appointment.findFirst({
    where: {
      accountId: args.accountId,
      specialistId: appt.specialistId,
      locationId: appt.locationId,
      id: { not: appt.id },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startAt: { lt: args.endAt },
      endAt: { gt: args.startAt },
    },
    select: { id: true },
  });
  if (conflict) return { ok: false as const, reason: "slot_busy" as const };
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { startAt: args.startAt, endAt: args.endAt, status: "CONFIRMED" },
  });
  await prisma.appointmentStatusHistory.create({
    data: { appointmentId: appt.id, actorType: "client_chat", fromStatus: appt.status, toStatus: "CONFIRMED" },
  });
  return { ok: true as const };
}

export async function updateClientPhone(args: { accountId: number; clientId: number; phone: string }) {
  const updated = await prisma.client.update({
    where: { id: args.clientId },
    data: { phone: args.phone },
    select: { id: true, phone: true },
  });
  return updated;
}
