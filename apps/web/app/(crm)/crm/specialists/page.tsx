import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import SpecialistCreateForm from "./specialist-create-form";
import SpecialistRowActions from "./specialist-row-actions";
import SpecialistLevelForm from "./specialist-level-form";
import SpecialistLevelRow from "./specialist-level-row";

export default async function CrmSpecialistsPage() {
  const session = await requireCrmPermission("crm.specialists.read");

  const [specialists, levels] = await Promise.all([
    prisma.specialistProfile.findMany({
      where: { accountId: session.accountId },
      include: { user: { include: { profile: true } }, level: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.specialistLevel.findMany({
      where: {
        OR: [{ accountId: session.accountId }, { accountId: null }],
      },
      orderBy: [{ rank: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Сотрудники
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Сотрудники</h1>
        <p className="text-[color:var(--bp-muted)]">
          Настройте команду, уровни специалистов и статус доступа.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Уровни специалистов</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Используйте уровни для расчета стоимости и распределения нагрузки.
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
        <h2 className="text-lg font-semibold">Добавить сотрудника</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Создайте профиль специалиста и назначьте уровень.
        </p>
        <div className="mt-4">
          <SpecialistCreateForm
            levels={levels.map((level) => ({
              id: level.id,
              name: level.name,
            }))}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Список сотрудников</h2>
        {specialists.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Сотрудников пока нет.
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
                  levelId: specialist.level?.id ?? null,
                  bio: specialist.bio,
                }}
                levels={levels.map((level) => ({
                  id: level.id,
                  name: level.name,
                }))}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
