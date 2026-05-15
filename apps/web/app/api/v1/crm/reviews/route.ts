import { jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { prisma } from "@/lib/prisma";

function specialistName(item: { user: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null } }) {
  return [item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" ") || item.user.email || "Специалист";
}

function userName(item: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null } | null) {
  if (!item) return null;
  return [item.profile?.firstName, item.profile?.lastName].filter(Boolean).join(" ") || item.email || null;
}

export async function GET(request: Request) {
  const auth = await requireCrmApiPermission("crm.clients.read");
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { accountId: auth.session.accountId },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        client: true,
        repliedByUser: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
        appointment: {
          select: {
            startAt: true,
            location: { select: { name: true } },
            specialist: { select: { user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } } },
            services: { orderBy: { orderIndex: "asc" }, select: { service: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.review.count({ where: { accountId: auth.session.accountId } }),
  ]);

  const ids = reviews.map((review) => String(review.id));
  const [reviewPhotos, replyPhotos] = await Promise.all([
    prisma.mediaLink.findMany({
      where: { entityType: "review.photo", entityId: { in: ids } },
      include: { asset: { select: { url: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "review.reply.photo", entityId: { in: ids } },
      include: { asset: { select: { id: true, url: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const reviewPhotoMap = new Map<string, string[]>();
  reviewPhotos.forEach((link) => reviewPhotoMap.set(link.entityId, [...(reviewPhotoMap.get(link.entityId) ?? []), link.asset.url]));

  const replyPhotoMap = new Map<string, Array<{ assetId: number; url: string }>>();
  replyPhotos.forEach((link) => replyPhotoMap.set(link.entityId, [...(replyPhotoMap.get(link.entityId) ?? []), { assetId: link.asset.id, url: link.asset.url }]));

  const locationIds = reviews.filter((item) => item.entityType === "location" && item.entityId).map((item) => Number(item.entityId)).filter(Number.isInteger);
  const serviceIds = reviews.filter((item) => item.entityType === "service" && item.entityId).map((item) => Number(item.entityId)).filter(Number.isInteger);
  const specialistIds = reviews.filter((item) => item.entityType === "specialist" && item.entityId).map((item) => Number(item.entityId)).filter(Number.isInteger);

  const [locations, services, specialists] = await Promise.all([
    prisma.location.findMany({ where: { accountId: auth.session.accountId, id: { in: locationIds } }, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { accountId: auth.session.accountId, id: { in: serviceIds } }, select: { id: true, name: true } }),
    prisma.specialistProfile.findMany({
      where: { accountId: auth.session.accountId, id: { in: specialistIds } },
      select: { id: true, user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    }),
  ]);

  const locationNames = new Map(locations.map((item) => [String(item.id), item.name]));
  const serviceNames = new Map(services.map((item) => [String(item.id), item.name]));
  const specialistNames = new Map(specialists.map((item) => [String(item.id), specialistName(item)]));
  const entityLabel = (review: (typeof reviews)[number]) => {
    if (review.entityType === "location") return locationNames.get(review.entityId ?? "") ?? `Локация #${review.entityId}`;
    if (review.entityType === "specialist") return specialistNames.get(review.entityId ?? "") ?? `Специалист #${review.entityId}`;
    if (review.entityType === "service") return serviceNames.get(review.entityId ?? "") ?? `Услуга #${review.entityId}`;
    return "Аккаунт";
  };

  const response = jsonOk({
    total,
    offset,
    limit,
    reviews: reviews.map((review) => ({
      id: review.id,
      accountId: review.accountId,
      clientId: review.clientId,
      appointmentId: review.appointmentId,
      entityType: review.entityType,
      entityId: review.entityId,
      entityLabel: entityLabel(review),
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      replyText: review.replyText,
      repliedAt: review.repliedAt?.toISOString() ?? null,
      repliedByUserId: review.repliedByUserId,
      repliedByUserName: userName(review.repliedByUser),
      moderationReason: review.moderationReason,
      moderationMatchedWords: Array.isArray(review.moderationMatchedWords) ? review.moderationMatchedWords : [],
      moderatedAt: review.moderatedAt?.toISOString() ?? null,
      moderatedByUserId: review.moderatedByUserId,
      createdAt: review.createdAt.toISOString(),
      photoUrls: reviewPhotoMap.get(String(review.id)) ?? [],
      replyPhotos: replyPhotoMap.get(String(review.id)) ?? [],
      client: {
        firstName: review.client.firstName,
        lastName: review.client.lastName,
        phone: review.client.phone,
        email: review.client.email,
      },
      appointment: review.appointment
        ? {
            startAt: review.appointment.startAt.toISOString(),
            locationName: review.appointment.location.name,
            specialistName: specialistName(review.appointment.specialist),
            serviceNames: review.appointment.services.map((item) => item.service.name),
          }
        : null,
    })),
  });
  return applyCrmAccessCookie(response, auth);
}
