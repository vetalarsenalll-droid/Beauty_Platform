import { jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAccountSlotStepMinutes, resolvePublicAccount } from "@/lib/public-booking";
import { NextRequest } from "next/server";

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const buildSpecialistName = (profile: {
  user: {
    email: string | null;
    profile: { firstName: string | null; lastName: string | null } | null;
  };
}) => {
  const first = profile.user.profile?.firstName?.trim() ?? "";
  const last = profile.user.profile?.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || profile.user.email || "Специалист";
};

export async function GET(request: NextRequest) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const { account } = resolved;
  const locationIdParam = new URL(request.url).searchParams.get("locationId");
  const locationId = locationIdParam ? Number(locationIdParam) : null;
  const hasLocation = Number.isInteger(locationId) && Number(locationId) > 0;

  const slotStepMinutes = await getAccountSlotStepMinutes(account.id);
  const publicAccount = { ...account, slotStepMinutes };

  const [locationsRaw, legalDocs, platformLegalDocs, services, specialists] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: account.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        hours: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
          orderBy: { dayOfWeek: "asc" },
        },
        exceptions: {
          select: { date: true, isClosed: true, startTime: true, endTime: true },
          orderBy: { date: "asc" },
        },
      },
    }),
    prisma.legalDocument.findMany({
      where: { accountId: account.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        isRequired: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true, publishedAt: true },
        },
      },
    }),
    prisma.platformLegalDocument.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        isRequired: true,
        versions: {
          where: { isActive: true },
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true, publishedAt: true },
        },
      },
    }),
    prisma.service.findMany({
      where: {
        accountId: account.id,
        isActive: true,
        ...(hasLocation ? { locations: { some: { locationId: Number(locationId) } } } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        allowMultiServiceBooking: true,
        bookingType: true,
        groupCapacityDefault: true,
        category: { select: { name: true, slug: true } },
        baseDurationMin: true,
        basePrice: true,
        locations: { select: { locationId: true } },
        specialists: {
          select: {
            specialistId: true,
            priceOverride: true,
            durationOverrideMin: true,
            specialist: { select: { levelId: true } },
          },
        },
        levelConfigs: { select: { levelId: true, price: true, durationMin: true } },
      },
    }),
    prisma.specialistProfile.findMany({
      where: {
        accountId: account.id,
        ...(hasLocation ? { locations: { some: { locationId: Number(locationId) } } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        levelId: true,
        level: { select: { name: true } },
        locations: { select: { locationId: true } },
        user: {
          select: {
            email: true,
            profile: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    }),
  ]);

  const locationIds = locationsRaw.map((item) => String(item.id));
  const serviceIds = services.map((item) => String(item.id));
  const specialistIds = specialists.map((item) => String(item.id));
  const [locationPhotos, servicePhotos, specialistPhotos] = await Promise.all([
    locationIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "location.photo", entityId: { in: locationIds }, isCover: true },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    serviceIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "service.photo", entityId: { in: serviceIds }, isCover: true },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    specialistIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "specialist.photo", entityId: { in: specialistIds }, isCover: true },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
  ]);

  const toCoverMap = (items: Array<{ entityId: string; asset: { url: string } }>) => {
    const map = new Map<string, string>();
    items.forEach((item) => {
      if (!map.has(item.entityId)) map.set(item.entityId, item.asset.url);
    });
    return map;
  };
  const locationCoverMap = toCoverMap(locationPhotos);
  const serviceCoverMap = toCoverMap(servicePhotos);
  const specialistCoverMap = toCoverMap(specialistPhotos);

  const locations = locationsRaw.map((location) => ({
    ...location,
    coverUrl: locationCoverMap.get(String(location.id)) ?? null,
    exceptions: location.exceptions.map((item) => ({
      date: item.date.toISOString().slice(0, 10),
      isClosed: item.isClosed,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  }));

  const outputServices = services.map((service) => {
    const basePrice = toNumber(service.basePrice);
    const specialistMetrics = service.specialists.map((binding) => {
      const levelConfig = binding.specialist.levelId
        ? service.levelConfigs.find((item) => item.levelId === binding.specialist.levelId)
        : null;
      return {
        price: toNumber(binding.priceOverride) || toNumber(levelConfig?.price) || basePrice,
        durationMin: binding.durationOverrideMin || levelConfig?.durationMin || service.baseDurationMin,
      };
    });
    const prices = specialistMetrics.map((item) => item.price).filter(Number.isFinite);
    const durations = specialistMetrics.map((item) => item.durationMin).filter(Number.isFinite);

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      categoryName: service.category?.name ?? null,
      categorySlug: service.category?.slug ?? null,
      allowMultiServiceBooking: service.allowMultiServiceBooking,
      bookingType: service.bookingType,
      groupCapacityDefault: service.groupCapacityDefault,
      baseDurationMin: service.baseDurationMin,
      basePrice,
      minDurationMin: durations.length ? Math.min(...durations) : service.baseDurationMin,
      minPrice: prices.length ? Math.min(...prices) : basePrice,
      computedDurationMin: service.baseDurationMin,
      computedPrice: basePrice,
      specialistIds: service.specialists.map((item) => item.specialistId),
      coverUrl: serviceCoverMap.get(String(service.id)) ?? null,
      locationIds: service.locations.map((item) => item.locationId),
    };
  });

  const outputSpecialists = specialists.map((specialist) => ({
    id: specialist.id,
    name: buildSpecialistName(specialist),
    role: specialist.level?.name ?? null,
    levelId: specialist.levelId,
    avatarUrl: specialist.user.profile?.avatarUrl ?? null,
    coverUrl: specialistCoverMap.get(String(specialist.id)) ?? null,
    locationIds: specialist.locations.map((item) => item.locationId),
  }));

  const legalDocuments = legalDocs.flatMap((doc) => {
    const version = doc.versions[0];
    if (!version) return [];
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description ?? null,
      isRequired: doc.isRequired,
      versionId: version.id,
      version: version.version,
      publishedAt: version.publishedAt.toISOString(),
    };
  });

  const platformLegalDocuments = platformLegalDocs.flatMap((doc) => {
    const version = doc.versions[0];
    if (!version) return [];
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description ?? null,
      isRequired: doc.isRequired,
      versionId: version.id,
      version: version.version,
      publishedAt: version.publishedAt.toISOString(),
    };
  });

  return jsonOk({
    account: publicAccount,
    locations,
    legalDocuments,
    platformLegalDocuments,
    services: outputServices,
    specialists: outputSpecialists,
  });
}
