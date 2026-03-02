import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LocationProfileTabs from "./location-profile-tabs";
import LocationProfileActions from "./location-profile-actions";

export default async function LocationProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCrmPermission("crm.locations.read");
  const { id } = await params;
  const locationId = Number(id);

  if (!Number.isInteger(locationId)) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Некорректный идентификатор локации.
        </p>
      </div>
    );
  }

  const location = await prisma.location.findFirst({
    where: { id: locationId, accountId: session.accountId },
    include: {
      geoPoint: true,
      hours: true,
      exceptions: true,
      services: { select: { serviceId: true } },
      specialists: { select: { specialistId: true } },
      managers: { select: { userId: true } },
    },
  });

  if (!location) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Локация не найдена.
        </p>
        <div className="mt-4">
          <Link
            href="/crm/locations"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            Назад к локациям
          </Link>
        </div>
      </div>
    );
  }

  const [locationPhotos, workPhotos, services, specialists, managers] =
    await Promise.all([
      prisma.mediaLink.findMany({
        where: {
          entityType: "location.photo",
          entityId: String(location.id),
        },
        include: { asset: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.mediaLink.findMany({
        where: {
          entityType: "location.work",
          entityId: String(location.id),
        },
        include: { asset: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.service.findMany({
        where: { accountId: session.accountId },
        include: { category: true },
        orderBy: { name: "asc" },
      }),
      prisma.specialistProfile.findMany({
        where: { accountId: session.accountId },
        include: {
          user: { include: { profile: true } },
          level: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.roleAssignment.findMany({
        where: {
          accountId: session.accountId,
          role: { name: { in: ["OWNER", "MANAGER"] } },
        },
        include: {
          user: { include: { profile: true } },
          role: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const serviceOptions = services.map((service) => ({
    id: service.id,
    label: service.name,
    meta: service.category?.name ?? null,
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

  const managerOptions = managers.map((assignment) => {
    const profile = assignment.user.profile;
    const fullName = [profile?.firstName, profile?.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      id: assignment.user.id,
      label: fullName || assignment.user.email || "Без имени",
      meta: assignment.role.name === "OWNER" ? "Владелец" : "Менеджер",
    };
  });

  const locationPhotoItems = locationPhotos.map((item) => ({
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
    locationPhotoItems.find((item) => item.isCover) ??
    locationPhotoItems[0] ??
    null;

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/crm/locations"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Локации
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Профиль локации
          </span>
          <LocationProfileActions locationId={location.id} />
        </div>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {location.name}
              </h1>
              <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-[color:var(--bp-muted)]">
                {location.status}
              </span>
            </div>
            <p className="text-sm text-[color:var(--bp-muted)]">
              {location.address || "Без адреса"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--bp-muted)]">
              <span>
                Телефон: {location.phone ? location.phone : "не указан"}
              </span>
              {location.geoPoint ? (
                <span>
                  Координаты: {location.geoPoint.lat}, {location.geoPoint.lng}
                </span>
              ) : null}
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
                Обложка не выбрана
              </div>
            )}
          </div>
        </div>
      </header>

      <LocationProfileTabs
        location={{
          id: location.id,
          name: location.name,
          address: location.address,
          description: location.description,
          phone: location.phone,
          status: location.status,
          websiteUrl: location.websiteUrl,
          instagramUrl: location.instagramUrl,
          whatsappUrl: location.whatsappUrl,
          telegramUrl: location.telegramUrl,
          maxUrl: location.maxUrl,
          vkUrl: location.vkUrl,
          viberUrl: location.viberUrl,
          pinterestUrl: location.pinterestUrl,
          geo: location.geoPoint
            ? { lat: location.geoPoint.lat, lng: location.geoPoint.lng }
            : null,
        }}
        hours={location.hours.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          startTime: hour.startTime,
          endTime: hour.endTime,
        }))}
        exceptions={location.exceptions.map((exception) => ({
          id: exception.id,
          date: exception.date.toISOString().slice(0, 10),
          isClosed: exception.isClosed,
          startTime: exception.startTime ?? null,
          endTime: exception.endTime ?? null,
        }))}
        services={serviceOptions}
        specialists={specialistOptions}
        managers={managerOptions}
        locationPhotoItems={locationPhotoItems}
        workPhotoItems={workPhotoItems}
        selectedServiceIds={location.services.map((item) => item.serviceId)}
        selectedSpecialistIds={location.specialists.map(
          (item) => item.specialistId
        )}
        selectedManagerIds={location.managers.map((item) => item.userId)}
      />
    </div>
  );
}
