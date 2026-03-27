import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ServiceProfileTabs from "./service-profile-tabs";
import ServiceProfileActions from "./service-profile-actions";

export default async function ServiceProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCrmPermission("crm.services.read");
  const { id } = await params;
  const serviceId = Number(id);

  if (!Number.isInteger(serviceId)) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Некорректный идентификатор услуги.
        </p>
      </div>
    );
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, accountId: session.accountId },
    include: {
      category: true,
      variants: true,
      levelConfigs: { include: { level: true }, orderBy: { createdAt: "asc" } },
      locations: { select: { locationId: true } },
      specialists: { select: { specialistId: true } },
    },
  });

  if (!service) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">Услуга не найдена.</p>
        <div className="mt-4">
          <Link
            href="/crm/services"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            Назад к услугам
          </Link>
        </div>
      </div>
    );
  }

  const [
    servicePhotos,
    workPhotos,
    locations,
    specialists,
    levels,
    categories,
  ] = await Promise.all([
    prisma.mediaLink.findMany({
      where: {
        entityType: "service.photo",
        entityId: String(service.id),
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "service.work",
        entityId: String(service.id),
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.location.findMany({
      where: { accountId: session.accountId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId },
      include: { user: { include: { profile: true } }, level: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.specialistLevel.findMany({
      where: {
        OR: [{ accountId: session.accountId }, { accountId: null }],
      },
      orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
    }),
    prisma.serviceCategory.findMany({
      where: { accountId: session.accountId },
      orderBy: { name: "asc" },
    }),
  ]);

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: location.name,
    meta: location.address ?? null,
  }));

  const specialistOptions = specialists.map((specialist) => {
    const profile = specialist.user.profile;
    const fullName = [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      id: specialist.id,
      label: fullName || specialist.user.email || "Без имени",
      meta: specialist.level?.name ?? null,
    };
  });

  const levelOptions = levels.map((level) => ({
    id: level.id,
    name: level.name,
    rank: level.rank,
  }));

  const servicePhotoItems = servicePhotos.map((item) => ({
    id: item.id,
    url: item.asset.url,
    sortOrder: item.sortOrder,
    isCover: item.isCover,
  }));

  const workPhotoItems = workPhotos.map((item) => ({
    id: item.id,
    url: item.asset.url,
    sortOrder: item.sortOrder,
    isCover: item.isCover,
  }));

  const coverPhoto =
    servicePhotoItems.find((item) => item.isCover) ??
    servicePhotoItems[0] ??
    null;

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/crm/services"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Услуги
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Профиль услуги
          </span>
          <ServiceProfileActions serviceId={service.id} />
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {service.name}
              </h1>
              <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-[color:var(--bp-muted)]">
                {service.isActive ? "Активна" : "В архиве"}
              </span>
              {service.category ? (
                <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-[color:var(--bp-muted)]">
                  {service.category.name}
                </span>
              ) : null}
            </div>
            {service.description ? (
              <p className="text-sm text-[color:var(--bp-muted)]">
                {service.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--bp-muted)]">
              <span>Длительность: {service.baseDurationMin} мин</span>
              <span>Цена: {service.basePrice.toString()} ₽</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/60">
            {coverPhoto ? (
              <img
                src={coverPhoto.url}
                alt=""
                className="h-48 w-full object-cover"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center text-sm text-[color:var(--bp-muted)]">
                Обложка не добавлена
              </div>
            )}
          </div>
        </div>
      </header>

      <ServiceProfileTabs
        service={{
          id: service.id,
          name: service.name,
          description: service.description,
          baseDurationMin: service.baseDurationMin,
          basePrice: service.basePrice.toString(),
          isActive: service.isActive,
          allowMultiServiceBooking: service.allowMultiServiceBooking,
          categoryId: service.categoryId,
        }}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        levelConfigs={service.levelConfigs.map((config) => ({
          levelId: config.levelId,
          levelName: config.level.name,
          durationMin: config.durationMin,
          price: config.price ? config.price.toString() : null,
        }))}
        levelOptions={levelOptions}
        locations={locationOptions}
        specialists={specialistOptions}
        servicePhotoItems={servicePhotoItems}
        workPhotoItems={workPhotoItems}
        selectedLocationIds={service.locations.map((item) => item.locationId)}
        selectedSpecialistIds={service.specialists.map(
          (item) => item.specialistId
        )}
      />
    </div>
  );
}
