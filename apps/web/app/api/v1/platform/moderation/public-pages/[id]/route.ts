import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePlatformApiPermission } from "@/lib/platform-api";
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
    return jsonError("VALIDATION_FAILED", "Invalid public page id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid JSON body", null, 400);
  }

  const status = String(body.status ?? "").trim();
  if (!status) {
    return jsonError("VALIDATION_FAILED", "Status is required", {
      fields: [{ path: "status", issue: "required" }],
    });
  }

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

    return jsonOk({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Public page not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to update status", null, 500);
  }
}
