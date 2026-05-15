import { jsonError, jsonOk } from "@/lib/api";
import { getClientSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function resolveAccountClient(
  request: Request,
  session: NonNullable<Awaited<ReturnType<typeof getClientSession>>>
) {
  const url = new URL(request.url);
  const accountSlug = url.searchParams.get("account")?.trim() || "";
  const target = accountSlug
    ? session.clients.find((item) => item.accountSlug === accountSlug) ?? null
    : null;

  if (!target) return { error: jsonError("ACCOUNT_REQUIRED", "Укажите организацию.", null, 400) };

  return {
    accountSlug: target.accountSlug,
    accountId: target.accountId,
    clientId: target.clientId,
  };
}

async function writeRatingAggregate(accountId: number, entityType: string, entityId: string, ratingAvg: number, ratingCount: number) {
  await prisma.ratingAggregate.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { accountId, entityType, entityId, ratingAvg, ratingCount },
    update: { ratingAvg, ratingCount },
  });
}

async function refreshRatingAggregate(accountId: number, entityType: string, entityId: string) {
  const stats = await prisma.review.aggregate({
    where: { accountId, entityType, entityId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await writeRatingAggregate(accountId, entityType, entityId, stats._avg.rating ?? 0, stats._count.rating);
}

async function refreshAppointmentTargetAggregates(accountId: number, appointmentId: number) {
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

  const serviceIds = Array.from(new Set(appointment.services.map((item) => item.serviceId)));
  await Promise.all(
    serviceIds.map((serviceId) =>
      aggregateByAppointmentWhere("service", String(serviceId), { services: { some: { serviceId } } })
    )
  );
}

async function readReviewAutoPublish(accountId: number) {
  const settings = await prisma.accountSetting.findUnique({
    where: { accountId },
    select: {
      reviewAutoPublish: true,
      reviewModerationWords: true,
      reviewModerationMode: true,
      reviewModerationMinRating: true,
    },
  });
  return {
    reviewAutoPublish: settings?.reviewAutoPublish ?? true,
    reviewModerationWords: settings?.reviewModerationWords,
    reviewModerationMode: settings?.reviewModerationMode ?? "auto",
    reviewModerationMinRating: settings?.reviewModerationMinRating ?? null,
  };
}

function normalizeModerationText(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function readModerationWords(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? normalizeModerationText(item) : ""))
        .filter((item) => item.length > 0)
    )
  ).slice(0, 100);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findModerationWords(comment: string, words: string[]) {
  const normalized = normalizeModerationText(comment);
  return words.filter((word) => {
    if (word.includes(" ")) return normalized.includes(word);
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(word)}(?=$|[^\\p{L}\\p{N}_])`, "u");
    return pattern.test(normalized);
  });
}

function resolveReviewModerationStatus({
  comment,
  rating,
  settings,
}: {
  comment: string;
  rating: number;
  settings: Awaited<ReturnType<typeof readReviewAutoPublish>>;
}) {
  const mode = settings.reviewModerationMode;
  const words = readModerationWords(settings.reviewModerationWords);
  const matchedWords = findModerationWords(comment, words);
  const minRating = settings.reviewModerationMinRating;
  const lowRatingMatched = typeof minRating === "number" && rating <= minRating;

  if (mode === "publish") {
    return { status: "PUBLISHED" as const, moderationReason: null, moderationMatchedWords: [] };
  }

  if (mode === "all") {
    return { status: "PENDING" as const, moderationReason: "Все новые отзывы отправляются на модерацию", moderationMatchedWords: [] };
  }

  if (matchedWords.length > 0) {
    return {
      status: "PENDING" as const,
      moderationReason: `Найдено слово: "${matchedWords[0]}"`,
      moderationMatchedWords: matchedWords,
    };
  }

  if (lowRatingMatched) {
    return {
      status: "PENDING" as const,
      moderationReason: `Оценка ${rating} ниже порога модерации`,
      moderationMatchedWords: [],
    };
  }

  if (mode !== "words" && !settings.reviewAutoPublish) {
    return { status: "PENDING" as const, moderationReason: "Автопубликация отзывов выключена", moderationMatchedWords: [] };
  }

  return { status: "PUBLISHED" as const, moderationReason: null, moderationMatchedWords: [] };
}

async function loadReviewPhotoMap(reviewIds: number[]) {
  const ids = reviewIds.map((id) => String(id));
  if (ids.length === 0) return new Map<string, string[]>();

  const links = await prisma.mediaLink.findMany({
    where: { entityType: "review.photo", entityId: { in: ids } },
    include: { asset: { select: { url: true } } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const map = new Map<string, string[]>();
  links.forEach((link) => {
    const current = map.get(link.entityId) ?? [];
    current.push(link.asset.url);
    map.set(link.entityId, current);
  });
  return map;
}

export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинете.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const reviews = await prisma.review.findMany({
    where: { accountId: resolved.accountId, clientId: resolved.clientId },
    orderBy: { createdAt: "desc" },
    select: { id: true, appointmentId: true, rating: true, comment: true, createdAt: true },
  });
  const reviewPhotoMap = await loadReviewPhotoMap(reviews.map((review) => review.id));

  const reviewAppointmentIds = reviews
    .map((review) => review.appointmentId)
    .filter((id): id is number => typeof id === "number");

  const appointments = await prisma.appointment.findMany({
    where: {
      accountId: resolved.accountId,
      clientId: resolved.clientId,
      status: "DONE",
      id: { notIn: reviewAppointmentIds },
    },
    orderBy: { startAt: "desc" },
    take: 20,
    select: {
      id: true,
      startAt: true,
      locationId: true,
      specialistId: true,
      location: { select: { name: true } },
      specialist: { select: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } } },
      services: { select: { serviceId: true, service: { select: { name: true } } }, orderBy: { orderIndex: "asc" } },
    },
  });

  return jsonOk({
    reviews: reviews.map((review) => ({
      ...review,
      photoUrls: reviewPhotoMap.get(String(review.id)) ?? [],
    })),
    appointments: appointments.map((appointment) => ({
      id: appointment.id,
      startAt: appointment.startAt.toISOString(),
      locationId: appointment.locationId,
      locationName: appointment.location.name,
      specialistId: appointment.specialistId,
      specialistName:
        [appointment.specialist.user.profile?.firstName, appointment.specialist.user.profile?.lastName]
          .filter(Boolean)
          .join(" ") || "Специалист",
      services: appointment.services.map((item) => ({ id: item.serviceId, name: item.service.name })),
      servicesLabel: appointment.services.map((item) => item.service.name).join(", ") || "Услуга",
    })),
  });
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Требуется вход в кабинете.", null, 401);
  }

  const resolved = resolveAccountClient(request, session);
  if ("error" in resolved) return resolved.error;

  const body = (await request.json().catch(() => null)) as {
    appointmentId?: number;
    entityType?: string;
    entityId?: string;
    photoAssetIds?: number[];
    rating?: number;
    comment?: string;
  } | null;

  if (!body) {
    return jsonError("INVALID_BODY", "Некорректные данные.", null, 400);
  }

  const rating = Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return jsonError("INVALID_RATING", "Оценка должна быть от 1 до 5.", null, 400);
  }

  const comment = String(body.comment ?? "").trim();
  if (comment.length > 1000) {
    return jsonError("COMMENT_TOO_LONG", "Комментарий слишком длинный.", null, 400);
  }

  const appointmentId = Number(body.appointmentId);
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    return jsonError("APPOINTMENT_REQUIRED", "Выберите завершенную запись для отзыва.", null, 400);
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      accountId: resolved.accountId,
      clientId: resolved.clientId,
    },
    select: {
      id: true,
      status: true,
      locationId: true,
      specialistId: true,
      services: { select: { serviceId: true }, orderBy: { orderIndex: "asc" } },
    },
  });

  if (!appointment) {
    return jsonError("APPOINTMENT_NOT_FOUND", "Запись не найдена.", null, 404);
  }
  if (appointment.status !== "DONE") {
    return jsonError("APPOINTMENT_NOT_DONE", "Отзыв можно оставить только по завершенной записи.", null, 409);
  }

  const existing = await prisma.review.findFirst({
    where: { accountId: resolved.accountId, clientId: resolved.clientId, appointmentId: appointment.id },
    select: { id: true },
  });
  if (existing) {
    return jsonError("REVIEW_EXISTS", "Отзыв по этой записи уже оставлен.", null, 409);
  }

  const moderation = resolveReviewModerationStatus({
    comment,
    rating,
    settings: await readReviewAutoPublish(resolved.accountId),
  });
  const requestedEntityType = String(body.entityType ?? "account");
  const requestedEntityId = String(body.entityId ?? "").trim();
  const serviceIds = new Set(appointment.services.map((item) => String(item.serviceId)));
  const target =
    requestedEntityType === "location" && requestedEntityId === String(appointment.locationId)
      ? { entityType: "location", entityId: String(appointment.locationId) }
      : requestedEntityType === "specialist" && requestedEntityId === String(appointment.specialistId)
        ? { entityType: "specialist", entityId: String(appointment.specialistId) }
        : requestedEntityType === "service" && serviceIds.has(requestedEntityId)
          ? { entityType: "service", entityId: requestedEntityId }
          : requestedEntityType === "account"
            ? { entityType: "account", entityId: String(resolved.accountId) }
            : null;

  if (!target) {
    return jsonError("INVALID_REVIEW_TARGET", "Выберите, к чему относится отзыв.", null, 400);
  }

  const photoAssetIds = Array.isArray(body.photoAssetIds)
    ? Array.from(new Set(body.photoAssetIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 5)
    : [];

  const photoAssets =
    photoAssetIds.length > 0
      ? await prisma.mediaAsset.findMany({
          where: {
            id: { in: photoAssetIds },
            accountId: resolved.accountId,
            type: "image",
            url: { startsWith: `/uploads/accounts/${resolved.accountId}/review/` },
          },
          select: { id: true, url: true },
        })
      : [];

  if (photoAssets.length !== photoAssetIds.length) {
    return jsonError("INVALID_REVIEW_PHOTOS", "Не удалось прикрепить выбранные фотографии.", null, 400);
  }

  const review = await prisma.$transaction(async (tx) => {
    const createdReview = await tx.review.create({
      data: {
        accountId: resolved.accountId,
        clientId: resolved.clientId,
        appointmentId: appointment.id,
        entityType: target.entityType,
        entityId: target.entityId,
        rating,
        comment: comment || null,
        status: moderation.status,
        moderationReason: moderation.moderationReason,
        moderationMatchedWords: moderation.moderationMatchedWords.length > 0 ? moderation.moderationMatchedWords : undefined,
        moderatedAt: moderation.status === "PENDING" && moderation.moderationReason ? new Date() : undefined,
      },
      select: { id: true, appointmentId: true, rating: true, comment: true, createdAt: true },
    });

    if (photoAssetIds.length > 0) {
      await tx.mediaLink.createMany({
        data: photoAssetIds.map((assetId, index) => ({
          assetId,
          entityType: "review.photo",
          entityId: String(createdReview.id),
          sortOrder: index,
          isCover: index === 0,
        })),
      });
    }

    return createdReview;
  });

  await refreshRatingAggregate(resolved.accountId, "account", String(resolved.accountId));
  await refreshAppointmentTargetAggregates(resolved.accountId, appointment.id);

  const photoUrlById = new Map(photoAssets.map((asset) => [asset.id, asset.url]));

  return jsonOk({
    review: {
      ...review,
      photoUrls: photoAssetIds.map((id) => photoUrlById.get(id)).filter((url): url is string => Boolean(url)),
    },
  });
}
