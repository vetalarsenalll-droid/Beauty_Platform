import { prisma } from "@/lib/prisma";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import type { CrmAgentActionContext } from "../types";

export async function readSpecialistInsightAction(actionName: string, payload: JsonRecord, ctx: CrmAgentActionContext) {
  const specialistId = requiredNumber(payload.specialistId ?? payload.id, "specialistId");
  await assertSpecialist(ctx.accountId, specialistId);

  if (actionName === "specialist.view_revenue") {
    const appointments = await prisma.appointment.findMany({
      where: { accountId: ctx.accountId, specialistId, status: "DONE" },
      select: { priceTotal: true },
      take: 1000,
    });
    return {
      specialistId,
      revenue: appointments.reduce((sum, appointment) => sum + Number(appointment.priceTotal), 0).toFixed(2),
      appointments: appointments.length,
    };
  }

  if (actionName === "specialist.view_reviews") {
    const reviews = await prisma.review.findMany({
      where: { accountId: ctx.accountId, entityType: "specialist", entityId: String(specialistId) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { specialistId, reviews: reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString(), updatedAt: review.updatedAt.toISOString() })) };
  }

  if (actionName === "specialist.view_workload") {
    const [upcoming, done, cancelled] = await Promise.all([
      prisma.appointment.count({ where: { accountId: ctx.accountId, specialistId, startAt: { gte: ctx.now } } }),
      prisma.appointment.count({ where: { accountId: ctx.accountId, specialistId, status: "DONE" } }),
      prisma.appointment.count({ where: { accountId: ctx.accountId, specialistId, status: { in: ["CANCELLED", "NO_SHOW"] } } }),
    ]);
    return { specialistId, workload: { upcoming, done, cancelled } };
  }

  if (actionName === "specialist.view_empty_slots") {
    const appointments = await prisma.appointment.findMany({
      where: { accountId: ctx.accountId, specialistId, startAt: { gte: ctx.now } },
      orderBy: { startAt: "asc" },
      take: 20,
      select: { id: true, startAt: true, endAt: true, status: true },
    });
    return {
      specialistId,
      bookedWindows: appointments.map((appointment) => ({
        id: appointment.id,
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        status: appointment.status,
      })),
      note: "Empty slot calculation requires schedule templates; this read view returns booked future windows for planner-side gap analysis.",
    };
  }

  throw new Error(`Unsupported specialist insight action: ${actionName}.`);
}

async function assertSpecialist(accountId: number, specialistId: number) {
  const specialist = await prisma.specialistProfile.findFirst({ where: { accountId, id: specialistId }, select: { id: true } });
  if (!specialist) throw new Error("Specialist not found.");
}
