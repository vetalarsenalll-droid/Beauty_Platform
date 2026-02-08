import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SiteClient from "./site-client";
import { buildPublicSlugId } from "@/lib/public-slug";
import { createDefaultDraft, normalizeDraft, type SiteDraft } from "@/lib/site-builder";
import { Prisma } from "@prisma/client";

export default async function CrmSitePage() {
  const session = await requireCrmPermission("crm.settings.read");

  const account = await prisma.account.findUnique({
    where: { id: session.accountId },
    select: { id: true, name: true, slug: true, timeZone: true },
  });

  const publicPage = await prisma.publicPage.findFirst({
    where: { accountId: session.accountId },
  });

  const defaultDraft = createDefaultDraft(account?.name ?? "Салон красоты");
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
    (page.draftJson ?? defaultDraft) as SiteDraft
  );

  const [locations, services, specialists, promotions, profile, branding] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId },
      orderBy: { name: "asc" },
      include: { geoPoint: true },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId },
      orderBy: { name: "asc" },
      include: { locations: { select: { locationId: true } } },
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
        initialPublicPage={{
          id: page.id,
          status: page.status,
          draftJson: safeDraftJson,
          publishedVersionId: page.publishedVersionId,
        }}
        account={{
          id: account?.id ?? session.accountId,
          name: account?.name ?? "Салон красоты",
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
        services={services.map((service: { id: number; name: string; description: string | null; baseDurationMin: number; basePrice: unknown; locations: Array<{ locationId: number }> }) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          baseDurationMin: service.baseDurationMin,
          basePrice: Number(service.basePrice),
          coverUrl: serviceCoverMap.get(String(service.id)) ?? null,
          locationIds: service.locations.map((item) => item.locationId),
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


