import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import ServiceCreateForm from "./service-create-form";
import ServiceRowActions from "./service-row-actions";
import ServiceCategoryForm from "./service-category-form";
import ServiceCategoryRow from "./service-category-row";

export default async function CrmServicesPage() {
  const session = await requireCrmPermission("crm.services.read");

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where: { accountId: session.accountId, isActive: true },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceCategory.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <div className="flex flex-col gap-6">

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Категории</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Категории используются для структуры каталога услуг.
        </p>
        <div className="mt-4">
          <ServiceCategoryForm />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
              Категорий пока нет.
            </div>
          ) : (
            categories.map((category) => (
              <ServiceCategoryRow
                key={category.id}
                category={{
                  id: category.id,
                  name: category.name,
                }}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Карточка услуги</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Создайте услугу, задайте длительность и базовую цену.
        </p>
        <div className="mt-4">
          <ServiceCreateForm
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Список услуг</h2>
        {services.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Услуг пока нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {services.map((service) => (
              <ServiceRowActions
                key={service.id}
                service={{
                  id: service.id,
                  name: service.name,
                  description: service.description,
                  baseDurationMin: service.baseDurationMin,
                  basePrice: service.basePrice.toString(),
                  isActive: service.isActive,
                  categoryName: service.category?.name ?? null,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
