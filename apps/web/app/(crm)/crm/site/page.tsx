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

  const [locations, services, specialists, promotions, profile, branding, serviceCategories] = await Promise.all([
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
  specialistPhotos.forEach((item) => {
    if (!specialistCoverMap.has(item.entityId)) {
      specialistCoverMap.set(item.entityId, item.asset.url);
    }
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
        locations={locations.map((location: { id: number; name: string; address: string; phone: string | null; geoPoint: { lat: number; lng: number } | null }) => ({
          id: location.id,
          name: location.name,
          address: location.address,
          phone: location.phone,
          geo: location.geoPoint
            ? { lat: location.geoPoint.lat, lng: location.geoPoint.lng }
            : null,
          coverUrl: locationCoverMap.get(String(location.id)) ?? null,
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
        }))}
        serviceCategories={serviceCategories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        specialists={specialists.map((specialist: { id: number; user: { email: string | null; profile: { firstName: string | null; lastName: string | null } | null }; level: { name: string } | null; locations: Array<{ locationId: number }> }) => {
          const profile = specialist.user.profile;
          const fullName = [profile?.firstName, profile?.lastName]
            .filter(Boolean)
            .join(" ");
          return {
            id: specialist.id,
            name: fullName || specialist.user.email || "Без имени",
            level: specialist.level?.name ?? null,
            locationIds: specialist.locations.map((item: { locationId: number }) => item.locationId),
            coverUrl: specialistCoverMap.get(String(specialist.id)) ?? null,
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
        workPhotos={workPhotos}
      />
    </div>
  );
}


