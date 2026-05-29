import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalDate, optionalString, type JsonRecord } from "../action-helpers";

export const appointmentSelect = {
  id: true,
  clientId: true,
  specialistId: true,
  locationId: true,
  startAt: true,
  endAt: true,
  status: true,
  priceTotal: true,
  durationTotalMin: true,
  source: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  location: { select: { id: true, name: true, address: true } },
  specialist: { select: { id: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
  services: { select: { serviceId: true, price: true, durationMin: true, service: { select: { id: true, name: true } } }, take: 20 },
} as const;

export function appointmentWhere(payload: JsonRecord, accountId: number) {
  const appointmentId = numberOrNull(payload.appointmentId ?? payload.id);
  const clientId = numberOrNull(payload.clientId);
  const specialistId = numberOrNull(payload.specialistId);
  const locationId = numberOrNull(payload.locationId);
  const dateFrom = optionalDate(payload, "dateFrom");
  const dateTo = optionalDate(payload, "dateTo");
  const status = optionalString(payload, "status");
  return {
    accountId,
    ...(appointmentId ? { id: appointmentId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(specialistId ? { specialistId } : {}),
    ...(locationId ? { locationId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(dateFrom || dateTo ? { startAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
}

export function serializeAppointment(appointment: {
  id: number;
  clientId: number;
  specialistId: number;
  locationId: number;
  startAt: Date;
  endAt: Date;
  status: unknown;
  priceTotal: { toString(): string };
  durationTotalMin: number;
  source: string;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: number; firstName: string | null; lastName: string | null; phone: string | null; email: string | null };
  location: { id: number; name: string; address: string | null };
  specialist: { id: number; user: { profile: { firstName: string | null; lastName: string | null } | null } };
  services: Array<{ serviceId: number; price: { toString(): string }; durationMin: number; service: { id: number; name: string } }>;
}) {
  const clientName = [appointment.client.firstName, appointment.client.lastName].filter(Boolean).join(" ").trim() || null;
  const specialistProfile = appointment.specialist.user.profile;
  const specialistName = [specialistProfile?.firstName, specialistProfile?.lastName].filter(Boolean).join(" ").trim() || null;
  return {
    id: appointment.id,
    clientId: appointment.clientId,
    specialistId: appointment.specialistId,
    locationId: appointment.locationId,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    status: appointment.status,
    priceTotal: appointment.priceTotal.toString(),
    durationTotalMin: appointment.durationTotalMin,
    source: appointment.source,
    comment: appointment.comment,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
    client: { ...appointment.client, displayName: clientName },
    specialist: { id: appointment.specialist.id, displayName: specialistName },
    location: appointment.location,
    services: appointment.services.map((item) => ({
      serviceId: item.serviceId,
      price: item.price.toString(),
      durationMin: item.durationMin,
      service: item.service,
    })),
  };
}

export function clampTake(value: unknown, fallback: number, max: number) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getAppointmentById(accountId: number, appointmentId: number) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, accountId },
    select: appointmentSelect,
  });
}

