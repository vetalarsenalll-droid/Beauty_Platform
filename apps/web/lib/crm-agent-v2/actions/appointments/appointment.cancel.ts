import { prisma } from "@/lib/prisma";
import { buildActionPreview } from "../action-preview";
import { optionalString, requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";

export const appointmentCancelAction = defineCrmAgentAction({
  name: "appointment.cancel",
  domain: "appointments",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.appointments.cancel",
  confirmation: "always",
  requiredSlots: ["appointmentId"],
  optionalSlots: ["comment"],
  description: "Отменить запись.",
  plannerHints: ["Use appointment.cancel only after required slots are resolved and the user intent matches: Отменить запись."],
  preview: async (payload: JsonRecord, ctx) => {
    const appointmentId = numberArg(payload.appointmentId);
    const appointment = appointmentId
      ? await prisma.appointment.findFirst({
          where: { id: appointmentId, accountId: ctx.accountId },
          select: { id: true, status: true, startAt: true, endAt: true, clientId: true, specialistId: true, locationId: true, comment: true },
        })
      : null;
    const before = appointment
      ? { ...appointment, startAt: appointment.startAt.toISOString(), endAt: appointment.endAt.toISOString() }
      : null;
    return buildActionPreview({ before, after: { ...(before ?? {}), ...payload, status: "CANCELLED" } });
  },
  execute: async (payload: JsonRecord, ctx) => {
    const appointmentId = requiredNumber(payload.appointmentId, "appointmentId");
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, accountId: ctx.accountId },
      select: { id: true, status: true },
    });
    if (!appointment) throw new Error("Appointment not found.");
    await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "CANCELLED", comment: optionalString(payload, "comment") },
      }),
      prisma.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          actorType: "CRM_AGENT_V2",
          actorId: ctx.userId ? String(ctx.userId) : null,
          fromStatus: appointment.status,
          toStatus: "CANCELLED",
          comment: optionalString(payload, "comment"),
        },
      }),
    ]);
    return { status: "DONE", data: { appointmentId } };
  },
});

function numberArg(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}
