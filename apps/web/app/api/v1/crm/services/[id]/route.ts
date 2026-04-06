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
        "Некорректный id услуги.",
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
    return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса.", null, 400);
  }

  const data: Prisma.ServiceUpdateInput = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.baseDurationMin !== undefined) {
    const parsedDuration = Number(body.baseDurationMin);
    if (!Number.isInteger(parsedDuration)) {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректная длительность услуги.",
        { fields: [{ path: "baseDurationMin", issue: "invalid" }] },
        400
      );
    }
    data.baseDurationMin = parsedDuration;
  }
  if (body.basePrice !== undefined) {
    try {
      data.basePrice = new Prisma.Decimal(body.basePrice);
    } catch {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректная цена.",
        { fields: [{ path: "basePrice", issue: "invalid" }] },
        400
      );
    }
  }

  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      data.category = { disconnect: true };
    } else {
      const categoryId = Number(body.categoryId);
      if (!Number.isInteger(categoryId)) {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректная категория.",
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
          "Категория не найдена.",
          { fields: [{ path: "categoryId", issue: "not_found" }] },
          400
        );
      }
      data.category = { connect: { id: categoryId } };
    }
  }

  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.allowMultiServiceBooking !== undefined) {
    data.allowMultiServiceBooking = Boolean(body.allowMultiServiceBooking);
  }
  if (body.bookingType !== undefined) {
    const bookingType = String(body.bookingType ?? "").toUpperCase();
    if (bookingType !== "SINGLE" && bookingType !== "GROUP") {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный тип записи.",
        { fields: [{ path: "bookingType", issue: "invalid" }] },
        400
      );
    }
    data.bookingType = bookingType as Prisma.ServiceBookingType;
  }
  if (body.groupCapacityDefault !== undefined) {
    if (body.groupCapacityDefault === null || body.groupCapacityDefault === "") {
      data.groupCapacityDefault = null;
    } else {
      const capacity = Number(body.groupCapacityDefault);
      if (!Number.isInteger(capacity)) {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректное количество мест.",
          { fields: [{ path: "groupCapacityDefault", issue: "invalid" }] },
          400
        );
      }
      data.groupCapacityDefault = capacity;
    }
  }

  const updated = await prisma.service.update({
    where: { id: service.id },
    data,
    include: { category: true },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил услугу",
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
    allowMultiServiceBooking: updated.allowMultiServiceBooking,
    bookingType: updated.bookingType,
    groupCapacityDefault: updated.groupCapacityDefault,
    isActive: updated.isActive,
    category: updated.category ? { id: updated.category.id, name: updated.category.name } : null,
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
    return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  const response = jsonOk({
    id: service.id,
    name: service.name,
    description: service.description,
    baseDurationMin: service.baseDurationMin,
    basePrice: service.basePrice.toString(),
    allowMultiServiceBooking: service.allowMultiServiceBooking,
    bookingType: service.bookingType,
    groupCapacityDefault: service.groupCapacityDefault,
    isActive: service.isActive,
    category: service.category ? { id: service.category.id, name: service.category.name } : null,
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
    return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  const archived = await prisma.service.update({
    where: { id: service.id },
    data: { isActive: false },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Переместил услугу в архив",
    targetType: "service",
    targetId: archived.id,
    diffJson: { isActive: false },
  });

  const response = jsonOk({ id: archived.id, isActive: archived.isActive });
  return applyCrmAccessCookie(response, auth);
}
