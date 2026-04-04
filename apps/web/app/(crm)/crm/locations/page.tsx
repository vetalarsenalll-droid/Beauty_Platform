import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import LocationCreateForm from "./location-create-form";
import LocationRowActions from "./location-row-actions";

export default async function CrmLocationsPage() {
  const session = await requireCrmPermission("crm.locations.read");

  const locations = await prisma.location.findMany({
    where: { accountId: session.accountId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Создать локацию</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Заполните базовые сведения о локации. Детальные настройки доступны в
          профиле локации.
        </p>
        <div className="mt-4">
          <LocationCreateForm />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Ваши локации</h2>
        {locations.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Пока нет созданных локаций.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {locations.map((location) => (
              <LocationRowActions
                key={location.id}
                location={{
                  id: location.id,
                  name: location.name,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
