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
};

const emptyConfig: HeroConfig = {
  main: [],
  sideTop: [],
  sideBottom: [],
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
