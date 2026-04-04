import { prisma } from "@/lib/prisma";
import { requireCrmPermission } from "@/lib/auth";
import ClientCreateForm from "./client-create-form";
import ClientRowActions from "./client-row-actions";

export default async function CrmClientsPage() {
  const session = await requireCrmPermission("crm.clients.read");
  const clients = await prisma.client.findMany({
    where: { accountId: session.accountId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Создать клиента</h2>
        <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
          Заполните основные данные клиента и сохраните в CRM.
        </p>
        <div className="mt-4">
          <ClientCreateForm />
        </div>
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">База клиентов</h2>
        {clients.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Пока нет клиентов. Добавьте первого клиента выше.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {clients.map((client) => (
              <ClientRowActions
                key={client.id}
                client={{
                  id: client.id,
                  firstName: client.firstName,
                  lastName: client.lastName,
                  phone: client.phone,
                  email: client.email,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
