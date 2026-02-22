export type SiteThemePalette = {
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
  clientContentWidth: number;
  clientAuthWidth: number;
  clientCardBg: string;
  clientButtonColor: string;
  clientButtonTextColor: string;
};

export type SiteTheme = SiteThemePalette & {
  mode: "light" | "dark";
  lightPalette: SiteThemePalette;
  darkPalette: SiteThemePalette;
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
  | "loader"
  | "about"
  | "client"
  | "booking"
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
  | "booking"
  | "client"
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
  loader: "Лоадер",
  about: "О нас",
  client: "Личный кабинет",
  booking: "Онлайн-запись",
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
  loader: ["v1", "v2", "v3"],
  about: ["v1", "v2"],
  client: ["v1"],
  booking: ["v1"],
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

export type SiteLoaderVisual = "spinner" | "dots" | "pulse";

export type SiteLoaderConfig = {
  visual: SiteLoaderVisual;
  size: number;
  color: string;
  speedMs: number;
  thickness: number;
  showPageOverlay: boolean;
  showBookingInline: boolean;
  backdropEnabled: boolean;
  backdropColor: string;
};

const DEFAULT_LOADER_CONFIG: SiteLoaderConfig = {
  visual: "spinner",
  size: 36,
  color: "#111827",
  speedMs: 900,
  thickness: 3,
  showPageOverlay: true,
  showBookingInline: true,
  backdropEnabled: false,
  backdropColor: "rgba(17,24,39,0.16)",
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(17,24,39,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const mapVariantToLoaderVisual = (
  variant: "v1" | "v2" | "v3" | "v4" | "v5" | undefined
): SiteLoaderVisual => {
  if (variant === "v2") return "dots";
  if (variant === "v3") return "pulse";
  return "spinner";
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export function resolveSiteLoaderConfig(draft: SiteDraft): SiteLoaderConfig | null {
  const homeBlocks = draft.pages?.home ?? draft.blocks;
  const loaderBlock = homeBlocks.find((block) => block.type === "loader");
  if (!loaderBlock) return null;
  const data =
    loaderBlock.data && typeof loaderBlock.data === "object"
      ? (loaderBlock.data as Record<string, unknown>)
      : {};
  const enabled = data.enabled !== false;
  if (!enabled) return null;

  const color =
    typeof data.color === "string" && data.color.trim()
      ? data.color.trim()
      : DEFAULT_LOADER_CONFIG.color;
  const backdropAlpha = clamp(data.backdropOpacity, 0, 1, 0.16);
  const backdropHex =
    typeof data.backdropHex === "string" && data.backdropHex.trim()
      ? data.backdropHex.trim()
      : "#111827";
  const backdropColor =
    typeof data.backdropColor === "string" && data.backdropColor.trim()
      ? data.backdropColor.trim()
      : hexToRgba(backdropHex, backdropAlpha);

  return {
    visual: mapVariantToLoaderVisual(loaderBlock.variant),
    size: clamp(data.size, 16, 120, DEFAULT_LOADER_CONFIG.size),
    color,
    speedMs: clamp(data.speedMs, 300, 4000, DEFAULT_LOADER_CONFIG.speedMs),
    thickness: clamp(data.thickness, 1, 10, DEFAULT_LOADER_CONFIG.thickness),
    showPageOverlay:
      typeof data.showPageOverlay === "boolean"
        ? data.showPageOverlay
        : DEFAULT_LOADER_CONFIG.showPageOverlay,
    showBookingInline:
      typeof data.showBookingInline === "boolean"
        ? data.showBookingInline
        : DEFAULT_LOADER_CONFIG.showBookingInline,
    backdropEnabled:
      typeof data.backdropEnabled === "boolean"
        ? data.backdropEnabled
        : DEFAULT_LOADER_CONFIG.backdropEnabled,
    backdropColor,
  };
}

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
    menuItems: ["home", "booking", "client", "locations", "services", "specialists", "promos"],
    showLogo: true,
    showButton: true,
    showThemeToggle: false,
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
        subtitle: "Онлайн-запись и лучшие специалистЫ рядом с вами",
        description:
          "Удобно записывайтесь онлайн, выбирайте специалистов и услуги в пару кликов.",
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
        subtitle: "Выберите специалиста",
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

  const baseTheme: SiteThemePalette = {
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
    clientContentWidth: 1120,
    clientAuthWidth: 560,
    clientCardBg: "#FFFFFF",
    clientButtonColor: "#111827",
    clientButtonTextColor: "#FFFFFF",
  };

  const darkTheme: SiteThemePalette = {
    ...baseTheme,
    accentColor: "#F3F4F6",
    shadowColor: "rgba(17, 24, 39, 0.12)",
    shadowSize: 0,
    gradientFrom: "#0F1115",
    gradientTo: "#1A1D24",
    surfaceColor: "#0F1115",
    panelColor: "#1A1D24",
    textColor: "#F5F7FA",
    mutedColor: "#A1A7B3",
    borderColor: "rgba(255, 255, 255, 0.12)",
    buttonColor: "#F5F7FA",
    buttonTextColor: "#0F1115",
    clientCardBg: "#1A1D24",
    clientButtonColor: "#F5F7FA",
    clientButtonTextColor: "#0F1115",
  };

  return {
    version: 1,
    theme: {
      ...baseTheme,
      mode: "light",
      lightPalette: baseTheme,
      darkPalette: darkTheme,
    },
    blocks: homeBlocks,
    pages: {
      home: homeBlocks,
      booking: [
        {
          id: makeBlockId(),
          type: "booking",
          variant: "v1",
          data: {
            style: {},
          },
        },
      ],
      client: [
        {
          id: makeBlockId(),
          type: "client",
          variant: "v1",
          data: {
            title: "Личный кабинет",
            subtitle: "Ваши данные и история записей",
            salonsTitle: "Ваши салоны",
            emptyText: "Пока нет салонов, где вы записывались.",
            style: {
              useCustomWidth: false,
              blockWidth: null,
            },
          },
        },
      ],
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
  const normalizePalette = (
    palette: Partial<SiteThemePalette> | undefined,
    fallback: SiteThemePalette
  ): SiteThemePalette => ({
    fontHeading: palette?.fontHeading || fallback.fontHeading,
    fontBody: palette?.fontBody || fallback.fontBody,
    accentColor: palette?.accentColor || fallback.accentColor,
    shadowColor: palette?.shadowColor || fallback.shadowColor,
    shadowSize: Number.isFinite(palette?.shadowSize)
      ? (palette?.shadowSize as number)
      : fallback.shadowSize,
    contentWidth: Number.isFinite(palette?.contentWidth)
      ? (palette?.contentWidth as number)
      : fallback.contentWidth,
    gradientEnabled:
      typeof palette?.gradientEnabled === "boolean"
        ? (palette?.gradientEnabled as boolean)
        : fallback.gradientEnabled,
    gradientDirection:
      palette?.gradientDirection === "horizontal" || palette?.gradientDirection === "vertical"
        ? (palette?.gradientDirection as "horizontal" | "vertical")
        : fallback.gradientDirection,
    gradientFrom: palette?.gradientFrom || fallback.gradientFrom,
    gradientTo: palette?.gradientTo || fallback.gradientTo,
    surfaceColor: palette?.surfaceColor || fallback.surfaceColor,
    panelColor: palette?.panelColor || fallback.panelColor,
    textColor: palette?.textColor || fallback.textColor,
    mutedColor: palette?.mutedColor || fallback.mutedColor,
    borderColor: palette?.borderColor || fallback.borderColor,
    buttonColor: palette?.buttonColor || fallback.buttonColor,
    buttonTextColor: palette?.buttonTextColor || fallback.buttonTextColor,
    radius: Number.isFinite(palette?.radius) ? (palette?.radius as number) : fallback.radius,
    buttonRadius: Number.isFinite(palette?.buttonRadius)
      ? (palette?.buttonRadius as number)
      : fallback.buttonRadius,
    blockSpacing: Number.isFinite(palette?.blockSpacing)
      ? (palette?.blockSpacing as number)
      : fallback.blockSpacing,
    headingSize: Number.isFinite(palette?.headingSize)
      ? (palette?.headingSize as number)
      : fallback.headingSize,
    subheadingSize: Number.isFinite(palette?.subheadingSize)
      ? (palette?.subheadingSize as number)
      : fallback.subheadingSize,
    textSize: Number.isFinite(palette?.textSize)
      ? (palette?.textSize as number)
      : fallback.textSize,
    clientContentWidth: Number.isFinite(palette?.clientContentWidth)
      ? (palette?.clientContentWidth as number)
      : fallback.clientContentWidth,
    clientAuthWidth: Number.isFinite(palette?.clientAuthWidth)
      ? (palette?.clientAuthWidth as number)
      : fallback.clientAuthWidth,
    clientCardBg: palette?.clientCardBg || fallback.clientCardBg,
    clientButtonColor: palette?.clientButtonColor || fallback.clientButtonColor,
    clientButtonTextColor: palette?.clientButtonTextColor || fallback.clientButtonTextColor,
  });
  const normalizeBlocks = (blocks: SiteBlock[]) =>
    blocks
      .filter((block) => block && typeof block === "object")
      .map((block) => {
        const safeData =
          typeof block.data === "object" && block.data ? { ...block.data } : {};
        if (block.type === "menu") {
          const menuItems = Array.isArray(safeData.menuItems)
            ? (safeData.menuItems as SitePageKey[]).filter((item) =>
                ["home", "booking", "client", "locations", "services", "specialists", "promos"].includes(item)
              )
            : [];
          if (!menuItems.includes("client")) {
            menuItems.splice(2, 0, "client");
          }
          safeData.menuItems = menuItems.length
            ? menuItems
            : ["home", "booking", "client", "locations", "services", "specialists", "promos"];
        }
        return {
          id: block.id || makeBlockId(),
          type: block.type,
          variant: block.variant ?? "v1",
          data: safeData,
        };
      })
      .filter((block) => block.type in BLOCK_LABELS);

  const fallbackPages = createDefaultDraft("Салон красоты").pages!;
  const pagesInput =
    draft.pages && typeof draft.pages === "object"
      ? (draft.pages as Partial<SitePages>)
      : { home: draft.blocks };

  const pages: SitePages = {
    home: normalizeBlocks(pagesInput.home ?? draft.blocks ?? fallbackPages.home),
    booking: normalizeBlocks(pagesInput.booking ?? fallbackPages.booking),
    client: normalizeBlocks(pagesInput.client ?? fallbackPages.client),
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
  if (!pages.booking.some((block) => block.type === "booking")) {
    pages.booking = [
      {
        id: makeBlockId(),
        type: "booking",
        variant: "v1",
        data: {
          style: {},
        },
      },
      ...pages.booking,
    ];
  }
  if (!pages.client.some((block) => block.type === "client")) {
    pages.client = [
      {
        id: makeBlockId(),
        type: "client",
        variant: "v1",
        data: {
          title: "Личный кабинет",
          subtitle: "Ваши данные и история записей",
          salonsTitle: "Ваши салоны",
          emptyText: "Пока нет салонов, где вы записывались.",
          style: {
            useCustomWidth: false,
            blockWidth: null,
          },
        },
      },
      ...pages.client,
    ];
  }

  pages.client = pages.client.map((block) => {
    if (block.type !== "client") return block;
    const data = (block.data ?? {}) as Record<string, unknown>;
    const style =
      data.style && typeof data.style === "object"
        ? ({ ...(data.style as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    if (style.useCustomWidth === true && Number(style.blockWidth) === 980) {
      style.useCustomWidth = false;
      style.blockWidth = null;
      return { ...block, data: { ...data, style } };
    }
    return block;
  });

  const mode = theme.mode === "dark" ? "dark" : "light";
  const lightPalette = normalizePalette(
    theme.lightPalette ?? (mode === "light" ? theme : undefined),
    fallbackTheme.lightPalette
  );
  const darkPalette = normalizePalette(
    theme.darkPalette ?? (mode === "dark" ? theme : undefined),
    fallbackTheme.darkPalette
  );
  const activePalette = mode === "dark" ? darkPalette : lightPalette;

  return {
    version: 1,
    theme: {
      ...activePalette,
      mode,
      lightPalette,
      darkPalette,
    },
    blocks: pages.home,
    pages,
    entityPages,
  };
};


