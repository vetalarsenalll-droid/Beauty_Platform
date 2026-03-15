import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";
import HomeHeroGroup from "./home-hero-group";
import HomeHeroSlider from "./home-hero-slider";
import {
  HERO_SETTING_KEY,
  HeroSlide,
  normalizeHeroConfig,
  isSlideReady,
} from "@/lib/marketplace-hero";

const buildSlideHref = (
  slide: HeroSlide,
  deps: {
    accounts: Map<number, { id: number; slug: string }>;
    locations: Map<number, { id: number; accountId: number }>;
    services: Map<number, { id: number; accountId: number }>;
    specialists: Map<number, { id: number; accountId: number }>;
  }
) => {
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
};

const resolveSlides = (
  slides: HeroSlide[],
  deps: Parameters<typeof buildSlideHref>[1]
) => {
  return slides
    .filter((slide) => isSlideReady(slide))
    .map((slide) => {
      const url = buildSlideHref(slide, deps) ?? "#";
      return { ...slide, url };
    });
};

export default async function HomeHeroSection() {
  const heroSetting = await prisma.platformSetting.findUnique({
    where: { key: HERO_SETTING_KEY },
  });

  const heroConfig = normalizeHeroConfig(heroSetting?.valueJson);
  const heroSettings = heroConfig.settings ?? {};
  const mainIntervalMs =
    Math.max(2, heroSettings.autoplayMainSec ?? 6) * 1000;

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

  const heroAccounts = heroAccountIds.size
    ? await prisma.account.findMany({
        where: { id: { in: Array.from(heroAccountIds) } },
        select: { id: true, slug: true },
      })
    : [];

  const deps = {
    accounts: new Map(heroAccounts.map((item) => [item.id, item])),
    locations: new Map(heroLocations.map((item) => [item.id, item])),
    services: new Map(heroServices.map((item) => [item.id, item])),
    specialists: new Map(heroSpecialists.map((item) => [item.id, item])),
  };

  const heroMainSlides = resolveSlides(heroConfig.main, deps);
  const heroSideTopSlides = resolveSlides(heroConfig.sideTop, deps);
  const heroSideBottomSlides = resolveSlides(heroConfig.sideBottom, deps);

  if (
    !heroMainSlides.length &&
    !heroSideTopSlides.length &&
    !heroSideBottomSlides.length
  ) {
    return null;
  }

  if (heroMainSlides.length && heroSideTopSlides.length && heroSideBottomSlides.length) {
    return (
      <HomeHeroGroup
        mainSlides={heroMainSlides}
        sideTopSlides={heroSideTopSlides}
        sideBottomSlides={heroSideBottomSlides}
        intervalMs={mainIntervalMs}
        showDotsMain={heroSettings.showDotsMain ?? true}
        showDotsSide={heroSettings.showDotsSide ?? true}
        pauseOnHover={heroSettings.pauseOnHover ?? true}
      />
    );
  }

  if (heroMainSlides.length) {
    return (
      <HomeHeroSlider
        slides={heroMainSlides}
        variant="large"
        intervalMs={mainIntervalMs}
        showDots={heroSettings.showDotsMain ?? true}
        pauseOnHover={heroSettings.pauseOnHover ?? true}
      />
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div />
      <div className="grid gap-4">
        {heroSideTopSlides.length ? (
          <HomeHeroSlider
            slides={heroSideTopSlides}
            variant="compact"
            intervalMs={mainIntervalMs}
            showDots={heroSettings.showDotsSide ?? true}
            pauseOnHover={heroSettings.pauseOnHover ?? true}
          />
        ) : null}
        {heroSideBottomSlides.length ? (
          <HomeHeroSlider
            slides={heroSideBottomSlides}
            variant="compact"
            intervalMs={mainIntervalMs}
            showDots={heroSettings.showDotsSide ?? true}
            pauseOnHover={heroSettings.pauseOnHover ?? true}
          />
        ) : null}
      </div>
    </section>
  );
}
