"use client";

import { useEffect, useMemo, useState } from "react";

type HomeCityPickerProps = {
  className?: string;
};

type CityResponse = {
  data?: { cities?: string[] };
};

export default function HomeCityPicker({ className }: HomeCityPickerProps) {
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showList, setShowList] = useState(false);

  const storeCity = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setCity(trimmed);
    try {
      localStorage.setItem("bp-city", trimmed);
    } catch {
      // ignore
    }
  };

  const askCity = () => {
    setQuery(city ?? "");
    setShowList(false);
    setOpen(true);
  };

  const loadSuggestions = async (value: string) => {
    setFetching(true);
    try {
      const res = await fetch(`/api/v1/public/cities?query=${encodeURIComponent(value)}`);
      const payload = (await res.json().catch(() => null)) as CityResponse | null;
      const next = payload?.data?.cities ?? [];
      setSuggestions(next);
    } catch {
      setSuggestions([]);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const cached = (() => {
      try {
        return localStorage.getItem("bp-city");
      } catch {
        return null;
      }
    })();

    if (cached) {
      setCity(cached);
      setLoading(false);
      return;
    }

    const fetchByIp = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json().catch(() => null);
        const detected = data?.city || data?.region || "";
        if (detected && alive) {
          const listRes = await fetch(`/api/v1/public/cities?query=${encodeURIComponent(detected)}`);
          const listPayload = (await listRes.json().catch(() => null)) as CityResponse | null;
          const list = listPayload?.data?.cities ?? [];
          const exact = list.find((item) => item.toLowerCase() === detected.toLowerCase());
          if (exact) {
            storeCity(exact);
          }
        }
      } catch {
        // ignore
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchByIp();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      loadSuggestions(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, open]);

  const hintText = useMemo(() => {
    if (fetching) return "Ищем города…";
    if (suggestions.length === 0) return "Городов не найдено";
    return "Выберите из списка";
  }, [fetching, suggestions.length]);

  if (loading) {
    return (
      <div className={`rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-xs font-semibold text-[color:var(--bp-muted)] ${className ?? ""}`}>
        Определяем город…
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={askCity}
        className={`rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-2 text-xs font-semibold ${className ?? ""}`}
      >
        {city ?? "Выбрать город"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-5 shadow-[var(--bp-shadow)]">
            <div className="text-sm font-semibold">Выберите город</div>
            <div className="mt-2 text-xs text-[color:var(--bp-muted)]">{hintText}</div>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowList(true);
              }}
              onFocus={() => setShowList(true)}
              placeholder="Введите город"
              className="mt-3 h-11 w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 text-sm outline-none"
            />
            <div className="relative mt-3">
              {showList && suggestions.length > 0 ? (
                <div className="absolute z-10 w-full overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]">
                  <div className="max-h-64 overflow-y-auto py-1">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          storeCity(item);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-start px-4 py-2 text-sm text-[color:var(--bp-ink)] transition hover:bg-[color:var(--bp-panel)]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-xs font-semibold"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => {
                  if (query.trim()) storeCity(query);
                  setOpen(false);
                }}
                className="rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-white"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
