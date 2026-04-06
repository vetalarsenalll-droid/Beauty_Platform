import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { Prisma } from "@prisma/client";

type DbService = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: Prisma.Decimal;
  allowMultiServiceBooking: boolean;
  bookingType: string;
  groupCapacityDefault: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { id: number; name: string } | null;
};

function mapService(service: DbService) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    baseDurationMin: service.baseDurationMin,
    basePrice: service.basePrice.toString(),
    allowMultiServiceBooking: service.allowMultiServiceBooking,
    bookingType: service.bookingType,
    groupCapacityDefault: service.groupCapacityDefault,
    isActive: service.isActive,
    category: service.category
      ? { id: service.category.id, name: service.category.name }
      : null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requireCrmApiPermission("crm.services.read");
  if ("response" in auth) return auth.response;

  const services = await prisma.service.findMany({
    where: { accountId: auth.session.accountId },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(services.map((item) => mapService(item as DbService)));
  return applyCrmAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission("crm.services.create");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const name = String(body.name ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const baseDurationMin = Number(body.baseDurationMin);
  const categoryId =
    body.categoryId !== undefined &&
    body.categoryId !== null &&
    body.categoryId !== ""
      ? Number(body.categoryId)
      : null;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;
  const allowMultiServiceBooking =
    body.allowMultiServiceBooking !== undefined
      ? Boolean(body.allowMultiServiceBooking)
      : false;
  const bookingType = String(body.bookingType ?? "SINGLE").toUpperCase();
  const groupCapacityDefaultRaw =
    body.groupCapacityDefault !== undefined && body.groupCapacityDefault !== null && body.groupCapacityDefault !== ""
      ? Number(body.groupCapacityDefault)
      : null;

  if (bookingType !== "SINGLE" && bookingType !== "GROUP") {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный тип записи.",
      { fields: [{ path: "bookingType", issue: "invalid" }] },
      400
    );
  }

  if (groupCapacityDefaultRaw !== null && !Number.isInteger(groupCapacityDefaultRaw)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректное количество мест.",
      { fields: [{ path: "groupCapacityDefault", issue: "invalid" }] },
      400
    );
  }

  if (!name || !Number.isInteger(baseDurationMin)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Заполните название и длительность услуги.",
      {
        fields: [
          { path: "name", issue: name ? null : "required" },
          {
            path: "baseDurationMin",
            issue: Number.isInteger(baseDurationMin) ? null : "invalid",
          },
        ],
      },
      400
    );
  }

  let basePrice: Prisma.Decimal;
  try {
    basePrice = new Prisma.Decimal(body.basePrice);
  } catch {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректная цена.",
      { fields: [{ path: "basePrice", issue: "invalid" }] },
      400
    );
  }

  if (categoryId !== null) {
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
  }

  const created = await prisma.service.create({
    data: {
      accountId: auth.session.accountId,
      categoryId,
      name,
      description,
      baseDurationMin,
      basePrice,
      isActive,
      allowMultiServiceBooking,
      bookingType,
      groupCapacityDefault: groupCapacityDefaultRaw,
    },
    include: { category: true },
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Создал услугу",
    targetType: "service",
    targetId: created.id,
    diffJson: {
      name,
      description,
      baseDurationMin,
      basePrice: basePrice.toString(),
      categoryId,
      isActive,
      allowMultiServiceBooking,
      bookingType,
      groupCapacityDefault: groupCapacityDefaultRaw,
    },
  });

  const response = jsonOk(mapService(created as DbService), 201);
  return applyCrmAccessCookie(response, auth);
}
