import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";

type ClientProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientProfilePage({
  params,
}: ClientProfilePageProps) {
  const session = await requireCrmPermission("crm.clients.read");
  const { id } = await params;
  const clientId = Number(id);

  if (!Number.isInteger(clientId)) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-sm text-[color:var(--bp-muted)]">
        Некорректный идентификатор клиента.
      </div>
    );
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, accountId: session.accountId },
  });

  if (!client) {
    return (
      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-sm text-[color:var(--bp-muted)]">
        Клиент не найден.
      </div>
    );
  }

  const fullName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  const displayName =
    fullName || client.phone || client.email || "Без имени";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM BUSINESS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {displayName}
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Профиль клиента и история взаимодействий.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Контакты</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] p-4">
            <div className="text-xs text-[color:var(--bp-muted)]">Телефон</div>
            <div className="mt-1 text-sm">
              {client.phone || "Телефон не указан"}
            </div>
          </div>
          <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] p-4">
            <div className="text-xs text-[color:var(--bp-muted)]">Email</div>
            <div className="mt-1 text-sm">
              {client.email || "Email не указан"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Карточка клиента</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-[color:var(--bp-muted)]">Имя</div>
            <div className="mt-1 text-sm">{client.firstName || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[color:var(--bp-muted)]">Фамилия</div>
            <div className="mt-1 text-sm">{client.lastName || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[color:var(--bp-muted)]">Создан</div>
            <div className="mt-1 text-sm">
              {client.createdAt.toLocaleString("ru-RU")}
            </div>
          </div>
          <div>
            <div className="text-xs text-[color:var(--bp-muted)]">
              Обновлен
            </div>
            <div className="mt-1 text-sm">
              {client.updatedAt.toLocaleString("ru-RU")}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
