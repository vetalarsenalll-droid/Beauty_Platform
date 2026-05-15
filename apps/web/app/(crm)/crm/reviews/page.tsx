import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CrmReviewsClient, { type CrmReviewItem } from "./crm-reviews-client";

function specialistName(item: { user: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null } }) {
  return [item.user.profile?.firstName, item.user.profile?.lastName].filter(Boolean).join(" ") || item.user.email || "Специалист";
}

function userName(item: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null } | null) {
  if (!item) return null;
  return [item.profile?.firstName, item.profile?.lastName].filter(Boolean).join(" ") || item.email || null;
}

export default async function CrmReviewsPage() {
  const session = await requireCrmPermission("crm.clients.read");
  const pageSize = 50;
  const [reviews, total, settings] = await Promise.all([
    prisma.review.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
      include: {
        client: true,
        repliedByUser: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
        appointment: {
          select: {
            startAt: true,
            location: { select: { name: true } },
            specialist: {
              select: {
                user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
              },
            },
            services: {
              orderBy: { orderIndex: "asc" },
              select: { service: { select: { name: true } } },
            },
          },
        },
      },
      take: pageSize,
    }),
    prisma.review.count({ where: { accountId: session.accountId } }),
    prisma.accountSetting.findUnique({ where: { accountId: session.accountId } }),
  ]);

  const reviewSettings = {
    reviewAutoPublish: settings?.reviewAutoPublish ?? true,
    reviewAllowReplies: settings?.reviewAllowReplies ?? true,
    reviewModerationMode: settings?.reviewModerationMode ?? "auto",
    reviewModerationWords: Array.isArray(settings?.reviewModerationWords)
      ? settings.reviewModerationWords.filter((item): item is string => typeof item === "string")
      : [],
    reviewModerationMinRating: settings?.reviewModerationMinRating ?? null,
  };

  const reviewIds = reviews.map((review) => String(review.id));
  const [reviewPhotoLinks, replyPhotoLinks] = await Promise.all([
    prisma.mediaLink.findMany({
      where: { entityType: "review.photo", entityId: { in: reviewIds } },
      include: { asset: { select: { url: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "review.reply.photo", entityId: { in: reviewIds } },
      include: { asset: { select: { id: true, url: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const reviewPhotoMap = new Map<string, string[]>();
  reviewPhotoLinks.forEach((link) => reviewPhotoMap.set(link.entityId, [...(reviewPhotoMap.get(link.entityId) ?? []), link.asset.url]));

  const replyPhotoMap = new Map<string, Array<{ assetId: number; url: string }>>();
  replyPhotoLinks.forEach((link) => replyPhotoMap.set(link.entityId, [...(replyPhotoMap.get(link.entityId) ?? []), { assetId: link.asset.id, url: link.asset.url }]));

  const locationIds = reviews
    .filter((item) => item.entityType === "location" && item.entityId)
    .map((item) => Number(item.entityId))
    .filter(Number.isInteger);
  const serviceIds = reviews
    .filter((item) => item.entityType === "service" && item.entityId)
    .map((item) => Number(item.entityId))
    .filter(Number.isInteger);
  const specialistIds = reviews
    .filter((item) => item.entityType === "specialist" && item.entityId)
    .map((item) => Number(item.entityId))
    .filter(Number.isInteger);

  const [locations, services, specialists] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId, id: { in: locationIds } },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId, id: { in: serviceIds } },
      select: { id: true, name: true },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId, id: { in: specialistIds } },
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

  const reviewItems: CrmReviewItem[] = reviews.map((review) => ({
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
    moderationMatchedWords: Array.isArray(review.moderationMatchedWords)
      ? review.moderationMatchedWords.filter((item): item is string => typeof item === "string")
      : [],
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
  }));

  return (
    <CrmReviewsClient
      reviews={reviewItems}
      settings={reviewSettings}
      total={total}
      pageSize={pageSize}
    />
  );
}
