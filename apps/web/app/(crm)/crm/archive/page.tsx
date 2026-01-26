import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import ArchiveRestoreButton from "./archive-restore-button";
import ArchiveDeleteButton from "./archive-delete-button";

export default async function CrmArchivePage() {
  const session = await requireCrmPermission("crm.locations.read");

  const [locations, services, specialists, promos] = await Promise.all([
    prisma.location.findMany({
      where: { accountId: session.accountId, status: "INACTIVE" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.service.findMany({
      where: { accountId: session.accountId, isActive: false },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId, user: { status: "DISABLED" } },
      include: { user: { include: { profile: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.promotion.findMany({
      where: { accountId: session.accountId, isActive: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM BUSINESS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Архив</h1>
        <p className="text-[color:var(--bp-muted)]">
          Здесь находятся архивные записи локаций, сотрудников, услуг, клиентов
          и промо.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Локации</h2>
        {locations.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            В архиве нет локаций.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm text-[color:var(--bp-muted)]">
            {locations.map((location) => (
              <div
                key={location.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[color:var(--bp-ink)]">
                    {location.name}
                  </span>
                  <span>{location.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArchiveRestoreButton entity="location" id={location.id} />
                  <ArchiveDeleteButton entity="location" id={location.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Сотрудники</h2>
        {specialists.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            В архиве нет сотрудников.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm text-[color:var(--bp-muted)]">
            {specialists.map((specialist) => {
              const profile = specialist.user.profile;
              const fullName = [profile?.firstName, profile?.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={specialist.id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[color:var(--bp-ink)]">
                      {fullName || specialist.user.email || "Без имени"}
                    </span>
                    <span>специалист</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArchiveRestoreButton
                      entity="specialist"
                      id={specialist.id}
                    />
                    <ArchiveDeleteButton
                      entity="specialist"
                      id={specialist.id}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Услуги</h2>
        {services.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            В архиве нет услуг.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm text-[color:var(--bp-muted)]">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[color:var(--bp-ink)]">
                    {service.name}
                  </span>
                  <span>{service.baseDurationMin} мин</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArchiveRestoreButton entity="service" id={service.id} />
                  <ArchiveDeleteButton entity="service" id={service.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Клиенты</h2>
        <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
          Архив клиентов появится после внедрения статуса клиента.
        </p>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Промо</h2>
        {promos.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            В архиве нет промо.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm text-[color:var(--bp-muted)]">
            {promos.map((promo) => (
              <div
                key={promo.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[color:var(--bp-ink)]">
                    {promo.name}
                  </span>
                  <span>{promo.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArchiveRestoreButton entity="promo" id={promo.id} />
                  <ArchiveDeleteButton entity="promo" id={promo.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
