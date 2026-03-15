"use client";

import Link from "next/link";
import HomeCityPicker from "./home-city-picker";
import HomeSearchBar from "./home-search-bar";

export default function HomeMarketplaceHeader() {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] text-sm font-semibold text-white">
            BP
          </div>
          <div>
            <div className="text-lg font-semibold">Beauty Platform</div>
            <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--bp-muted)]">
              marketplace
            </div>
          </div>
        </div>
        <HomeCityPicker />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <HomeSearchBar />
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)]"
          aria-label="Избранное"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
          >
            <path
              fill="none"
              stroke="#000000"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M12 7.23c-1.733-3.924-5.764-4.273-7.641-2.562c-1.529 1.373-2.263 4.665-.867 7.695C5.9 17.573 12 20.309 12 20.309s6.101-2.736 8.508-7.946c1.396-3.03.662-6.322-.867-7.695C17.764 2.957 13.733 3.306 12 7.229"
            />
          </svg>
        </button>
        <Link
          href="/c"
          className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-xs font-semibold text-white shadow-[var(--bp-shadow)]"
        >
          Личный кабинет
        </Link>
      </div>
    </header>
  );
}
