import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

function parseServiceId(raw: string) {
  const serviceId = Number(raw);
  if (!Number.isInteger(serviceId)) {
    return {
      error: jsonError(
        "VALIDATION_FAILED",
        "Некорректный id услуги",
        { fields: [{ path: "id", issue: "invalid" }] },
        400
      ),
    };
  }
  return { serviceId };
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.update");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseServiceId(id);
  if ("error" in parsed) return parsed.error;

  const service = await prisma.service.findUnique({
    where: { id: parsed.serviceId },
    include: { category: true },
  });

  if (!service || service.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Услуга не найдена", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректный формат запроса",
      null,
      400
    );
  }

  const data: {
    name?: string;
    description?: string | null;
    baseDurationMin?: number;
    basePrice?: Prisma.Decimal;
    categoryId?: number | null;
    isActive?: boolean;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.baseDurationMin !== undefined) {
    const parsed = Number(body.baseDurationMin);
    if (!Number.isInteger(parsed)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректная длительность",
        { fields: [{ path: "baseDurationMin", issue: "invalid" }] },
        400
      );
    }
    data.baseDurationMin = parsed;
  }
  if (body.basePrice !== undefined) {
    try {
      data.basePrice = new Prisma.Decimal(body.basePrice);
    } catch {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректная цена",
        { fields: [{ path: "basePrice", issue: "invalid" }] },
        400
      );
    }
  }
  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      data.categoryId = null;
    } else {
      const categoryId = Number(body.categoryId);
      if (!Number.isInteger(categoryId)) {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректная категория",
          { fields: [{ path: "categoryId", issue: "invalid" }] },
          400
        );
      }
      const category = await prisma.serviceCategory.findFirst({
        where: { id: categoryId, accountId: auth.session.accountId },
        select: { id: true },
      });
      if (!category) {
        return jsonError(
          "VALIDATION_FAILED",
          "Категория не найдена",
          { fields: [{ path: "categoryId", issue: "not_found" }] },
          400
        );
      }
      data.categoryId = categoryId;
    }
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const updated = await prisma.service.update({
    where: { id: service.id },
    data,
    include: { category: true },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновление услуги",
    targetType: "service",
    targetId: updated.id,
    diffJson: {
      ...data,
      basePrice: data.basePrice ? data.basePrice.toString() : undefined,
    },
  });

  const response = jsonOk({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    baseDurationMin: updated.baseDurationMin,
    basePrice: updated.basePrice.toString(),
    isActive: updated.isActive,
    category: updated.category
      ? { id: updated.category.id, name: updated.category.name }
      : null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.read");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseServiceId(id);
  if ("error" in parsed) return parsed.error;

  const service = await prisma.service.findUnique({
    where: { id: parsed.serviceId },
    include: { category: true },
  });

  if (!service || service.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Услуга не найдена", null, 404);
  }

  const response = jsonOk({
    id: service.id,
    name: service.name,
    description: service.description,
    baseDurationMin: service.baseDurationMin,
    basePrice: service.basePrice.toString(),
    isActive: service.isActive,
    category: service.category
      ? { id: service.category.id, name: service.category.name }
      : null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  });
  return applyCrmAccessCookie(response, auth);
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireCrmApiPermission("crm.services.delete");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = parseServiceId(id);
  if ("error" in parsed) return parsed.error;

  const service = await prisma.service.findUnique({
    where: { id: parsed.serviceId },
  });

  if (!service || service.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Услуга не найдена", null, 404);
  }

  const archived = await prisma.service.update({
    where: { id: service.id },
    data: { isActive: false },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Удаление услуги",
    targetType: "service",
    targetId: archived.id,
    diffJson: { isActive: false },
  });

  const response = jsonOk({ id: archived.id, isActive: archived.isActive });
  return applyCrmAccessCookie(response, auth);
}
