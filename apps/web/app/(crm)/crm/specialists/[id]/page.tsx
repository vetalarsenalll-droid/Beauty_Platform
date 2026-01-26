import Link from "next/link";
import { requireCrmPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SpecialistProfileTabs from "./specialist-profile-tabs";
import SpecialistProfileActions from "./specialist-profile-actions";

export default async function SpecialistProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireCrmPermission("crm.specialists.read");
  const { id } = await params;
  const specialistId = Number(id);

  if (!Number.isInteger(specialistId)) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Некорректный идентификатор специалиста.
        </p>
      </div>
    );
  }

  const specialist = await prisma.specialistProfile.findFirst({
    where: { id: specialistId, accountId: session.accountId },
    include: {
      user: { include: { profile: true } },
      level: true,
      services: { select: { serviceId: true } },
      locations: { select: { locationId: true } },
    },
  });

  if (!specialist) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Специалист не найден.
        </p>
        <div className="mt-4">
          <Link
            href="/crm/specialists"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-sm font-semibold"
          >
            Назад к специалистам
          </Link>
        </div>
      </div>
    );
  }

  const [services, locations, levels, specialistPhotos, workPhotos] =
    await Promise.all([
    prisma.service.findMany({
      where: { accountId: session.accountId, isActive: true },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      where: { accountId: session.accountId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.specialistLevel.findMany({
      where: {
        OR: [{ accountId: session.accountId }, { accountId: null }],
      },
      orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "specialist.photo",
        entityId: String(specialist.id),
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.mediaLink.findMany({
      where: {
        entityType: "specialist.work",
        entityId: String(specialist.id),
      },
      include: { asset: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
  ]);

  const serviceOptions = services.map((service) => ({
    id: service.id,
    label: service.name,
    meta: service.category?.name ?? null,
  }));

  const locationOptions = locations.map((location) => ({
    id: location.id,
    label: location.name,
    meta: location.address ?? null,
  }));

  const levelOptions = levels.map((level) => ({
    id: level.id,
    name: level.name,
  }));

  const specialistPhotoItems = specialistPhotos.map((item) => ({
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

  const profile = specialist.user.profile;
  const fullName = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/crm/specialists"
            className="inline-flex items-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold"
          >
            Специалисты
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Профиль специалиста
          </span>
          <SpecialistProfileActions specialistId={specialist.id} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {fullName || specialist.user.email || "Без имени"}
            </h1>
            <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-[color:var(--bp-muted)]">
              {specialist.user.status === "ACTIVE"
                ? "Активен"
                : specialist.user.status === "INVITED"
                  ? "Приглашен"
                  : "В архиве"}
            </span>
            {specialist.level ? (
              <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs font-semibold text-[color:var(--bp-muted)]">
                {specialist.level.name}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--bp-muted)]">
            {specialist.user.email ? <span>{specialist.user.email}</span> : null}
            {specialist.user.phone ? <span>{specialist.user.phone}</span> : null}
          </div>
        </div>
      </header>

      <SpecialistProfileTabs
        specialist={{
          id: specialist.id,
          firstName: profile?.firstName ?? null,
          lastName: profile?.lastName ?? null,
          email: specialist.user.email,
          phone: specialist.user.phone,
          status: specialist.user.status,
          levelId: specialist.level?.id ?? null,
          bio: specialist.bio,
        }}
        levels={levelOptions}
        services={serviceOptions}
        locations={locationOptions}
        specialistPhotoItems={specialistPhotoItems}
        workPhotoItems={workPhotoItems}
        selectedServiceIds={specialist.services.map((item) => item.serviceId)}
        selectedLocationIds={specialist.locations.map(
          (item) => item.locationId
        )}
      />
    </div>
  );
}
