import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const locationId = Number(params.id);
  if (!Number.isInteger(locationId)) {
    return jsonError("INVALID_LOCATION", "Некорректная локация.", null, 400);
  }

  const specialistIdParam = new URL(request.url).searchParams.get(
    "specialistId"
  );
  const specialistId = specialistIdParam ? Number(specialistIdParam) : null;

  const location = await prisma.location.findFirst({
    where: {
      id: locationId,
      accountId: resolved.account.id,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialist =
    specialistId && Number.isInteger(specialistId)
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

  const output = services.map((service) => {
    const specialistIds = service.specialists.map(
      (item) => item.specialistId
    );
    const basePrice = toNumber(service.basePrice);
    const baseDuration = service.baseDurationMin;

    let computedPrice = basePrice;
    let computedDurationMin = baseDuration;

    if (specialist) {
      const override = service.specialists.find(
        (item) => item.specialistId === specialist.id
      );
      const levelConfig = specialist.levelId
        ? service.levelConfigs.find(
            (item) => item.levelId === specialist.levelId
          )
        : null;
      computedPrice =
        toNumber(override?.priceOverride) ||
        toNumber(levelConfig?.price) ||
        basePrice;
      computedDurationMin =
        override?.durationOverrideMin ||
        levelConfig?.durationMin ||
        baseDuration;
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
    };
  });

  return jsonOk({ services: output });
}
