import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { refreshAppointmentReviewAggregates, refreshReviewRatingAggregate } from "@/lib/crm-review-aggregates";
import { prisma } from "@/lib/prisma";
import { ReviewStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseStatus(value: unknown): ReviewStatus | null {
  return value === "PUBLISHED" || value === "PENDING" || value === "HIDDEN" ? value : null;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.clients.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const reviewId = parseId(id);
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = parseStatus(body?.status);

  if (!reviewId || !status) {
    return jsonError("VALIDATION_FAILED", "Некорректный статус отзыва.", null, 400);
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, accountId: auth.session.accountId },
    select: { id: true, accountId: true, entityType: true, entityId: true, appointmentId: true, status: true },
  });
  if (!review) {
    return jsonError("NOT_FOUND", "Отзыв не найден.", null, 404);
  }

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      status,
      moderatedAt: new Date(),
      moderatedByUserId: auth.session.userId,
    },
    select: {
      id: true,
      status: true,
      moderatedAt: true,
      moderatedByUserId: true,
      accountId: true,
      entityType: true,
      entityId: true,
      appointmentId: true,
    },
  });

  await refreshReviewRatingAggregate(updated.accountId, updated.entityType, updated.entityId ?? String(updated.accountId));
  await refreshAppointmentReviewAggregates(updated.accountId, updated.appointmentId);

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Изменил статус отзыва",
    targetType: "review",
    targetId: review.id,
    diffJson: { from: review.status, to: status },
  });

  const response = jsonOk({
    id: updated.id,
    status: updated.status,
    moderatedAt: updated.moderatedAt?.toISOString() ?? null,
    moderatedByUserId: updated.moderatedByUserId,
  });
  return applyCrmAccessCookie(response, auth);
}
