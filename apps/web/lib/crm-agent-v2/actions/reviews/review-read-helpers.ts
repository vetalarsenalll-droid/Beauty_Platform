import { prisma } from "@/lib/prisma";
import { numberOrNull, optionalDate, optionalString, type JsonRecord } from "../action-helpers";

export const reviewSelect = {
  id: true,
  clientId: true,
  appointmentId: true,
  entityType: true,
  entityId: true,
  rating: true,
  comment: true,
  status: true,
  replyText: true,
  repliedAt: true,
  moderationReason: true,
  moderatedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, firstName: true, lastName: true, phone: true } },
  appointment: { select: { id: true, startAt: true, specialistId: true, locationId: true } },
} as const;

export function reviewWhere(payload: JsonRecord, accountId: number) {
  const reviewId = numberOrNull(payload.reviewId ?? payload.id);
  const clientId = numberOrNull(payload.clientId);
  const appointmentId = numberOrNull(payload.appointmentId);
  const minRating = numberOrNull(payload.minRating);
  const maxRating = numberOrNull(payload.maxRating);
  const status = optionalString(payload, "status");
  const dateFrom = optionalDate(payload, "dateFrom");
  const dateTo = optionalDate(payload, "dateTo");
  return {
    accountId,
    ...(reviewId ? { id: reviewId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(appointmentId ? { appointmentId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(minRating || maxRating ? { rating: { ...(minRating ? { gte: minRating } : {}), ...(maxRating ? { lte: maxRating } : {}) } } : {}),
    ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
}

export function serializeReview(review: {
  id: number;
  clientId: number;
  appointmentId: number | null;
  entityType: string;
  entityId: string | null;
  rating: number;
  comment: string | null;
  status: unknown;
  replyText: string | null;
  repliedAt: Date | null;
  moderationReason: string | null;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: number; firstName: string | null; lastName: string | null; phone: string | null };
  appointment: { id: number; startAt: Date; specialistId: number; locationId: number } | null;
}) {
  return {
    id: review.id,
    clientId: review.clientId,
    appointmentId: review.appointmentId,
    entityType: review.entityType,
    entityId: review.entityId,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    replyText: review.replyText,
    repliedAt: review.repliedAt?.toISOString() ?? null,
    moderationReason: review.moderationReason,
    moderatedAt: review.moderatedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    client: {
      ...review.client,
      displayName: [review.client.firstName, review.client.lastName].filter(Boolean).join(" ").trim() || null,
    },
    appointment: review.appointment
      ? {
          ...review.appointment,
          startAt: review.appointment.startAt.toISOString(),
        }
      : null,
  };
}

export function reviewQuery(payload: JsonRecord) {
  return optionalString(payload, "query");
}

export function reviewMatchesQuery(review: ReturnType<typeof serializeReview>, query: string | null) {
  if (!query) return true;
  const normalized = query.toLocaleLowerCase("ru-RU");
  return [String(review.id), review.comment, review.replyText, review.client.displayName, review.client.phone]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized));
}

export function reviewTake(value: unknown, fallback = 20, max = 100) {
  const take = numberOrNull(value) ?? fallback;
  return Math.min(Math.max(Math.trunc(take), 1), max);
}

export async function getReviewById(accountId: number, reviewId: number) {
  return prisma.review.findFirst({ where: { accountId, id: reviewId }, select: reviewSelect });
}
