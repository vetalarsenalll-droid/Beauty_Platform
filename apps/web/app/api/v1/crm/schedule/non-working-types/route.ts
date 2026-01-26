import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";

export async function GET() {
  const auth = await requireCrmApiPermission("crm.schedule.read");
  if ("response" in auth) return auth.response;

  const types = await prisma.scheduleNonWorkingType.findMany({
    where: { accountId: auth.session.accountId, isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    types.map((type) => ({
      id: type.id,
      name: type.name,
      color: type.color,
    }))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.schedule.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid request body.", null, 400);
  }

  const name = String(body.name ?? "").trim();
  const color = String(body.color ?? "#7a7af0").trim();
  if (!name) {
    return jsonError("VALIDATION_FAILED", "Name is required.", null, 400);
  }

  const created = await prisma.scheduleNonWorkingType.create({
    data: {
      accountId: auth.session.accountId,
      name,
      color,
    },
  });

  const response = jsonOk(
    { id: created.id, name: created.name, color: created.color },
    201
  );
  return applyCrmAccessCookie(response, auth);
}
