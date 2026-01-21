import { prisma } from "@/lib/prisma";
import { requirePlatformPermission } from "@/lib/auth";

export default async function PlatformMonitoringPage() {
  await requirePlatformPermission("platform.monitoring");

  const [outboxPending, outboxFailed, deliveryFailed, webhookFailed, health] =
    await Promise.all([
      prisma.outboxItem.count({ where: { status: "PENDING" } }),
      prisma.outboxItem.count({ where: { status: "FAILED" } }),
      prisma.deliveryLog.count({ where: { status: "FAILED" } }),
      prisma.webhookDelivery.count({ where: { status: "FAILED" } }),
      prisma.healthCheck.findMany({ orderBy: { checkedAt: "desc" }, take: 5 }),
    ]);

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
          Реальные данные из outbox, deliveries, webhooks и healthchecks.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Outbox: в очереди",
            value: outboxPending,
            hint: "Ожидают обработки",
          },
          {
            label: "Outbox: ошибки",
            value: outboxFailed,
            hint: "Ошибки в outbox",
          },
          {
            label: "Доставки: ошибки",
            value: deliveryFailed,
            hint: "Проблемные доставки",
          },
          {
            label: "Webhooks: ошибки",
            value: webhookFailed,
            hint: "Ошибки webhooks",
          },
        ].map((item) => (
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

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Проверки</h2>
        {health.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--bp-muted)]">
            Проверок пока нет.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {health.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
              >
                <div className="font-semibold">{row.name}</div>
                <div className="text-[color:var(--bp-muted)]">
                  {row.status.toLowerCase() === "ok" ? "ОК" : row.status}
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  {row.checkedAt.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
