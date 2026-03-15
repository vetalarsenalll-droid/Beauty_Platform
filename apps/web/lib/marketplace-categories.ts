export const CATEGORY_SETTING_KEY = "marketplace.home.categories";

export type MarketplaceCategory = {
  key: string;
  label: string;
  imageUrl?: string | null;
};

export type CategoryConfig = {
  items: MarketplaceCategory[];
};

export const DEFAULT_CATEGORIES: MarketplaceCategory[] = [
  { key: "hair", label: "Парикмахерские услуги" },
  { key: "nails", label: "Ногтевой сервис" },
  { key: "brows", label: "Брови" },
  { key: "lashes", label: "Ресницы" },
  { key: "cosmetology", label: "Косметология, уход" },
  { key: "massage", label: "Массаж" },
  { key: "makeup", label: "Макияж, визаж" },
  { key: "epilation", label: "Депиляция, эпиляция" },
  { key: "spa", label: "СПА" },
  { key: "barber", label: "Барбершоп" },
  { key: "beard", label: "Усы, борода" },
  { key: "tattoo", label: "Татуаж, тату" },
  { key: "piercing", label: "Пирсинг" },
  { key: "solarium", label: "Солярий" },
  { key: "dentistry", label: "Стоматология" },
  { key: "medicine", label: "Медицина" },
  { key: "banya", label: "Бани, сауны" },
  { key: "fitness", label: "Фитнес" },
  { key: "yoga", label: "Йога" },
  { key: "dance", label: "Танцы" },
];

const emptyConfig: CategoryConfig = { items: [] };

export function normalizeCategoryConfig(raw: unknown): CategoryConfig {
  if (!raw || typeof raw !== "object") return emptyConfig;
  const value = raw as Partial<CategoryConfig>;
  if (!Array.isArray(value.items)) return emptyConfig;
  return {
    items: value.items
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const entry = item as Partial<MarketplaceCategory>;
        return {
          key: String(entry.key ?? ""),
          label: String(entry.label ?? ""),
          imageUrl: entry.imageUrl ?? null,
        };
      }),
  };
}
