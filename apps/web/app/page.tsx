import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import HomeHeroGroup from "./home-hero-group";
import HomeCategoryStrip from "./home-category-strip";
import {
  CATEGORY_SETTING_KEY,
  DEFAULT_CATEGORIES,
  normalizeCategoryConfig,
} from "@/lib/marketplace-categories";
import {
  HERO_SETTING_KEY,
  HeroSlide,
  normalizeHeroConfig,
  isSlideReady,
} from "@/lib/marketplace-hero";

const routes = [
  {
    title: "Записаться к мастеру",
    description:
      "Проверенные специалисты, рейтинг, реальная доступность времени.",
    cta: "Выбрать услугу",
  },
  {
    title: "Подобрать специалиста",
    description:
      "AI‑подбор по задаче, бюджету и локации — без лишних шагов.",
    cta: "Запустить AI‑подбор",
  },
  {
    title: "Найти студию",
    description: "Салоны с точными слотами и прозрачным прайсом.",
    cta: "Открыть каталог",
  },
];

type HeroSlideView = HeroSlide & { url: string };

function buildSlideHref(
  slide: HeroSlide,
  deps: {
    accounts: Map<number, { id: number; slug: string }>;
    locations: Map<number, { id: number; accountId: number }>;
    services: Map<number, { id: number; accountId: number }>;
    specialists: Map<number, { id: number; accountId: number }>;
  }
) {
  if (!slide.isActive) return null;
  switch (slide.linkType) {
    case "url":
      return slide.url?.trim() || null;
    case "collection":
      return slide.collectionKey
        ? `/?collection=${encodeURIComponent(slide.collectionKey)}`
        : null;
    case "ai_assistant": {
      if (slide.accountId) {
        const account = deps.accounts.get(slide.accountId);
        if (!account) return null;
        return `/${buildPublicSlugId(account.slug, account.id)}/booking?assistant=1`;
      }
      return "/booking?assistant=1";
    }
    case "account": {
      if (!slide.accountId) return null;
      const account = deps.accounts.get(slide.accountId);
      if (!account) return null;
      return `/${buildPublicSlugId(account.slug, account.id)}/booking`;
    }
    case "location": {
      if (!slide.entityId) return null;
      const location = deps.locations.get(slide.entityId);
      if (!location) return null;
      const account = deps.accounts.get(location.accountId);
      if (!account) return null;
      return `/${buildPublicSlugId(account.slug, account.id)}/locations/${location.id}`;
    }
    case "service": {
      if (!slide.entityId) return null;
      const service = deps.services.get(slide.entityId);
      if (!service) return null;
      const account = deps.accounts.get(service.accountId);
      if (!account) return null;
      return `/${buildPublicSlugId(account.slug, account.id)}/services/${service.id}`;
    }
    case "specialist": {
      if (!slide.entityId) return null;
      const specialist = deps.specialists.get(slide.entityId);
      if (!specialist) return null;
      const account = deps.accounts.get(specialist.accountId);
      if (!account) return null;
      return `/${buildPublicSlugId(account.slug, account.id)}/specialists/${specialist.id}`;
    }
    default:
      return null;
  }
}

function resolveSlides(
  slides: HeroSlide[],
  deps: Parameters<typeof buildSlideHref>[1]
): HeroSlideView[] {
  return slides
    .filter((slide) => isSlideReady(slide))
    .map((slide) => {
      const url = buildSlideHref(slide, deps) ?? "#";
      return { ...slide, url };
    });
}

export default async function Home() {
  const [heroSetting, categorySetting] = await Promise.all([
    prisma.platformSetting.findUnique({
      where: { key: HERO_SETTING_KEY },
    }),
    prisma.platformSetting.findUnique({
      where: { key: CATEGORY_SETTING_KEY },
    }),
  ]);

  const heroConfig = normalizeHeroConfig(heroSetting?.valueJson);
  const categoryConfig = normalizeCategoryConfig(categorySetting?.valueJson);
  const heroSettings = heroConfig.settings ?? {};
  const mainIntervalMs =
    Math.max(2, heroSettings.autoplayMainSec ?? 6) * 1000;

  const categoryByKey = new Map(
    categoryConfig.items.map((item) => [item.key, item])
  );
  const categories = DEFAULT_CATEGORIES.map((item) => ({
    ...item,
    imageUrl: categoryByKey.get(item.key)?.imageUrl ?? null,
  }));

  const locationIds = new Set<number>();
  const serviceIds = new Set<number>();
  const specialistIds = new Set<number>();
  const heroAccountIds = new Set<number>();

  const collectIds = (slides: HeroSlide[]) => {
    slides.forEach((slide) => {
      if (!slide.isActive) return;
      if (slide.linkType === "account" || slide.linkType === "ai_assistant") {
        if (slide.accountId) heroAccountIds.add(slide.accountId);
      }
      if (slide.linkType === "location" && slide.entityId) {
        locationIds.add(slide.entityId);
      }
      if (slide.linkType === "service" && slide.entityId) {
        serviceIds.add(slide.entityId);
      }
      if (slide.linkType === "specialist" && slide.entityId) {
        specialistIds.add(slide.entityId);
      }
    });
  };

  collectIds(heroConfig.main);
  collectIds(heroConfig.sideTop);
  collectIds(heroConfig.sideBottom);

  const [heroLocations, heroServices, heroSpecialists] = await Promise.all([
    locationIds.size
      ? prisma.location.findMany({
          where: { id: { in: Array.from(locationIds) } },
          select: { id: true, accountId: true },
        })
      : Promise.resolve([]),
    serviceIds.size
      ? prisma.service.findMany({
          where: { id: { in: Array.from(serviceIds) } },
          select: { id: true, accountId: true },
        })
      : Promise.resolve([]),
    specialistIds.size
      ? prisma.specialistProfile.findMany({
          where: { id: { in: Array.from(specialistIds) } },
          select: { id: true, accountId: true },
        })
      : Promise.resolve([]),
  ]);

  heroLocations.forEach((item) => heroAccountIds.add(item.accountId));
  heroServices.forEach((item) => heroAccountIds.add(item.accountId));
  heroSpecialists.forEach((item) => heroAccountIds.add(item.accountId));

  const [heroAccounts, accounts] = await Promise.all([
    heroAccountIds.size
      ? prisma.account.findMany({
          where: { id: { in: Array.from(heroAccountIds) } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    prisma.account.findMany({
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
    }),
  ]);

  const deps = {
    accounts: new Map(heroAccounts.map((item) => [item.id, item])),
    locations: new Map(heroLocations.map((item) => [item.id, item])),
    services: new Map(heroServices.map((item) => [item.id, item])),
    specialists: new Map(heroSpecialists.map((item) => [item.id, item])),
  };

  const heroMainSlides = resolveSlides(heroConfig.main, deps);
  const heroSideTopSlides = resolveSlides(heroConfig.sideTop, deps);
  const heroSideBottomSlides = resolveSlides(heroConfig.sideBottom, deps);

  const fallbackSlide: HeroSlideView = {
    id: "fallback",
    isActive: true,
    tag: "Marketplace",
    title: "Настройте витрину в админке",
    subtitle: "Загрузите фото и укажите переходы",
    description: "Блок будет скрыт, когда карточки заполнены.",
    ctaLabel: "",
    imageUrl:
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=80",
    linkType: "url",
    url: "/platform/marketplace",
  };

  const pageStyle: CSSProperties = {
    fontFamily: "\"Montserrat\", var(--font-sans)",
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
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 pb-24 pt-6">
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
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-3 rounded-2xl border border-[color:var(--bp-stroke)] bg-white px-4 py-3 text-sm">
              <span className="text-[color:var(--bp-muted)]">
                Искать услуги, мастеров или студии
              </span>
            </div>
            <button className="rounded-2xl bg-[color:var(--bp-accent)] px-5 py-3 text-xs font-semibold text-white shadow-[var(--bp-shadow)]">
              Найти
            </button>
          </div>

        </header>

        <HomeHeroGroup
          mainSlides={heroMainSlides.length ? heroMainSlides : [fallbackSlide]}
          sideTopSlides={heroSideTopSlides.length ? heroSideTopSlides : [fallbackSlide]}
          sideBottomSlides={heroSideBottomSlides.length ? heroSideBottomSlides : [fallbackSlide]}
          intervalMs={mainIntervalMs}
          showDotsMain={heroSettings.showDotsMain ?? true}
          showDotsSide={heroSettings.showDotsSide ?? true}
          pauseOnHover={heroSettings.pauseOnHover ?? true}
        />

        <section>
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
                Студии и мастера
              </div>
              <h2 className="text-2xl font-semibold">
                Доступные организации
              </h2>
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
    </main>
  );
}
