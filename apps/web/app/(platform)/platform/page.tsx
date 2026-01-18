import { requirePlatformSession } from "@/lib/auth";

type Metric = {
  label: string;
  value: string;
  hint: string;
};

type ActionCard = {
  title: string;
  text: string;
  href: string;
};

const metrics: Metric[] = [
  { label: "Активные аккаунты", value: "—", hint: "Все активные бизнесы" },
  { label: "Новые регистрации", value: "—", hint: "За последние 7 дней" },
  { label: "Outbox lag", value: "—", hint: "Средняя задержка" },
  { label: "Системные алерты", value: "—", hint: "Требуют внимания" },
];

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
