const sections = [
  {
    title: "Локации",
    description: "Точки обслуживания, адреса, графики и статусы.",
    href: "/crm/locations",
  },
  {
    title: "Услуги",
    description: "Каталог услуг, категории, уровни и цены.",
    href: "/crm/services",
  },
  {
    title: "Специалисты",
    description: "Профили Специалистов и привязки к услугам/локациям.",
    href: "/crm/specialists",
  },
  {
    title: "Расписание",
    description: "Шаблоны, рабочие часы, перерывы, исключения.",
    href: "/crm/schedule",
  },
  {
    title: "Календарь",
    description: "Календарь записей и управление визитами.",
    href: "/crm/calendar",
  },
];

const secondary = [
  { title: "Клиенты", href: "/crm/clients" },
  { title: "Оплаты/Финансы", href: "/crm/payments" },
  { title: "Промо/Скидки", href: "/crm/promos" },
  { title: "Лояльность", href: "/crm/loyalty" },
  { title: "Аналитика", href: "/crm/analytics" },
  { title: "Настройки", href: "/crm/settings" },
];

export default function CrmHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          CRM Business
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Операционка бизнеса: от локаций до записей
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Строим CRM по логике: локации → услуги → специалисты → расписание →
          календарь.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {sections.map((item) => (
          <a
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] transition hover:-translate-y-0.5 hover:border-[color:var(--bp-accent)]"
          >
            <div className="text-lg font-semibold">{item.title}</div>
            <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
              {item.description}
            </p>
          </a>
        ))}
      </section>

      <section className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
        <h2 className="text-lg font-semibold">Другие разделы</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secondary.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3 text-sm text-[color:var(--bp-muted)] transition hover:border-[color:var(--bp-accent)] hover:text-[color:var(--bp-ink)]"
            >
              {item.title}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
