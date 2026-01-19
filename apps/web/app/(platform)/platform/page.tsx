import { requirePlatformSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ActionCard = {
  title: string;
  text: string;
  href: string;
};

const actions: ActionCard[] = [
  {
    title: "Настройки платформы",
    text: "Глобальные шаблоны, пресеты и справочники.",
    href: "/platform/settings",
  },
  {
    title: "Мониторинг",
    text: "Outbox, deliveries, webhooks, healthchecks.",
    href: "/platform/monitoring",
  },
  {
    title: "Модерация",
    text: "Проверка отзывов, медиа и профилей.",
    href: "/platform/moderation",
  },
];

export default async function PlatformHome() {
  await requirePlatformSession();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [activeAccounts, newAccounts, pendingOutbox, healthChecks] =
    await Promise.all([
      prisma.account.count({ where: { status: "ACTIVE" } }),
      prisma.account.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.outboxItem.findMany({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        select: { createdAt: true },
      }),
      prisma.healthCheck.findMany({ select: { status: true } }),
    ]);

  const lagMinutes =
    pendingOutbox.length === 0
      ? null
      : Math.round(
          pendingOutbox.reduce(
            (sum, item) => sum + (Date.now() - item.createdAt.getTime()),
            0
          ) /
            pendingOutbox.length /
            60000
        );

  const alertsCount = healthChecks.filter(
    (check) => check.status.toLowerCase() !== "ok"
  ).length;

  const metrics = [
    {
      label: "Активные аккаунты",
      value: String(activeAccounts),
      hint: "Все активные бизнесы",
    },
    {
      label: "Новые регистрации",
      value: String(newAccounts),
      hint: "За последние 7 дней",
    },
    {
      label: "Outbox lag",
      value: lagMinutes === null ? "—" : `${lagMinutes} мин`,
      hint: "Средняя задержка",
    },
    {
      label: "Системные алерты",
      value: String(alertsCount),
      hint: "Требуют внимания",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Платформа
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Панель управления платформой
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Сводка по аккаунтам, подпискам, модерации и состоянию системы.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]"
          >
            <div className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
              {item.label}
            </div>
            <div className="mt-2 text-2xl font-semibold">{item.value}</div>
            <p className="mt-1 text-sm text-[color:var(--bp-muted)]">
              {item.hint}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {actions.map((item) => (
          <a
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] transition hover:-translate-y-0.5 hover:border-[color:var(--bp-accent)]"
          >
            <div className="text-lg font-semibold">{item.title}</div>
            <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
              {item.text}
            </p>
          </a>
        ))}
      </section>
    </div>
  );
}
