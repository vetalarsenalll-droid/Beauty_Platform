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
          Выберите нужную вкладку. Здесь собрана аналитика по бизнесу, AI-ассистенту и онлайн-записи.
        </p>
        <AnalyticsTabs active="overview" />
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Общая аналитика</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Сводные показатели по бизнесу: загрузка, выручка, повторные визиты, средний чек и каналы
            привлечения.
          </p>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Аналитика AI-ассистента</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Диалоги, жалобы, качество распознавания и конверсия AI-ассистента в запись.
          </p>
          <a
            href="/crm/analytics/aisha"
            className="mt-4 inline-flex rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm text-[color:var(--bp-ink)] transition hover:border-[color:var(--bp-accent)]"
          >
            Открыть аналитику AI-ассистента
          </a>
        </article>

        <article className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 shadow-[var(--bp-shadow)]">
          <h2 className="text-lg font-semibold">Онлайн-запись</h2>
          <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
            Воронка шагов, конверсия и детали прохождения записи клиентами на сайте.
          </p>
          <a
            href="/crm/analytics/online-booking"
            className="mt-4 inline-flex rounded-xl border border-[color:var(--bp-stroke)] px-3 py-2 text-sm text-[color:var(--bp-ink)] transition hover:border-[color:var(--bp-accent)]"
          >
            Открыть аналитику онлайн-записи
          </a>
        </article>
      </section>
    </div>
  );
}
