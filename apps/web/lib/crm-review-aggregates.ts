import { prisma } from "@/lib/prisma";

async function writeRatingAggregate(accountId: number, entityType: string, entityId: string, ratingAvg: number, ratingCount: number) {
  await prisma.ratingAggregate.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { accountId, entityType, entityId, ratingAvg, ratingCount },
    update: { ratingAvg, ratingCount },
  });
}

export async function refreshReviewRatingAggregate(accountId: number, entityType: string, entityId: string) {
  const stats = await prisma.review.aggregate({
    where: { accountId, entityType, entityId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await writeRatingAggregate(accountId, entityType, entityId, stats._avg.rating ?? 0, stats._count.rating);
}

export async function refreshAppointmentReviewAggregates(accountId: number, appointmentId: number | null) {
  if (!appointmentId) return;

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, accountId },
    select: {
      locationId: true,
      specialistId: true,
      services: { select: { serviceId: true } },
    },
  });
  if (!appointment) return;

  const aggregateByAppointmentWhere = async (
    entityType: string,
    entityId: string,
    appointmentWhere: { locationId?: number; specialistId?: number; services?: { some: { serviceId: number } } } = {}
  ) => {
    const stats = await prisma.review.aggregate({
      where: {
        accountId,
        status: "PUBLISHED",
        appointmentId: { not: null },
        appointment: appointmentWhere,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await writeRatingAggregate(accountId, entityType, entityId, stats._avg.rating ?? 0, stats._count.rating);
  };

  await aggregateByAppointmentWhere("account", String(accountId), {});
  await aggregateByAppointmentWhere("location", String(appointment.locationId), { locationId: appointment.locationId });
  await aggregateByAppointmentWhere("specialist", String(appointment.specialistId), { specialistId: appointment.specialistId });
  await Promise.all(
    Array.from(new Set(appointment.services.map((item) => item.serviceId))).map((serviceId) =>
      aggregateByAppointmentWhere("service", String(serviceId), { services: { some: { serviceId } } })
    )
  );
}
