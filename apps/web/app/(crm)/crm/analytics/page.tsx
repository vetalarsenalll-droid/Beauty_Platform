import { requireCrmPermission } from "@/lib/auth";
import { AnalyticsTabs } from "./_components/analytics-tabs";

export default async function CrmAnalyticsPage() {
  await requireCrmPermission("crm.analytics.read");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Раздел аналитики</p>
        <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
        <p className="text-[color:var(--bp-muted)]">
          Выберите нужную вкладку. В этом разделе собирается аналитика по бизнесу и по AI-ассистенту.
        </p>
        <AnalyticsTabs active="overview" />
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Общая аналитика</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Здесь будет агрегированная аналитика по бизнесу: загрузка, выручка, повторные визиты, средний чек и
            каналы привлечения.
          </p>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Аналитика Аиши</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Отдельная вкладка с диалогами, жалобами, качеством распознавания и конверсией ассистента в запись.
          </p>
          <a
            href="/crm/analytics/aisha"
            className="mt-4 inline-flex rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm text-[color:var(--bp-ink)] transition hover:border-[color:var(--bp-accent)]"
          >
            Открыть аналитику Аиши
          </a>
        </article>
      </section>
    </div>
  );
}

