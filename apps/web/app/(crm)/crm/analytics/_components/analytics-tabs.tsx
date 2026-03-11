import Link from "next/link";

type AnalyticsTabsProps = {
  active: "overview" | "aisha" | "online-booking";
};

export function AnalyticsTabs({ active }: AnalyticsTabsProps) {
  const base = "rounded-xl border px-3 py-2 text-sm transition";
  const activeCls =
    "border-[color:var(--bp-accent)] bg-[color:var(--bp-soft)] text-[color:var(--bp-ink)]";
  const idleCls =
    "border-[color:var(--bp-stroke)] text-[color:var(--bp-muted)] hover:border-[color:var(--bp-accent)] hover:text-[color:var(--bp-ink)]";

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/crm/analytics" className={`${base} ${active === "overview" ? activeCls : idleCls}`}>
        Общая аналитика
      </Link>
      <Link href="/crm/analytics/aisha" className={`${base} ${active === "aisha" ? activeCls : idleCls}`}>
        Аналитика Аиши
      </Link>
      <Link
        href="/crm/analytics/online-booking"
        className={`${base} ${active === "online-booking" ? activeCls : idleCls}`}
      >
        Онлайн-запись
      </Link>
    </div>
  );
}
