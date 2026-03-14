import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";

export default async function Home() {
  const accounts = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      profile: { select: { description: true, address: true } },
      _count: { select: { locations: true, services: true } },
    },
    take: 12,
  });

  const pageStyle: CSSProperties = {
    fontFamily: "var(--font-sans)",
    backgroundImage:
      "radial-gradient(960px 520px at 10% -10%, rgba(255, 237, 213, 0.6) 0%, rgba(255,255,255,0) 65%), radial-gradient(820px 480px at 88% -15%, rgba(30, 41, 59, 0.08) 0%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #f8fafc 0%, #f3f4f6 60%, #eef2f7 100%)",
    color: "#0f172a",
    "--bp-ink": "#0f172a",
    "--bp-muted": "#64748b",
    "--bp-paper": "rgba(255, 255, 255, 0.92)",
    "--bp-surface": "#f3f4f6",
    "--bp-stroke": "rgba(15, 23, 42, 0.08)",
    "--bp-accent": "#ef5a3c",
    "--bp-accent-strong": "#d94b2f",
    "--bp-shadow": "0 24px 55px rgba(15, 23, 42, 0.12)",
  } as CSSProperties;

  return (
    <main className="min-h-screen" style={pageStyle}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 px-6 pb-20 pt-14">
        <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--bp-muted)]">
              Marketplace
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-[color:var(--bp-ink)] md:text-5xl">
              Платформа сервисных услуг нового поколения
            </h1>
            <p className="text-lg text-[color:var(--bp-muted)]">
              Бронируйте лучшие студии, управляйте записями и бонусами в одном кабинете.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/c"
                className="inline-flex items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--bp-shadow)] transition hover:opacity-90"
              >
                Личный кабинет
              </a>
              <a
                href="/c/login"
                className="inline-flex items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] bg-white/80 px-5 py-3 text-sm font-semibold text-[color:var(--bp-ink)] transition hover:border-[color:var(--bp-accent)]"
              >
                Войти
              </a>
            </div>
          </div>
          <div className="rounded-[32px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-8 shadow-[var(--bp-shadow)]">
            <div className="text-sm font-semibold">Что внутри</div>
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--bp-muted)]">
              <li>Единый кабинет для всех организаций</li>
              <li>Умные подсказки по повторным визитам</li>
              <li>История оплат, бонусов и документов</li>
              <li>Быстрая запись в любимые студии</li>
            </ul>
          </div>
        </header>

        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">Организации</h2>
            <span className="text-sm text-[color:var(--bp-muted)]">
              {accounts.length} организаций доступно сейчас
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => {
              const publicSlug = buildPublicSlugId(account.slug, account.id);
              return (
                <div
                  key={account.id}
                  className="flex h-full flex-col gap-4 rounded-[24px] border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 shadow-[var(--bp-shadow)]"
                >
                  <div className="space-y-2">
                    <div className="text-lg font-semibold">{account.name}</div>
                    <div className="text-sm text-[color:var(--bp-muted)]">
                      {account.profile?.description || "Премиальные услуги и забота о клиентах."}
                    </div>
                  </div>
                  <div className="text-xs text-[color:var(--bp-muted)]">
                    {account.profile?.address || "Город"}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
                    <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">
                      Локаций: {account._count.locations}
                    </span>
                    <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">
                      Услуг: {account._count.services}
                    </span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <a
                      href={`/${publicSlug}/booking`}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl bg-[color:var(--bp-accent)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    >
                      Записаться
                    </a>
                    <a
                      href={`/c/login?account=${account.slug}`}
                      className="inline-flex flex-1 items-center justify-center rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-xs font-semibold text-[color:var(--bp-ink)]"
                    >
                      Кабинет
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
