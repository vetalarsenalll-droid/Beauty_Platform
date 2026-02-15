import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";
import { NextRequest } from "next/server";

const buildSpecialistName = (profile: {
  user: {
    email: string | null;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
}) => {
  const first = profile.user.profile?.firstName?.trim() ?? "";
  const last = profile.user.profile?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return profile.user.email ?? "Специалист";
};

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

  const { searchParams } = new URL(request.url);
  const serviceIdParam = searchParams.get("serviceId");
  const serviceId = serviceIdParam ? Number(serviceIdParam) : null;

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: resolved.account.id, status: "ACTIVE" },
    select: { id: true },
  });

  if (!location) {
    return jsonError("LOCATION_NOT_FOUND", "Локация не найдена.", null, 404);
  }

  const specialists = await prisma.specialistProfile.findMany({
    where: {
      accountId: resolved.account.id,
      locations: { some: { locationId } },
      ...(serviceId && Number.isInteger(serviceId) && serviceId > 0
        ? { services: { some: { serviceId } } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      levelId: true,
      level: { select: { name: true } },
      categories: {
        include: { category: { select: { id: true, name: true, slug: true } } },
      },
      user: {
        select: {
          email: true,
          profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
  });

  const selectedService =
    serviceId && Number.isInteger(serviceId) && serviceId > 0
      ? await prisma.service.findFirst({
          where: {
            id: serviceId,
            accountId: resolved.account.id,
            isActive: true,
            locations: { some: { locationId } },
          },
          select: {
            id: true,
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
        })
      : null;

  const selectedServiceOverridesBySpecialistId = new Map(
    (selectedService?.specialists ?? []).map((item) => [item.specialistId, item])
  );
  const selectedServiceLevelConfigByLevelId = new Map(
    (selectedService?.levelConfigs ?? []).map((item) => [item.levelId, item])
  );

  const specialistIds = specialists.map((item) => String(item.id));
  const specialistPhotos = specialistIds.length
    ? await prisma.mediaLink.findMany({
        where: { entityType: "specialist.photo", entityId: { in: specialistIds } },
        include: { asset: true },
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      })
    : [];

  const specialistCoverMap = new Map<string, string>();
  specialistPhotos.forEach((item) => {
    if (!specialistCoverMap.has(item.entityId)) {
      specialistCoverMap.set(item.entityId, item.asset.url);
    }
  });

  const output = specialists.map((item) => {
    const override = selectedServiceOverridesBySpecialistId.get(item.id);
    const levelConfig = item.levelId
      ? selectedServiceLevelConfigByLevelId.get(item.levelId)
      : null;

    const servicePrice = selectedService
      ? toNumber(override?.priceOverride) ||
        toNumber(levelConfig?.price) ||
        toNumber(selectedService.basePrice)
      : null;
    const serviceDurationMin = selectedService
      ? override?.durationOverrideMin ||
        levelConfig?.durationMin ||
        selectedService.baseDurationMin
      : null;

    return {
      id: item.id,
      name: buildSpecialistName(item),
      role: item.level?.name ?? null,
      levelId: item.levelId,
      avatarUrl: item.user.profile?.avatarUrl ?? null,
      coverUrl: specialistCoverMap.get(String(item.id)) ?? null,
      servicePrice,
      serviceDurationMin,
      categories: item.categories.map((entry) => ({
        id: entry.category.id,
        name: entry.category.name,
        slug: entry.category.slug,
      })),
    };
  });

  return jsonOk({ specialists: output });
}
