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
  SitePaymentSettings as PaymentSettings,
  SitePromoItem as PromoItem,
  SiteReviewItem as ReviewItem,
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
  ReviewItem,
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
    reviews,
    profile,
    branding,
    legalDocs,
    platformLegalDocs,
    accountSettings,
    defaultPaymentConnection,
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
          where: { specialist: { isPublic: true, user: { status: "ACTIVE" } } },
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
      where: { accountId: account.id, isPublic: true, user: { status: "ACTIVE" } },
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
    prisma.review.findMany({
      where: { accountId: account.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        client: true,
        appointment: {
          include: {
            location: { select: { id: true, name: true } },
            specialist: {
              select: {
                id: true,
                user: { select: { profile: { select: { firstName: true, lastName: true } } } },
              },
            },
            services: { select: { service: { select: { id: true, name: true } } }, orderBy: { orderIndex: "asc" } },
          },
        },
      },
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
          select: { id: true, version: true, content: true, publishedAt: true },
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
          select: { id: true, version: true, content: true, publishedAt: true },
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
    ratingAggregates,
    reviewRatingGroups,
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
    prisma.ratingAggregate.findMany({
      where: {
        accountId: account.id,
        OR: [
          { entityType: "account", entityId: String(account.id) },
          { entityType: "location", entityId: { in: locationIds } },
          { entityType: "service", entityId: { in: serviceIds } },
          { entityType: "specialist", entityId: { in: specialistIds } },
        ],
      },
    }),
    prisma.review.groupBy({
      by: ["entityType", "entityId"],
      where: {
        accountId: account.id,
        status: "PUBLISHED",
        OR: [
          { entityType: "account", entityId: String(account.id) },
          { entityType: "location", entityId: { in: locationIds } },
          { entityType: "service", entityId: { in: serviceIds } },
          { entityType: "specialist", entityId: { in: specialistIds } },
        ],
      },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  const ratingMap = new Map(
    ratingAggregates.map((item) => [`${item.entityType}:${item.entityId}`, item])
  );
  const liveRatingMap = new Map(
    reviewRatingGroups.map((item) => [
      `${item.entityType}:${item.entityId}`,
      {
        ratingAvg: item._avg.rating ?? null,
        ratingCount: item._count.rating,
      },
    ])
  );
  const readRating = (entityType: string, entityId: string) => {
    const aggregate = ratingMap.get(`${entityType}:${entityId}`);
    const live = liveRatingMap.get(`${entityType}:${entityId}`);
    return {
      ratingAvg: live?.ratingAvg ?? aggregate?.ratingAvg ?? null,
      ratingCount: live?.ratingCount ?? aggregate?.ratingCount ?? 0,
    };
  };

  const reviewIds = reviews.map((review) => String(review.id));
  const [reviewPhotoLinks, replyPhotoLinks] = await Promise.all([
    prisma.mediaLink.findMany({
      where: {
        entityType: "review.photo",
        entityId: { in: reviewIds },
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "review.reply.photo",
        entityId: { in: reviewIds },
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);
  const reviewPhotoMap = new Map<string, string[]>();
  reviewPhotoLinks.forEach((link) => {
    const current = reviewPhotoMap.get(link.entityId) ?? [];
    current.push(link.asset.url);
    reviewPhotoMap.set(link.entityId, current);
  });
  const replyPhotoMap = new Map<string, string[]>();
  replyPhotoLinks.forEach((link) => {
    const current = replyPhotoMap.get(link.entityId) ?? [];
    current.push(link.asset.url);
    replyPhotoMap.set(link.entityId, current);
  });

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
    ...readRating("location", String(location.id)),
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
    ...readRating("service", String(service.id)),
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
      ...readRating("specialist", String(specialist.id)),
    };
  });

  const reviewItems: ReviewItem[] = reviews.map((review) => {
    const numericEntityId = review.entityId ? Number(review.entityId) : null;
    const fallbackEntityId = Number.isFinite(numericEntityId) ? numericEntityId : null;

    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      entityType: review.entityType,
      entityId: review.entityId,
      replyText: review.replyText,
      replyPhotoUrls: replyPhotoMap.get(String(review.id)) ?? [],
      createdAt: review.createdAt.toISOString(),
      locationId: review.appointment?.location?.id ?? (review.entityType === "location" ? fallbackEntityId : null),
      locationName: review.appointment?.location?.name ?? null,
      specialistId: review.appointment?.specialist?.id ?? (review.entityType === "specialist" ? fallbackEntityId : null),
      specialistName:
        [review.appointment?.specialist?.user?.profile?.firstName, review.appointment?.specialist?.user?.profile?.lastName]
          .filter(Boolean)
          .join(" ") || null,
      services: review.appointment?.services.map((entry) => ({ id: entry.service.id, name: entry.service.name })) ?? [],
      servicesLabel: review.appointment?.services.map((entry) => entry.service.name).join(", ") || null,
      photoUrls: reviewPhotoMap.get(String(review.id)) ?? [],
      clientName:
        [review.client.firstName, review.client.lastName].filter(Boolean).join(" ") ||
        review.client.email ||
        review.client.phone ||
        "Клиент",
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
      content: version.content,
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
      content: version.content,
      publishedAt: version.publishedAt.toISOString(),
    };
  });

  const payments: PaymentSettings = {
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
    bookingPrepaymentAmount: accountSettings?.bookingPrepaymentAmount
      ? Number(accountSettings.bookingPrepaymentAmount)
      : null,
    bookingPrepaymentPercent: accountSettings?.bookingPrepaymentPercent
      ? Number(accountSettings.bookingPrepaymentPercent)
      : null,
    bookingFullPaymentDiscountPercent: accountSettings?.bookingFullPaymentDiscountPercent
      ? Number(accountSettings.bookingFullPaymentDiscountPercent)
      : null,
    onlinePaymentAvailable: Boolean(defaultPaymentConnection),
    provider: defaultPaymentConnection?.provider ?? null,
    mode: defaultPaymentConnection?.mode ?? null,
  };

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
    reviews: reviewItems,
    workPhotos,
    legalDocuments,
    platformLegalDocuments,
    payments,
  };
}

