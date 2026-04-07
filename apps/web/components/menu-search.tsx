"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <div className={`relative z-[90] ${className ?? ""}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => {
              const next = !prev;
              if (!next) setQuery("");
              return next;
            });
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--block-border,var(--bp-stroke))] bg-[color:var(--block-sub-bg,var(--bp-panel))] text-[color:var(--block-muted,var(--bp-muted))] transition-colors hover:text-[color:var(--block-text,var(--bp-ink))]"
          aria-label="Открыть поиск"
          title="Открыть поиск"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          >
            <path d="m16.893 16.92l3.08 3.08m-.889-8.419c0 4.187-3.383 7.581-7.556 7.581c-4.172 0-7.555-3.394-7.555-7.58C3.973 7.393 7.356 4 11.528 4c4.173 0 7.556 3.394 7.556 7.581Z" />
          </svg>
        </button>
        <div
          className={`relative overflow-hidden transition-all duration-300 ease-out ${open ? "w-40 opacity-100" : "w-0 opacity-0"}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder="Поиск"
            className="h-9 w-full rounded-full border border-[color:var(--block-border,var(--bp-stroke))] bg-[color:var(--block-sub-bg,var(--bp-panel))] px-3 pr-8 text-sm text-[color:var(--block-muted,var(--bp-muted))] placeholder:text-[color:var(--block-muted,var(--bp-muted))] outline-none transition focus:border-[color:var(--block-border,var(--bp-stroke))] focus:outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--block-border,var(--bp-stroke))]"
          />
          {query && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--block-muted,var(--bp-muted))]"
              aria-label="Очистить поиск"
              title="Очистить поиск"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute right-0 z-[120] mt-2 w-64 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--block-sub-bg,var(--bp-panel))] p-2 shadow-lg">
          {filtered.map((item) => (
            <a
              key={`${item.kind}-${item.id}`}
              href={item.href}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-[color:var(--block-muted,var(--bp-muted))] hover:bg-[color:var(--bp-surface)]"
            >
              <span className="truncate">{item.label}</span>
              <span className="text-xs text-[color:var(--block-muted,var(--bp-muted))]">{item.kind}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
