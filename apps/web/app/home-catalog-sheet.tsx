"use client";

import { useEffect, useMemo, useState } from "react";
import HomeSearchBar from "./home-search-bar";

type CatalogCategory = {
  key: string;
  label: string;
  imageUrl?: string | null;
};

type HomeCatalogSheetProps = {
  categories: CatalogCategory[];
};

const chunk = <T,>(items: T[], size: number) => {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export default function HomeCatalogSheet({ categories }: HomeCatalogSheetProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const columns = useMemo(() => {
    const base = categories.length > 12 ? 3 : 2;
    const perColumn = Math.ceil(categories.length / base);
    return chunk(categories, perColumn);
  }, [categories]);

  const featured = useMemo(() => categories.slice(0, 3), [categories]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-xs font-semibold text-white shadow-[var(--bp-shadow)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
        >
          <path
            fill="none"
            stroke="#ffffff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M8.557 2.75H4.682A1.932 1.932 0 0 0 2.75 4.682v3.875a1.942 1.942 0 0 0 1.932 1.942h3.875a1.942 1.942 0 0 0 1.942-1.942V4.682A1.942 1.942 0 0 0 8.557 2.75m10.761 0h-3.875a1.942 1.942 0 0 0-1.942 1.932v3.875a1.943 1.943 0 0 0 1.942 1.942h3.875a1.942 1.942 0 0 0 1.932-1.942V4.682a1.932 1.932 0 0 0-1.932-1.932m0 10.75h-3.875a1.942 1.942 0 0 0-1.942 1.933v3.875a1.942 1.942 0 0 0 1.942 1.942h3.875a1.942 1.942 0 0 0 1.932-1.942v-3.875a1.932 1.932 0 0 0-1.932-1.932M8.557 13.5H4.682a1.943 1.943 0 0 0-1.932 1.943v3.875a1.932 1.932 0 0 0 1.932 1.932h3.875a1.942 1.942 0 0 0 1.942-1.932v-3.875a1.942 1.942 0 0 0-1.942-1.942"
          />
        </svg>
        Каталог
      </button>

      {open ? (
        <div className="fixed inset-0 z-[120]">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-1/2 top-10 w-[min(1200px,92vw)] -translate-x-1/2 rounded-[30px] border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]">
            <div className="flex items-center justify-between px-8 pb-5 pt-6">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--bp-muted)]">
                  Каталог
                </div>
                <div className="text-xl font-semibold">Бьюти‑услуги и специалисты</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-xs font-semibold"
              >
                Закрыть
              </button>
            </div>

            <div className="px-8 pb-8">
              <HomeSearchBar />

              <div className="mt-6 grid gap-6 lg:grid-cols-[2.2fr_1fr]">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {columns.map((group, index) => (
                    <div key={`col-${index}`} className="space-y-2">
                      {group.map((category) => (
                        <a
                          key={category.key}
                          href={`/?category=${encodeURIComponent(category.key)}`}
                          className="group flex items-center gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel,rgba(0,0,0,0.02))] px-3 py-2 text-sm transition hover:border-[color:var(--bp-accent)]"
                        >
                          <div
                            className="h-10 w-10 flex-shrink-0 rounded-xl bg-cover bg-center"
                            style={{
                              backgroundImage: category.imageUrl
                                ? `url(${category.imageUrl})`
                                : "linear-gradient(135deg, #f3f4f6, #e5e7eb)",
                            }}
                          />
                          <span className="font-medium text-[color:var(--bp-ink)]">
                            {category.label}
                          </span>
                        </a>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="rounded-[26px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel,rgba(0,0,0,0.02))] p-5">
                    <div className="text-xs uppercase tracking-[0.25em] text-[color:var(--bp-muted)]">
                      Быстрые действия
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                      <a href="/?collection=ai" className="block rounded-xl bg-white px-4 py-3 shadow-[var(--bp-shadow)]">
                        AI‑подбор услуги
                      </a>
                      <a href="/?collection=top" className="block rounded-xl bg-white px-4 py-3 shadow-[var(--bp-shadow)]">
                        Топ‑специалисты недели
                      </a>
                      <a href="/?collection=nearby" className="block rounded-xl bg-white px-4 py-3 shadow-[var(--bp-shadow)]">
                        Онлайн‑запись рядом
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-[0.25em] text-[color:var(--bp-muted)]">
                      Подборки
                    </div>
                    {featured.map((category) => (
                      <a
                        key={`featured-${category.key}`}
                        href={`/?category=${encodeURIComponent(category.key)}`}
                        className="group relative flex h-24 items-end overflow-hidden rounded-2xl border border-[color:var(--bp-stroke)] bg-black/40 p-4 text-sm font-semibold text-white"
                      >
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105"
                          style={{
                            backgroundImage: category.imageUrl
                              ? `url(${category.imageUrl})`
                              : "linear-gradient(135deg, #111827, #374151)",
                          }}
                        />
                        <div className="absolute inset-0 bg-black/35" />
                        <span className="relative z-10">{category.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
