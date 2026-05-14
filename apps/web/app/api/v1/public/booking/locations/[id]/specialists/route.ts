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
  request: NextRequest
) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const pathname = new URL(request.url).pathname;
  const pathParts = pathname.split("/").filter(Boolean);
  const locationsIndex = pathParts.indexOf("locations");
  const pathId =
    locationsIndex >= 0 && locationsIndex + 1 < pathParts.length
      ? pathParts[locationsIndex + 1]
      : "";
  const locationId = Number(pathId);
  if (!Number.isInteger(locationId) || locationId <= 0) {
    return jsonError("INVALID_LOCATION", "Некорректная локация.", null, 400);
  }

  const { searchParams } = new URL(request.url);
  const serviceIdParam = searchParams.get("serviceId");
  const serviceId = serviceIdParam ? Number(serviceIdParam) : null;
  const serviceIdsParam = searchParams.get("serviceIds");
  const serviceIds = serviceIdsParam
    ? serviceIdsParam
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    : [];
  const selectedServiceIds = Array.from(
    new Set([
      ...(Number.isInteger(serviceId) && serviceId && serviceId > 0 ? [serviceId] : []),
      ...serviceIds,
    ])
  );

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
      isPublic: true,
      user: { status: "ACTIVE" },
      locations: { some: { locationId } },
      ...(selectedServiceIds.length > 0
        ? {
            AND: selectedServiceIds.map((id) => ({
              services: { some: { serviceId: id } },
            })),
          }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      bio: true,
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

  const selectedServices =
    selectedServiceIds.length > 0
      ? await prisma.service.findMany({
          where: {
            id: { in: selectedServiceIds },
            accountId: resolved.account.id,
            isActive: true,
            locations: { some: { locationId } },
          },
          select: {
            id: true,
            baseDurationMin: true,
            basePrice: true,
            specialists: {
              where: { specialist: { isPublic: true, user: { status: "ACTIVE" } } },
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
      : [];

  if (selectedServiceIds.length > 0 && selectedServices.length !== selectedServiceIds.length) {
    return jsonOk({ specialists: [] });
  }

  const specialistIds = specialists.map((item) => String(item.id));
  const [specialistPhotos, specialistWorkPhotos] = await Promise.all([
    specialistIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "specialist.photo", entityId: { in: specialistIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    specialistIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "specialist.work", entityId: { in: specialistIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
  ]);

  const specialistCoverMap = new Map<string, string>();
  const specialistPhotoMap = new Map<string, string[]>();
  specialistPhotos.forEach((item) => {
    if (!specialistCoverMap.has(item.entityId)) {
      specialistCoverMap.set(item.entityId, item.asset.url);
    }
    const current = specialistPhotoMap.get(item.entityId) ?? [];
    current.push(item.asset.url);
    specialistPhotoMap.set(item.entityId, current);
  });
  const specialistWorkPhotoMap = new Map<string, string[]>();
  specialistWorkPhotos.forEach((item) => {
    const current = specialistWorkPhotoMap.get(item.entityId) ?? [];
    current.push(item.asset.url);
    specialistWorkPhotoMap.set(item.entityId, current);
  });

  const output = specialists.map((item) => {
    let servicePrice: number | null = null;
    let serviceDurationMin: number | null = null;

    if (selectedServices.length > 0) {
      let totalPrice = 0;
      let totalDuration = 0;

      for (const service of selectedServices) {
        const override = service.specialists.find((s) => s.specialistId === item.id);
        const levelConfig = item.levelId
          ? service.levelConfigs.find((cfg) => cfg.levelId === item.levelId)
          : null;

        const price =
          toNumber(override?.priceOverride) ||
          toNumber(levelConfig?.price) ||
          toNumber(service.basePrice);
        const duration =
          override?.durationOverrideMin ||
          levelConfig?.durationMin ||
          service.baseDurationMin;

        totalPrice += toNumber(price);
        totalDuration += Number.isFinite(duration) ? Number(duration) : 0;
      }

      servicePrice = totalPrice;
      serviceDurationMin = totalDuration;
    }

    return {
      id: item.id,
      name: buildSpecialistName(item),
      bio: item.bio,
      role: item.level?.name ?? null,
      levelId: item.levelId,
      avatarUrl: item.user.profile?.avatarUrl ?? null,
      coverUrl: specialistCoverMap.get(String(item.id)) ?? null,
      photoUrls: specialistPhotoMap.get(String(item.id)) ?? [],
      workPhotoUrls: specialistWorkPhotoMap.get(String(item.id)) ?? [],
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
