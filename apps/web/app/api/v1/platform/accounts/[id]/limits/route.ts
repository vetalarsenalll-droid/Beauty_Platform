import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function parseAccountId(raw: string) {
  const accountId = Number(raw);
  if (!Number.isInteger(accountId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id аккаунта",
        null,
        400
      ),
    };
  }
  return { accountId };
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseAccountId(id);
  if ("error" in parsed) return parsed.error;

  const limits = await prisma.platformLimit.findMany({
    where: { accountId: parsed.accountId },
    orderBy: { key: "asc" },
  });

  const response = jsonOk(limits);
  return applyAccessCookie(response, auth);
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const parsed = parseAccountId(id);
  if ("error" in parsed) return parsed.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const key = String(body.key ?? "").trim();
  const valueInt =
    body.valueInt !== undefined && body.valueInt !== null && body.valueInt !== ""
      ? Number(body.valueInt)
      : null;

  if (!key) {
    return jsonError("VALIDATION_FAILED", "Укажите ключ лимита", {
      fields: [{ path: "key", issue: "required" }],
    });
  }

  if (valueInt === null || Number.isNaN(valueInt)) {
    return jsonError("VALIDATION_FAILED", "Укажите числовое значение", {
      fields: [{ path: "valueInt", issue: "invalid" }],
    });
  }

  const limit = await prisma.platformLimit.upsert({
    where: { accountId_key: { accountId: parsed.accountId, key } },
    update: { valueInt, valueJson: null },
    create: { accountId: parsed.accountId, key, valueInt },
  });

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Обновить лимит аккаунта",
    targetType: "platform_limit",
    targetId: limit.id,
    diffJson: { accountId: parsed.accountId, key, valueInt },
  });

  const response = jsonOk(limit, 201);
  return applyAccessCookie(response, auth);
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const parsed = parseAccountId(id);
  if ("error" in parsed) return parsed.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const key = String(body.key ?? "").trim();
  if (!key) {
    return jsonError("VALIDATION_FAILED", "Укажите ключ лимита", {
      fields: [{ path: "key", issue: "required" }],
    });
  }

  try {
    const deleted = await prisma.platformLimit.delete({
      where: { accountId_key: { accountId: parsed.accountId, key } },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Удалить лимит аккаунта",
      targetType: "platform_limit",
      targetId: deleted.id,
      diffJson: { accountId: parsed.accountId, key },
    });

    const response = jsonOk({ key, id: deleted.id });
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Лимит не найден", null, 404);
    }
    return jsonError("SERVER_ERROR", "Не удалось удалить лимит", null, 500);
  }
}
