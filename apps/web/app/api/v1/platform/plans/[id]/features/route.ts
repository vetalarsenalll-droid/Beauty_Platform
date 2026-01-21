import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function parsePlanId(raw: string) {
  const planId = Number(raw);
  if (!Number.isInteger(planId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id тарифа",
        null,
        400
      ),
    };
  }
  return { planId };
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parsePlanId(id);
  if ("error" in parsed) return parsed.error;

  const features = await prisma.platformPlanFeature.findMany({
    where: { planId: parsed.planId },
    orderBy: { key: "asc" },
  });

  const response = jsonOk(features);
  return applyAccessCookie(response, auth);
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const parsed = parsePlanId(id);
  if ("error" in parsed) return parsed.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const key = String(body.key ?? "").trim();
  const value = body.value !== undefined ? String(body.value) : null;

  if (!key) {
    return jsonError("VALIDATION_FAILED", "Укажите ключ лимита", {
      fields: [{ path: "key", issue: "required" }],
    });
  }

  const feature = await prisma.platformPlanFeature.upsert({
    where: { planId_key: { planId: parsed.planId, key } },
    update: { value },
    create: { planId: parsed.planId, key, value },
  });

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Обновить лимит тарифа",
    targetType: "platform_plan_feature",
    targetId: feature.id,
    diffJson: { planId: parsed.planId, key, value },
  });

  const response = jsonOk(feature, 201);
  return applyAccessCookie(response, auth);
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const parsed = parsePlanId(id);
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
    const deleted = await prisma.platformPlanFeature.delete({
      where: { planId_key: { planId: parsed.planId, key } },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Удалить лимит тарифа",
      targetType: "platform_plan_feature",
      targetId: deleted.id,
      diffJson: { planId: parsed.planId, key },
    });

    const response = jsonOk({ key });
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Лимит не найден", null, 404);
    }
    return jsonError("SERVER_ERROR", "Не удалось удалить лимит", null, 500);
  }
}
