import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyCrmAccessCookie, requireCrmApiPermission } from "@/lib/crm-api";
import { logAccountAudit } from "@/lib/crm-audit";

type DeleteEntity = "location" | "service" | "specialist" | "promo";

const PERMISSIONS: Record<DeleteEntity, string> = {
  location: "crm.locations.delete",
  service: "crm.services.delete",
  specialist: "crm.specialists.delete",
  promo: "crm.promos.update",
};

export async function POST(request: Request) {
  const auth = await requireCrmApiPermission();
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

  const entity = String((body as { entity?: string }).entity ?? "");
  const rawId = (body as { id?: number | string }).id;
  const id = Number(rawId);

  if (!["location", "service", "specialist", "promo"].includes(entity)) {
    return jsonError(
      "VALIDATION_FAILED",
      "Некорректный тип сущности.",
      null,
      400
    );
  }

  if (!Number.isInteger(id)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id.", null, 400);
  }

  const permission = PERMISSIONS[entity as DeleteEntity];
  if (
    !auth.session.permissions.includes(permission) &&
    !auth.session.permissions.includes("crm.all")
  ) {
    return jsonError(
      "FORBIDDEN",
      "Insufficient permissions",
      { permission },
      403
    );
  }

  const accountId = auth.session.accountId;

  if (entity === "location") {
    const location = await prisma.location.findFirst({
      where: { id, accountId },
    });
    if (!location) {
      return jsonError("NOT_FOUND", "Локация не найдена.", null, 404);
    }

    const appointmentCount = await prisma.appointment.count({
      where: { locationId: id },
    });
    if (appointmentCount > 0) {
      return jsonError(
        "CONFLICT",
        "Нельзя удалить локацию: есть записи.",
        null,
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      const links = await tx.mediaLink.findMany({
        where: {
          entityId: String(id),
          entityType: { in: ["location.photo", "location.work"] },
        },
      });

      if (links.length > 0) {
        await tx.mediaLink.deleteMany({
          where: { id: { in: links.map((link) => link.id) } },
        });
        for (const assetId of new Set(links.map((link) => link.assetId))) {
          const left = await tx.mediaLink.count({ where: { assetId } });
          if (left === 0) {
            await tx.mediaAsset.delete({ where: { id: assetId } });
          }
        }
      }

      await tx.locationHour.deleteMany({ where: { locationId: id } });
      await tx.locationException.deleteMany({ where: { locationId: id } });
      await tx.serviceLocation.deleteMany({ where: { locationId: id } });
      await tx.specialistLocation.deleteMany({ where: { locationId: id } });
      await tx.locationManager.deleteMany({ where: { locationId: id } });
      await tx.geoPoint.deleteMany({ where: { locationId: id } });
      await tx.workingHour.deleteMany({ where: { locationId: id } });
      await tx.break.deleteMany({ where: { locationId: id } });
      await tx.vacation.deleteMany({ where: { locationId: id } });
      await tx.blockedSlot.deleteMany({ where: { locationId: id } });

      await tx.location.delete({ where: { id } });
    });

    await logAccountAudit({
      accountId,
      userId: auth.session.userId,
      action: "Удалил локацию",
      targetType: "location",
      targetId: id,
      diffJson: {},
    });
  }

  if (entity === "service") {
    const service = await prisma.service.findFirst({
      where: { id, accountId },
    });
    if (!service) {
      return jsonError("NOT_FOUND", "Услуга не найдена.", null, 404);
    }

    const appointmentCount = await prisma.appointmentService.count({
      where: { serviceId: id },
    });
    if (appointmentCount > 0) {
      return jsonError(
        "CONFLICT",
        "Нельзя удалить услугу: есть записи.",
        null,
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.serviceVariant.deleteMany({ where: { serviceId: id } });
      await tx.serviceLevelConfig.deleteMany({ where: { serviceId: id } });
      await tx.specialistService.deleteMany({ where: { serviceId: id } });
      await tx.serviceLocation.deleteMany({ where: { serviceId: id } });
      await tx.appointmentService.deleteMany({ where: { serviceId: id } });
      await tx.service.delete({ where: { id } });
    });

    await logAccountAudit({
      accountId,
      userId: auth.session.userId,
      action: "Удалил услугу",
      targetType: "service",
      targetId: id,
      diffJson: {},
    });
  }

  if (entity === "specialist") {
    const specialist = await prisma.specialistProfile.findFirst({
      where: { id, accountId },
      include: { user: true },
    });
    if (!specialist) {
      return jsonError("NOT_FOUND", "Сотрудник не найден.", null, 404);
    }

    const appointmentCount = await prisma.appointment.count({
      where: { specialistId: id },
    });
    const holdCount = await prisma.appointmentHold.count({
      where: { specialistId: id },
    });
    if (appointmentCount > 0 || holdCount > 0) {
      return jsonError(
        "CONFLICT",
        "Нельзя удалить сотрудника: есть записи.",
        null,
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.specialistService.deleteMany({ where: { specialistId: id } });
      await tx.specialistLocation.deleteMany({ where: { specialistId: id } });
      await tx.workingHour.deleteMany({ where: { specialistId: id } });
      await tx.break.deleteMany({ where: { specialistId: id } });
      await tx.vacation.deleteMany({ where: { specialistId: id } });
      await tx.blockedSlot.deleteMany({ where: { specialistId: id } });
      await tx.appointmentHold.deleteMany({ where: { specialistId: id } });
      await tx.specialistLevelHistory.deleteMany({
        where: { specialistId: id },
      });
      await tx.roleAssignment.deleteMany({
        where: {
          userId: specialist.userId,
          accountId,
          role: { name: "SPECIALIST" },
        },
      });
      await tx.specialistProfile.delete({ where: { id } });
    });

    await logAccountAudit({
      accountId,
      userId: auth.session.userId,
      action: "Удалил сотрудника",
      targetType: "specialist",
      targetId: id,
      diffJson: {},
    });
  }

  if (entity === "promo") {
    const promo = await prisma.promotion.findFirst({
      where: { id, accountId },
    });
    if (!promo) {
      return jsonError("NOT_FOUND", "Промо не найдено.", null, 404);
    }

    const promoCodes = await prisma.promoCode.findMany({
      where: { promotionId: id },
      select: { id: true },
    });
    const promoCodeIds = promoCodes.map((item) => item.id);
    if (promoCodeIds.length > 0) {
      const redemptions = await prisma.promoRedemption.count({
        where: { promoCodeId: { in: promoCodeIds } },
      });
      if (redemptions > 0) {
        return jsonError(
          "CONFLICT",
          "Нельзя удалить промо: есть записи.",
          null,
          409
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (promoCodeIds.length > 0) {
        await tx.promoRedemption.deleteMany({
          where: { promoCodeId: { in: promoCodeIds } },
        });
        await tx.promoCode.deleteMany({
          where: { promotionId: id },
        });
      }
      await tx.promotion.delete({ where: { id } });
    });

    await logAccountAudit({
      accountId,
      userId: auth.session.userId,
      action: "Удалил промо",
      targetType: "promotion",
      targetId: id,
      diffJson: {},
    });
  }

  const response = jsonOk({ ok: true });
  return applyCrmAccessCookie(response, auth);
}
