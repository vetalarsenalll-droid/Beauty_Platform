import { PublicPageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.moderation");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const pageId = Number(id);
  if (!Number.isInteger(pageId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id страницы", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const statusRaw = String(body.status ?? "").trim();
  if (!statusRaw) {
    return jsonError("VALIDATION_FAILED", "Status is required", {
      fields: [{ path: "status", issue: "required" }],
    });
  }
  if (!Object.values(PublicPageStatus).includes(statusRaw as PublicPageStatus)) {
    return jsonError("VALIDATION_FAILED", "Invalid status", {
      fields: [{ path: "status", issue: "invalid" }],
    });
  }
  const status = statusRaw as PublicPageStatus;

  try {
    const updated = await prisma.publicPage.update({
      where: { id: pageId },
      data: { status },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Модерация публичной страницы",
      targetType: "public_page",
      targetId: updated.id,
      diffJson: { status },
    });

    const response = jsonOk({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Публичная страница не найдена", null, 404);
    }
    return jsonError("SERVER_ERROR", "Не удалось обновить статус", null, 500);
  }
}
