import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import ManagerCreateForm from "./manager-create-form";
import ManagerRowActions from "./manager-row-actions";

export default async function CrmManagersPage() {
  const session = await requireCrmPermission("crm.specialists.read");

  const managers = await prisma.roleAssignment.findMany({
    where: {
      accountId: session.accountId,
      role: { name: "MANAGER" },
      user: { status: { not: "DISABLED" } },
    },
    include: { user: { include: { profile: true } }, role: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Менеджеры
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Менеджеры</h1>
        <p className="text-[color:var(--bp-muted)]">
          Менеджеры аккаунта с доступом к CRM.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Карточка менеджера</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Создайте профиль менеджера и пригласите в CRM.
        </p>
        <div className="mt-4">
          <ManagerCreateForm />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Список менеджеров</h2>
        {managers.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Менеджеров пока нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {managers.map((assignment) => (
              <ManagerRowActions
                key={assignment.id}
                manager={{
                  id: assignment.user.id,
                  firstName: assignment.user.profile?.firstName ?? null,
                  lastName: assignment.user.profile?.lastName ?? null,
                  email: assignment.user.email,
                  phone: assignment.user.phone,
                  status: assignment.user.status,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}