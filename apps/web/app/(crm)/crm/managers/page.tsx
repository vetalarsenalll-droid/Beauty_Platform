import { requireCrmPermission } from "@/lib/auth";

export default async function CrmManagersPage() {
  await requireCrmPermission("crm.specialists.read");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Менеджеры
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Менеджеры</h1>
        <p className="text-[color:var(--bp-muted)]">
          Назначайте менеджеров на локации и контролируйте доступ.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <p className="text-sm text-[color:var(--bp-muted)]">
          Раздел менеджеров в разработке.
        </p>
      </section>
    </div>
  );
}
