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
  placeholder?: string;
  resultsMode?: "dropdown" | "panel";
  bordered?: boolean;
  grow?: boolean;
};

type SearchProps = {
  size: string;
};

const Search = ({ size }: SearchProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
  >
    <path
      fill="none"
      stroke="#000000"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="M10.783 18.828a8.046 8.046 0 0 0 7.439-4.955a8.034 8.034 0 0 0-1.737-8.765a8.045 8.045 0 0 0-13.735 5.68c0 2.131.846 4.174 2.352 5.681a8.046 8.046 0 0 0 5.68 2.359m5.706-2.337l4.762 4.759"
    />
  </svg>
);

const readStoredCity = () => {
  try {
    return localStorage.getItem("bp-city");
  } catch {
    return null;
  }
};

export default function HomeSearchBar({
  className,
  placeholder = "Поиск",
  resultsMode = "dropdown",
  bordered = false,
  grow = true,
}: HomeSearchBarProps) {
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

  const borderClass = bordered
    ? "border border-[color:var(--bp-stroke)]"
    : "border border-transparent";
  const containerBase =
    resultsMode === "panel"
      ? `relative flex min-w-[240px] items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm ${borderClass}`
      : `relative flex min-w-[260px] items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm ${borderClass} ${
          grow ? "flex-1" : ""
        }`;

  return (
    <div className={`${containerBase} ${className ?? ""}`}>
      <Search size="18" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (results) setOpen(true);
        }}
        aria-label="Поиск"
        placeholder={placeholder}
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
        <div
          className={
            resultsMode === "panel"
              ? "mt-6 w-full overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]"
              : "absolute left-0 top-full z-40 mt-3 w-full min-w-[280px] overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]"
          }
        >
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
