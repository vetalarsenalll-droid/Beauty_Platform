export type SiteTheme = {
  fontHeading: string;
  fontBody: string;
  accentColor: string;
  shadowColor: string;
  shadowSize: number;
  contentWidth: number;
  gradientEnabled: boolean;
  gradientDirection: "vertical" | "horizontal";
  gradientFrom: string;
  gradientTo: string;
  surfaceColor: string;
  panelColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  buttonColor: string;
  buttonTextColor: string;
  radius: number;
  buttonRadius: number;
  blockSpacing: number;
  headingSize: number;
  subheadingSize: number;
  textSize: number;
};

export type SiteDraft = {
  version: 1;
  theme: SiteTheme;
  blocks: SiteBlock[];
  pages?: SitePages;
  entityPages?: SiteEntityPages;
};

export type BlockType =
  | "cover"
  | "menu"
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
  variant: "v1" | "v2" | "v3" | "v4" | "v5";
  data: Record<string, unknown>;
};

export type SitePageKey =
  | "home"
  | "locations"
  | "services"
  | "specialists"
  | "promos";

export type SitePages = Record<SitePageKey, SiteBlock[]>;

export type SiteEntityPages = {
  locations?: Record<string, SiteBlock[]>;
  services?: Record<string, SiteBlock[]>;
  specialists?: Record<string, SiteBlock[]>;
  promos?: Record<string, SiteBlock[]>;
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  cover: "Главный экран",
  menu: "Меню",
  about: "О нас",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  works: "Работы",
  reviews: "Отзывы",
  contacts: "Контакты",
  promos: "Промо / скидки",
};

export const BLOCK_VARIANTS: Record<
  BlockType,
  Array<"v1" | "v2" | "v3" | "v4" | "v5">
> = {
  cover: ["v1", "v2"],
  menu: ["v1", "v2", "v3", "v4", "v5"],
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

const createMenuBlock = (): SiteBlock => ({
  id: makeBlockId(),
  type: "menu",
  variant: "v1",
  data: {
    title: "Меню",
    menuItems: ["home", "locations", "services", "specialists", "promos"],
    showLogo: true,
    showButton: true,
    ctaMode: "booking",
    phoneOverride: "",
    buttonText: "Записаться",
    showSearch: false,
    showAccount: false,
    accountLink: "/c",
    showSocials: false,
    position: "static",
    socialsMode: "auto",
    socialsCustom: {
      website: "",
      instagram: "",
      whatsapp: "",
      telegram: "",
      max: "",
      vk: "",
      viber: "",
      pinterest: "",
      facebook: "",
      tiktok: "",
      youtube: "",
      twitter: "",
      dzen: "",
      ok: "",
    },
    align: "left",
  },
});

export const createDefaultDraft = (accountName: string): SiteDraft => {
  const homeBlocks: SiteBlock[] = [
    createMenuBlock(),
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
      shadowColor: "rgba(17, 24, 39, 0.12)",
      shadowSize: 18,
      contentWidth: 1120,
      gradientEnabled: false,
      gradientDirection: "vertical",
      gradientFrom: "#F7F3F0",
      gradientTo: "#FFF7F2",
      surfaceColor: "#F5F2F0",
      panelColor: "#FFFFFF",
      textColor: "#111827",
      mutedColor: "#6B7280",
      borderColor: "#E5E7EB",
      buttonColor: "#111827",
      buttonTextColor: "#FFFFFF",
      radius: 28,
      buttonRadius: 999,
      blockSpacing: 28,
      headingSize: 28,
      subheadingSize: 18,
      textSize: 14,
    },
    blocks: homeBlocks,
    pages: {
      home: homeBlocks,
      locations: detailBlocks("locations", "Локации"),
      services: detailBlocks("services", "Услуги"),
      specialists: detailBlocks("specialists", "Специалисты"),
      promos: detailBlocks("promos", "Промо / скидки"),
    },
    entityPages: {},
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

  const normalizeEntityMap = (value: unknown) => {
    if (!value || typeof value !== "object") return {};
    const entries = Object.entries(value as Record<string, unknown>);
    const result: Record<string, SiteBlock[]> = {};
    entries.forEach(([key, blocks]) => {
      if (Array.isArray(blocks)) {
        result[key] = normalizeBlocks(blocks as SiteBlock[]);
      }
    });
    return result;
  };

  const rawEntityPages =
    draft.entityPages && typeof draft.entityPages === "object"
      ? (draft.entityPages as SiteEntityPages)
      : {};
  const entityPages: SiteEntityPages = {
    locations: normalizeEntityMap(rawEntityPages.locations),
    services: normalizeEntityMap(rawEntityPages.services),
    specialists: normalizeEntityMap(rawEntityPages.specialists),
    promos: normalizeEntityMap(rawEntityPages.promos),
  };

  if (!pages.home.some((block) => block.type === "menu")) {
    pages.home = [createMenuBlock(), ...pages.home];
  }

  return {
    version: 1,
    theme: {
      fontHeading: theme.fontHeading || fallbackTheme.fontHeading,
      fontBody: theme.fontBody || fallbackTheme.fontBody,
      accentColor: theme.accentColor || fallbackTheme.accentColor,
      shadowColor: theme.shadowColor || fallbackTheme.shadowColor,
      shadowSize: Number.isFinite(theme.shadowSize)
        ? theme.shadowSize
        : fallbackTheme.shadowSize,
      contentWidth: Number.isFinite(theme.contentWidth)
        ? theme.contentWidth
        : fallbackTheme.contentWidth,
      gradientEnabled:
        typeof theme.gradientEnabled === "boolean"
          ? theme.gradientEnabled
          : fallbackTheme.gradientEnabled,
      gradientDirection:
        theme.gradientDirection === "horizontal" || theme.gradientDirection === "vertical"
          ? theme.gradientDirection
          : fallbackTheme.gradientDirection,
      gradientFrom: theme.gradientFrom || fallbackTheme.gradientFrom,
      gradientTo: theme.gradientTo || fallbackTheme.gradientTo,
      surfaceColor: theme.surfaceColor || fallbackTheme.surfaceColor,
      panelColor: theme.panelColor || fallbackTheme.panelColor,
      textColor: theme.textColor || fallbackTheme.textColor,
      mutedColor: theme.mutedColor || fallbackTheme.mutedColor,
      borderColor: theme.borderColor || fallbackTheme.borderColor,
      buttonColor: theme.buttonColor || fallbackTheme.buttonColor,
      buttonTextColor: theme.buttonTextColor || fallbackTheme.buttonTextColor,
      radius: Number.isFinite(theme.radius) ? theme.radius : fallbackTheme.radius,
      buttonRadius: Number.isFinite(theme.buttonRadius)
        ? theme.buttonRadius
        : fallbackTheme.buttonRadius,
      blockSpacing: Number.isFinite(theme.blockSpacing)
        ? theme.blockSpacing
        : fallbackTheme.blockSpacing,
      headingSize: Number.isFinite(theme.headingSize)
        ? theme.headingSize
        : fallbackTheme.headingSize,
      subheadingSize: Number.isFinite(theme.subheadingSize)
        ? theme.subheadingSize
        : fallbackTheme.subheadingSize,
      textSize: Number.isFinite(theme.textSize)
        ? theme.textSize
        : fallbackTheme.textSize,
    },
    blocks: pages.home,
    pages,
    entityPages,
  };
};
