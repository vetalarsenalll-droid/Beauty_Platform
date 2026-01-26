import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type Params = { params: Promise<{ id: string }> };

function parsePromoId(raw: string) {
  const promoId = Number(raw);
  if (!Number.isInteger(promoId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id промо.",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { promoId };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.promos.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parsePromoId(id);
  if ("error" in parsed) return parsed.error;

  const promo = await prisma.promotion.findUnique({
    where: { id: parsed.promoId },
  });

  if (!promo || promo.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Промо не найдено.", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const isActive =
    body.isActive !== undefined ? Boolean(body.isActive) : undefined;

  if (isActive === undefined) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте isActive.",
      { fields: [{ path: "isActive", issue: "required" }] },
      400
    );
  }

  const updated = await prisma.promotion.update({
    where: { id: promo.id },
    data: { isActive },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: isActive ? "Восстановил промо" : "Архивировал промо",
    targetType: "promotion",
    targetId: updated.id,
    diffJson: { isActive },
  });

  const response = jsonOk({
    id: updated.id,
    isActive: updated.isActive,
  });
  return applyCrmAccessCookie(response, auth);
}
