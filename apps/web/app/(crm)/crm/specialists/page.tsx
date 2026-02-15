import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import SpecialistCreateForm from "./specialist-create-form";
import SpecialistRowActions from "./specialist-row-actions";
import SpecialistLevelForm from "./specialist-level-form";
import SpecialistLevelRow from "./specialist-level-row";
import SpecialistCategoryForm from "./specialist-category-form";
import SpecialistCategoryRow from "./specialist-category-row";

export default async function CrmSpecialistsPage() {
  const session = await requireCrmPermission("crm.specialists.read");

  const [specialists, levels, categories] = await Promise.all([
    prisma.specialistProfile.findMany({
      where: {
        accountId: session.accountId,
        user: { status: { not: "DISABLED" } },
      },
      include: { user: { include: { profile: true } }, level: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.specialistLevel.findMany({
      where: {
        OR: [{ accountId: session.accountId }, { accountId: null }],
      },
      orderBy: [{ rank: "asc" }, { createdAt: "desc" }],
    }),
    prisma.specialistCategory.findMany({
      where: { accountId: session.accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Специалисты
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Специалисты</h1>
        <p className="text-[color:var(--bp-muted)]">
          Профили специалистов, уровни, категории и привязки к услугам.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Уровни специалистов</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Уровни используются для градации специалистов.
        </p>
        <div className="mt-4">
          <SpecialistLevelForm />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {levels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
              Уровней пока нет.
            </div>
          ) : (
            levels.map((level) => (
              <SpecialistLevelRow
                key={level.id}
                level={{
                  id: level.id,
                  name: level.name,
                  rank: level.rank,
                  readOnly: level.accountId === null,
                }}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Категории специалистов</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Категории используются для фильтрации специалистов в онлайн-записи.
        </p>
        <div className="mt-4">
          <SpecialistCategoryForm />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] px-4 py-6 text-sm text-[color:var(--bp-muted)]">
              Категорий пока нет.
            </div>
          ) : (
            categories.map((category) => (
              <SpecialistCategoryRow
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
        <h2 className="text-lg font-semibold">Карточка специалиста</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Создайте профиль специалиста, задайте уровень и категории.
        </p>
        <div className="mt-4">
          <SpecialistCreateForm
            levels={levels.map((level) => ({
              id: level.id,
              name: level.name,
            }))}
            categories={categories.map((category) => ({
              id: category.id,
              name: category.name,
            }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Список специалистов</h2>
        {specialists.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Специалистов пока нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {specialists.map((specialist) => (
              <SpecialistRowActions
                key={specialist.id}
                specialist={{
                  id: specialist.id,
                  firstName: specialist.user.profile?.firstName ?? null,
                  lastName: specialist.user.profile?.lastName ?? null,
                  email: specialist.user.email,
                  phone: specialist.user.phone,
                  status: specialist.user.status,
                  levelName: specialist.level?.name ?? null,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
