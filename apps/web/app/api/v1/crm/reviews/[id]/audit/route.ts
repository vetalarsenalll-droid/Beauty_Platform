import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string) {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.clients.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const reviewId = parseId(id);
  if (!reviewId) {
    return jsonError("VALIDATION_FAILED", "Некорректный id отзыва.", null, 400);
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, accountId: auth.session.accountId },
    select: { id: true },
  });
  if (!review) {
    return jsonError("NOT_FOUND", "Отзыв не найден.", null, 404);
  }

  const logs = await prisma.accountAuditLog.findMany({
    where: { accountId: auth.session.accountId, targetType: "review", targetId: String(review.id) },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
  });

  const response = jsonOk({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
      actorName:
        [log.user.profile?.firstName, log.user.profile?.lastName].filter(Boolean).join(" ") ||
        log.user.email ||
        `Пользователь #${log.userId}`,
    })),
  });
  return applyCrmAccessCookie(response, auth);
}
