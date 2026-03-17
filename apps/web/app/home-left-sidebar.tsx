"use client";

import Link from "next/link";
import { useState } from "react";
import HomeSearchBar from "./home-search-bar";

type SidebarKey =
  | "collection"
  | "catalog"
  | "promos"
  | "map"
  | "favorites"
  | "records";

const NAV_ITEMS: Array<{ key: SidebarKey; label: string; href: string }> = [
  { key: "collection", label: "Подборка", href: "/" },
  { key: "catalog", label: "Каталог", href: "/catalog" },
  { key: "promos", label: "Акции", href: "/promos" },
  { key: "map", label: "На карте", href: "/map" },
  { key: "favorites", label: "Избранное", href: "/favorites" },
  { key: "records", label: "Мои записи", href: "/records" },
];

type HomeLeftSidebarProps = {
  active: SidebarKey;
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

export default function HomeLeftSidebar({ active }: HomeLeftSidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const isCollapsed = searchOpen;

  return (
    <aside
      className={`fixed left-6 top-6 z-30 hidden md:block ${
        isCollapsed ? "w-[80px]" : "w-[220px]"
      }`}
    >
      <div className="flex max-h-[calc(100vh-48px)] flex-col gap-6 overflow-auto rounded-[28px] bg-transparent px-2 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] text-[11px] font-semibold text-white">
            BP
          </div>
          <div className={`${isCollapsed ? "hidden" : "text-sm font-semibold"}`}>
            Beauty Platform
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={`flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[color:var(--bp-muted)] shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:bg-[color:var(--bp-accent)]/10 ${
            isCollapsed ? "justify-center px-2" : ""
          }`}
        >
          <Search size="18" />
          <span className={`${isCollapsed ? "hidden" : ""}`}>Поиск</span>
        </button>

        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[color:var(--bp-accent)]/10 text-[color:var(--bp-accent)]"
                    : "text-[color:var(--bp-ink)] hover:bg-[color:var(--bp-accent)]/10"
                } ${isCollapsed ? "justify-center" : ""}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--bp-ink)]/50" />
                </span>
                <span className={`${isCollapsed ? "hidden" : ""}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div
            className={`text-xs text-[color:var(--bp-muted)] ${
              isCollapsed ? "hidden" : ""
            }`}
          >
            Войдите, чтобы видеть записи и избранное.
          </div>
          <Link
            href="/c"
            className={`rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-center text-xs font-semibold text-white ${
              isCollapsed ? "px-0" : ""
            }`}
          >
            {isCollapsed ? "BP" : "Личный кабинет"}
          </Link>
        </div>
      </div>

      {searchOpen ? (
        <div className="fixed left-[120px] top-0 z-40 hidden h-screen w-[360px] md:block">
          <div className="flex h-full flex-col gap-4 overflow-visible rounded-[0px] border-r border-[color:var(--bp-stroke)] bg-white px-6 pb-8 pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Поиск</div>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-xl px-2 py-1 text-xs text-[color:var(--bp-muted)] hover:bg-[color:var(--bp-accent)]/10"
              >
                Закрыть
              </button>
            </div>
            <HomeSearchBar
              className="h-11 w-full rounded-full bg-[color:var(--bp-paper)]"
              placeholder="Поиск"
              resultsMode="dropdown"
              bordered
              grow={false}
            />
          </div>
        </div>
      ) : null}
    </aside>
  );
}
