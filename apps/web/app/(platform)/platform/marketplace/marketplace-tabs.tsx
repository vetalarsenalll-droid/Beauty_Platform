"use client";

import { useState } from "react";

type MarketplaceTabsProps = {
  hero: React.ReactNode;
  categories: React.ReactNode;
};

export default function MarketplaceTabs({ hero, categories }: MarketplaceTabsProps) {
  const [active, setActive] = useState<"hero" | "categories">("hero");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] p-2">
        <button
          type="button"
          onClick={() => setActive("hero")}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            active === "hero"
              ? "bg-white text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]"
              : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
          }`}
        >
          Витрина
        </button>
        <button
          type="button"
          onClick={() => setActive("categories")}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            active === "categories"
              ? "bg-white text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]"
              : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
          }`}
        >
          Категории
        </button>
      </div>

      {active === "hero" ? hero : categories}
    </div>
  );
}
