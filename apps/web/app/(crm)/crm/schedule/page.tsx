import { requireCrmPermission } from "@/lib/auth";

export default async function CrmSchedulePage() {
  await requireCrmPermission("crm.schedule.read");
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM · Расписание
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Расписание</h1>
        <p className="text-[color:var(--bp-muted)]">
          Шаблоны, рабочие часы, перерывы и исключения.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Что будет на экране</h2>
        <div className="mt-3 grid gap-2 text-sm text-[color:var(--bp-muted)]">
          <div>Шаблоны расписания и привязка к специалистам.</div>
          <div>Рабочие часы, перерывы и отпуска.</div>
          <div>Исключения и блокировки слотов.</div>
        </div>
      </section>
    </div>
  );
}
