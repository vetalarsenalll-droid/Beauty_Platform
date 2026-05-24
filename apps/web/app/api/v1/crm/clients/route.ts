import { prisma } from "@/lib/prisma";
import { normalizeRuPhone } from "@/lib/phone";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

function parseBirthDate(value: unknown) {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.clients.read");
  if ("response" in auth) return auth.response;

  const clients = await prisma.client.findMany({
    where: { accountId: auth.session.accountId },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    clients.map((client) => ({
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      email: client.email,
      birthDate: client.birthDate ? client.birthDate.toISOString().slice(0, 10) : null,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }))
  );
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.clients.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const firstName = body.firstName ? String(body.firstName).trim() : null;
  const lastName = body.lastName ? String(body.lastName).trim() : null;
  const phone = normalizeRuPhone(body.phone ? String(body.phone).trim() : null);
  const email = body.email ? String(body.email).trim() : null;
  const birthDate = parseBirthDate(body.birthDate);
  if (birthDate === undefined) {
    return jsonError("VALIDATION_FAILED", "birthDate must be a valid date.", { field: "birthDate" }, 400);
  }

  if (!firstName && !lastName && !phone && !email) {
    return jsonError(
      "VALIDATION_FAILED",
      "Укажите хотя бы одно поле: имя, фамилия, телефон или email.",
      null,
      400
    );
  }

  const created = await prisma.client.create({
    data: {
      accountId: auth.session.accountId,
      firstName,
      lastName,
      phone,
      email,
      birthDate,
    },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Создан клиент",
    targetType: "client",
    targetId: created.id,
    diffJson: {
      firstName,
      lastName,
      phone,
      email,
      birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : null,
    },
  });

  const response = jsonOk(
    {
      id: created.id,
      firstName: created.firstName,
      lastName: created.lastName,
      phone: created.phone,
      email: created.email,
      birthDate: created.birthDate ? created.birthDate.toISOString().slice(0, 10) : null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
    201
  );
  return applyCrmAccessCookie(response, auth);
}

