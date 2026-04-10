import { prisma } from "@/lib/prisma";
import { parsePublicSlugId } from "@/lib/public-slug";
import { normalizeDraft, type SiteDraft } from "@/lib/site-builder";
import type {
  PublicSiteData,
  SiteAccountProfile as AccountProfile,
  SiteBranding as Branding,
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

  const [locations, services, specialists, promotions, profile, branding] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: account.id },
      orderBy: { name: "asc" },
      include: { geoPoint: true },
    }),
    prisma.service.findMany({
      where: { accountId: account.id },
      orderBy: { name: "asc" },
      include: { locations: { select: { locationId: true } } },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: account.id },
      include: {
        user: { include: { profile: true } },
        level: true,
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
  servicePhotos.forEach((item) => {
    if (!serviceCoverMap.has(item.entityId)) {
      serviceCoverMap.set(item.entityId, item.asset.url);
    }
  });

  const specialistCoverMap = new Map<string, string>();
  specialistPhotos.forEach((item) => {
    if (!specialistCoverMap.has(item.entityId)) {
      specialistCoverMap.set(item.entityId, item.asset.url);
    }
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
    phone: location.phone,
    geo: location.geoPoint
      ? { lat: location.geoPoint.lat, lng: location.geoPoint.lng }
      : null,
    coverUrl: locationCoverMap.get(String(location.id)) ?? null,
  }));

  const serviceItems: ServiceItem[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description,
    baseDurationMin: service.baseDurationMin,
    basePrice: Number(service.basePrice),
    coverUrl: serviceCoverMap.get(String(service.id)) ?? null,
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
      level: specialist.level?.name ?? null,
      locationIds: specialist.locations.map((item) => item.locationId),
      coverUrl: specialistCoverMap.get(String(specialist.id)) ?? null,
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

  return {
    account,
    publicSlug,
    draft,
    accountProfile,
    branding: brandingData,
    locations: locationItems,
    services: serviceItems,
    specialists: specialistItems,
    promos: promoItems,
    workPhotos,
  };
}

