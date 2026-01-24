import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DbLevel = {
  id: number;
  name: string;
  rank: number;
  createdAt: Date;
};

function mapLevel(level: DbLevel) {
  return {
    id: level.id,
    name: level.name,
    rank: level.rank,
    createdAt: level.createdAt.toISOString(),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.update");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const levelId = Number(id);
  if (!Number.isInteger(levelId)) {
    return jsonError("INVALID_ID", "Неверный идентификатор уровня", null, 400);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректный формат запроса", null, 400);
  }

  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const rankInput = body.rank;

  const data: { name?: string; rank?: number } = {};
  if (name !== undefined) {
    if (!name) {
      return jsonError(
        "VALIDATION_FAILED",
        "Название уровня обязательно",
        { fields: [{ path: "name", issue: "required" }] },
        400
      );
    }
    data.name = name;
  }

  if (rankInput !== undefined) {
    if (rankInput === null || rankInput === "") {
      return jsonError(
        "VALIDATION_FAILED",
        "Ранг должен быть целым числом",
        { fields: [{ path: "rank", issue: "invalid" }] },
        400
      );
    }
    const parsedRank = Number(rankInput);
    if (!Number.isInteger(parsedRank)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Ранг должен быть целым числом",
        { fields: [{ path: "rank", issue: "invalid" }] },
        400
      );
    }
    data.rank = parsedRank;
  }

  if (Object.keys(data).length === 0) {
    return jsonError("VALIDATION_FAILED", "Нет данных для обновления", null, 400);
  }

  const existing = await prisma.specialistLevel.findFirst({
    where: {
      id: levelId,
      OR: [{ accountId: auth.session.accountId }, { accountId: null }],
    },
  });

  if (!existing) {
    return jsonError("NOT_FOUND", "Уровень не найден", null, 404);
  }

  if (existing.accountId === null) {
    return jsonError(
      "FORBIDDEN",
      "Базовый уровень нельзя редактировать",
      null,
      403
    );
  }

  const updated = await prisma.specialistLevel.update({
    where: { id: levelId },
    data,
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновление уровня специалиста",
    targetType: "specialist_level",
    targetId: updated.id,
    diffJson: data,
  });

  const response = jsonOk(mapLevel(updated as DbLevel));
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmApiPermission("crm.specialists.delete");
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const levelId = Number(id);
  if (!Number.isInteger(levelId)) {
    return jsonError("INVALID_ID", "Неверный идентификатор уровня", null, 400);
  }

  const existing = await prisma.specialistLevel.findFirst({
    where: {
      id: levelId,
      OR: [{ accountId: auth.session.accountId }, { accountId: null }],
    },
  });

  if (!existing) {
    return jsonError("NOT_FOUND", "Уровень не найден", null, 404);
  }

  if (existing.accountId === null) {
    return jsonError(
      "FORBIDDEN",
      "Базовый уровень нельзя удалять",
      null,
      403
    );
  }

  const used = await prisma.specialistProfile.count({
    where: { accountId: auth.session.accountId, levelId },
  });

  if (used > 0) {
    return jsonError(
      "LEVEL_IN_USE",
      "Уровень используется у специалистов",
      null,
      409
    );
  }

  await prisma.specialistLevel.delete({ where: { id: levelId } });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удаление уровня специалиста",
    targetType: "specialist_level",
    targetId: levelId,
    diffJson: { id: levelId },
  });

  const response = jsonOk({ ok: true });
  return applyCrmAccessCookie(response, auth);
}
