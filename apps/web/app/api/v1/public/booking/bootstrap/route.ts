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

  const [locationsRaw, legalDocs, platformLegalDocs, services, specialists, accountSettings, defaultPaymentConnection] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: account.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
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
          where: { specialist: { isPublic: true, user: { status: "ACTIVE" } } },
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
        isPublic: true,
        user: { status: "ACTIVE" },
        ...(hasLocation ? { locations: { some: { locationId: Number(locationId) } } } : {}),
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        bio: true,
        levelId: true,
        level: { select: { name: true } },
        locations: { select: { locationId: true } },
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
    }),
    prisma.accountSetting.findUnique({
      where: { accountId: account.id },
      select: {
        requireDeposit: true,
        requirePaymentToConfirm: true,
        bookingOnlinePaymentMode: true,
        bookingAllowPayLater: true,
        bookingAllowPrepaymentFixed: true,
        bookingAllowPrepaymentPercent: true,
        bookingAllowFullPayment: true,
        bookingPrepaymentAmount: true,
        bookingPrepaymentPercent: true,
        bookingFullPaymentDiscountPercent: true,
      },
    }),
    prisma.accountPaymentConnection.findFirst({
      where: {
        accountId: account.id,
        isEnabled: true,
      },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
      select: {
        provider: true,
        mode: true,
      },
    }),
  ]);

  const locationIds = locationsRaw.map((item) => String(item.id));
  const serviceIds = services.map((item) => String(item.id));
  const specialistIds = specialists.map((item) => String(item.id));
  const [locationPhotos, servicePhotos, specialistPhotos, locationWorkPhotos, serviceWorkPhotos, specialistWorkPhotos] = await Promise.all([
    locationIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "location.photo", entityId: { in: locationIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    serviceIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "service.photo", entityId: { in: serviceIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    specialistIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "specialist.photo", entityId: { in: specialistIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    locationIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "location.work", entityId: { in: locationIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        })
      : [],
    serviceIds.length
      ? prisma.mediaLink.findMany({
          where: { entityType: "service.work", entityId: { in: serviceIds } },
          select: { entityId: true, asset: { select: { url: true } } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
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

  const toPhotoMap = (items: Array<{ entityId: string; asset: { url: string } }>) => {
    const map = new Map<string, string[]>();
    items.forEach((item) => {
      const current = map.get(item.entityId) ?? [];
      current.push(item.asset.url);
      map.set(item.entityId, current);
    });
    return map;
  };
  const locationPhotoMap = toPhotoMap(locationPhotos);
  const servicePhotoMap = toPhotoMap(servicePhotos);
  const specialistPhotoMap = toPhotoMap(specialistPhotos);
  const locationWorkPhotoMap = toPhotoMap(locationWorkPhotos);
  const serviceWorkPhotoMap = toPhotoMap(serviceWorkPhotos);
  const specialistWorkPhotoMap = toPhotoMap(specialistWorkPhotos);

  const locations = locationsRaw.map((location) => ({
    ...location,
    coverUrl: locationCoverMap.get(String(location.id)) ?? null,
    photoUrls: locationPhotoMap.get(String(location.id)) ?? [],
    workPhotoUrls: locationWorkPhotoMap.get(String(location.id)) ?? [],
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
      photoUrls: servicePhotoMap.get(String(service.id)) ?? [],
      workPhotoUrls: serviceWorkPhotoMap.get(String(service.id)) ?? [],
      locationIds: service.locations.map((item) => item.locationId),
    };
  });

  const outputSpecialists = specialists.map((specialist) => ({
    id: specialist.id,
    name: buildSpecialistName(specialist),
    bio: specialist.bio,
    role: specialist.level?.name ?? null,
    levelId: specialist.levelId,
    avatarUrl: specialist.user.profile?.avatarUrl ?? null,
    coverUrl: specialistCoverMap.get(String(specialist.id)) ?? null,
    photoUrls: specialistPhotoMap.get(String(specialist.id)) ?? [],
    workPhotoUrls: specialistWorkPhotoMap.get(String(specialist.id)) ?? [],
    locationIds: specialist.locations.map((item) => item.locationId),
    categories: specialist.categories.map((entry) => ({
      id: entry.category.id,
      name: entry.category.name,
      slug: entry.category.slug,
    })),
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
    payments: {
      requireDeposit: accountSettings?.requireDeposit ?? false,
      requirePaymentToConfirm: accountSettings?.requirePaymentToConfirm ?? false,
      bookingOnlinePaymentMode: accountSettings?.bookingOnlinePaymentMode ?? "DISABLED",
      bookingAllowPayLater: accountSettings?.bookingAllowPayLater ?? true,
      bookingAllowPrepaymentFixed:
        accountSettings?.bookingAllowPrepaymentFixed ??
        accountSettings?.bookingOnlinePaymentMode === "PREPAYMENT_FIXED",
      bookingAllowPrepaymentPercent:
        accountSettings?.bookingAllowPrepaymentPercent ??
        accountSettings?.bookingOnlinePaymentMode === "PREPAYMENT_PERCENT",
      bookingAllowFullPayment:
        accountSettings?.bookingAllowFullPayment ??
        accountSettings?.bookingOnlinePaymentMode === "FULL_PAYMENT",
      bookingPrepaymentAmount:
        accountSettings?.bookingPrepaymentAmount == null
          ? null
          : Number(accountSettings.bookingPrepaymentAmount),
      bookingPrepaymentPercent:
        accountSettings?.bookingPrepaymentPercent == null
          ? null
          : Number(accountSettings.bookingPrepaymentPercent),
      bookingFullPaymentDiscountPercent:
        accountSettings?.bookingFullPaymentDiscountPercent == null
          ? null
          : Number(accountSettings.bookingFullPaymentDiscountPercent),
      onlinePaymentAvailable: Boolean(defaultPaymentConnection),
      provider: defaultPaymentConnection?.provider ?? null,
      mode: defaultPaymentConnection?.mode ?? null,
    },
    locations,
    legalDocuments,
    platformLegalDocuments,
    services: outputServices,
    specialists: outputSpecialists,
    workPhotos: {
      locations: locationWorkPhotos.map((item) => ({ entityId: item.entityId, url: item.asset.url })),
      services: serviceWorkPhotos.map((item) => ({ entityId: item.entityId, url: item.asset.url })),
      specialists: specialistWorkPhotos.map((item) => ({ entityId: item.entityId, url: item.asset.url })),
    },
  });
}
