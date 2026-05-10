import { prisma } from "@/lib/prisma";
import { parsePublicSlugId } from "@/lib/public-slug";
import { getAccountSlotStepMinutes } from "@/lib/public-booking";
import { normalizeDraft, type SiteDraft } from "@/lib/site-builder";
import type {
  PublicSiteData,
  SiteAccountProfile as AccountProfile,
  SiteBranding as Branding,
  SiteLegalDocumentItem as LegalDocumentItem,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
  SiteWorkPhotos as WorkPhotos,
} from "@/features/site-builder/shared/site-data";

export type {
  PublicSiteData,
  AccountProfile,
  Branding,
  LocationItem,
  PromoItem,
  ServiceItem,
  SpecialistItem,
  WorkPhotos,
};
export async function loadPublicData(publicSlug: string): Promise<PublicSiteData | null> {
  const parsed = parsePublicSlugId(publicSlug);
  if (!parsed) return null;

  const account = await prisma.account.findUnique({
    where: { id: parsed.id },
    select: { id: true, name: true, slug: true, timeZone: true },
  });
  if (!account) return null;

  const publicPage = await prisma.publicPage.findFirst({
    where: { accountId: account.id },
    include: {
      publishedVersion: {
        select: { contentJson: true },
      },
    },
  });

  const sourceJson =
    (publicPage?.publishedVersion?.contentJson ?? publicPage?.draftJson ?? null) as SiteDraft | null;
  const draft = normalizeDraft(sourceJson, account.name);

  const [
    slotStepMinutes,
    locations,
    services,
    specialists,
    promotions,
    profile,
    branding,
    legalDocs,
    platformLegalDocs,
  ] = await Promise.all([
    getAccountSlotStepMinutes(account.id),
    prisma.location.findMany({
      where: { accountId: account.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: {
        geoPoint: true,
        hours: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
          orderBy: { dayOfWeek: "asc" },
        },
        exceptions: {
          select: {
            date: true,
            isClosed: true,
            startTime: true,
            endTime: true,
          },
          orderBy: { date: "asc" },
        },
      },
    }),
    prisma.service.findMany({
      where: { accountId: account.id, isActive: true },
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true, slug: true } },
        locations: { select: { locationId: true } },
        specialists: {
          select: {
            specialistId: true,
            priceOverride: true,
            durationOverrideMin: true,
            specialist: { select: { levelId: true } },
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
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: account.id },
      include: {
        user: { include: { profile: true } },
        level: true,
        categories: {
          include: { category: { select: { id: true, name: true, slug: true } } },
        },
        locations: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.promotion.findMany({
      where: { accountId: account.id },
      include: { promoCodes: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.accountProfile.findUnique({
      where: { accountId: account.id },
    }),
    prisma.accountBranding.findUnique({
      where: { accountId: account.id },
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
  ]);

  const locationIds = locations.map((item) => String(item.id));
  const serviceIds = services.map((item) => String(item.id));
  const specialistIds = specialists.map((item) => String(item.id));

  const [
    locationPhotos,
    servicePhotos,
    specialistPhotos,
    locationWorkPhotos,
    serviceWorkPhotos,
    specialistWorkPhotos,
  ] = await Promise.all([
    prisma.mediaLink.findMany({
      where: { entityType: "location.photo", entityId: { in: locationIds } },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "service.photo", entityId: { in: serviceIds } },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "specialist.photo", entityId: { in: specialistIds } },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "location.work", entityId: { in: locationIds } },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "service.work", entityId: { in: serviceIds } },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: { entityType: "specialist.work", entityId: { in: specialistIds } },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const locationCoverMap = new Map<string, string>();
  locationPhotos.forEach((item) => {
    if (!locationCoverMap.has(item.entityId)) {
      locationCoverMap.set(item.entityId, item.asset.url);
    }
  });

  const serviceCoverMap = new Map<string, string>();
  const servicePhotoMap = new Map<string, string[]>();
  servicePhotos.forEach((item) => {
    if (!serviceCoverMap.has(item.entityId)) {
      serviceCoverMap.set(item.entityId, item.asset.url);
    }
    const current = servicePhotoMap.get(item.entityId) ?? [];
    current.push(item.asset.url);
    servicePhotoMap.set(item.entityId, current);
  });

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

  const workPhotos: WorkPhotos = {
    locations: locationWorkPhotos.map((item) => ({
      entityId: item.entityId,
      url: item.asset.url,
    })),
    services: serviceWorkPhotos.map((item) => ({
      entityId: item.entityId,
      url: item.asset.url,
    })),
    specialists: specialistWorkPhotos.map((item) => ({
      entityId: item.entityId,
      url: item.asset.url,
    })),
  };

  const accountProfile: AccountProfile = {
    description: profile?.description ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    address: profile?.address ?? null,
    websiteUrl: profile?.websiteUrl ?? null,
    instagramUrl: profile?.instagramUrl ?? null,
    whatsappUrl: profile?.whatsappUrl ?? null,
    telegramUrl: profile?.telegramUrl ?? null,
    facebookUrl: null,
    tiktokUrl: null,
    youtubeUrl: null,
    twitterUrl: null,
    dzenUrl: null,
    okUrl: null,
    maxUrl: profile?.maxUrl ?? null,
    vkUrl: profile?.vkUrl ?? null,
    viberUrl: profile?.viberUrl ?? null,
    pinterestUrl: profile?.pinterestUrl ?? null,
  };

  const brandingData: Branding = {
    logoUrl: branding?.logoUrl ?? null,
    coverUrl: branding?.coverUrl ?? null,
  };

  const locationItems: LocationItem[] = locations.map((location) => ({
    id: location.id,
    name: location.name,
    address: location.address,
    description: location.description,
    phone: location.phone,
    geo: location.geoPoint
      ? { lat: location.geoPoint.lat, lng: location.geoPoint.lng }
      : null,
    coverUrl: locationCoverMap.get(String(location.id)) ?? null,
    hours: location.hours,
    exceptions: location.exceptions.map((item) => ({
      date: item.date.toISOString().slice(0, 10),
      isClosed: item.isClosed,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
    photoUrls: locationPhotos
      .filter((item) => item.entityId === String(location.id))
      .map((item) => item.asset.url),
    photoItems: locationPhotos
      .filter((item) => item.entityId === String(location.id))
      .map((item) => ({
        id: item.id,
        url: item.asset.url,
        isCover: item.isCover,
      })),
  }));

  const serviceItems: ServiceItem[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    categoryName: service.category?.name ?? null,
    categorySlug: service.category?.slug ?? null,
    allowMultiServiceBooking: service.allowMultiServiceBooking,
    bookingType: service.bookingType,
    groupCapacityDefault: service.groupCapacityDefault,
    baseDurationMin: service.baseDurationMin,
    basePrice: Number(service.basePrice),
    minDurationMin:
      service.specialists.length > 0
        ? Math.min(
            ...service.specialists.map((binding) => {
              const levelConfig = binding.specialist.levelId
                ? service.levelConfigs.find((item) => item.levelId === binding.specialist.levelId)
                : null;
              return binding.durationOverrideMin || levelConfig?.durationMin || service.baseDurationMin;
            })
          )
        : service.baseDurationMin,
    minPrice:
      service.specialists.length > 0
        ? Math.min(
            ...service.specialists.map((binding) => {
              const levelConfig = binding.specialist.levelId
                ? service.levelConfigs.find((item) => item.levelId === binding.specialist.levelId)
                : null;
              return Number(binding.priceOverride) || Number(levelConfig?.price) || Number(service.basePrice);
            })
          )
        : Number(service.basePrice),
    computedDurationMin: service.baseDurationMin,
    computedPrice: Number(service.basePrice),
    specialistIds: service.specialists.map((item) => item.specialistId),
    coverUrl: serviceCoverMap.get(String(service.id)) ?? null,
    photoUrls: servicePhotoMap.get(String(service.id)) ?? [],
    locationIds: service.locations.map((item) => item.locationId),
  }));

  const specialistItems: SpecialistItem[] = specialists.map((specialist) => {
    const profileData = specialist.user.profile;
    const fullName = [profileData?.firstName, profileData?.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      id: specialist.id,
      name: fullName || specialist.user.email || "Без имени",
      bio: specialist.bio,
      level: specialist.level?.name ?? null,
      role: specialist.level?.name ?? null,
      levelId: specialist.levelId,
      avatarUrl: profileData?.avatarUrl ?? null,
      categories: specialist.categories.map((entry) => ({
        id: entry.category.id,
        name: entry.category.name,
        slug: entry.category.slug,
      })),
      locationIds: specialist.locations.map((item) => item.locationId),
      coverUrl: specialistCoverMap.get(String(specialist.id)) ?? null,
      photoUrls: specialistPhotoMap.get(String(specialist.id)) ?? [],
    };
  });

  const promoItems: PromoItem[] = promotions.map((promo) => ({
    id: promo.id,
    name: promo.name,
    type: promo.type,
    value: Number(promo.value),
    startsAt: promo.startsAt ? promo.startsAt.toISOString().slice(0, 10) : null,
    endsAt: promo.endsAt ? promo.endsAt.toISOString().slice(0, 10) : null,
    isActive: promo.isActive,
    codes: promo.promoCodes.map((code) => code.code),
  }));

  const legalDocuments: LegalDocumentItem[] = legalDocs.flatMap((doc) => {
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

  const platformLegalDocuments: LegalDocumentItem[] = platformLegalDocs.flatMap((doc) => {
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

  return {
    account: { ...account, slotStepMinutes },
    publicSlug,
    draft,
    accountProfile,
    branding: brandingData,
    locations: locationItems,
    services: serviceItems,
    specialists: specialistItems,
    promos: promoItems,
    workPhotos,
    legalDocuments,
    platformLegalDocuments,
  };
}

