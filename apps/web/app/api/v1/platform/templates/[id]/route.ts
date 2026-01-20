import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

type DbTemplate = {
  id: number;
  type: string;
  name: string;
  description: string | null;
  contentJson: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapTemplate(template: DbTemplate) {
  return {
    id: template.id,
    type: template.type,
    name: template.name,
    description: template.description,
    contentJson: template.contentJson,
    isActive: template.isActive,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId)) {
    return jsonError("VALIDATION_FAILED", "Invalid template id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const template = await prisma.templateLibrary.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    return jsonError("NOT_FOUND", "Template not found", null, 404);
  }

  const response = jsonOk(mapTemplate(template as DbTemplate));
  return applyAccessCookie(response, auth);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId)) {
    return jsonError("VALIDATION_FAILED", "Invalid template id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid JSON body", null, 400);
  }

  const data: {
    type?: string;
    name?: string;
    description?: string | null;
    contentJson?: unknown;
    isActive?: boolean;
  } = {};

  if (body.type !== undefined) data.type = String(body.type).trim();
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined)
    data.description = body.description ? String(body.description).trim() : null;
  if (body.contentJson !== undefined) data.contentJson = body.contentJson;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  try {
    const updated = await prisma.templateLibrary.update({
      where: { id: templateId },
      data,
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Обновлен шаблон",
      targetType: "template",
      targetId: updated.id,
      diffJson: data,
    });

    const response = jsonOk(mapTemplate(updated as DbTemplate));
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Template not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to update template", null, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isInteger(templateId)) {
    return jsonError("VALIDATION_FAILED", "Invalid template id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  try {
    const archived = await prisma.templateLibrary.update({
      where: { id: templateId },
      data: { isActive: false },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Шаблон отключен",
      targetType: "template",
      targetId: archived.id,
      diffJson: { isActive: false },
    });

    const response = jsonOk({ id: templateId, isActive: false });
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Template not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to disable template", null, 500);
  }
}
