import Link from "next/link";

type TabKey = "collection" | "catalog" | "promos" | "map" | "favorites" | "records";

const TABS: Array<{ key: TabKey; label: string; href: string }> = [
  { key: "collection", label: "Подборка", href: "/" },
  { key: "catalog", label: "Каталог", href: "/catalog" },
  { key: "promos", label: "Акции", href: "/promos" },
  { key: "map", label: "На карте", href: "/map" },
  { key: "favorites", label: "Избранное", href: "/favorites" },
  { key: "records", label: "Мои записи", href: "/records" },
];

type HomeCatalogTabsProps = {
  active: TabKey;
};

export default function HomeCatalogTabs({ active }: HomeCatalogTabsProps) {
  return (
    <div className="flex w-full justify-center">
      <nav className="flex flex-wrap items-center justify-center gap-2 rounded-[24px] border border-[color:var(--bp-stroke)] bg-white px-2 py-2 shadow-[var(--bp-shadow)]">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`rounded-2xl px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? "bg-[color:var(--bp-accent)] text-white shadow-[var(--bp-shadow)]"
                  : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
