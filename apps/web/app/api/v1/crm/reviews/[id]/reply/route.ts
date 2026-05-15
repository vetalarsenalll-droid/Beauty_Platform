import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function userName(item: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null } | null) {
  if (!item) return null;
  return [item.profile?.firstName, item.profile?.lastName].filter(Boolean).join(" ") || item.email || null;
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.clients.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const reviewId = parseId(id);
  const body = (await request.json().catch(() => null)) as { replyText?: unknown } | null;
  const replyText = String(body?.replyText ?? "").trim();

  if (!reviewId || replyText.length > 1000) {
    return jsonError("VALIDATION_FAILED", "Ответ должен быть не длиннее 1000 символов.", null, 400);
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, accountId: auth.session.accountId },
    select: { id: true, replyText: true },
  });
  if (!review) {
    return jsonError("NOT_FOUND", "Отзыв не найден.", null, 404);
  }

  const updated = await prisma.review.update({
    where: { id: review.id },
    data: {
      replyText: replyText || null,
      repliedAt: replyText ? new Date() : null,
      repliedByUserId: replyText ? auth.session.userId : null,
    },
    select: {
      id: true,
      replyText: true,
      repliedAt: true,
      repliedByUserId: true,
      repliedByUser: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
    },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: review.replyText ? (replyText ? "Изменил ответ на отзыв" : "Удалил ответ на отзыв") : "Ответил на отзыв",
    targetType: "review",
    targetId: review.id,
    diffJson: { hadReply: Boolean(review.replyText), hasReply: Boolean(replyText) },
  });

  const response = jsonOk({
    id: updated.id,
    replyText: updated.replyText,
    repliedAt: updated.repliedAt?.toISOString() ?? null,
    repliedByUserId: updated.repliedByUserId,
    repliedByUserName: userName(updated.repliedByUser),
  });
  return applyCrmAccessCookie(response, auth);
}
