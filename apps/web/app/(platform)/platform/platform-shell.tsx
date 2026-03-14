"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type PlatformShellProps = {
  children: React.ReactNode;
  userEmail: string;
  permissions: string[];
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Обзор", href: "/platform", icon: <IconHome /> },
  {
    label: "Аккаунты",
    href: "/platform/accounts",
    icon: <IconUsers />,
    permission: "platform.accounts",
  },
  {
    label: "Тарифы",
    href: "/platform/plans",
    icon: <IconTag />,
    permission: "platform.plans",
  },
  {
    label: "Оплаты",
    href: "/platform/billing",
    icon: <IconWallet />,
    permission: "platform.plans",
  },
  {
    label: "Модерация",
    href: "/platform/moderation",
    icon: <IconShield />,
    permission: "platform.moderation",
  },
  {
    label: "Витрина",
    href: "/platform/marketplace",
    icon: <IconStar />,
    permission: "platform.settings",
  },
  {
    label: "Мониторинг",
    href: "/platform/monitoring",
    icon: <IconPulse />,
    permission: "platform.monitoring",
  },
  {
    label: "Аудит",
    href: "/platform/audit",
    icon: <IconFile />,
    permission: "platform.audit",
  },
  {
    label: "Настройки",
    href: "/platform/settings",
    icon: <IconSettings />,
    permission: "platform.settings",
  },
];

export default function PlatformShell({
  children,
  userEmail,
  permissions,
}: PlatformShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const initials = useMemo(() => {
    const base = userEmail?.split("@")[0] ?? "BS";
    return base.slice(0, 2).toUpperCase();
  }, [userEmail]);

  const visibleItems = useMemo(() => {
    if (permissions.includes("platform.all")) {
      return NAV_ITEMS;
    }
    return NAV_ITEMS.filter(
      (item) => !item.permission || permissions.includes(item.permission)
    );
  }, [permissions]);

  useEffect(() => {
    const stored = localStorage.getItem("bp-sidebar");
    setCollapsed(stored === "collapsed");
  }, []);

  useEffect(() => {
    localStorage.setItem("bp-sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  useEffect(() => {
    const stored = localStorage.getItem("bp-theme");
    setDarkMode(stored === "dark");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("bp-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/platform/login";
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]">
      <div
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[color:var(--bp-stroke)] bg-[color:var(--sidebar-bg)] shadow-[var(--bp-shadow)] transition-[transform,width] duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:fixed md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "w-[272px] md:w-[78px]" : "w-[272px]"}`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] text-xs font-semibold text-white">
              BS
            </div>
            {!collapsed && (
              <div>
                <div className="text-sm font-semibold leading-tight">
                  Beauty Spot
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  Точка красоты
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            title={collapsed ? "Развернуть меню" : "Свернуть меню"}
            onClick={() => setCollapsed((prev) => !prev)}
            className="hidden h-9 w-9 items-center justify-center text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] md:flex"
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          <div className="flex flex-col gap-1">
            {visibleItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/platform" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`group flex w-full items-center rounded-2xl text-sm font-medium transition hover:bg-[color:var(--sidebar-item)] ${
                    collapsed
                      ? "justify-start px-3 py-2 md:justify-center md:px-2 md:py-2"
                      : "px-3 py-2"
                  } ${
                    isActive
                      ? "bg-[color:var(--sidebar-item-active)] text-[color:var(--bp-ink)]"
                      : "text-[color:var(--bp-muted)]"
                  }`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[color:inherit]">
                    {item.icon}
                  </span>
                  <span
                    className={`whitespace-nowrap transition-all duration-200 ${
                      collapsed
                        ? "opacity-100 translate-x-0 md:pointer-events-none md:w-0 md:overflow-hidden md:opacity-0 md:-translate-x-1"
                        : "opacity-100 translate-x-0"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-[color:var(--bp-stroke)] px-3 py-4">
          <div
            className={`mb-3 flex items-center gap-3 px-2 py-1 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bp-chip)] text-xs font-semibold">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-xs text-[color:var(--bp-muted)]">
                  {userEmail}
                </div>
                <div className="text-xs text-[color:var(--bp-muted)]">
                  Администратор
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center rounded-2xl text-sm font-medium text-[color:var(--bp-muted)] transition hover:bg-[color:var(--sidebar-item)] hover:text-[color:var(--bp-ink)] ${
              collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
            }`}
            title={collapsed ? "Выйти" : undefined}
            aria-label="Выйти"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl">
              <IconLogout />
            </span>
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                collapsed
                  ? "pointer-events-none w-0 overflow-hidden opacity-0 -translate-x-1"
                  : "opacity-100 translate-x-0"
              }`}
            >
              Выйти
            </span>
          </button>
        </div>
      </aside>

      <div
        className={`flex min-h-screen flex-1 flex-col ${
          collapsed ? "md:pl-[78px]" : "md:pl-[272px]"
        }`}
      >
        <header
          className={`fixed top-0 z-30 flex h-16 items-center border-b border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/90 px-4 shadow-[var(--bp-shadow)] backdrop-blur-[var(--glass-blur)] sm:px-6 ${
            collapsed ? "md:left-[78px]" : "md:left-[272px]"
          } left-0 right-0`}
        >
          <button
            type="button"
            aria-label="Открыть меню"
            title="Открыть меню"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] md:hidden"
          >
            <IconMenu />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Поиск"
              title="Поиск"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] md:hidden"
            >
              <IconSearch />
            </button>
            <div className="relative hidden md:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--bp-muted)]">
                <IconSearch />
              </span>
              <input
                type="search"
                placeholder="Поиск по системе"
                className="h-10 w-[260px] rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--input-bg)] pl-9 pr-3 text-sm text-[color:var(--bp-ink)] outline-none transition focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              />
            </div>
            <button
              type="button"
              aria-label="Уведомления"
              title="Уведомления"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)]"
            >
              <IconBell />
            </button>
            <button
              type="button"
              aria-label="Переключить тему"
              title="Переключить тему"
              onClick={() => setDarkMode((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)] text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)]"
            >
              {darkMode ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>

        <main className="flex-1 mt-16 px-4 pb-6 pt-6 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function IconBase({
  children,
  className = "h-5 w-5",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} shrink-0`}
    >
      {children}
    </svg>
  );
}

function IconHome() {
  return (
    <IconBase>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </IconBase>
  );
}

function IconUsers() {
  return (
    <IconBase>
      <path d="M7.5 14a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 7.5 14Z" />
      <path d="M2 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16.5 14a3 3 0 1 0-3-3" />
      <path d="M14 20a4 4 0 0 1 7 0" />
    </IconBase>
  );
}

function IconTag() {
  return (
    <IconBase>
      <path d="M3 12l9 9 9-9-9-9H5a2 2 0 0 0-2 2Z" />
      <circle cx="8" cy="8" r="1.5" />
    </IconBase>
  );
}

function IconWallet() {
  return (
    <IconBase>
      <path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M4 7a2 2 0 0 1 2-2h10" />
      <path d="M16 13h4" />
      <circle cx="16" cy="13" r="1" />
    </IconBase>
  );
}

function IconShield() {
  return (
    <IconBase>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6Z" />
      <path d="M9 12l2 2 4-4" />
    </IconBase>
  );
}

function IconPulse() {
  return (
    <IconBase>
      <path d="M3 12h4l2-5 4 10 2-5h4" />
    </IconBase>
  );
}

function IconFile() {
  return (
    <IconBase>
      <path d="M6 3h7l5 5v13H6Z" />
      <path d="M13 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </IconBase>
  );
}

function IconSettings() {
  return (
    <IconBase>
      <path d="M12 8.5a3.5 3.5 0 1 0 3.5 3.5A3.5 3.5 0 0 0 12 8.5Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V22a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H2a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V2a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H22a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
    </IconBase>
  );
}

function IconStar() {
  return (
    <IconBase>
      <path d="M12 3.5l2.7 5.4 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6-4.3-4.2 6-.9Z" />
    </IconBase>
  );
}

function IconChevronLeft() {
  return (
    <IconBase>
      <path d="M15 6l-6 6 6 6" />
    </IconBase>
  );
}

function IconChevronRight() {
  return (
    <IconBase>
      <path d="M9 6l6 6-6 6" />
    </IconBase>
  );
}

function IconBell() {
  return (
    <IconBase>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </IconBase>
  );
}

function IconMoon() {
  return (
    <IconBase>
      <path d="M21 12.8A8.2 8.2 0 1 1 11.2 3a6.2 6.2 0 0 0 9.8 9.8Z" />
    </IconBase>
  );
}

function IconSun() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.9 19.1l1.4-1.4" />
      <path d="M17.7 6.3l1.4-1.4" />
    </IconBase>
  );
}

function IconLogout() {
  return (
    <IconBase>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </IconBase>
  );
}

function IconSearch() {
  return (
    <IconBase className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </IconBase>
  );
}

function IconMenu() {
  return (
    <IconBase>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  );
}
