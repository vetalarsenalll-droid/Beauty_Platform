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
  type JsonRecord,
} from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const appointmentCreateAction = defineCrmAgentAction({
  name: "appointment.create",
  domain: "appointments",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.create",
  confirmation: "always",
  requiredSlots: ["clientId", "serviceId", "specialistId", "locationId", "startAt"],
  optionalSlots: ["endAt", "priceTotal", "durationTotalMin", "comment"],
  description: "Создать запись.",
  plannerHints: ["Use appointment.create only after required slots are resolved and the user intent matches: Создать запись."],
  preview: async (payload) => buildActionPreview({ after: payload }),
  execute: async (payload: JsonRecord, ctx) => {
    const serviceId = requiredNumber(payload.serviceId, "serviceId");
    const service = await prisma.service.findFirst({
      where: { id: serviceId, accountId: ctx.accountId, isActive: true },
      select: { id: true, basePrice: true, baseDurationMin: true },
    });
    if (!service) throw new Error("Service not found.");
    const startAt = requiredDate(payload, "startAt");
    const endAt = optionalDate(payload, "endAt") ?? new Date(startAt.getTime() + service.baseDurationMin * 60 * 1000);
    const clientId = requiredNumber(payload.clientId, "clientId");
    const specialistId = requiredNumber(payload.specialistId, "specialistId");
    const locationId = requiredNumber(payload.locationId, "locationId");
    await assertClientBelongsToAccount(ctx.accountId, clientId);
    await assertSpecialistBelongsToAccount(ctx.accountId, specialistId);
    await assertLocationBelongsToAccount(ctx.accountId, locationId);
    await assertServiceSpecialistBinding(service.id, specialistId);
    await assertServiceLocationBinding(service.id, locationId);
    await assertSlotAvailable(ctx.accountId, specialistId, locationId, startAt, endAt);
    const appointment = await prisma.appointment.create({
      data: {
        accountId: ctx.accountId,
        clientId,
        specialistId,
        locationId,
        startAt,
        endAt,
        status: "NEW",
        priceTotal: optionalString(payload, "priceTotal") ?? service.basePrice,
        durationTotalMin: numberOrNull(payload.durationTotalMin) ?? service.baseDurationMin,
        source: "CRM_AGENT_V2",
        comment: optionalString(payload, "comment"),
        services: {
          create: {
            serviceId: service.id,
            price: optionalString(payload, "priceTotal") ?? service.basePrice,
            durationMin: numberOrNull(payload.durationTotalMin) ?? service.baseDurationMin,
            specialistId,
          },
        },
        statusHistory: {
          create: {
            actorType: "CRM_AGENT_V2",
            actorId: ctx.userId ? String(ctx.userId) : null,
            toStatus: "NEW",
            comment: optionalString(payload, "comment"),
          },
        },
      },
    });
    return { status: "DONE", data: { appointmentId: appointment.id } };
  },
});

async function assertSlotAvailable(accountId: number, specialistId: number, locationId: number, startAt: Date, endAt: Date) {
  const appointment = await prisma.appointment.findFirst({
    where: {
      accountId,
      specialistId,
      locationId,
      status: { in: ["NEW", "CONFIRMED", "IN_PROGRESS"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });
  if (appointment) throw new Error(`Appointment slot conflicts with appointment #${appointment.id}.`);

  const blocked = await prisma.blockedSlot.findFirst({
    where: {
      accountId,
      AND: [{ OR: [{ specialistId }, { specialistId: null }] }, { OR: [{ locationId }, { locationId: null }] }],
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, reason: true },
  });
  if (blocked) throw new Error(`Appointment slot is blocked${blocked.reason ? `: ${blocked.reason}` : "."}`);
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
