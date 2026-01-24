import { requireCrmPermission } from "@/lib/auth";

export default async function CrmLoyaltyPage() {
  await requireCrmPermission("crm.loyalty.read");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Лояльность
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Лояльность</h1>
        <p className="text-[color:var(--bp-muted)]">
          Бонусные кошельки, уровни, подарочные карты и абонементы.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Что будет на экране</h2>
        <div className="mt-3 grid gap-2 text-sm text-[color:var(--bp-muted)]">
          <div>Кошельки и транзакции лояльности.</div>
          <div>Уровни и правила начисления.</div>
          <div>Подарочные карты и абонементы.</div>
        </div>
      </section>
    </div>
  );
}
