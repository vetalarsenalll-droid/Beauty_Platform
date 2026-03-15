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
  className?: string;
};

const readStoredCity = () => {
  try {
    return localStorage.getItem("bp-city");
  } catch {
    return null;
  }
};

export default function HomeSearchBar({ className }: HomeSearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [results, setResults] = useState<{
    services: SearchItem[];
    specialists: SearchItem[];
    accounts: SearchItem[];
  } | null>(null);

  useEffect(() => {
    setCity(readStoredCity());
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setOpen(false);
      return;
    }

    let alive = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const storedCity = readStoredCity();
        if (storedCity && storedCity !== city) {
          setCity(storedCity);
        }
        const params = new URLSearchParams({ query: trimmed });
        if (storedCity) params.set("city", storedCity);
        const res = await fetch(`/api/v1/public/search?${params.toString()}`);
        const payload = (await res.json().catch(() => null)) as SearchResponse | null;
        const data = payload?.data ?? {};
        if (!alive) return;
        setResults({
          services: data.services ?? [],
          specialists: data.specialists ?? [],
          accounts: data.accounts ?? [],
        });
        setOpen(true);
      } catch {
        if (!alive) return;
        setResults({ services: [], specialists: [], accounts: [] });
        setOpen(true);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [query, city]);

  const hasResults = useMemo(() => {
    if (!results) return false;
    return (
      results.services.length > 0 ||
      results.specialists.length > 0 ||
      results.accounts.length > 0
    );
  }, [results]);

  return (
    <div
      className={`relative flex min-w-[260px] flex-1 items-center gap-3 rounded-2xl border border-transparent bg-white px-4 py-3 text-sm ${className ?? ""}`}
    >
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (results) setOpen(true);
        }}
        placeholder="Искать услуги, специалистов или студии"
        className="w-full appearance-none rounded-none border-0 !border-0 bg-transparent !bg-transparent text-sm text-[color:var(--bp-ink)] outline-none ring-0 !ring-0 focus:ring-0 focus:outline-none shadow-none !shadow-none placeholder:text-[color:var(--bp-muted)]"
        style={{
          backgroundColor: "transparent",
          boxShadow: "none",
          border: "none",
          borderRadius: "0",
          WebkitAppearance: "none",
        }}
      />
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-3 w-full min-w-[280px] overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]">
          <div className="max-h-96 overflow-y-auto px-4 py-3 text-xs text-[color:var(--bp-muted)]">
            {loading ? "Ищем результаты…" : null}
            {!loading && results && !hasResults ? "Ничего не найдено" : null}
          </div>
          {!loading && results && hasResults ? (
            <div className="max-h-96 overflow-y-auto pb-3">
              {results.services.length ? (
                <div className="px-4 pb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                    Услуги
                  </div>
                  <div className="mt-2 space-y-2">
                    {results.services.map((item) => (
                      <a
                        key={`${item.type}-${item.id}`}
                        href={item.url}
                        className="flex flex-col rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
                        onClick={() => setOpen(false)}
                      >
                        <span className="font-medium text-[color:var(--bp-ink)]">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="text-xs text-[color:var(--bp-muted)]">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {results.specialists.length ? (
                <div className="px-4 pb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                    Специалисты
                  </div>
                  <div className="mt-2 space-y-2">
                    {results.specialists.map((item) => (
                      <a
                        key={`${item.type}-${item.id}`}
                        href={item.url}
                        className="flex flex-col rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
                        onClick={() => setOpen(false)}
                      >
                        <span className="font-medium text-[color:var(--bp-ink)]">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="text-xs text-[color:var(--bp-muted)]">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
              {results.accounts.length ? (
                <div className="px-4 pb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                    Организации
                  </div>
                  <div className="mt-2 space-y-2">
                    {results.accounts.map((item) => (
                      <a
                        key={`${item.type}-${item.id}`}
                        href={item.url}
                        className="flex flex-col rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
                        onClick={() => setOpen(false)}
                      >
                        <span className="font-medium text-[color:var(--bp-ink)]">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="text-xs text-[color:var(--bp-muted)]">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
