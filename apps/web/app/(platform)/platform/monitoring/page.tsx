import { requirePlatformPermission } from "@/lib/auth";

type MonitorCard = {
  label: string;
  value: string;
  hint: string;
};

type CheckRow = {
  name: string;
  status: string;
  info: string;
};

const metrics: MonitorCard[] = [
  { label: "Outbox lag", value: "—", hint: "Средняя задержка" },
  { label: "Retries", value: "—", hint: "Повторные доставки" },
  { label: "Dead-letter", value: "—", hint: "Требуют разбора" },
  { label: "Webhooks", value: "—", hint: "Активные endpoints" },
];

const checks: CheckRow[] = [
  { name: "Postgres", status: "ok", info: "Пинг 14 ms" },
  { name: "Redis", status: "ok", info: "Пинг 3 ms" },
  { name: "Worker", status: "ok", info: "Обработчик в строю" },
  { name: "Mail", status: "warn", info: "Очередь 6" },
];

export default async function PlatformMonitoringPage() {
  await requirePlatformPermission("platform.monitoring");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Мониторинг
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Системные метрики и состояния
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Outbox, deliveries, webhooks и healthchecks.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
              {item.label}
            </div>
            <div className="mt-2 text-xl font-semibold">{item.value}</div>
            <p className="mt-1 text-sm text-[color:var(--bp-muted)]">
              {item.hint}
            </p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          Healthchecks
        </div>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          {checks.map((check) => (
            <div
              key={check.name}
              className="flex items-center justify-between rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
            >
              <div className="font-semibold">{check.name}</div>
              <div className="text-[color:var(--bp-muted)]">{check.info}</div>
              <div className="text-xs font-semibold text-[color:var(--bp-ink)]">
                {check.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
