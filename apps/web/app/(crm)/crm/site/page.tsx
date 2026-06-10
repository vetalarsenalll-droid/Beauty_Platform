import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SiteClient from "./site-client";
import { cookies } from "next/headers";
import { buildPublicSlugId } from "@/lib/public-slug";
import {
  createDefaultDraft,
  DEFAULT_ACCOUNT_NAME,
  normalizeDraft,
  type SiteDraft,
  type SitePageKey,
} from "@/lib/site-builder";
import {
  MOBILE_VIEWPORTS,
  type CurrentEntity,
  type MobileViewportKey,
} from "@/features/site-builder/crm/site-client-core";
import { Prisma } from "@prisma/client";

const ALLOWED_PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "aisha",
  "client",
  "clientLogin",
  "clientCabinet",
  "legal",
  "locations",
  "services",
  "specialists",
  "promos",
];

const normalizeInitialPage = (value: string | undefined): SitePageKey => {
  if (!value) return "home";
  return ALLOWED_PAGE_KEYS.includes(value as SitePageKey)
    ? (value as SitePageKey)
    : "home";
};

const normalizeInitialEntity = (
  value: string | undefined,
  pageKey: SitePageKey
): CurrentEntity => {
  const legalMatch = value?.match(/^legalDocument:(\d+)$/);
  if (legalMatch) {
    if (pageKey !== "legal") return null;
    const id = Number(legalMatch[1]);
    return Number.isInteger(id) && id > 0 ? { type: "legalDocument", id } : null;
  }

  const match = value?.match(/^(location|service|specialist|promo):(\d+)$/);
  if (!match) return null;

  const type = match[1] as "location" | "service" | "specialist" | "promo";
  const id = Number(match[2]);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (type === "location" && pageKey !== "locations") return null;
  if (type === "service" && pageKey !== "services") return null;
  if (type === "specialist" && pageKey !== "specialists") return null;
  if (type === "promo" && pageKey !== "promos") return null;

  return { type, id };
};

const SITE_PREVIEW_MODE_COOKIE_KEY = "site_builder_preview_mode";
const SITE_MOBILE_VIEWPORT_COOKIE_KEY = "site_builder_mobile_viewport";

const normalizeInitialPreviewMode = (value: string | undefined): "desktop" | "mobile" =>
  value === "mobile" ? "mobile" : "desktop";

const normalizeInitialMobileViewport = (value: string | undefined): MobileViewportKey =>
  value && value in MOBILE_VIEWPORTS ? (value as MobileViewportKey) : "mobile360";

export default async function CrmSitePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; entity?: string }>;
}) {
  const session = await requireCrmPermission("crm.settings.read");
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const initialActivePage = normalizeInitialPage(resolvedSearchParams?.page);
  const initialCurrentEntity = normalizeInitialEntity(
    resolvedSearchParams?.entity,
    initialActivePage
  );
  const initialPreviewMode = normalizeInitialPreviewMode(
    cookieStore.get(SITE_PREVIEW_MODE_COOKIE_KEY)?.value
  );
  const initialMobileViewport = normalizeInitialMobileViewport(
    cookieStore.get(SITE_MOBILE_VIEWPORT_COOKIE_KEY)?.value
  );

  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, slug: true, timeZone: true },
  });

  const publicPage = await prisma.publicPage.findFirst({
    where: { accountId: session.accountId },
  });

  const accountName = account?.name?.trim() || DEFAULT_ACCOUNT_NAME;
  const defaultDraft = createDefaultDraft(accountName);
  const page = publicPage
    ? publicPage
    : await prisma.publicPage.create({
        data: {
          accountId: session.accountId,
          status: "DRAFT",
          draftJson: defaultDraft as Prisma.InputJsonValue,
        },
      });

  const safeDraftJson = normalizeDraft(
    (page.draftJson ?? defaultDraft) as SiteDraft,
    accountName
  );

  const [
    locations,
    services,
    specialists,
    promotions,
    reviews,
    profile,
    branding,
    serviceCategories,
    specialistLevels,
    legalDocs,
    platformLegalDocs,
    seoPageSettings,
    bookingSettings,
  ] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId },
      orderBy: { name: "asc" },
      include: { geoPoint: true },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId },
      orderBy: { name: "asc" },
      include: {
        category: { select: { id: true, name: true } },
        locations: { select: { locationId: true } },
      },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId },
      include: {
        user: { include: { profile: true } },
        level: true,
        locations: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.promotion.findMany({
      where: { accountId: session.accountId },
      include: { promoCodes: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.findMany({
      where: { accountId: session.accountId, status: "PUBLISHED" },
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
      where: { accountId: session.accountId },
    }),
    prisma.accountBranding.findUnique({
      where: { accountId: session.accountId },
    }),
    prisma.serviceCategory.findMany({
      where: { accountId: session.accountId },
      orderBy: { name: "asc" },
    }),
    prisma.specialistLevel.findMany({
      where: {
        OR: [{ accountId: session.accountId }, { accountId: null }],
      },
      orderBy: [{ rank: "asc" }, { createdAt: "desc" }],
    }),
    prisma.legalDocument.findMany({
      where: { accountId: session.accountId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        isRequired: true,
        sortOrder: true,
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
    prisma.seoPageSetting.findMany({
      where: { accountId: session.accountId },
      orderBy: { pageKey: "asc" },
    }),
    prisma.accountSetting.findUnique({
      where: { accountId: session.accountId },
      select: {
        slotStepMinutes: true,
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
        cancellationWindowHours: true,
        rescheduleWindowHours: true,
        holdTtlMinutes: true,
        defaultReminderHours: true,
      },
    }),
  ]);

  const locationIds = locations.map((item: { id: number }) => String(item.id));
  const serviceIds = services.map((item: { id: number }) => String(item.id));
  const specialistIds = specialists.map((item: { id: number }) => String(item.id));

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
      where: {
        entityType: "location.photo",
        entityId: { in: locationIds },
      },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "service.photo",
        entityId: { in: serviceIds },
      },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "specialist.photo",
        entityId: { in: specialistIds },
      },
      include: { asset: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "location.work",
        entityId: { in: locationIds },
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "service.work",
        entityId: { in: serviceIds },
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "specialist.work",
        entityId: { in: specialistIds },
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.ratingAggregate.findMany({
      where: {
        accountId: session.accountId,
        OR: [
          { entityType: "location", entityId: { in: locationIds } },
          { entityType: "service", entityId: { in: serviceIds } },
          { entityType: "specialist", entityId: { in: specialistIds } },
        ],
      },
    }),
    prisma.review.groupBy({
      by: ["entityType", "entityId"],
      where: {
        accountId: session.accountId,
        status: "PUBLISHED",
        OR: [
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
    if (item.isCover && !serviceCoverMap.has(item.entityId)) {
      serviceCoverMap.set(item.entityId, item.asset.url);
    }
    const current = servicePhotoMap.get(item.entityId) ?? [];
    current.push(item.asset.url);
    servicePhotoMap.set(item.entityId, current);
  });

  const specialistCoverMap = new Map<string, string>();
  const specialistPhotoMap = new Map<string, string[]>();
  const specialistPhotoItemMap = new Map<string, Array<{ id: number; url: string; isCover: boolean }>>();
  specialistPhotos.forEach((item) => {
    if (item.isCover && !specialistCoverMap.has(item.entityId)) {
      specialistCoverMap.set(item.entityId, item.asset.url);
    }
    const current = specialistPhotoMap.get(item.entityId) ?? [];
    current.push(item.asset.url);
    specialistPhotoMap.set(item.entityId, current);
    const currentItems = specialistPhotoItemMap.get(item.entityId) ?? [];
    currentItems.push({
      id: item.id,
      url: item.asset.url,
      isCover: item.isCover,
    });
    specialistPhotoItemMap.set(item.entityId, currentItems);
  });

  const workPhotos = {
    locations: locationWorkPhotos.map(
      (item: { entityId: string; asset: { url: string } }) => ({
        entityId: item.entityId,
        url: item.asset.url,
      })
    ),
    services: serviceWorkPhotos.map(
      (item: { entityId: string; asset: { url: string } }) => ({
        entityId: item.entityId,
        url: item.asset.url,
      })
    ),
    specialists: specialistWorkPhotos.map(
      (item: { entityId: string; asset: { url: string } }) => ({
        entityId: item.entityId,
        url: item.asset.url,
      })
    ),
  };

  const publicSlug = account ? buildPublicSlugId(account.slug, account.id) : null;
  const bookingOnlinePaymentMode = bookingSettings?.bookingOnlinePaymentMode ?? "DISABLED";
  const initialBookingSettings = {
    slotStepMinutes: bookingSettings?.slotStepMinutes ?? 15,
    requireDeposit: bookingSettings?.requireDeposit ?? false,
    requirePaymentToConfirm: bookingSettings?.requirePaymentToConfirm ?? false,
    bookingOnlinePaymentMode,
    bookingAllowPayLater: bookingSettings?.bookingAllowPayLater ?? true,
    bookingAllowPrepaymentFixed:
      bookingSettings?.bookingAllowPrepaymentFixed ?? bookingOnlinePaymentMode === "PREPAYMENT_FIXED",
    bookingAllowPrepaymentPercent:
      bookingSettings?.bookingAllowPrepaymentPercent ?? bookingOnlinePaymentMode === "PREPAYMENT_PERCENT",
    bookingAllowFullPayment: bookingSettings?.bookingAllowFullPayment ?? bookingOnlinePaymentMode === "FULL_PAYMENT",
    bookingPrepaymentAmount:
      bookingSettings?.bookingPrepaymentAmount == null ? null : Number(bookingSettings.bookingPrepaymentAmount),
    bookingPrepaymentPercent:
      bookingSettings?.bookingPrepaymentPercent == null ? null : Number(bookingSettings.bookingPrepaymentPercent),
    bookingFullPaymentDiscountPercent:
      bookingSettings?.bookingFullPaymentDiscountPercent == null
        ? null
        : Number(bookingSettings.bookingFullPaymentDiscountPercent),
    cancellationWindowHours: bookingSettings?.cancellationWindowHours ?? null,
    rescheduleWindowHours: bookingSettings?.rescheduleWindowHours ?? null,
    holdTtlMinutes: bookingSettings?.holdTtlMinutes ?? null,
    defaultReminderHours: bookingSettings?.defaultReminderHours ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <SiteClient
        initialActivePage={initialActivePage}
        initialCurrentEntity={initialCurrentEntity}
        initialPreviewMode={initialPreviewMode}
        initialMobileViewport={initialMobileViewport}
        initialPublicPage={{
          id: page.id,
          status: page.status,
          draftJson: safeDraftJson,
          publishedVersionId: page.publishedVersionId,
        }}
        initialSeoPageSettings={seoPageSettings.map((item) => ({
          pageKey: item.pageKey,
          title: item.title ?? "",
          description: item.description ?? "",
          ogImageUrl: item.ogImageUrl ?? "",
          keywords: item.keywords ?? "",
          canonicalUrl: item.canonicalUrl ?? "",
          noIndex: item.noIndex ?? false,
          noFollow: item.noFollow ?? false,
        }))}
        initialBookingSettings={initialBookingSettings}
        initialEditableLegalDocuments={legalDocs.map((doc) => ({
          id: doc.id,
          key: doc.key,
          title: doc.title,
          description: doc.description,
          isRequired: doc.isRequired,
          sortOrder: doc.sortOrder,
          versionId: doc.versions[0]?.id ?? null,
          version: doc.versions[0]?.version ?? null,
          content: doc.versions[0]?.content ?? "",
        }))}
        account={{
          id: account?.id ?? session.accountId,
          name: accountName,
          slug: account?.slug ?? "",
          publicSlug,
          timeZone: account?.timeZone ?? "Europe/Moscow",
        }}
        accountProfile={{
          description: profile?.description ?? "",
          phone: profile?.phone ?? "",
          email: profile?.email ?? "",
          address: profile?.address ?? "",
          websiteUrl: profile?.websiteUrl ?? "",
          instagramUrl: profile?.instagramUrl ?? "",
          whatsappUrl: profile?.whatsappUrl ?? "",
          telegramUrl: profile?.telegramUrl ?? "",
          maxUrl: profile?.maxUrl ?? "",
          vkUrl: profile?.vkUrl ?? "",
          viberUrl: profile?.viberUrl ?? "",
          pinterestUrl: profile?.pinterestUrl ?? "",
        }}
        branding={{
          logoUrl: branding?.logoUrl ?? null,
          coverUrl: branding?.coverUrl ?? null,
        }}
        locations={locations.map((location: { id: number; name: string; address: string; description: string | null; phone: string | null; geoPoint: { lat: number; lng: number } | null }) => ({
          id: location.id,
          name: location.name,
          address: location.address,
          description: location.description,
          phone: location.phone,
          geo: location.geoPoint
            ? { lat: location.geoPoint.lat, lng: location.geoPoint.lng }
            : null,
          coverUrl: locationCoverMap.get(String(location.id)) ?? null,
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
        }))}
        services={services.map((service: { id: number; name: string; description: string | null; category: { id: number; name: string } | null; baseDurationMin: number; basePrice: unknown; locations: Array<{ locationId: number }> }) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          categoryId: service.category?.id ?? null,
          categoryName: service.category?.name ?? null,
          baseDurationMin: service.baseDurationMin,
          basePrice: Number(service.basePrice),
          coverUrl: serviceCoverMap.get(String(service.id)) ?? null,
          photoUrls: servicePhotoMap.get(String(service.id)) ?? [],
          photoItems: servicePhotos
            .filter((item) => item.entityId === String(service.id))
            .map((item) => ({
              id: item.id,
              url: item.asset.url,
              isCover: item.isCover,
            })),
          locationIds: service.locations.map((item) => item.locationId),
          ...readRating("service", String(service.id)),
        }))}
        serviceCategories={serviceCategories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        specialistLevels={specialistLevels.map((level) => ({
          id: level.id,
          name: level.name,
        }))}
        specialists={specialists.map((specialist: { id: number; bio: string | null; user: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null }; level: { id: number; name: string } | null; locations: Array<{ locationId: number }> }) => {
          const profile = specialist.user.profile;
          const fullName = [profile?.firstName, profile?.lastName]
            .filter(Boolean)
            .join(" ");
          return {
            id: specialist.id,
            name: fullName || specialist.user.email || "Без имени",
            firstName: profile?.firstName ?? "",
            lastName: profile?.lastName ?? "",
            bio: specialist.bio,
            levelId: specialist.level?.id ?? null,
            level: specialist.level?.name ?? null,
            locationIds: specialist.locations.map((item: { locationId: number }) => item.locationId),
            coverUrl: specialistCoverMap.get(String(specialist.id)) ?? null,
            photoUrls: specialistPhotoMap.get(String(specialist.id)) ?? [],
            photoItems: specialistPhotoItemMap.get(String(specialist.id)) ?? [],
            ...readRating("specialist", String(specialist.id)),
          };
        })}
        promos={promotions.map((promo) => ({
          id: promo.id,
          name: promo.name,
          type: promo.type,
          value: Number(promo.value),
          startsAt: promo.startsAt ? promo.startsAt.toISOString().slice(0, 10) : null,
          endsAt: promo.endsAt ? promo.endsAt.toISOString().slice(0, 10) : null,
          isActive: promo.isActive,
          codes: promo.promoCodes.map((code) => code.code),
        }))}
        reviews={reviews.map((review) => {
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
        })}
        workPhotos={workPhotos}
        legalDocuments={legalDocs.flatMap((doc) => {
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
        })}
        platformLegalDocuments={platformLegalDocs.flatMap((doc) => {
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
        })}
      />
    </div>
  );
}


