"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  permission?: string;
};

const navItems: NavItem[] = [
  { href: "/platform", label: "Обзор" },
  {
    href: "/platform/accounts",
    label: "Аккаунты",
    permission: "platform.accounts",
  },
  { href: "/platform/plans", label: "Тарифы", permission: "platform.plans" },
  {
    href: "/platform/moderation",
    label: "Модерация",
    permission: "platform.moderation",
  },
  {
    href: "/platform/monitoring",
    label: "Мониторинг",
    permission: "platform.monitoring",
  },
  { href: "/platform/audit", label: "Аудит", permission: "platform.audit" },
  {
    href: "/platform/settings",
    label: "Настройки",
    permission: "platform.settings",
  },
];

type PlatformShellProps = {
  userEmail: string;
  permissions: string[];
  children: React.ReactNode;
};

export default function PlatformShell({
  userEmail,
  permissions,
  children,
}: PlatformShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const visibleNav = useMemo(() => {
    return navItems.filter((item) => {
      if (!item.permission) return true;
      return (
        permissions.includes("platform.all") ||
        permissions.includes(item.permission)
      );
    });
  }, [permissions]);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.href = "/platform/login";
  };

  const isActive = (href: string) => {
    if (href === "/platform") return pathname === "/platform";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen text-[color:var(--bp-ink)]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[auto_1fr]">
        <aside
          className={`${
            collapsed ? "w-20" : "w-64"
          } hidden rounded-[var(--bp-radius-lg)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)] transition-all lg:block`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Платформа
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-xs text-[color:var(--bp-muted)] transition hover:bg-[color:var(--bp-surface)]"
              aria-label="Свернуть меню"
            >
              {collapsed ? "›" : "‹"}
            </button>
          </div>
          <h1
            className={`mt-2 text-lg font-semibold ${
              collapsed ? "hidden" : "block"
            }`}
          >
            Beauty Platform
          </h1>
          <p
            className={`mt-1 text-xs text-[color:var(--bp-muted)] ${
              collapsed ? "hidden" : "block"
            }`}
          >
            {userEmail}
          </p>
          <nav className="mt-6 flex flex-col gap-2 text-sm font-medium text-[color:var(--bp-muted)]">
            {visibleNav.map((item) => {
              const active = isActive(item.href);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`rounded-2xl border border-transparent px-3 py-2 transition hover:border-[color:var(--bp-stroke)] hover:bg-[color:var(--bp-surface)] ${
                    active
                      ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]"
                      : ""
                  } ${collapsed ? "text-xs" : ""}`}
                  title={collapsed ? item.label : undefined}
                >
                  {collapsed ? item.label[0] : item.label}
                </a>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold text-[color:var(--bp-muted)] transition hover:bg-[color:var(--bp-surface)] ${
              collapsed ? "hidden" : ""
            }`}
          >
            Выйти
          </button>
        </aside>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-[var(--bp-radius-lg)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 shadow-[var(--bp-shadow)] lg:hidden">
            <div className="text-sm font-semibold">Платформа</div>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs text-[color:var(--bp-muted)] transition hover:bg-[color:var(--bp-surface)]"
            >
              Меню
            </button>
          </div>

          <div className="rounded-[var(--bp-radius-lg)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                  Панель управления
                </div>
                <div className="text-lg font-semibold">Platform Admin</div>
              </div>
              <div className="flex flex-1 items-center justify-end gap-3">
                <input
                  type="search"
                  placeholder="Поиск по разделам"
                  className="hidden w-64 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--bp-accent)] sm:block"
                />
                <button
                  type="button"
                  className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-[color:var(--bp-muted)] transition hover:bg-[color:var(--bp-surface)]"
                >
                  {userEmail}
                </button>
              </div>
            </div>
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden">
          <div className="m-4 rounded-[var(--bp-radius-lg)] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Платформа</div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1 text-xs text-[color:var(--bp-muted)] transition hover:bg-[color:var(--bp-surface)]"
              >
                Закрыть
              </button>
            </div>
            <nav className="mt-4 flex flex-col gap-2 text-sm font-medium text-[color:var(--bp-muted)]">
              {visibleNav.map((item) => {
                const active = isActive(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`rounded-2xl border border-transparent px-3 py-2 transition hover:border-[color:var(--bp-stroke)] hover:bg-[color:var(--bp-surface)] ${
                      active
                        ? "border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]"
                        : ""
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-3 py-2 text-xs font-semibold text-[color:var(--bp-muted)] transition hover:bg-[color:var(--bp-surface)]"
            >
              Выйти
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
