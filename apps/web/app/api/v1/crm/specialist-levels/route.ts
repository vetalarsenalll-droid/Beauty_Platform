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

export async function GET() {
  const auth = await requireCrmApiPermission("crm.specialists.read");
  if ("response" in auth) return auth.response;

  const levels = await prisma.specialistLevel.findMany({
    where: {
      OR: [{ accountId: auth.session.accountId }, { accountId: null }],
    },
    orderBy: [{ rank: "asc" }, { createdAt: "desc" }],
  });

  const response = jsonOk(levels.map((level) => mapLevel(level as DbLevel)));
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.specialists.create");
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

  const name = String(body.name ?? "").trim();
  const rankInput = body.rank;

  if (!name) {
    return jsonError(
      "VALIDATION_FAILED",
      "Название уровня обязательно.",
      { fields: [{ path: "name", issue: "required" }] },
      400
    );
  }

  let rank: number | null = null;
  if (rankInput !== undefined && rankInput !== null && rankInput !== "") {
    const parsedRank = Number(rankInput);
    if (!Number.isInteger(parsedRank)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Ранг уровня должен быть числом.",
        { fields: [{ path: "rank", issue: "invalid" }] },
        400
      );
    }
    rank = parsedRank;
  }

  if (rank === null) {
    const maxRank = await prisma.specialistLevel.aggregate({
      where: { accountId: auth.session.accountId },
      _max: { rank: true },
    });
    rank = (maxRank._max.rank ?? 0) + 1;
  }

  const created = await prisma.specialistLevel.create({
    data: {
      accountId: auth.session.accountId,
      name,
      rank,
    },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Создал уровень специалиста",
    targetType: "specialist_level",
    targetId: created.id,
    diffJson: { name, rank },
  });

  const response = jsonOk(mapLevel(created as DbLevel), 201);
  return applyCrmAccessCookie(response, auth);
}