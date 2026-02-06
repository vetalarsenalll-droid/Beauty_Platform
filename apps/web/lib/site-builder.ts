export type SiteTheme = {
  fontHeading: string;
  fontBody: string;
  accentColor: string;
  surfaceColor: string;
  panelColor: string;
  textColor: string;
  mutedColor: string;
  radius: number;
};

export type SiteDraft = {
  version: 1;
  theme: SiteTheme;
  blocks: SiteBlock[];
  pages?: SitePages;
};

export type BlockType =
  | "cover"
  | "about"
  | "locations"
  | "services"
  | "specialists"
  | "works"
  | "reviews"
  | "contacts"
  | "promos";

export type SiteBlock = {
  id: string;
  type: BlockType;
  variant: "v1" | "v2";
  data: Record<string, unknown>;
};

export type SitePageKey =
  | "home"
  | "locations"
  | "services"
  | "specialists"
  | "promos";

export type SitePages = Record<SitePageKey, SiteBlock[]>;

export const BLOCK_LABELS: Record<BlockType, string> = {
  cover: "Главный экран",
  about: "О нас",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  works: "Работы",
  reviews: "Отзывы",
  contacts: "Контакты",
  promos: "Промо / скидки",
};

export const BLOCK_VARIANTS: Record<BlockType, Array<"v1" | "v2">> = {
  cover: ["v1", "v2"],
  about: ["v1", "v2"],
  locations: ["v1", "v2"],
  services: ["v1", "v2"],
  specialists: ["v1", "v2"],
  works: ["v1", "v2"],
  reviews: ["v1", "v2"],
  contacts: ["v1", "v2"],
  promos: ["v1", "v2"],
};

export type CoverImageSource =
  | { type: "account" }
  | { type: "location"; id: number }
  | { type: "specialist"; id: number }
  | { type: "service"; id: number }
  | { type: "custom"; url: string }
  | { type: "none" };

export const makeBlockId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createDefaultDraft = (accountName: string): SiteDraft => {
  const homeBlocks: SiteBlock[] = [
    {
      id: makeBlockId(),
      type: "cover",
      variant: "v1",
      data: {
        title: accountName || "Салон красоты",
        subtitle: "Онлайн-запись и лучшие мастера рядом с вами",
        description:
          "Удобно записывайтесь онлайн, выбирайте мастеров и услуги в пару кликов.",
        buttonText: "Записаться",
        showButton: true,
        align: "left",
        imageSource: { type: "account" } as CoverImageSource,
      },
    },
    {
      id: makeBlockId(),
      type: "about",
      variant: "v1",
      data: {
        title: "О нас",
        text: "",
        showContacts: true,
      },
    },
    {
      id: makeBlockId(),
      type: "locations",
      variant: "v1",
      data: {
        title: "Локации",
        subtitle: "Выберите удобное место",
        mode: "all",
        ids: [],
        showButton: true,
        buttonText: "Записаться",
      },
    },
    {
      id: makeBlockId(),
      type: "services",
      variant: "v1",
      data: {
        title: "Услуги",
        subtitle: "Подберите удобную услугу",
        mode: "all",
        ids: [],
        showPrice: true,
        showDuration: true,
        showButton: true,
        buttonText: "Записаться",
      },
    },
    {
      id: makeBlockId(),
      type: "specialists",
      variant: "v1",
      data: {
        title: "Специалисты",
        subtitle: "Выберите мастера",
        mode: "all",
        ids: [],
        locationId: null,
        showButton: true,
        buttonText: "Записаться",
      },
    },
    {
      id: makeBlockId(),
      type: "works",
      variant: "v1",
      data: {
        title: "Работы",
        subtitle: "Фото наших работ",
        source: "locations",
        mode: "all",
        ids: [],
      },
    },
    {
      id: makeBlockId(),
      type: "reviews",
      variant: "v1",
      data: {
        title: "Отзывы",
        subtitle: "Что говорят клиенты",
        limit: 6,
      },
    },
    {
      id: makeBlockId(),
      type: "contacts",
      variant: "v1",
      data: {
        title: "Контакты",
        subtitle: "Свяжитесь с нами",
        locationId: null,
        showMap: false,
      },
    },
  ];

  const detailBlocks = (type: BlockType, title: string): SiteBlock[] => [
    {
      id: makeBlockId(),
      type,
      variant: "v1",
      data: {
        title,
        subtitle: "",
        mode: "selected",
        ids: [],
        useCurrent: true,
        showButton: true,
        buttonText: "Записаться",
      },
    },
  ];

  return {
    version: 1,
    theme: {
      fontHeading: "Prata, serif",
      fontBody: "Manrope, sans-serif",
      accentColor: "#111827",
      surfaceColor: "#F5F2F0",
      panelColor: "#FFFFFF",
      textColor: "#111827",
      mutedColor: "#6B7280",
      radius: 28,
    },
    blocks: homeBlocks,
    pages: {
      home: homeBlocks,
      locations: detailBlocks("locations", "Локации"),
      services: detailBlocks("services", "Услуги"),
      specialists: detailBlocks("specialists", "Специалисты"),
      promos: detailBlocks("promos", "Промо / скидки"),
    },
  };
};

export const normalizeDraft = (value: unknown): SiteDraft => {
  if (!value || typeof value !== "object") {
    return createDefaultDraft("Салон красоты");
  }
  const draft = value as SiteDraft;
  if (draft.version !== 1 || !Array.isArray(draft.blocks)) {
    return createDefaultDraft("Салон красоты");
  }
  const fallbackTheme = createDefaultDraft("Салон красоты").theme;
  const theme = draft.theme ?? fallbackTheme;
  const normalizeBlocks = (blocks: SiteBlock[]) =>
    blocks
      .filter((block) => block && typeof block === "object")
      .map((block) => ({
        id: block.id || makeBlockId(),
        type: block.type,
        variant: block.variant ?? "v1",
        data: typeof block.data === "object" && block.data ? block.data : {},
      }))
      .filter((block) => block.type in BLOCK_LABELS);

  const fallbackPages = createDefaultDraft("Салон красоты").pages!;
  const pagesInput =
    draft.pages && typeof draft.pages === "object"
      ? (draft.pages as Partial<SitePages>)
      : { home: draft.blocks };

  const pages: SitePages = {
    home: normalizeBlocks(pagesInput.home ?? draft.blocks ?? fallbackPages.home),
    locations: normalizeBlocks(pagesInput.locations ?? fallbackPages.locations),
    services: normalizeBlocks(pagesInput.services ?? fallbackPages.services),
    specialists: normalizeBlocks(pagesInput.specialists ?? fallbackPages.specialists),
    promos: normalizeBlocks(pagesInput.promos ?? fallbackPages.promos),
  };

  return {
    version: 1,
    theme: {
      fontHeading: theme.fontHeading || fallbackTheme.fontHeading,
      fontBody: theme.fontBody || fallbackTheme.fontBody,
      accentColor: theme.accentColor || fallbackTheme.accentColor,
      surfaceColor: theme.surfaceColor || fallbackTheme.surfaceColor,
      panelColor: theme.panelColor || fallbackTheme.panelColor,
      textColor: theme.textColor || fallbackTheme.textColor,
      mutedColor: theme.mutedColor || fallbackTheme.mutedColor,
      radius: Number.isFinite(theme.radius) ? theme.radius : fallbackTheme.radius,
    },
    blocks: pages.home,
    pages,
  };
};