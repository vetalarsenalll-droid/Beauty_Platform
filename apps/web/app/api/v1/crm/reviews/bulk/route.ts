import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { refreshAppointmentReviewAggregates, refreshReviewRatingAggregate } from "@/lib/crm-review-aggregates";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@prisma/client";

function parseStatus(value: unknown): ReviewStatus | null {
  return value === "PUBLISHED" || value === "PENDING" || value === "HIDDEN" ? value : null;
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.clients.update");
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { ids?: unknown; status?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? Array.from(new Set(body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))).slice(0, 200)
    : [];
  const status = parseStatus(body?.status);

  if (ids.length === 0 || !status) {
    return jsonError("VALIDATION_FAILED", "Выберите отзывы и статус.", null, 400);
  }

  const reviews = await prisma.review.findMany({
    where: { id: { in: ids }, accountId: auth.session.accountId },
    select: { id: true, status: true, accountId: true, entityType: true, entityId: true, appointmentId: true },
  });
  if (reviews.length === 0) {
    return jsonError("NOT_FOUND", "Отзывы не найдены.", null, 404);
  }

  const moderatedAt = new Date();
  await prisma.review.updateMany({
    where: { id: { in: reviews.map((review) => review.id) }, accountId: auth.session.accountId },
    data: {
      status,
      moderatedAt,
      moderatedByUserId: auth.session.userId,
    },
  });

  const aggregateKeys = new Map<string, { accountId: number; entityType: string; entityId: string }>();
  const appointmentIds = new Set<number>();
  reviews.forEach((review) => {
    aggregateKeys.set(`${review.entityType}:${review.entityId ?? review.accountId}`, {
      accountId: review.accountId,
      entityType: review.entityType,
      entityId: review.entityId ?? String(review.accountId),
    });
    if (review.appointmentId) appointmentIds.add(review.appointmentId);
  });

  await Promise.all([
    ...Array.from(aggregateKeys.values()).map((item) =>
      refreshReviewRatingAggregate(item.accountId, item.entityType, item.entityId)
    ),
    ...Array.from(appointmentIds).map((appointmentId) =>
      refreshAppointmentReviewAggregates(auth.session.accountId, appointmentId)
    ),
  ]);

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Массово изменил статус отзывов",
    targetType: "review",
    targetId: null,
    diffJson: { ids: reviews.map((review) => review.id), status },
  });

  const response = jsonOk({
    ids: reviews.map((review) => review.id),
    status,
    moderatedAt: moderatedAt.toISOString(),
    moderatedByUserId: auth.session.userId,
  });
  return applyCrmAccessCookie(response, auth);
}
