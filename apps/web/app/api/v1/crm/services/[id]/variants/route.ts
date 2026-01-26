import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

type VariantInput = {
  id?: number;
  name: string;
  durationMin?: number | null;
  price?: string | null;
};

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
  });

  if (!service || service.accountId !== auth.session.accountId) {
    return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError(
      "INVALID_BODY",
      "Некорректное тело запроса.",
      null,
      400
    );
  }

  const variants = Array.isArray(body.variants) ? body.variants : null;
  if (!variants) {
    return jsonError(
      "VALIDATION_FAILED",
      "Передайте список вариантов.",
      null,
      400
    );
  }

  const normalized: VariantInput[] = [];

  for (const item of variants) {
    if (!item || typeof item !== "object") {
      return jsonError(
        "VALIDATION_FAILED",
        "Некорректный вариант.",
        null,
        400
      );
    }

    const name = String(item.name ?? "").trim();
    if (!name) {
      return jsonError(
        "VALIDATION_FAILED",
        "Укажите название варианта.",
        { fields: [{ path: "name", issue: "required" }] },
        400
      );
    }

    let durationMin: number | null = null;
    if (item.durationMin !== undefined && item.durationMin !== null && item.durationMin !== "") {
      const parsedDuration = Number(item.durationMin);
      if (!Number.isInteger(parsedDuration)) {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректная длительность варианта.",
          { fields: [{ path: "durationMin", issue: "invalid" }] },
          400
        );
      }
      durationMin = parsedDuration;
    }

    let price: Prisma.Decimal | null = null;
    if (item.price !== undefined && item.price !== null && String(item.price).trim() !== "") {
      try {
        price = new Prisma.Decimal(item.price);
      } catch {
        return jsonError(
          "VALIDATION_FAILED",
          "Некорректная цена варианта.",
          { fields: [{ path: "price", issue: "invalid" }] },
          400
        );
      }
    }

    const idValue = item.id !== undefined ? Number(item.id) : undefined;
    normalized.push({
      id: Number.isInteger(idValue) ? idValue : undefined,
      name,
      durationMin,
      price: price ? price.toString() : null,
    });
  }

  const existing = await prisma.serviceVariant.findMany({
    where: { serviceId: service.id },
  });
  const existingIds = new Set(existing.map((variant) => variant.id));
  const incomingIds = new Set(
    normalized.map((variant) => variant.id).filter((idValue): idValue is number => Number.isInteger(idValue))
  );

  const missingIds = [...incomingIds].filter((idValue) => !existingIds.has(idValue));
  if (missingIds.length > 0) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некоторые варианты не найдены.",
      null,
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    const toDelete = existing.filter((variant) => !incomingIds.has(variant.id));
    if (toDelete.length > 0) {
      await tx.serviceVariant.deleteMany({
        where: { id: { in: toDelete.map((variant) => variant.id) } },
      });
    }

    for (const variant of normalized) {
      const data = {
        name: variant.name,
        durationMin: variant.durationMin,
        price: variant.price ? new Prisma.Decimal(variant.price) : null,
      };
      if (variant.id) {
        await tx.serviceVariant.update({
          where: { id: variant.id },
          data,
        });
      } else {
        await tx.serviceVariant.create({
          data: {
            serviceId: service.id,
            ...data,
          },
        });
      }
    }
  });

  await logAccountAudit({
    accountId: auth.session.accountId,
    userId: auth.session.userId,
    action: "Обновил варианты услуги",
    targetType: "service",
    targetId: service.id,
    diffJson: { variants: normalized },
  });

  const response = jsonOk({ id: service.id });
  return applyCrmAccessCookie(response, auth);
}