export const SEO_PAGE_KEYS = [
  "home",
  "booking",
  "client",
  "locations",
  "locationDetail",
  "services",
  "serviceDetail",
  "specialists",
  "specialistDetail",
  "promos",
  "promoDetail",
  "legal",
] as const;

export type SeoPageKey = (typeof SEO_PAGE_KEYS)[number];

export const SEO_PAGE_LABELS: Record<SeoPageKey, string> = {
  home: "Главная",
  booking: "Онлайн-запись",
  client: "Личный кабинет",
  locations: "Локации",
  locationDetail: "Карточка локации",
  services: "Услуги",
  serviceDetail: "Карточка услуги",
  specialists: "Специалисты",
  specialistDetail: "Карточка специалиста",
  promos: "Промо/скидки",
  promoDetail: "Карточка промо",
  legal: "Правовые документы",
};

export const SEO_PAGE_PATHS: Record<SeoPageKey, string> = {
  home: "/",
  booking: "/booking",
  client: "/client",
  locations: "/locations",
  locationDetail: "/locations/{id}",
  services: "/services",
  serviceDetail: "/services/{id}",
  specialists: "/specialists",
  specialistDetail: "/specialists/{id}",
  promos: "/promos",
  promoDetail: "/promos/{id}",
  legal: "/legal/{versionId}",
};

export function isSeoPageKey(value: string) {
  if ((SEO_PAGE_KEYS as readonly string[]).includes(value)) return true;
  return /^(?:location|service|specialist|promo|legal):\d+$/.test(value);
}

export function seoEntityFallbackKey(pageKey: string): SeoPageKey | null {
  if (pageKey.startsWith("location:")) return "locationDetail";
  if (pageKey.startsWith("service:")) return "serviceDetail";
  if (pageKey.startsWith("specialist:")) return "specialistDetail";
  if (pageKey.startsWith("promo:")) return "promoDetail";
  if (pageKey.startsWith("legal:")) return "legal";
  return null;
}
