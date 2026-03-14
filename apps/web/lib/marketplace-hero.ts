export const HERO_SETTING_KEY = "marketplace.home.hero";

export type HeroLinkType =
  | "ai_assistant"
  | "account"
  | "location"
  | "specialist"
  | "service"
  | "collection"
  | "url";

export type HeroSlide = {
  id: string;
  isActive: boolean;
  tag?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  badge?: string | null;
  ctaLabel?: string | null;
  imageUrl: string;
  linkType: HeroLinkType;
  accountId?: number | null;
  entityId?: number | null;
  url?: string | null;
  collectionKey?: string | null;
};

export type HeroConfig = {
  main: HeroSlide[];
  sideTop: HeroSlide[];
  sideBottom: HeroSlide[];
  settings?: HeroSettings;
};

export type HeroSettings = {
  autoplayMainSec?: number;
  autoplaySideSec?: number;
  autoplayMainMs?: number;
  autoplaySideMs?: number;
  showDotsMain?: boolean;
  showDotsSide?: boolean;
  pauseOnHover?: boolean;
};

const emptyConfig: HeroConfig = {
  main: [],
  sideTop: [],
  sideBottom: [],
  settings: {
    autoplayMainSec: 6,
    autoplaySideSec: 6,
    showDotsMain: true,
    showDotsSide: true,
    pauseOnHover: true,
  },
};

export function normalizeHeroConfig(raw: unknown): HeroConfig {
  if (!raw || typeof raw !== "object") return emptyConfig;
  const value = raw as Partial<HeroConfig>;
  return {
    main: Array.isArray(value.main) ? (value.main as HeroSlide[]) : [],
    sideTop: Array.isArray(value.sideTop) ? (value.sideTop as HeroSlide[]) : [],
    sideBottom: Array.isArray(value.sideBottom)
      ? (value.sideBottom as HeroSlide[])
      : [],
    settings: {
      autoplayMainSec:
        value.settings?.autoplayMainSec ??
        (value.settings?.autoplayMainMs
          ? Math.max(2, Math.round(value.settings.autoplayMainMs / 1000))
          : emptyConfig.settings?.autoplayMainSec),
      autoplaySideSec:
        value.settings?.autoplaySideSec ??
        (value.settings?.autoplaySideMs
          ? Math.max(2, Math.round(value.settings.autoplaySideMs / 1000))
          : emptyConfig.settings?.autoplaySideSec),
      showDotsMain:
        value.settings?.showDotsMain ?? emptyConfig.settings?.showDotsMain,
      showDotsSide:
        value.settings?.showDotsSide ?? emptyConfig.settings?.showDotsSide,
      pauseOnHover:
        value.settings?.pauseOnHover ?? emptyConfig.settings?.pauseOnHover,
    },
  };
}

export function isSlideActive(slide: HeroSlide) {
  return Boolean(slide.isActive);
}

export function isSlideReady(slide: HeroSlide) {
  if (!slide.isActive) return false;
  if (!slide.title?.trim()) return false;
  if (!slide.imageUrl?.trim()) return false;
  if (!slide.linkType) return false;
  if (slide.linkType === "url") return Boolean(slide.url?.trim());
  if (slide.linkType === "collection")
    return Boolean(slide.collectionKey?.trim());
  if (slide.linkType === "account") return Boolean(slide.accountId);
  if (slide.linkType === "ai_assistant") return true;
  return Boolean(slide.entityId);
}
