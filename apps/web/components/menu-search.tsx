"use client";

import { useMemo, useState } from "react";

type SearchItem = {
  id: number;
  label: string;
  href: string;
  kind: string;
};

type MenuSearchProps = {
  publicSlug: string | null;
  locations: Array<{ id: number; name: string }>;
  services: Array<{ id: number; name: string }>;
  specialists: Array<{ id: number; name: string }>;
  promos: Array<{ id: number; name: string }>;
  className?: string;
};

export default function MenuSearch({
  publicSlug,
  locations,
  services,
  specialists,
  promos,
  className,
}: MenuSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const base = publicSlug ? `/${publicSlug}` : "#";

  const items = useMemo<SearchItem[]>(() => {
    const list: SearchItem[] = [];
    locations.forEach((item) =>
      list.push({ id: item.id, label: item.name, href: `${base}/locations/${item.id}`, kind: "Локация" })
    );
    services.forEach((item) =>
      list.push({ id: item.id, label: item.name, href: `${base}/services/${item.id}`, kind: "Услуга" })
    );
    specialists.forEach((item) =>
      list.push({ id: item.id, label: item.name, href: `${base}/specialists/${item.id}`, kind: "Специалист" })
    );
    promos.forEach((item) =>
      list.push({ id: item.id, label: item.name, href: `${base}/promos/${item.id}`, kind: "Промо" })
    );
    return list;
  }, [base, locations, services, specialists, promos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder="Поиск"
        className="h-9 w-40 rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] px-4 text-sm"
      />
      {open && filtered.length > 0 && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-2 shadow-lg">
          {filtered.map((item) => (
            <a
              key={`${item.kind}-${item.id}`}
              href={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-[color:var(--bp-surface)]"
            >
              <span className="truncate">{item.label}</span>
              <span className="text-xs text-[color:var(--bp-muted)]">{item.kind}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

