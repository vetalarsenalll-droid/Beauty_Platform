import { Prisma, TemplateType } from "@prisma/client";
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

function isTemplateType(value: string): value is TemplateType {
  return Object.values(TemplateType).includes(value as TemplateType);
}

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;

  const templates = await prisma.templateLibrary.findMany({
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(templates.map((template) => mapTemplate(template as DbTemplate)));
  return applyAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requirePlatformApiPermission("platform.settings");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const typeRaw = String(body.type ?? "").trim();
  const name = String(body.name ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const contentJson =
    body.contentJson === undefined
      ? Prisma.JsonNull
      : body.contentJson === null
        ? Prisma.JsonNull
        : (body.contentJson as Prisma.InputJsonValue);
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!typeRaw || !name) {
    return jsonError("VALIDATION_FAILED", "Type and name are required", {
      fields: [
        { path: "type", issue: typeRaw ? null : "required" },
        { path: "name", issue: name ? null : "required" },
      ],
    });
  }
  if (!isTemplateType(typeRaw)) {
    return jsonError("VALIDATION_FAILED", "Invalid template type", {
      fields: [{ path: "type", issue: "invalid" }],
    });
  }
  const type = typeRaw as TemplateType;

  const created = await prisma.templateLibrary.create({
    data: {
      type,
      name,
      description: description || undefined,
      contentJson,
      isActive,
    },
  });

  await logPlatformAudit({
    adminId: session.adminId,
    action: "Создан шаблон",
    targetType: "template",
    targetId: created.id,
    diffJson: { type, name, description, isActive },
  });

  const response = jsonOk(mapTemplate(created as DbTemplate), 201);
  return applyAccessCookie(response, auth);
}
