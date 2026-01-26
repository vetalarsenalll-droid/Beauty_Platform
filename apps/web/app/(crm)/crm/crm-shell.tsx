"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import { useEffect, useMemo, useRef, useState } from "react";



type CrmShellProps = {

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

  { label: "Dashboard", href: "/crm", icon: <IconHome /> },

  {
    label: "Локации",
    href: "/crm/locations",
    icon: <IconMapPin />,
    permission: "crm.locations.read",
  },
  {
    label: "Услуги",
    href: "/crm/services",
    icon: <IconScissors />,
    permission: "crm.services.read",
  },
  {
    label: "Архив",
    href: "/crm/archive",
    icon: <IconArchive />,
    permission: "crm.locations.read",
  },
  {
    label: "График работы",
    href: "/crm/schedule",
    icon: <IconCalendar />,
    permission: "crm.schedule.read",
  },
  {
    label: "Журнал записи",
    href: "/crm/calendar",
    icon: <IconGrid />,
    permission: "crm.calendar.read",
  },
  {
    label: "Клиенты",
    href: "/crm/clients",
    icon: <IconUser />,
    permission: "crm.clients.read",
  },
  {
    label: "Оплаты/Финансы",
    href: "/crm/payments",
    icon: <IconWallet />,
    permission: "crm.payments.read",
  },
  {
    label: "Промо/Скидки",
    href: "/crm/promos",
    icon: <IconTag />,
    permission: "crm.promos.read",
  },
  {
    label: "Лояльность",
    href: "/crm/loyalty",
    icon: <IconHeart />,
    permission: "crm.loyalty.read",
  },
  {
    label: "Аналитика",
    href: "/crm/analytics",
    icon: <IconPulse />,
    permission: "crm.analytics.read",
  },
  {
    label: "Настройки",
    href: "/crm/settings",
    icon: <IconSettings />,
    permission: "crm.settings.read",
  },
];



const STAFF_ITEMS: NavItem[] = [

  {
    label: "Специалисты",
    href: "/crm/specialists",
    icon: <IconUsers />,
    permission: "crm.specialists.read",
  },
  {
    label: "Менеджеры",
    href: "/crm/managers",
    icon: <IconUser />,
    permission: "crm.specialists.read",
  },
];


export default function CrmShell({

  children,

  userEmail,

  permissions,

}: CrmShellProps) {

  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);

  const [mobileOpen, setMobileOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(false);

  const [staffOpen, setStaffOpen] = useState(() =>

    pathname.startsWith("/crm/specialists") || pathname.startsWith("/crm/managers")

  );

  const [staffHover, setStaffHover] = useState(false);

  const [staffFlyoutTop, setStaffFlyoutTop] = useState(0);

  const staffButtonRef = useRef<HTMLButtonElement | null>(null);

  const staffHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveCollapsed = collapsed && !mobileOpen;
  const isSchedulePage =
    pathname.startsWith("/crm/schedule") || pathname.startsWith("/crm/calendar");



  const initials = useMemo(() => {

    const base = userEmail?.split("@")[0] ?? "CRM";

    return base.slice(0, 2).toUpperCase();

  }, [userEmail]);



  const visibleItems = useMemo(() => {

    if (permissions.includes("crm.all")) {

      return NAV_ITEMS;

    }

    return NAV_ITEMS.filter(

      (item) => !item.permission || permissions.includes(item.permission)

    );

  }, [permissions]);



  const visibleStaffItems = useMemo(() => {

    if (permissions.includes("crm.all")) {

      return STAFF_ITEMS;

    }

    return STAFF_ITEMS.filter(

      (item) => !item.permission || permissions.includes(item.permission)

    );

  }, [permissions]);



  const [beforeStaffItems, afterStaffItems] = useMemo(() => {

    const insertAfterHref = "/crm/services";

    const index = visibleItems.findIndex((item) => item.href === insertAfterHref);

    if (index == -1) {

      return [visibleItems, []];

    }

    return [visibleItems.slice(0, index + 1), visibleItems.slice(index + 1)];

  }, [visibleItems]);





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



  useEffect(() => {

    if (pathname.startsWith("/crm/specialists") || pathname.startsWith("/crm/managers")) {

      setStaffOpen(true);

    }

  }, [pathname]);



  useEffect(() => {

    if (!effectiveCollapsed) {

      setStaffHover(false);

    }

  }, [effectiveCollapsed]);



  const handleLogout = async () => {

    try {

      await fetch("/api/v1/crm/auth/logout", { method: "POST" });

    } finally {

      window.location.href = "/crm/login";

    }

  };



  const handleStaffEnter = () => {

    if (!effectiveCollapsed) return;

    if (staffHoverTimeoutRef.current) {

      clearTimeout(staffHoverTimeoutRef.current);

      staffHoverTimeoutRef.current = null;

    }

    setStaffHover(true);

    const rect = staffButtonRef.current?.getBoundingClientRect();

    if (rect) {

      setStaffFlyoutTop(rect.top);

    }

  };



  const handleStaffLeave = () => {

    if (!effectiveCollapsed) return;

    if (staffHoverTimeoutRef.current) {

      clearTimeout(staffHoverTimeoutRef.current);

    }

    staffHoverTimeoutRef.current = setTimeout(() => {

      setStaffHover(false);

      staffHoverTimeoutRef.current = null;

    }, 250);

  };



  return (

    <div className="flex min-h-screen w-full overflow-x-visible bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]">

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

        } ${effectiveCollapsed ? "w-[272px] md:w-[78px]" : "w-[272px]"}`}

      >

        <div className="flex h-16 items-center justify-between px-4">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] text-xs font-semibold text-white">

              BS

            </div>

            {!effectiveCollapsed && (

              <div>

                <div className="text-sm font-semibold leading-tight">

                  Beauty Spot

                </div>

                <div className="text-xs text-[color:var(--bp-muted)]">

                  CRM Business

                </div>

              </div>

            )}

          </div>

          <button
            type="button"
            aria-label={effectiveCollapsed ? "Развернуть меню" : "Свернуть меню"}
            title={effectiveCollapsed ? "Развернуть меню" : "Свернуть меню"}
            onClick={() => setCollapsed((prev) => !prev)}
            className="hidden h-9 w-9 items-center justify-center text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] md:flex"
          >

            {effectiveCollapsed ? <IconChevronRight /> : <IconChevronLeft />}

          </button>

        </div>



        <nav className="flex-1 overflow-y-auto overflow-x-visible px-3 pb-4 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

          <div className="flex flex-col gap-1">

            {beforeStaffItems.map((item) => {

              const isActive =

                pathname === item.href ||

                (item.href !== "/crm" && pathname.startsWith(item.href));

              return (

                <Link

                  key={item.href}

                  href={item.href}

                  title={effectiveCollapsed ? item.label : undefined}

                  aria-label={item.label}

                  className={`group flex w-full items-center rounded-2xl text-sm font-medium transition hover:bg-[color:var(--sidebar-item)] ${

                    effectiveCollapsed

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

                      effectiveCollapsed

                        ? "opacity-100 translate-x-0 md:pointer-events-none md:w-0 md:overflow-hidden md:opacity-0 md:-translate-x-1"

                        : "opacity-100 translate-x-0"

                    }`}

                  >

                    {item.label}

                  </span>

                </Link>

              );

            })}

            {visibleStaffItems.length > 0 ? (

              <div

                className="mt-2 relative"

                onMouseEnter={handleStaffEnter}

                onMouseLeave={handleStaffLeave}

              >

                <button

                  type="button"

                  onClick={() => setStaffOpen((prev) => !prev)}

                  aria-expanded={staffOpen}

                  ref={staffButtonRef}

                  className={`flex w-full items-center rounded-2xl text-sm font-medium transition hover:bg-[color:var(--sidebar-item)] ${

                    effectiveCollapsed

                      ? "justify-start px-3 py-2 md:justify-center md:px-2 md:py-2"

                      : "px-3 py-2"

                  } ${

                    pathname.startsWith("/crm/specialists") ||

                    pathname.startsWith("/crm/managers")

                      ? "bg-[color:var(--sidebar-item-active)] text-[color:var(--bp-ink)]"

                      : "text-[color:var(--bp-muted)]"

                  }`}

                >

                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[color:inherit]">

                    <IconUsers />

                  </span>

                  <span

                    className={`whitespace-nowrap transition-all duration-200 ${

                      effectiveCollapsed

                        ? "opacity-100 translate-x-0 md:pointer-events-none md:w-0 md:overflow-hidden md:opacity-0 md:-translate-x-1"

                        : "opacity-100 translate-x-0"

                    }`}

                  >

                    Сотрудники

                  </span>

                  <span

                    className={`ml-auto hidden text-xs text-[color:var(--bp-muted)] transition ${

                      effectiveCollapsed ? "hidden" : "md:block"

                    }`}

                  >

                    {staffOpen ? "-" : "+"}

                  </span>

                </button>

                {effectiveCollapsed ? (

                  <div

                    className={`fixed left-[88px] z-50 w-52 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/95 p-2 text-sm text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)] backdrop-blur-[var(--glass-blur)] transition ${

                      staffHover ? "opacity-100" : "pointer-events-none opacity-0"

                    }`}

                    style={{ top: staffFlyoutTop }}

                  >

                    <div className="px-2 pb-2 text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">

                      Сотрудники

                    </div>

                    <div className="flex flex-col gap-1">

                      {visibleStaffItems.map((item) => {

                        const isActive =

                          pathname === item.href ||

                          (item.href !== "/crm" &&

                            pathname.startsWith(item.href));

                        return (

                          <Link

                            key={item.href}

                            href={item.href}

                            aria-label={item.label}

                            className={`flex items-center rounded-2xl px-3 py-2 text-sm font-medium transition hover:bg-[color:var(--sidebar-item)] ${

                              isActive

                                ? "bg-[color:var(--sidebar-item-active)] text-[color:var(--bp-ink)]"

                                : "text-[color:var(--bp-muted)]"

                            }`}

                          >

                            {item.label}

                          </Link>

                        );

                      })}

                    </div>

                  </div>

                ) : null}

                {!effectiveCollapsed ? (

                  <div className={`mt-1 flex flex-col gap-1 pl-7 ${staffOpen ? "" : "hidden"}`}>

                    {visibleStaffItems.map((item) => {

                      const isActive =

                        pathname === item.href ||

                        (item.href !== "/crm" && pathname.startsWith(item.href));

                      return (

                        <Link

                          key={item.href}

                          href={item.href}

                          aria-label={item.label}

                          className={`group flex w-full items-center rounded-2xl px-3 py-2 text-sm font-medium transition hover:bg-[color:var(--sidebar-item)] ${

                            isActive

                              ? "bg-[color:var(--sidebar-item-active)] text-[color:var(--bp-ink)]"

                              : "text-[color:var(--bp-muted)]"

                          }`}

                        >

                          <span className="mr-2 inline-flex h-2 w-2 items-center justify-center rounded-full bg-[color:var(--bp-muted)]/40" />

                          <span className="whitespace-nowrap">{item.label}</span>

                        </Link>

                      );

                    })}

                  </div>

                ) : null}

              </div>

            ) : null}

            {afterStaffItems.map((item) => {

              const isActive =

                pathname === item.href ||

                (item.href !== "/crm" && pathname.startsWith(item.href));

              return (

                <Link

                  key={item.href}

                  href={item.href}

                  title={effectiveCollapsed ? item.label : undefined}

                  aria-label={item.label}

                  className={`group flex w-full items-center rounded-2xl text-sm font-medium transition hover:bg-[color:var(--sidebar-item)] ${

                    effectiveCollapsed

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

                      effectiveCollapsed

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

              effectiveCollapsed ? "justify-center" : ""

            }`}

          >

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--bp-chip)] text-xs font-semibold">

              {initials}

            </div>

            {!effectiveCollapsed && (

              <div className="min-w-0">

                <div className="truncate text-xs text-[color:var(--bp-muted)]">

                  {userEmail}

                </div>

                <div className="text-xs text-[color:var(--bp-muted)]">

                  CRM оператор

                </div>

              </div>

            )}

          </div>

          <button

            type="button"

            onClick={handleLogout}

            className={`flex w-full items-center rounded-2xl text-sm font-medium text-[color:var(--bp-muted)] transition hover:bg-[color:var(--sidebar-item)] hover:text-[color:var(--bp-ink)] ${

              effectiveCollapsed ? "justify-center px-2 py-2" : "px-3 py-2"

            }`}

            title={effectiveCollapsed ? "Выйти" : undefined}
            aria-label="Выйти"

          >

            <span className="flex h-9 w-9 items-center justify-center rounded-xl">

              <IconLogout />

            </span>

            <span

              className={`whitespace-nowrap transition-all duration-200 ${

                effectiveCollapsed

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

        className={`flex min-h-screen flex-1 flex-col overflow-x-hidden ${

          effectiveCollapsed ? "md:pl-[78px]" : "md:pl-[272px]"

        }`}

      >

        <header

          className={`fixed top-0 z-30 flex h-16 items-center border-b border-[color:var(--bp-stroke)] bg-[color:var(--bp-panel)]/90 px-4 shadow-[var(--bp-shadow)] backdrop-blur-[var(--glass-blur)] sm:px-6 ${

            effectiveCollapsed ? "md:left-[78px]" : "md:left-[272px]"

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
                placeholder="Поиск по CRM"
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

          <div
            className={`mx-auto flex w-full flex-col ${
              isSchedulePage ? "max-w-none" : "max-w-[1240px]"
            }`}
          >

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



function IconUser() {

  return (

    <IconBase>

      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />

      <path d="M4 20a8 8 0 0 1 16 0" />

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



function IconArchive() {

  return (

    <IconBase>

      <path d="M4.5 6.5h15" />

      <path d="M6.5 6.5v8.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5" />

      <path d="M9.5 9.5h5" />

      <path d="M6 6.5l.8-2.5h10.4l.8 2.5" />

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



function IconPulse() {

  return (

    <IconBase>

      <path d="M3 12h4l2-5 4 10 2-5h4" />

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



function IconMenu() {

  return (

    <IconBase>

      <path d="M4 6h16" />

      <path d="M4 12h16" />

      <path d="M4 18h16" />

    </IconBase>

  );

}



function IconSearch() {

  return (

    <IconBase>

      <circle cx="11" cy="11" r="6" />

      <path d="M20 20l-3.5-3.5" />

    </IconBase>

  );

}



function IconBell() {

  return (

    <IconBase>

      <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />

      <path d="M6 17h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v5Z" />

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



function IconMoon() {

  return (

    <IconBase>

      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z" />

    </IconBase>

  );

}



function IconMapPin() {

  return (

    <IconBase>

      <path d="M12 21s6-6.2 6-11a6 6 0 1 0-12 0c0 4.8 6 11 6 11Z" />

      <circle cx="12" cy="10" r="2.5" />

    </IconBase>

  );

}



function IconScissors() {

  return (

    <IconBase>

      <circle cx="6" cy="6" r="2.5" />

      <circle cx="6" cy="18" r="2.5" />

      <path d="M8 8l12 8" />

      <path d="M8 16l6-4" />

    </IconBase>

  );

}



function IconCalendar() {

  return (

    <IconBase>

      <rect x="3" y="5" width="18" height="16" rx="2" />

      <path d="M8 3v4" />

      <path d="M16 3v4" />

      <path d="M3 10h18" />

    </IconBase>

  );

}



function IconGrid() {

  return (

    <IconBase>

      <rect x="4" y="4" width="7" height="7" rx="1.5" />

      <rect x="13" y="4" width="7" height="7" rx="1.5" />

      <rect x="4" y="13" width="7" height="7" rx="1.5" />

      <rect x="13" y="13" width="7" height="7" rx="1.5" />

    </IconBase>

  );

}



function IconHeart() {

  return (

    <IconBase>

      <path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.7-7 9-7 9Z" />

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

