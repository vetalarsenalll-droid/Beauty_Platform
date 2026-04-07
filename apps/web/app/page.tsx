import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import HomeCategoryStrip from "./home-category-strip";
import HomeLeftSidebar from "./home-left-sidebar";
import HomeHeroSection from "./home-hero-section";
import {
  CATEGORY_SETTING_KEY,
  DEFAULT_CATEGORIES,
  normalizeCategoryConfig,
} from "@/lib/marketplace-categories";

const routes = [
  {
    title: "Записаться к специалисту",
    description:
      "Проверенные специалисты, рейтинг, реальная доступность времени.",
    cta: "Выбрать услугу",
  },
  {
    title: "Подобрать специалиста",
    description:
      "AI-подбор по задаче, бюджету и локации — без лишних шагов.",
    cta: "Запустить AI-подбор",
  },
  {
    title: "Найти студию",
    description: "Салоны с точными слотами и прозрачным прайсом.",
    cta: "Открыть каталог",
  },
];

export default async function Home() {
  const categorySetting = await prisma.platformSetting.findUnique({
    where: { key: CATEGORY_SETTING_KEY },
  });

  const categoryConfig = normalizeCategoryConfig(categorySetting?.valueJson);
  const categoryByKey = new Map(
    categoryConfig.items.map((item) => [item.key, item])
  );
  const categories = DEFAULT_CATEGORIES.map((item) => ({
    ...item,
    imageUrl: categoryByKey.get(item.key)?.imageUrl ?? null,
  }));

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
    fontFamily: 'var(--font-montserrat), var(--font-sans)',
    color: "#111827",
    backgroundColor: "#f6f7fb",
    "--bp-ink": "#111827",
    "--bp-muted": "#6b7280",
    "--bp-paper": "#ffffff",
    "--bp-stroke": "rgba(17, 24, 39, 0.08)",
    "--bp-accent": "#ff6a3d",
    "--bp-accent-strong": "#e3562d",
    "--bp-blue": "#3b82f6",
    "--bp-blue-strong": "#2563eb",
    "--bp-shadow": "0 24px 50px rgba(17, 24, 39, 0.12)",
  } as CSSProperties;

  return (
    <main className="min-h-screen" style={pageStyle}>
      <HomeLeftSidebar active="collection" />
      <div className="mx-auto w-full max-w-[1560px] px-6 pb-24 pt-6 md:pl-[280px]">
        <div className="flex flex-col gap-6">
          <HomeHeroSection />

          <section className="space-y-3">
            <HomeCategoryStrip categories={categories} />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {routes.map((route) => (
              <div
                key={route.title}
                className="flex h-full flex-col gap-3 rounded-[28px] border border-[color:var(--bp-stroke)] bg-white p-6 shadow-[var(--bp-shadow)]"
              >
                <div className="text-lg font-semibold">{route.title}</div>
                <p className="text-sm text-[color:var(--bp-muted)]">
                  {route.description}
                </p>
                <button className="mt-auto w-fit rounded-2xl border border-[color:var(--bp-stroke)] px-4 py-2 text-xs font-semibold text-[color:var(--bp-ink)] transition hover:border-[color:var(--bp-accent)]">
                  {route.cta}
                </button>
              </div>
            ))}
          </section>

          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[color:var(--bp-muted)]">
                  Студии и специалисты
                </div>
                <h2 className="text-2xl font-semibold">Доступные организации</h2>
              </div>
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
                    className="group flex h-full flex-col gap-4 rounded-[26px] border border-[color:var(--bp-stroke)] bg-white p-6 shadow-[var(--bp-shadow)] transition hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold">{account.name}</div>
                      <span className="rounded-full bg-[color:var(--bp-blue)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--bp-blue)]">
                        Verified
                      </span>
                    </div>
                    <div className="text-sm text-[color:var(--bp-muted)]">
                      {account.profile?.description ||
                        "Премиальные услуги и забота о клиентах."}
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
      </div>
    </main>
  );
}


