import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";
import { NextRequest } from "next/server";

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const paramsValue = await params;
  const locationId = Number(paramsValue.id);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return jsonError("INVALID_LOCATION", "Некорректная локация.", null, 400);
  }

  const specialistIdParam = new URL(request.url).searchParams.get("specialistId");
  const specialistId = specialistIdParam ? Number(specialistIdParam) : null;

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialist =
    specialistId && Number.isInteger(specialistId) && specialistId > 0
      ? await prisma.specialistProfile.findFirst({
          where: {
            id: specialistId,
            accountId: resolved.account.id,
            locations: { some: { locationId } },
          },
          select: { id: true, levelId: true },
        })
      : null;

  const services = await prisma.service.findMany({
    where: {
      accountId: resolved.account.id,
      isActive: true,
      locations: { some: { locationId } },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      baseDurationMin: true,
      basePrice: true,
      specialists: {
        select: {
          specialistId: true,
          priceOverride: true,
          durationOverrideMin: true,
        },
      },
      levelConfigs: {
        select: {
          levelId: true,
          price: true,
          durationMin: true,
        },
      },
    },
  });

  const serviceIds = services.map((item) => String(item.id));
  const servicePhotos = serviceIds.length
    ? await prisma.mediaLink.findMany({
        where: { entityType: "service.photo", entityId: { in: serviceIds } },
        include: { asset: true },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      })
    : [];

  const serviceCoverMap = new Map<string, string>();
  servicePhotos.forEach((item) => {
    if (!serviceCoverMap.has(item.entityId)) {
      serviceCoverMap.set(item.entityId, item.asset.url);
    }
  });

  const output = services.map((service) => {
    const specialistIds = service.specialists.map((item) => item.specialistId);
    const basePrice = toNumber(service.basePrice);
    const baseDuration = service.baseDurationMin;

    let computedPrice = basePrice;
    let computedDurationMin = baseDuration;

    if (specialist) {
      const override = service.specialists.find((i) => i.specialistId === specialist.id);
      const levelConfig = specialist.levelId
        ? service.levelConfigs.find((i) => i.levelId === specialist.levelId)
        : null;

      computedPrice =
        toNumber(override?.priceOverride) || toNumber(levelConfig?.price) || basePrice;

      computedDurationMin =
        override?.durationOverrideMin || levelConfig?.durationMin || baseDuration;
    }

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      baseDurationMin: baseDuration,
      basePrice,
      computedDurationMin,
      computedPrice,
      specialistIds,
      coverUrl: serviceCoverMap.get(String(service.id)) ?? null,
    };
  });

  return jsonOk({ services: output });
}
