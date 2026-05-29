import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import {
  assertClientBelongsToAccount,
  assertLocationBelongsToAccount,
  assertServiceLocationBinding,
  assertServiceSpecialistBinding,
  assertSpecialistBelongsToAccount,
  optionalDate,
  optionalString,
  requiredDate,
  requiredNumber,
  requiredString,
  type JsonRecord,
} from "../action-helpers";
import type { CrmAgentActionContext, CrmAgentActionPreview } from "../types";
import { getAppointmentById, serializeAppointment } from "./appointment-read-helpers";

type AppointmentStatusValue = "NEW" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "NO_SHOW";

export async function previewAppointmentUpdate(payload: JsonRecord, ctx: CrmAgentActionContext): Promise<CrmAgentActionPreview> {
  const before = await loadAppointmentBefore(payload, ctx.accountId);
  return buildActionPreview({ before, after: { ...(before ?? {}), ...payload } });
}

export async function executeAppointmentStatus(payload: JsonRecord, ctx: CrmAgentActionContext, toStatus: AppointmentStatusValue) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, accountId: ctx.accountId }, select: { id: true, status: true } });
  if (!appointment) throw new Error("Appointment not found.");
  const comment = optionalString(payload, "comment");
  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: toStatus, ...(comment !== null ? { comment } : {}) } }),
    prisma.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        actorType: "CRM_AGENT_V2",
        actorId: ctx.userId ? String(ctx.userId) : null,
        fromStatus: appointment.status,
        toStatus,
        comment,
      },
    }),
  ]);
  return { status: "DONE" as const, data: { appointmentId, toStatus } };
}

export async function executeAppointmentClientChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const clientId = requiredNumber(payload.clientId, "clientId");
  await assertClientBelongsToAccount(ctx.accountId, clientId);
  await updateAppointment(ctx, appointmentId, { clientId }, optionalString(payload, "comment"));
  return { status: "DONE" as const, data: { appointmentId, clientId } };
}

export async function executeAppointmentSpecialistChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const appointment = await requireAppointment(ctx.accountId, appointmentId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  for (const item of appointment.services) await assertServiceSpecialistBinding(item.serviceId, specialistId);
  await assertSlotAvailable(ctx.accountId, specialistId, appointment.locationId, appointment.startAt, appointment.endAt, appointmentId);
  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: appointmentId }, data: { specialistId } });
    await tx.appointmentService.updateMany({ where: { appointmentId }, data: { specialistId } });
  });
  return { status: "DONE" as const, data: { appointmentId, specialistId } };
}

export async function executeAppointmentLocationChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const locationId = requiredNumber(payload.locationId, "locationId");
  const appointment = await requireAppointment(ctx.accountId, appointmentId);
  await assertLocationBelongsToAccount(ctx.accountId, locationId);
  for (const item of appointment.services) await assertServiceLocationBinding(item.serviceId, locationId);
  await assertSlotAvailable(ctx.accountId, appointment.specialistId, locationId, appointment.startAt, appointment.endAt, appointmentId);
  await updateAppointment(ctx, appointmentId, { locationId }, optionalString(payload, "comment"));
  return { status: "DONE" as const, data: { appointmentId, locationId } };
}

export async function executeAppointmentServiceChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const serviceId = requiredNumber(payload.serviceId, "serviceId");
  const appointment = await requireAppointment(ctx.accountId, appointmentId);
  const service = await prisma.service.findFirst({
    where: { id: serviceId, accountId: ctx.accountId, isActive: true },
    select: { id: true, basePrice: true, baseDurationMin: true },
  });
  if (!service) throw new Error("Service not found.");
  await assertServiceSpecialistBinding(service.id, appointment.specialistId);
  await assertServiceLocationBinding(service.id, appointment.locationId);
  const priceTotal = optionalString(payload, "priceTotal") ?? service.basePrice;
  const durationTotalMin = numberOrNull(payload.durationTotalMin) ?? service.baseDurationMin;
  await prisma.$transaction(async (tx) => {
    await tx.appointmentService.deleteMany({ where: { appointmentId } });
    await tx.appointmentService.create({
      data: { appointmentId, serviceId, price: priceTotal, durationMin: durationTotalMin, specialistId: appointment.specialistId },
    });
    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        priceTotal,
        durationTotalMin,
        endAt: new Date(appointment.startAt.getTime() + durationTotalMin * 60 * 1000),
        comment: optionalString(payload, "comment") ?? appointment.comment,
      },
    });
  });
  return { status: "DONE" as const, data: { appointmentId, serviceId } };
}

export async function executeAppointmentTimeChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const appointment = await requireAppointment(ctx.accountId, appointmentId);
  const startAt = requiredDate(payload, "startAt");
  const endAt = optionalDate(payload, "endAt") ?? new Date(startAt.getTime() + appointment.durationTotalMin * 60 * 1000);
  await assertSlotAvailable(ctx.accountId, appointment.specialistId, appointment.locationId, startAt, endAt, appointmentId);
  await updateAppointment(ctx, appointmentId, { startAt, endAt }, optionalString(payload, "comment"));
  return { status: "DONE" as const, data: { appointmentId, startAt: startAt.toISOString(), endAt: endAt.toISOString() } };
}

export async function executeAppointmentPriceChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const priceTotal = requiredString(payload, "priceTotal");
  await updateAppointment(ctx, appointmentId, { priceTotal }, optionalString(payload, "comment"));
  return { status: "DONE" as const, data: { appointmentId, priceTotal } };
}

export async function executeAppointmentDurationChange(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const appointment = await requireAppointment(ctx.accountId, appointmentId);
  const durationTotalMin = requiredNumber(payload.durationTotalMin, "durationTotalMin");
  const endAt = new Date(appointment.startAt.getTime() + durationTotalMin * 60 * 1000);
  await assertSlotAvailable(ctx.accountId, appointment.specialistId, appointment.locationId, appointment.startAt, endAt, appointmentId);
  await updateAppointment(ctx, appointmentId, { durationTotalMin, endAt }, optionalString(payload, "comment"));
  return { status: "DONE" as const, data: { appointmentId, durationTotalMin, endAt: endAt.toISOString() } };
}

export async function executeAppointmentCommentAdd(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const appointment = await requireAppointment(ctx.accountId, appointmentId);
  const comment = [appointment.comment, requiredString(payload, "comment")].filter(Boolean).join("\n");
  await updateAppointment(ctx, appointmentId, { comment }, null);
  return { status: "DONE" as const, data: { appointmentId } };
}

export async function executeAppointmentCommentUpdate(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
  const comment = requiredString(payload, "comment");
  await updateAppointment(ctx, appointmentId, { comment }, null);
  return { status: "DONE" as const, data: { appointmentId } };
}

export async function executeAppointmentHold(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId, "specialistId");
  const startAt = requiredDate(payload, "startAt");
  const endAt = requiredDate(payload, "endAt");
  const clientId = numberOrNull(payload.clientId);
  await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
  if (clientId) await assertClientBelongsToAccount(ctx.accountId, clientId);
  const expiresAt = optionalDate(payload, "expiresAt") ?? new Date(ctx.now.getTime() + 15 * 60 * 1000);
  const hold = await prisma.appointmentHold.create({ data: { accountId: ctx.accountId, specialistId, clientId, startAt, endAt, expiresAt } });
  return { status: "DONE" as const, data: { holdId: hold.id } };
}

export async function executeAppointmentHoldRelease(payload: JsonRecord, ctx: CrmAgentActionContext) {
  const holdId = requiredNumber(payload.holdId, "holdId");
  const deleted = await prisma.appointmentHold.deleteMany({ where: { id: holdId, accountId: ctx.accountId } });
  if (!deleted.count) throw new Error("Appointment hold not found.");
  return { status: "DONE" as const, data: { holdId } };
}

async function loadAppointmentBefore(payload: JsonRecord, accountId: number) {
  const appointmentId = numberOrNull(payload.appointmentId);
  if (!appointmentId) return null;
  const appointment = await getAppointmentById(accountId, appointmentId);
  return appointment ? serializeAppointment(appointment) : null;
}

async function requireAppointment(accountId: number, appointmentId: number) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId },
    select: {
      id: true,
      specialistId: true,
      locationId: true,
      startAt: true,
      endAt: true,
      durationTotalMin: true,
      comment: true,
      services: { select: { serviceId: true } },
    },
  });
  if (!appointment) throw new Error("Appointment not found.");
  return appointment;
}

async function updateAppointment(ctx: CrmAgentActionContext, appointmentId: number, data: Record<string, unknown>, historyComment: string | null) {
  await requireAppointment(ctx.accountId, appointmentId);
  await prisma.appointment.update({ where: { id: appointmentId }, data });
  if (historyComment) {
    await prisma.appointmentStatusHistory.create({
      data: {
        appointmentId,
        actorType: "CRM_AGENT_V2",
        actorId: ctx.userId ? String(ctx.userId) : null,
        toStatus: "NEW",
        comment: historyComment,
      },
    });
  }
}

async function assertSlotAvailable(accountId: number, specialistId: number, locationId: number, startAt: Date, endAt: Date, excludeAppointmentId: number) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      accountId,
      id: { not: excludeAppointmentId },
      specialistId,
      locationId,
      status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  if (appointment) throw new Error(`Appointment slot conflicts with appointment #${appointment.id}.`);
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
