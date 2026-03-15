"use client";

import { useEffect, useMemo, useState } from "react";

type SearchItem = {
  id: string;
  type: "service" | "specialist" | "account";
  title: string;
  subtitle?: string | null;
  url: string;
};

type SearchResponse = {
  data?: {
    services?: SearchItem[];
    specialists?: SearchItem[];
    accounts?: SearchItem[];
  };
};

type HomeSearchBarProps = {
  placeholder?: string;
};

export default function HomeSearchBar({
  placeholder = "Искать услуги, специалистов или студии",
}: HomeSearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  const grouped = useMemo(() => {
    const byType = { service: [], specialist: [], account: [] } as Record<
      SearchItem["type"],
      SearchItem[]
    >;
    for (const item of items) byType[item.type].push(item);
    return byType;
  }, [items]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const city = (() => {
      try {
        return localStorage.getItem("bp-city") ?? "";
      } catch {
        return "";
      }
    })();

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/public/search?query=${encodeURIComponent(trimmed)}&city=${encodeURIComponent(city)}`
        );
        const payload = (await res.json().catch(() => null)) as SearchResponse | null;
        const next: SearchItem[] = [
          ...(payload?.data?.services ?? []),
          ...(payload?.data?.specialists ?? []),
          ...(payload?.data?.accounts ?? []),
        ];
        setItems(next);
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="relative flex min-w-[260px] flex-1 items-center">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 text-sm text-[color:var(--bp-ink)] outline-none"
      />
      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-40 w-full overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]">
          <div className="max-h-[360px] overflow-y-auto p-2">
            {loading ? (
              <div className="px-3 py-2 text-xs text-[color:var(--bp-muted)]">
                Ищем…
              </div>
            ) : null}
            {!loading && items.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[color:var(--bp-muted)]">
                Ничего не найдено
              </div>
            ) : null}
            {grouped.service.length ? (
              <Section title="Услуги" items={grouped.service} />
            ) : null}
            {grouped.specialist.length ? (
              <Section title="Специалисты" items={grouped.specialist} />
            ) : null}
            {grouped.account.length ? (
              <Section title="Студии" items={grouped.account} />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, items }: { title: string; items: SearchItem[] }) {
  return (
    <div className="px-1 py-2">
      <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
        {title}
      </div>
      <div className="mt-1">
        {items.map((item) => (
          <a
            key={`${item.type}-${item.id}`}
            href={item.url}
            className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-[color:var(--bp-panel)]"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-[color:var(--bp-ink)]">{item.title}</span>
              {item.subtitle ? (
                <span className="text-xs text-[color:var(--bp-muted)]">{item.subtitle}</span>
              ) : null}
            </div>
            <span className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-[10px] text-[color:var(--bp-muted)]">
              {title}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
