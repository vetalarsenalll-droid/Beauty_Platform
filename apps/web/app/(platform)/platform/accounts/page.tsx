import { requirePlatformPermission } from "@/lib/auth";

type AccountRow = {
  name: string;
  slug: string;
  status: string;
  plan: string;
  updated: string;
};

const rows: AccountRow[] = [
  {
    name: "Beauty Studio One",
    slug: "beauty-studio-one",
    status: "active",
    plan: "Pro",
    updated: "сегодня, 12:40",
  },
  {
    name: "Nail Lab Central",
    slug: "nail-lab-central",
    status: "trial",
    plan: "Starter",
    updated: "вчера, 18:05",
  },
  {
    name: "Brow & Glow",
    slug: "brow-glow",
    status: "paused",
    plan: "Pro",
    updated: "12 янв, 09:10",
  },
];

export default async function PlatformAccountsPage() {
  await requirePlatformPermission("platform.accounts");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Аккаунты
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Управление бизнес-аккаунтами
        </h1>
        <p className="text-[color:var(--bp-muted)]">
          Статусы, лимиты, тарифы и подключенные модули.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Поиск по названию или slug"
          className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)] sm:max-w-sm"
        />
        <button className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm font-semibold text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]">
          Добавить аккаунт
        </button>
      </div>

      <div className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 shadow-[var(--bp-shadow)]">
        <div className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr_1fr] gap-3 border-b border-[color:var(--bp-stroke)] pb-3 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
          <div>Аккаунт</div>
          <div>Slug</div>
          <div>Статус</div>
          <div>Тариф</div>
          <div>Обновлено</div>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {rows.map((row) => (
            <div
              key={row.slug}
              className="grid grid-cols-[2fr_1.2fr_0.8fr_0.8fr_1fr] gap-3 rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-3"
            >
              <div className="font-semibold">{row.name}</div>
              <div className="text-[color:var(--bp-muted)]">{row.slug}</div>
              <div className="text-[color:var(--bp-ink)]">{row.status}</div>
              <div className="text-[color:var(--bp-ink)]">{row.plan}</div>
              <div className="text-[color:var(--bp-muted)]">{row.updated}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
