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
  type MobileViewportKey,
} from "@/features/site-builder/crm/site-client-core";
import { Prisma } from "@prisma/client";

const ALLOWED_PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "client",
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

const SITE_PREVIEW_MODE_COOKIE_KEY = "site_builder_preview_mode";
const SITE_MOBILE_VIEWPORT_COOKIE_KEY = "site_builder_mobile_viewport";

const normalizeInitialPreviewMode = (value: string | undefined): "desktop" | "mobile" =>
  value === "mobile" ? "mobile" : "desktop";

const normalizeInitialMobileViewport = (value: string | undefined): MobileViewportKey =>
  value && value in MOBILE_VIEWPORTS ? (value as MobileViewportKey) : "mobile360";

export default async function CrmSitePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const session = await requireCrmPermission("crm.settings.read");
  const resolvedSearchParams = await searchParams;
  const cookieStore = await cookies();
  const initialActivePage = normalizeInitialPage(resolvedSearchParams?.page);
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

  const [locations, services, specialists, promotions, reviews, profile, branding, serviceCategories, specialistLevels] = await Promise.all([
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

  return (
    <div className="flex flex-col gap-6">
      <SiteClient
        initialActivePage={initialActivePage}
        initialPreviewMode={initialPreviewMode}
        initialMobileViewport={initialMobileViewport}
        initialPublicPage={{
          id: page.id,
          status: page.status,
          draftJson: safeDraftJson,
          publishedVersionId: page.publishedVersionId,
        }}
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
      />
    </div>
  );
}


