import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

export async function PATCH(request: Request) {
  const auth = await requireCrmApiPermission("crm.settings.read");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const nameRaw = (body as { name?: string }).name;
  const timeZoneRaw = (body as { timeZone?: string }).timeZone;
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  const timeZone =
    typeof timeZoneRaw === "string" && timeZoneRaw.trim()
      ? timeZoneRaw.trim()
      : null;

  if (!name) {
    return jsonError(
      "VALIDATION_FAILED",
      "Название аккаунта обязательно.",
      null,
      400
    );
  }

  const updated = await prisma.account.update({
    where: { id: auth.session.accountId },
    data: { name, timeZone: timeZone ?? undefined },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил данные аккаунта",
    targetType: "account",
    targetId: auth.session.accountId,
    diffJson: { name },
  });

  const response = jsonOk({
    id: updated.id,
    name: updated.name,
    timeZone: updated.timeZone,
  });
  return applyCrmAccessCookie(response, auth);
}
