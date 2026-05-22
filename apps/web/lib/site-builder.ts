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

const DEFAULT_LIGHT_SURFACE_COLOR = "#f6f7f9";
const LEGACY_LIGHT_SURFACE_COLORS = new Set(["#f5f2f0"]);

export type SiteDraft = {
  version: 1;
  theme: SiteTheme;
  pageThemes?: Partial<Record<SitePageKey, SiteTheme>>;
  blocks: SiteBlock[];
  pages?: SitePages;
  entityPages?: SiteEntityPages;
};

export type BlockType =
  | "cover"
  | "menu"
  | "loader"
  | "about"
  | "heading"
  | "text"
  | "image"
  | "gallery"
  | "form"
  | "button"
  | "advantages"
  | "project"
  | "footer"
  | "team"
  | "news"
  | "widget"
  | "locationProfile"
  | "serviceProfile"
  | "specialistProfile"
  | "client"
  | "clientLogin"
  | "clientCabinet"
  | "legal"
  | "booking"
  | "locations"
  | "services"
  | "specialists"
  | "works"
  | "reviews"
  | "contacts"
  | "promos"
  | "aisha";

export type SiteBlock = {
  id: string;
  type: BlockType;
  variant: "v1" | "v2" | "v3" | "v4" | "v5";
  data: Record<string, unknown>;
};

export type SitePageKey =
  | "home"
  | "booking"
  | "aisha"
  | "client"
  | "clientLogin"
  | "clientCabinet"
  | "locations"
  | "services"
  | "specialists"
  | "legal"
  | "promos";

export const SITE_PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "aisha",
  "client",
  "clientLogin",
  "clientCabinet",
  "legal",
  "locations",
  "services",
  "specialists",
  "promos",
];
const MENU_PAGE_KEYS: SitePageKey[] = ["home", "booking", "client", "locations", "services", "specialists", "promos"];
export const DEFAULT_ACCOUNT_NAME = "Салон красоты";

export type SitePages = Record<SitePageKey, SiteBlock[]>;

export type SiteEntityPages = {
  locations?: Record<string, SiteBlock[]>;
  services?: Record<string, SiteBlock[]>;
  specialists?: Record<string, SiteBlock[]>;
  promos?: Record<string, SiteBlock[]>;
  legalDocuments?: Record<string, SiteBlock[]>;
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Заголовок",
  text: "Текстовый блок",
  image: "Изображение",
  gallery: "Галерея изображений",
  form: "Форма",
  button: "Кнопка",
  advantages: "Преимущества",
  project: "О проекте",
  footer: "Подвал",
  team: "Команда",
  news: "Новости",
  widget: "Виджет",
  locationProfile: "Профиль локации",
  serviceProfile: "Профиль услуги",
  specialistProfile: "Профиль специалиста",
  cover: "Обложка",
  menu: "Меню",
  loader: "Лоадер",
  about: "О нас",
  client: "Личный кабинет",
  clientLogin: "Вход",
  clientCabinet: "Кабинет",
  legal: "Документы",
  booking: "Онлайн-запись",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  works: "Галерея",
  reviews: "Отзывы",
  contacts: "Контакты",
  promos: "Промо / скидки",
  aisha: "AI-ассистент",
};

export const BLOCK_VARIANTS: Record<
  BlockType,
  Array<"v1" | "v2" | "v3" | "v4" | "v5">
> = {
  cover: ["v1", "v2", "v3"],
  menu: ["v1", "v2", "v3"],
  loader: ["v1", "v2", "v3"],
  about: ["v1"],
  heading: ["v1"],
  text: ["v1"],
  image: ["v1"],
  gallery: ["v1"],
  form: ["v1"],
  button: ["v1"],
  advantages: ["v1"],
  project: ["v1"],
  footer: ["v1"],
  team: ["v1"],
  news: ["v1"],
  widget: ["v1"],
  locationProfile: ["v1"],
  serviceProfile: ["v1"],
  specialistProfile: ["v1"],
  client: ["v1"],
  clientLogin: ["v1"],
  clientCabinet: ["v1"],
  legal: ["v1"],
  booking: ["v1", "v2"],
  locations: ["v1"],
  services: ["v1"],
  specialists: ["v1"],
  works: ["v1", "v2"],
  reviews: ["v1"],
  contacts: ["v1"],
  promos: ["v1"],
  aisha: ["v1"],
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
  fixedDurationEnabled: boolean;
  fixedDurationSec: number;
};

export type SiteAishaWidgetConfig = {
  enabled: boolean;
  assistantName: string;
  headerTitle: string;
  label: string;
  offsetBottomPx: number;
  offsetRightPx: number;
  panelWidthPx: number;
  panelHeightVh: number;
  radiusPx: number | null;
  buttonRadiusPx: number | null;
  quickReplyRadiusPx?: number | null;
  buttonColor: string | null;
  buttonTextColor: string | null;
  panelColor: string | null;
  textColor: string | null;
  borderColor: string | null;
  buttonColorLight?: string | null;
  buttonColorDark?: string | null;
  buttonTextColorLight?: string | null;
  buttonTextColorDark?: string | null;
  panelColorLight?: string | null;
  panelColorDark?: string | null;
  textColorLight?: string | null;
  textColorDark?: string | null;
  mutedColor?: string | null;
  mutedColorLight?: string | null;
  mutedColorDark?: string | null;
  borderColorLight?: string | null;
  borderColorDark?: string | null;
  gradientEnabled: boolean;
  gradientEnabledLight?: boolean;
  gradientEnabledDark?: boolean;
  gradientDirection: "vertical" | "horizontal";
  gradientDirectionLight?: "vertical" | "horizontal";
  gradientDirectionDark?: "vertical" | "horizontal";
  panelGradientFrom: string | null;
  panelGradientTo: string | null;
  panelGradientFromLight?: string | null;
  panelGradientFromDark?: string | null;
  panelGradientToLight?: string | null;
  panelGradientToDark?: string | null;
  assistantBubbleColor: string | null;
  assistantTextColor: string | null;
  clientBubbleColor: string | null;
  clientTextColor: string | null;
  headerBgColor: string | null;
  headerTextColor: string | null;
  quickReplyButtonColor: string | null;
  quickReplyTextColor: string | null;
  assistantBubbleColorLight?: string | null;
  assistantBubbleColorDark?: string | null;
  assistantTextColorLight?: string | null;
  assistantTextColorDark?: string | null;
  clientBubbleColorLight?: string | null;
  clientBubbleColorDark?: string | null;
  clientTextColorLight?: string | null;
  clientTextColorDark?: string | null;
  headerBgColorLight?: string | null;
  headerBgColorDark?: string | null;
  headerTextColorLight?: string | null;
  headerTextColorDark?: string | null;
  quickReplyButtonColorLight?: string | null;
  quickReplyButtonColorDark?: string | null;
  quickReplyTextColorLight?: string | null;
  quickReplyTextColorDark?: string | null;
  backdropColor: string | null;
  backdropColorLight?: string | null;
  backdropColorDark?: string | null;
  backdropOpacity: number | null;
  backdropOpacityLight?: number | null;
  backdropOpacityDark?: number | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  headingSizePx?: number | null;
  subheadingSizePx?: number | null;
  textSizePx?: number | null;
  messageRadiusPx: number | null;
  panelShadowColor: string | null;
  panelShadowSize: number | null;
};

const DEFAULT_LOADER_CONFIG: SiteLoaderConfig = {
  visual: "spinner",
  size: 36,
  color: "#111827",
  speedMs: 900,
  thickness: 1,
  showPageOverlay: true,
  showBookingInline: true,
  backdropEnabled: false,
  backdropColor: "rgba(17,24,39,0.16)",
  fixedDurationEnabled: false,
  fixedDurationSec: 1,
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

type LoaderColorMode = "solid" | "linear" | "radial";

const readLoaderColorMode = (value: unknown): LoaderColorMode =>
  value === "linear" || value === "radial" ? value : "solid";

const readLoaderString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const readLoaderNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
};

export function resolveLoaderCssColor(
  data: Record<string, unknown>,
  {
    prefix,
    fallback,
    dark,
  }: {
    prefix: "color" | "backdrop";
    fallback: string;
    dark: boolean;
  }
) {
  const suffix = dark ? "Dark" : "";
  const baseKey = prefix === "color" ? `color${suffix}` : `backdropHex${suffix}`;
  const fallbackBaseKey = prefix === "color" ? "color" : "backdropHex";
  const from = readLoaderString(data[baseKey], readLoaderString(data[fallbackBaseKey], fallback));
  const to = readLoaderString(data[`${prefix}To${suffix}`], readLoaderString(data[`${prefix}To`], from));
  const mode = readLoaderColorMode(data[`${prefix}Mode${suffix}`] ?? data[`${prefix}Mode`]);
  const angle = readLoaderNumber(data[`${prefix}Angle${suffix}`] ?? data[`${prefix}Angle`], 0, 360, 180);
  const stopA = readLoaderNumber(data[`${prefix}StopA${suffix}`] ?? data[`${prefix}StopA`], 0, 100, 0);
  const stopB = readLoaderNumber(data[`${prefix}StopB${suffix}`] ?? data[`${prefix}StopB`], 0, 100, 100);

  if (mode === "linear") return `linear-gradient(${angle}deg, ${from}, ${to})`;
  if (mode === "radial") return `radial-gradient(circle, ${from} ${stopA}%, ${to} ${stopB}%)`;
  return from;
}

export function resolveSiteLoaderConfig(draft: SiteDraft): SiteLoaderConfig | null {
  const homeBlocks = draft.pages?.home ?? draft.blocks;
  const loaderBlock = homeBlocks.find((block) => block.type === "loader");
  if (!loaderBlock) return null;
  const isDark = draft.theme.mode === "dark";
  const data =
    loaderBlock.data && typeof loaderBlock.data === "object"
      ? (loaderBlock.data as Record<string, unknown>)
      : {};
  const enabled = data.enabled !== false;
  if (!enabled) return null;

  const color = resolveLoaderCssColor(data, {
    prefix: "color",
    fallback: DEFAULT_LOADER_CONFIG.color,
    dark: isDark,
  });
  const backdropAlpha = clamp(isDark ? data.backdropOpacityDark : data.backdropOpacity, 0, 1, 0.16);
  const backdropHexCandidate = isDark ? data.backdropHexDark : data.backdropHex;
  const backdropHex =
    typeof backdropHexCandidate === "string" && backdropHexCandidate.trim()
      ? backdropHexCandidate.trim()
      : typeof data.backdropHex === "string" && data.backdropHex.trim()
        ? data.backdropHex.trim()
      : "#111827";
  const backdropColor =
    readLoaderColorMode(data[isDark ? "backdropModeDark" : "backdropMode"] ?? data.backdropMode) ===
    "solid"
      ? typeof (isDark ? data.backdropColorDark : data.backdropColor) === "string" &&
          String(isDark ? data.backdropColorDark : data.backdropColor).trim()
        ? String(isDark ? data.backdropColorDark : data.backdropColor).trim()
        : hexToRgba(backdropHex, backdropAlpha)
      : resolveLoaderCssColor(data, {
          prefix: "backdrop",
          fallback: "#111827",
          dark: isDark,
        });

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
    fixedDurationEnabled:
      typeof data.fixedDurationEnabled === "boolean"
        ? data.fixedDurationEnabled
        : DEFAULT_LOADER_CONFIG.fixedDurationEnabled,
    fixedDurationSec: clamp(data.fixedDurationSec, 1, 10, DEFAULT_LOADER_CONFIG.fixedDurationSec),
  };
}


export function resolveAishaWidgetConfig(draft: SiteDraft, modeOverride?: "light" | "dark"): SiteAishaWidgetConfig {
  const homeBlocks = draft.pages?.home ?? draft.blocks;
  const aishaPageBlocks = draft.pages?.aisha ?? [];
  const aishaBlock =
    aishaPageBlocks.find((block) => block.type === "aisha") ??
    homeBlocks.find((block) => block.type === "aisha") ??
    null;
  if (!aishaBlock) {
    return {
      enabled: false,
      assistantName: "Ассистент",
      headerTitle: "AI-ассистент записи",
      label: "AI-чат",
      offsetBottomPx: 16,
      offsetRightPx: 16,
      panelWidthPx: 400,
      panelHeightVh: 74,
      radiusPx: null,
      buttonRadiusPx: null,
      quickReplyRadiusPx: null,
      buttonColor: null,
      buttonTextColor: null,
      panelColor: null,
      textColor: null,
      borderColor: null,
      mutedColor: null,
      mutedColorLight: null,
      mutedColorDark: null,
      gradientEnabled: false,
      gradientEnabledLight: false,
      gradientEnabledDark: false,
      gradientDirection: "vertical",
      gradientDirectionLight: "vertical",
      gradientDirectionDark: "vertical",
      panelGradientFrom: null,
      panelGradientTo: null,
      panelGradientFromLight: null,
      panelGradientFromDark: null,
      panelGradientToLight: null,
      panelGradientToDark: null,
      assistantBubbleColor: null,
      assistantTextColor: null,
      clientBubbleColor: null,
      clientTextColor: null,
      headerBgColor: null,
      headerTextColor: null,
      quickReplyButtonColor: null,
      quickReplyTextColor: null,
      backdropColor: null,
      backdropColorLight: null,
      backdropColorDark: null,
      backdropOpacity: 50,
      backdropOpacityLight: 50,
      backdropOpacityDark: 50,
      fontHeading: null,
      fontBody: null,
      headingSizePx: null,
      subheadingSizePx: null,
      textSizePx: null,
      messageRadiusPx: null,
      panelShadowColor: null,
      panelShadowSize: null,
    };
  }
  const data =
    aishaBlock.data && typeof aishaBlock.data === "object"
      ? (aishaBlock.data as Record<string, unknown>)
      : {};
  const style =
    data.style && typeof data.style === "object"
      ? (data.style as Record<string, unknown>)
      : {};

  const numInRange = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  const textOrNull = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const readColor = (key: string) =>
    typeof style[key] === "string" ? (style[key] as string).trim() : "";
  const theme = draft.pageThemes?.home ?? draft.theme;
  const isDark = (modeOverride ?? theme.mode) === "dark";
  const byMode = (base: unknown, light: unknown, dark: unknown) => {
    const lightVal = textOrNull(light);
    const darkVal = textOrNull(dark);
    const baseVal = textOrNull(base);
    return isDark ? darkVal || lightVal || baseVal : lightVal || darkVal || baseVal;
  };
  const resolvePair = (
    lightKey: string,
    darkKey: string,
    legacyKey: string,
    lightFallback: string,
    darkFallback: string
  ) => {
    const lightRaw = readColor(lightKey) || readColor(legacyKey);
    const darkRaw = readColor(darkKey);
    const lightResolved =
      lightRaw.toLowerCase() == "transparent" ? "transparent" : lightRaw || lightFallback;
    const darkResolved =
      darkRaw.toLowerCase() == "transparent" ? "transparent" : darkRaw || darkFallback;
    return { lightResolved, darkResolved };
  };
  const panelPair = resolvePair(
    "blockBgLight",
    "blockBgDark",
    "blockBg",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const subBlockPair = resolvePair(
    "subBlockBgLight",
    "subBlockBgDark",
    "subBlockBg",
    panelPair.lightResolved,
    panelPair.darkResolved
  );
  const textPair = resolvePair(
    "textColorLight",
    "textColorDark",
    "textColor",
    theme.lightPalette.textColor,
    theme.darkPalette.textColor
  );
  const borderPair = resolvePair(
    "borderColorLight",
    "borderColorDark",
    "borderColor",
    theme.lightPalette.borderColor,
    theme.darkPalette.borderColor
  );
  const mutedPair = resolvePair(
    "mutedColorLight",
    "mutedColorDark",
    "mutedColor",
    theme.lightPalette.mutedColor,
    theme.darkPalette.mutedColor
  );
  const buttonPair = resolvePair(
    "buttonColorLight",
    "buttonColorDark",
    "buttonColor",
    theme.lightPalette.buttonColor,
    theme.darkPalette.buttonColor
  );
  const buttonTextPair = resolvePair(
    "buttonTextColorLight",
    "buttonTextColorDark",
    "buttonTextColor",
    theme.lightPalette.buttonTextColor,
    theme.darkPalette.buttonTextColor
  );
  const headerBgPair = resolvePair(
    "headerBgColorLight",
    "headerBgColorDark",
    "headerBgColor",
    panelPair.lightResolved,
    panelPair.darkResolved
  );
  const headerTextPair = resolvePair(
    "headerTextColorLight",
    "headerTextColorDark",
    "headerTextColor",
    textPair.lightResolved,
    textPair.darkResolved
  );
  const assistantBubblePair = resolvePair(
    "assistantBubbleColorLight",
    "assistantBubbleColorDark",
    "assistantBubbleColor",
    subBlockPair.lightResolved,
    subBlockPair.darkResolved
  );
  const assistantTextPair = resolvePair(
    "assistantTextColorLight",
    "assistantTextColorDark",
    "assistantTextColor",
    textPair.lightResolved,
    textPair.darkResolved
  );
  const clientBubblePair = resolvePair(
    "clientBubbleColorLight",
    "clientBubbleColorDark",
    "clientBubbleColor",
    buttonPair.lightResolved,
    buttonPair.darkResolved
  );
  const clientTextPair = resolvePair(
    "clientTextColorLight",
    "clientTextColorDark",
    "clientTextColor",
    buttonTextPair.lightResolved,
    buttonTextPair.darkResolved
  );
  const quickReplyButtonPair = resolvePair(
    "quickReplyButtonColorLight",
    "quickReplyButtonColorDark",
    "quickReplyButtonColor",
    buttonPair.lightResolved,
    buttonPair.darkResolved
  );
  const quickReplyTextPair = resolvePair(
    "quickReplyTextColorLight",
    "quickReplyTextColorDark",
    "quickReplyTextColor",
    buttonTextPair.lightResolved,
    buttonTextPair.darkResolved
  );
  const backdropPair = resolvePair(
    "aishaBackdropColorLight",
    "aishaBackdropColorDark",
    "aishaBackdropColor",
    "transparent",
    "transparent"
  );
  const backdropOpacityLight = Number.isFinite(Number(style.aishaBackdropOpacityLight))
    ? numInRange(style.aishaBackdropOpacityLight, 0, 100, 50)
    : 50;
  const backdropOpacityDark = Number.isFinite(Number(style.aishaBackdropOpacityDark))
    ? numInRange(style.aishaBackdropOpacityDark, 0, 100, backdropOpacityLight)
    : backdropOpacityLight;

  const gradientEnabledLight =
    typeof style.gradientEnabledLight === "boolean"
      ? style.gradientEnabledLight
      : typeof style.gradientEnabled === "boolean"
        ? style.gradientEnabled
        : false;
  const gradientEnabledDark =
    typeof style.gradientEnabledDark === "boolean"
      ? style.gradientEnabledDark
      : typeof style.gradientEnabled === "boolean"
        ? style.gradientEnabled
        : gradientEnabledLight;
  const gradientDirectionLight =
    style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
      ? style.gradientDirectionLight
      : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? style.gradientDirection
        : "vertical";
  const gradientDirectionDark =
    style.gradientDirectionDark === "horizontal" || style.gradientDirectionDark === "vertical"
      ? style.gradientDirectionDark
      : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? style.gradientDirection
        : gradientDirectionLight;
  const panelGradientFromLight =
    textOrNull(style.gradientFromLight) ||
    textOrNull(style.gradientFrom) ||
    textOrNull(theme.lightPalette.gradientFrom);
  const panelGradientToLight =
    textOrNull(style.gradientToLight) ||
    textOrNull(style.gradientTo) ||
    textOrNull(theme.lightPalette.gradientTo);
  const panelGradientFromDark =
    textOrNull(style.gradientFromDark) ||
    textOrNull(style.gradientFrom) ||
    textOrNull(theme.darkPalette.gradientFrom) ||
    panelGradientFromLight;
  const panelGradientToDark =
    textOrNull(style.gradientToDark) ||
    textOrNull(style.gradientTo) ||
    textOrNull(theme.darkPalette.gradientTo) ||
    panelGradientToLight;

  return {
    enabled: data.enabled !== false,
    assistantName:
      typeof data.assistantName === "string" && data.assistantName.trim() ? data.assistantName.trim() : "Ассистент",
    headerTitle:
      typeof data.title === "string" && data.title.trim() ? data.title.trim() : "AI-ассистент записи",
    label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : "AI-чат",
    offsetBottomPx: numInRange(data.offsetBottomPx, 0, 160, 16),
    offsetRightPx: numInRange(data.offsetRightPx, 0, 240, 16),
    panelWidthPx: 400,
    panelHeightVh: 74,
    radiusPx: Number.isFinite(Number(style.radius)) ? numInRange(style.radius, 0, 36, 16) : theme.radius,
    buttonRadiusPx: Number.isFinite(Number(style.buttonRadius))
      ? numInRange(style.buttonRadius, 0, 36, 999)
      : theme.buttonRadius,
    quickReplyRadiusPx: Number.isFinite(Number(style.quickReplyRadius))
      ? numInRange(style.quickReplyRadius, 0, 36, 12)
      : 12,
    buttonColor: byMode(style.buttonColor, style.buttonColorLight, style.buttonColorDark),
    buttonTextColor: byMode(style.buttonTextColor, style.buttonTextColorLight, style.buttonTextColorDark),
    panelColor: byMode(style.blockBg, style.blockBgLight, style.blockBgDark),
    textColor: byMode(style.textColor, style.textColorLight, style.textColorDark),
    borderColor: byMode(style.borderColor, style.borderColorLight, style.borderColorDark),
    mutedColor: byMode(style.mutedColor, mutedPair.lightResolved, mutedPair.darkResolved),
    buttonColorLight: textOrNull(buttonPair.lightResolved) || null,
    buttonColorDark: textOrNull(buttonPair.darkResolved) || null,
    buttonTextColorLight: textOrNull(buttonTextPair.lightResolved) || null,
    buttonTextColorDark: textOrNull(buttonTextPair.darkResolved) || null,
    panelColorLight: textOrNull(panelPair.lightResolved) || null,
    panelColorDark: textOrNull(panelPair.darkResolved) || null,
    textColorLight: textOrNull(textPair.lightResolved) || null,
    textColorDark: textOrNull(textPair.darkResolved) || null,
    borderColorLight: textOrNull(borderPair.lightResolved) || null,
    borderColorDark: textOrNull(borderPair.darkResolved) || null,
    mutedColorLight: textOrNull(mutedPair.lightResolved) || null,
    mutedColorDark: textOrNull(mutedPair.darkResolved) || null,
    gradientEnabled: isDark ? gradientEnabledDark : gradientEnabledLight,
    gradientEnabledLight,
    gradientEnabledDark,
    gradientDirection: isDark ? gradientDirectionDark : gradientDirectionLight,
    gradientDirectionLight,
    gradientDirectionDark,
    panelGradientFrom: isDark ? panelGradientFromDark : panelGradientFromLight,
    panelGradientTo: isDark ? panelGradientToDark : panelGradientToLight,
    panelGradientFromLight,
    panelGradientFromDark,
    panelGradientToLight,
    panelGradientToDark,
    assistantBubbleColor: byMode(style.assistantBubbleColor, assistantBubblePair.lightResolved, assistantBubblePair.darkResolved),
    assistantTextColor: byMode(style.assistantTextColor, assistantTextPair.lightResolved, assistantTextPair.darkResolved),
    clientBubbleColor: byMode(style.clientBubbleColor, clientBubblePair.lightResolved, clientBubblePair.darkResolved),
    clientTextColor: byMode(style.clientTextColor, clientTextPair.lightResolved, clientTextPair.darkResolved),
    headerBgColor: byMode(style.headerBgColor, style.headerBgColorLight, style.headerBgColorDark),
    headerTextColor: byMode(style.headerTextColor, style.headerTextColorLight, style.headerTextColorDark),
    quickReplyButtonColor: byMode(style.quickReplyButtonColor, quickReplyButtonPair.lightResolved, quickReplyButtonPair.darkResolved),
    quickReplyTextColor: byMode(style.quickReplyTextColor, quickReplyTextPair.lightResolved, quickReplyTextPair.darkResolved),
    assistantBubbleColorLight: textOrNull(assistantBubblePair.lightResolved) || null,
    assistantBubbleColorDark: textOrNull(assistantBubblePair.darkResolved) || null,
    assistantTextColorLight: textOrNull(assistantTextPair.lightResolved) || null,
    assistantTextColorDark: textOrNull(assistantTextPair.darkResolved) || null,
    clientBubbleColorLight: textOrNull(clientBubblePair.lightResolved) || null,
    clientBubbleColorDark: textOrNull(clientBubblePair.darkResolved) || null,
    clientTextColorLight: textOrNull(clientTextPair.lightResolved) || null,
    clientTextColorDark: textOrNull(clientTextPair.darkResolved) || null,
    headerBgColorLight: textOrNull(headerBgPair.lightResolved) || null,
    headerBgColorDark: textOrNull(headerBgPair.darkResolved) || null,
    headerTextColorLight: textOrNull(headerTextPair.lightResolved) || null,
    headerTextColorDark: textOrNull(headerTextPair.darkResolved) || null,
    quickReplyButtonColorLight: textOrNull(quickReplyButtonPair.lightResolved) || null,
    quickReplyButtonColorDark: textOrNull(quickReplyButtonPair.darkResolved) || null,
    quickReplyTextColorLight: textOrNull(quickReplyTextPair.lightResolved) || null,
    quickReplyTextColorDark: textOrNull(quickReplyTextPair.darkResolved) || null,
    backdropColor: byMode(style.aishaBackdropColor, backdropPair.lightResolved, backdropPair.darkResolved),
    backdropColorLight: textOrNull(backdropPair.lightResolved) || null,
    backdropColorDark: textOrNull(backdropPair.darkResolved) || null,
    backdropOpacity: isDark ? backdropOpacityDark : backdropOpacityLight,
    backdropOpacityLight,
    backdropOpacityDark,
    fontHeading: textOrNull(style.fontHeading) || textOrNull(theme.fontHeading) || null,
    fontBody: textOrNull(style.fontBody) || textOrNull(theme.fontBody) || null,
    headingSizePx: Number.isFinite(Number(style.headingSize))
      ? numInRange(style.headingSize, 10, 96, 14)
      : 14,
    subheadingSizePx: Number.isFinite(Number(style.subheadingSize))
      ? numInRange(style.subheadingSize, 10, 64, theme.subheadingSize)
      : theme.subheadingSize,
    textSizePx: Number.isFinite(Number(style.textSize))
      ? numInRange(style.textSize, 10, 48, theme.textSize)
      : theme.textSize,
    messageRadiusPx: Number.isFinite(Number(style.messageRadius))
      ? numInRange(style.messageRadius, 4, 32, 16)
      : null,
    panelShadowColor: textOrNull(style.shadowColor) || textOrNull(theme.shadowColor) || null,
    panelShadowSize: Number.isFinite(Number(style.shadowSize))
      ? numInRange(style.shadowSize, 0, 40, 16)
      : theme.shadowSize,
  };
}

export const makeBlockId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createMenuBlock = (accountTitle = ""): SiteBlock => ({
  id: makeBlockId(),
  type: "menu",
  variant: "v1",
  data: {
    title: "Меню",
    menuItems: [...MENU_PAGE_KEYS],
    showLogo: true,
    showCompanyName: true,
    showOnAllPages: true,
    showButton: true,
    showThemeToggle: true,
    ctaMode: "booking",
    phoneOverride: "",
    buttonText: "Записаться",
    showSearch: false,
    showAccount: false,
    presetVersion: 1,
    accountTitle,
    menuHeight: 64,
    showSocials: false,
    socialIconSize: 40,
    position: "static",
    socialsMode: "auto",
    menuBlockBackgroundMode: "solid",
    menuBlockBackgroundFrom: "#ffffff",
    menuBlockBackgroundModeDark: "solid",
    menuBlockBackgroundFromDark: "#16181d",
    menuSectionBackgroundMode: "solid",
    menuSectionBackgroundFrom: "#ffffff",
    menuSectionBackgroundModeDark: "solid",
    menuSectionBackgroundFromDark: "#16181d",
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
    align: "center",
    style: {
      radius: 0,
      buttonRadius: 0,
      fontHeading: "var(--font-manrope), sans-serif",
      fontSubheading: "var(--font-manrope), sans-serif",
      fontBody: "var(--font-manrope), sans-serif",
      textAlign: "center",
      textAlignHeading: "center",
      textAlignSubheading: "center",
      fontWeightHeading: 500,
      fontWeightSubheading: 500,
      fontWeightBody: 400,
      headingSize: 15,
      subheadingSize: 14,
      textSize: 14,
      blockBgLight: "#ffffff",
      sectionBgLight: "#ffffff",
      blockBgDark: "#16181d",
      sectionBgDark: "#16181d",
      subBlockBgLight: "#ffffff",
      subBlockBgDark: "#1a1c22",
      borderColorLight: "transparent",
      borderColorDark: "transparent",
      borderColor: "transparent",
      textColorLight: "#111827",
      textColorDark: "#f2f3f5",
      mutedColorLight: "#4b5563",
      mutedColorDark: "#a1a5ad",
      buttonColorLight: "#000000",
      buttonColorDark: "#000000",
      buttonTextColorLight: "#ffffff",
      buttonTextColorDark: "#ffffff",
      shadowColor: "#111827",
      shadowSize: 0,
      gradientEnabledLight: false,
      gradientEnabledDark: false,
      gradientDirectionLight: "vertical",
      gradientDirectionDark: "vertical",
      gradientFromLight: "#ffffff",
      gradientToLight: "#f4f6f8",
      gradientFromDark: "#0c0e12",
      gradientToDark: "#111318",
    },
  },
});

const createBookingBlock = (): SiteBlock => ({
  id: makeBlockId(),
  type: "booking",
  variant: "v1",
  data: {
    style: {
      marginTop: 30,
      marginBottom: 30,
      blockWidth: 1400,
      blockWidthColumns: 12,
      mobileBlockWidthColumns: 12,
      radius: 5,
      shadowSize: 0,
      headingSize: 18,
      subheadingSize: 16,
      textSize: 14,
    },
  },
});

const createAishaBlock = (): SiteBlock => ({
  id: makeBlockId(),
  type: "aisha",
  variant: "v1",
  data: {
    title: "AI-ассистент записи",
    assistantName: "Ассистент",
    enabled: true,
    label: "AI Ассистент",
    offsetBottomPx: 16,
    offsetRightPx: 16,
  },
});

const createClientBlock = (): SiteBlock => ({
  id: makeBlockId(),
  type: "client",
  variant: "v1",
  data: {
    style: {
      blockWidth: 1400,
      blockWidthColumns: 12,
      mobileBlockWidthColumns: 12,
      radius: 16,
      buttonRadius: 8,
      shadowSize: 0,
      authPageBg: "#f3f4f6",
      authBlockBg: "#ffffff",
      authSideBg: "#1f2937",
      authRightBg: "#ffffff",
      authRadius: 0,
      authButtonRadius: 0,
      authTitleSize: 32,
      authTextSize: 14,
      authFormTitleSize: 24,
      authFormTextSize: 14,
      authButtonTextSize: 14,
      authSocialButtonTextSize: 14,
      authSideTextColor: "#ffffff",
      authSideMutedColor: "rgba(255,255,255,0.8)",
      authRightTextColor: "#111827",
      authRightMutedColor: "#6b7280",
      authButtonColor: "#111827",
      authButtonTextColor: "#ffffff",
      authSocialButtonColor: "#ffffff",
      authSocialButtonTextColor: "#111827",
      authSocialButtonBorderColor: "#e5e7eb",
      cabinetPageBg: "#eef2f7",
      cabinetBlockBg: "#ffffff",
      cabinetRadius: 0,
      cabinetButtonRadius: 16,
      cabinetTitleSize: 32,
      cabinetTextSize: 14,
      cabinetButtonTextSize: 14,
      cabinetTextColor: "#111827",
      cabinetMutedColor: "#6b7280",
      cabinetButtonColor: "#111827",
      cabinetButtonTextColor: "#ffffff",
      cabinetSecondaryButtonColor: "#ffffff",
      cabinetSecondaryButtonTextColor: "#111827",
    },
  },
});

const createClientLoginBlock = (): SiteBlock => {
  const block = createClientBlock();
  const data = block.data as Record<string, unknown>;
  const style = data.style && typeof data.style === "object" ? (data.style as Record<string, unknown>) : {};
  return {
    ...block,
    type: "clientLogin",
    data: {
      ...data,
      clientView: "login",
      style: {
        ...style,
        blockWidthColumns: 6,
        blockWidth: 700,
        gridStartColumn: 4,
        gridEndColumn: 9,
        authPageBgDark: "#0f1012",
        authBlockBgDark: "#181b22",
        authSideBgDark: "#111827",
        authRightBgDark: "#181b22",
        authSideTextColorDark: "#f8fafc",
        authSideMutedColorDark: "#aeb4bf",
        authRightTextColorDark: "#f8fafc",
        authRightMutedColorDark: "#aeb4bf",
        authButtonColorDark: "#f8fafc",
        authButtonTextColorDark: "#111827",
        authSocialButtonColorDark: "#20242d",
        authSocialButtonTextColorDark: "#f8fafc",
        authSocialButtonBorderColorDark: "#343a46",
      },
    },
  };
};

const createClientCabinetBlock = (): SiteBlock => {
  const block = createClientBlock();
  const data = block.data as Record<string, unknown>;
  const style = data.style && typeof data.style === "object" ? (data.style as Record<string, unknown>) : {};
  return {
    ...block,
    type: "clientCabinet",
    data: {
      ...data,
      clientView: "cabinet",
      cabinetTitle: "Личный кабинет",
      cabinetEmail: "client@example.com",
      cabinetSectionLabel: "Клиентский кабинет",
      appointmentTitle: "Следующая запись",
      appointmentEmptyText: "Пока нет ближайших записей.",
      smartHintTitle: "Умные подсказки",
      smartHintText: "Вы недавно были у нас. Хотите повторить услугу позже?",
      loyaltyTitle: "Лояльность",
      loyaltyStatusText: "Статус: Базовый",
      contactsTitle: "Контакты",
      organizationsTitle: "Каталог организаций",
      style: {
        ...style,
        blockWidthColumns: 8,
        blockWidth: 933,
        gridStartColumn: 3,
        gridEndColumn: 10,
        cabinetPageBgDark: "#0f1012",
        cabinetBlockBgDark: "#181b22",
        cabinetTextColorDark: "#f8fafc",
        cabinetMutedColorDark: "#aeb4bf",
        cabinetButtonColorDark: "#f8fafc",
        cabinetButtonTextColorDark: "#111827",
        cabinetSecondaryButtonColorDark: "#20242d",
        cabinetSecondaryButtonTextColorDark: "#f8fafc",
      },
    },
  };
};

const createLegalBlock = (): SiteBlock => ({
  id: makeBlockId(),
  type: "legal",
  variant: "v1",
  data: {
    title: "Документы",
    subtitle: "Правовые документы и согласия",
    style: {
      blockWidth: 960,
      blockWidthColumns: 8,
      mobileBlockWidthColumns: 12,
      radius: 16,
      buttonRadius: 8,
      shadowSize: 0,
    },
  },
});

export const createDefaultDraft = (accountName: string): SiteDraft => {
  const safeAccountName = accountName?.trim() || DEFAULT_ACCOUNT_NAME;
  const homeBlocks: SiteBlock[] = [
    createMenuBlock(safeAccountName),
    {
      id: makeBlockId(),
      type: "cover",
      variant: "v1",
      data: {
        title: "Онлайн-запись",
        subtitle: "Онлайн-запись по услугам, специалистам и слотам",
        description: "Выберите услугу, специалиста или группу и удобное время.",
        buttonText: "Записаться онлайн",
        showButton: true,
        secondaryButtonText: "Наши соцсети",
        showSecondaryButton: false,
        secondaryButtonSource: "auto",
        coverScrollEffect: "none",
        coverScrollHeight: "900px",
        coverFilterStartColor: "#000000",
        coverFilterStartOpacity: 10,
        coverFilterStartColorDark: "#000000",
        coverFilterStartOpacityDark: 10,
        coverFilterEndColor: "#0f0f0f",
        coverFilterEndOpacity: 60,
        coverFilterEndColorDark: "#0f0f0f",
        coverFilterEndOpacityDark: 60,
        coverBackgroundModeDark: "solid",
        coverBackgroundFromDark: "#0f1012",
        coverBackgroundToDark: "#16181d",
        coverBackgroundAngleDark: 135,
        coverBackgroundStopADark: 0,
        coverBackgroundStopBDark: 100,
        coverSubtitleColor: "#ffffff",
        coverSubtitleColorDark: "#ffffff",
        coverDescriptionColor: "#ffffff",
        coverDescriptionColorDark: "#ffffff",
        coverArrowDark: "none",
        coverArrowColorDark: "#ffffff",
        coverPrimaryButtonBorderColorDark: "transparent",
        coverPrimaryButtonHoverBgColor: "transparent",
        coverPrimaryButtonHoverBgColorDark: "transparent",
        coverSecondaryButtonColorDark: "transparent",
        coverSecondaryButtonTextColorDark: "#ffffff",
        coverSecondaryButtonBorderColorDark: "#ffffff",
        coverSecondaryButtonHoverBgColor: "transparent",
        coverSecondaryButtonHoverBgColorDark: "transparent",
        coverHeight: 100,
        align: "left",
        coverContentVerticalAlign: "center",
        coverImageInsetPx: 0,
        coverImageRadiusPx: 0,
        coverFlipHorizontal: false,
        imageSource: { type: "account" } as CoverImageSource,
        style: {
          useCustomWidth: true,
          blockWidth: 1400,
          blockWidthColumns: 7,
          textAlign: "left",
          textAlignHeading: "left",
          textAlignSubheading: "left",
          fontHeading: "Manrope",
          fontSubheading: "Manrope",
          fontBody: "Manrope",
          headingSize: 48,
          subheadingSize: 35,
          textSize: 28,
          textColorLight: "#ffffff",
          textColorDark: "#ffffff",
          textColor: "#ffffff",
          mutedColorLight: "rgba(255,255,255,0.9)",
          mutedColorDark: "rgba(255,255,255,0.9)",
          mutedColor: "rgba(255,255,255,0.9)",
        },
      },
    },
    {
      id: makeBlockId(),
      type: "loader",
      variant: "v1",
      data: {
        enabled: true,
        showPageOverlay: true,
        showBookingInline: true,
        backdropEnabled: false,
        backdropColor: "rgba(17,24,39,0.16)",
        backdropHex: "#111827",
        backdropOpacity: 0.16,
        backdropMode: "solid",
        backdropAngle: 180,
        backdropColorDark: "rgba(17,24,39,0.16)",
        backdropHexDark: "#111827",
        backdropOpacityDark: 0.16,
        backdropModeDark: "solid",
        backdropAngleDark: 180,
        color: "#111827",
        colorDark: "#111827",
        colorMode: "solid",
        colorModeDark: "solid",
        colorAngle: 180,
        colorAngleDark: 180,
        size: 36,
        speedMs: 900,
        thickness: 1,
        fixedDurationEnabled: false,
        fixedDurationSec: 1,
        style: {
          useCustomWidth: false,
          blockWidth: null,
          blockWidthColumns: null,
        },
      },
    },
  ];
  const bookingBlocks: SiteBlock[] = [createBookingBlock()];
  const aishaBlocks: SiteBlock[] = [createAishaBlock()];
  const clientBlocks: SiteBlock[] = [createClientBlock()];
  const clientLoginBlocks: SiteBlock[] = [createClientLoginBlock()];
  const clientCabinetBlocks: SiteBlock[] = [createClientCabinetBlock()];
  const legalBlocks: SiteBlock[] = [createLegalBlock()];

  const baseTheme: SiteThemePalette = {
    fontHeading: "var(--font-manrope), sans-serif",
    fontBody: "var(--font-manrope), sans-serif",
    accentColor: "#111827",
    shadowColor: "#111827",
    shadowSize: 18,
    contentWidth: 1120,
    gradientEnabled: false,
    gradientDirection: "vertical",
    gradientFrom: DEFAULT_LIGHT_SURFACE_COLOR,
    gradientTo: "#ffffff",
    surfaceColor: DEFAULT_LIGHT_SURFACE_COLOR,
    panelColor: "#FFFFFF",
    textColor: "#111827",
    mutedColor: "#6B7280",
    borderColor: "#E5E7EB",
    buttonColor: "#111827",
    buttonTextColor: "#FFFFFF",
    radius: 28,
    buttonRadius: 0,
    blockSpacing: 0,
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
    accentColor: "#d3d6db",
    shadowColor: "#00000080",
    shadowSize: 0,
    gradientFrom: "#0c0e12",
    gradientTo: "#111318",
    surfaceColor: "#14161a",
    panelColor: "#16181d",
    textColor: "#f2f3f5",
    mutedColor: "#a1a5ad",
    borderColor: "#ffffff14",
    buttonColor: "#d3d6db",
    buttonTextColor: "#0f1012",
    clientCardBg: "#1a1c22",
    clientButtonColor: "#d3d6db",
    clientButtonTextColor: "#0f1012",
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
      booking: bookingBlocks,
      aisha: aishaBlocks,
      client: clientBlocks,
      clientLogin: clientLoginBlocks,
      clientCabinet: clientCabinetBlocks,
      legal: legalBlocks,
      locations: [],
      services: [],
      specialists: [],
      promos: [],
    },
    entityPages: {},
  };
};

export const normalizeDraft = (value: unknown, accountName?: string): SiteDraft => {
  const safeAccountName = accountName?.trim() || DEFAULT_ACCOUNT_NAME;
  if (!value || typeof value !== "object") {
    return createDefaultDraft(safeAccountName);
  }
  const draft = value as SiteDraft;
  if (draft.version !== 1 || !Array.isArray(draft.blocks)) {
    return createDefaultDraft(safeAccountName);
  }
  const fallbackTheme = createDefaultDraft(safeAccountName).theme;
  const migrateLegacyButtonRadius = (raw: unknown, fallback: number) => {
    if (!Number.isFinite(raw)) return fallback;
    const next = Number(raw);
    return next === 999 ? 0 : next;
  };
  const normalizePalette = (
    palette: Partial<SiteThemePalette> | undefined,
    fallback: SiteThemePalette
  ): SiteThemePalette => {
    const rawSurfaceColor =
      typeof palette?.surfaceColor === "string" ? palette.surfaceColor : fallback.surfaceColor;
    const normalizedSurfaceColor =
      LEGACY_LIGHT_SURFACE_COLORS.has(rawSurfaceColor.trim().toLowerCase())
        ? DEFAULT_LIGHT_SURFACE_COLOR
        : rawSurfaceColor;

    return {
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
    surfaceColor: normalizedSurfaceColor,
    panelColor: palette?.panelColor || fallback.panelColor,
    textColor: palette?.textColor || fallback.textColor,
    mutedColor: palette?.mutedColor || fallback.mutedColor,
    borderColor: palette?.borderColor || fallback.borderColor,
    buttonColor: palette?.buttonColor || fallback.buttonColor,
    buttonTextColor: palette?.buttonTextColor || fallback.buttonTextColor,
    radius: Number.isFinite(palette?.radius) ? (palette?.radius as number) : fallback.radius,
    buttonRadius: migrateLegacyButtonRadius(palette?.buttonRadius, fallback.buttonRadius),
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
    };
  };
  const normalizeBlocks = (blocks: SiteBlock[]) =>
    blocks
      .filter((block) => block && typeof block === "object")
      .map((block, index) => {
        const safeData =
          typeof block.data === "object" && block.data ? { ...block.data } : {};
        if (block.type === "cover") {
          const rawTitle = typeof safeData.title === "string" ? safeData.title.trim() : "";
          if (!rawTitle || rawTitle.toLowerCase() === DEFAULT_ACCOUNT_NAME.toLowerCase()) {
            safeData.title = "Онлайн-запись";
          }
        }
        if (safeData.style && typeof safeData.style === "object") {
          const style = { ...(safeData.style as Record<string, unknown>) };
          if (Number.isFinite(style.buttonRadius) && Number(style.buttonRadius) === 999) {
            style.buttonRadius = 0;
          }
          safeData.style = style;
        }
        if (block.type === "menu") {
          const normalizeMenuColor = (value: unknown) => {
            const raw = typeof value === "string" ? value.trim().replace(/;$/, "").toLowerCase() : "";
            if (!raw) return value;
            if (/^rgba\(\s*22\s*,\s*24\s*,\s*29\s*,\s*0?\.?9\s*\)$/.test(raw)) return "#16181d";
            if (/^rgba\(\s*26\s*,\s*28\s*,\s*34\s*,\s*0?\.?92\s*\)$/.test(raw)) return "#1a1c22";
            if (/^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.?08\s*\)$/.test(raw)) return "#ffffff14";
            if (/^rgba\(\s*17\s*,\s*24\s*,\s*39\s*,\s*0?\.?12\s*\)$/.test(raw)) return "#111827";
            const rgba = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([01]?(?:\.\d+)?))?\s*\)$/i.exec(raw);
            if (rgba) {
              const r = Number(rgba[1]);
              const g = Number(rgba[2]);
              const b = Number(rgba[3]);
              if (r === 22 && g === 24 && b === 29) return "#16181d";
              if (r === 26 && g === 28 && b === 34) return "#1a1c22";
              if (r === 17 && g === 24 && b === 39) return "#111827";
              if (r === 255 && g === 255 && b === 255) return "#ffffff14";
              const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
              const alphaRaw = rgba[4];
              if (typeof alphaRaw === "undefined") {
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
              }
              const alpha = Math.max(0, Math.min(1, Number(alphaRaw)));
              if (!Number.isFinite(alpha) || alpha >= 0.999) {
                return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
              }
              return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(Math.round(alpha * 255))}`;
            }
            return value;
          };
          const menuItems = Array.isArray(safeData.menuItems)
            ? MENU_PAGE_KEYS.filter((key) => (safeData.menuItems as SitePageKey[]).includes(key))
            : [];
          const presetVersionRaw = Number(safeData.presetVersion);
          const hasMenuPreset = Number.isFinite(presetVersionRaw) && presetVersionRaw >= 1;
          if (!hasMenuPreset) {
            safeData.presetVersion = 1;
          }
          if (typeof safeData.showOnAllPages !== "boolean") {
            safeData.showOnAllPages = true;
          }
          if (typeof safeData.showThemeToggle !== "boolean") {
            safeData.showThemeToggle = true;
          }
          if (!hasMenuPreset || typeof safeData.align !== "string" || !safeData.align.trim()) {
            safeData.align = "center";
          }
          if (!hasMenuPreset || typeof safeData.menuBlockBackgroundMode !== "string") {
            safeData.menuBlockBackgroundMode = "solid";
          }
          if (!hasMenuPreset || typeof safeData.menuBlockBackgroundFrom !== "string" || !safeData.menuBlockBackgroundFrom.trim()) {
            safeData.menuBlockBackgroundFrom = "#ffffff";
          }
          if (!hasMenuPreset || typeof safeData.menuBlockBackgroundModeDark !== "string") {
            safeData.menuBlockBackgroundModeDark = "solid";
          }
          if (!hasMenuPreset || typeof safeData.menuBlockBackgroundFromDark !== "string" || !safeData.menuBlockBackgroundFromDark.trim()) {
            safeData.menuBlockBackgroundFromDark = "#16181d";
          }
          if (!hasMenuPreset || typeof safeData.menuSectionBackgroundMode !== "string") {
            safeData.menuSectionBackgroundMode = "solid";
          }
          if (!hasMenuPreset || typeof safeData.menuSectionBackgroundFrom !== "string" || !safeData.menuSectionBackgroundFrom.trim()) {
            safeData.menuSectionBackgroundFrom = "#ffffff";
          }
          if (!hasMenuPreset || typeof safeData.menuSectionBackgroundModeDark !== "string") {
            safeData.menuSectionBackgroundModeDark = "solid";
          }
          if (!hasMenuPreset || typeof safeData.menuSectionBackgroundFromDark !== "string" || !safeData.menuSectionBackgroundFromDark.trim()) {
            safeData.menuSectionBackgroundFromDark = "#16181d";
          }
          safeData.menuBlockBackgroundFrom = normalizeMenuColor(safeData.menuBlockBackgroundFrom);
          safeData.menuBlockBackgroundFromDark = normalizeMenuColor(safeData.menuBlockBackgroundFromDark);
          safeData.menuSectionBackgroundFrom = normalizeMenuColor(safeData.menuSectionBackgroundFrom);
          safeData.menuSectionBackgroundFromDark = normalizeMenuColor(safeData.menuSectionBackgroundFromDark);
          const menuHeightRaw = Number(safeData.menuHeight);
          if (!hasMenuPreset || !Number.isFinite(menuHeightRaw) || menuHeightRaw < 56) {
            safeData.menuHeight = block.variant === "v1" ? 64 : 56;
          }
          safeData.menuItems = menuItems.length
            ? menuItems
            : [...MENU_PAGE_KEYS];
          const socialIconSizeRaw = Number(safeData.socialIconSize);
          safeData.socialIconSize =
            Number.isFinite(socialIconSizeRaw) && socialIconSizeRaw >= 24 && socialIconSizeRaw <= 72
              ? Math.round(socialIconSizeRaw)
              : 40;
          const menuStyle =
            typeof safeData.style === "object" && safeData.style
              ? { ...(safeData.style as Record<string, unknown>) }
              : {};
          if (!hasMenuPreset || typeof menuStyle.radius !== "number") menuStyle.radius = 0;
          if (!hasMenuPreset || typeof menuStyle.buttonRadius !== "number") menuStyle.buttonRadius = 0;
          if (!hasMenuPreset || typeof menuStyle.fontHeading !== "string" || !menuStyle.fontHeading.trim()) {
            menuStyle.fontHeading = "var(--font-manrope), sans-serif";
          }
          if (!hasMenuPreset || typeof menuStyle.fontSubheading !== "string" || !menuStyle.fontSubheading.trim()) {
            menuStyle.fontSubheading = "var(--font-manrope), sans-serif";
          }
          if (!hasMenuPreset || typeof menuStyle.fontBody !== "string" || !menuStyle.fontBody.trim()) {
            menuStyle.fontBody = "var(--font-manrope), sans-serif";
          }
          if (!hasMenuPreset || typeof menuStyle.textAlign !== "string" || !menuStyle.textAlign.trim()) {
            menuStyle.textAlign = "center";
          }
          if (!hasMenuPreset || typeof menuStyle.textAlignHeading !== "string" || !menuStyle.textAlignHeading.trim()) {
            menuStyle.textAlignHeading = "center";
          }
          if (!hasMenuPreset || typeof menuStyle.textAlignSubheading !== "string" || !menuStyle.textAlignSubheading.trim()) {
            menuStyle.textAlignSubheading = "center";
          }
          const headingSizeRaw = Number(menuStyle.headingSize);
          if (!hasMenuPreset || !Number.isFinite(headingSizeRaw) || headingSizeRaw > 22 || headingSizeRaw < 12) {
            menuStyle.headingSize = 15;
          }
          const subheadingSizeRaw = Number(menuStyle.subheadingSize);
          if (!hasMenuPreset || !Number.isFinite(subheadingSizeRaw) || subheadingSizeRaw > 20 || subheadingSizeRaw < 12) {
            menuStyle.subheadingSize = 14;
          }
          const textSizeRaw = Number(menuStyle.textSize);
          if (!hasMenuPreset || !Number.isFinite(textSizeRaw) || textSizeRaw > 18 || textSizeRaw < 12) {
            menuStyle.textSize = 14;
          }
          if (!hasMenuPreset || !Number.isFinite(Number(menuStyle.fontWeightHeading))) menuStyle.fontWeightHeading = 500;
          if (!hasMenuPreset || !Number.isFinite(Number(menuStyle.fontWeightSubheading))) menuStyle.fontWeightSubheading = 500;
          if (!hasMenuPreset || !Number.isFinite(Number(menuStyle.fontWeightBody))) menuStyle.fontWeightBody = 400;
          if (!hasMenuPreset || typeof menuStyle.blockBgLight !== "string" || !menuStyle.blockBgLight.trim()) {
            menuStyle.blockBgLight = "#ffffff";
          }
          if (!hasMenuPreset || typeof menuStyle.sectionBgLight !== "string" || !menuStyle.sectionBgLight.trim()) {
            menuStyle.sectionBgLight = "#ffffff";
          }
          if (!hasMenuPreset || typeof menuStyle.blockBgDark !== "string" || !menuStyle.blockBgDark.trim()) {
            menuStyle.blockBgDark = "#16181d";
          }
          if (!hasMenuPreset || typeof menuStyle.sectionBgDark !== "string" || !menuStyle.sectionBgDark.trim()) {
            menuStyle.sectionBgDark = "#16181d";
          }
          if (!hasMenuPreset || typeof menuStyle.subBlockBgLight !== "string" || !menuStyle.subBlockBgLight.trim()) {
            menuStyle.subBlockBgLight = "#ffffff";
          }
          if (!hasMenuPreset || typeof menuStyle.subBlockBgDark !== "string" || !menuStyle.subBlockBgDark.trim()) {
            menuStyle.subBlockBgDark = "#1a1c22";
          }
          if (!hasMenuPreset || typeof menuStyle.borderColorLight !== "string" || !menuStyle.borderColorLight.trim()) {
            menuStyle.borderColorLight = "transparent";
          }
          if (!hasMenuPreset || typeof menuStyle.borderColorDark !== "string" || !menuStyle.borderColorDark.trim()) {
            menuStyle.borderColorDark = "transparent";
          }
          if (!hasMenuPreset || typeof menuStyle.textColorLight !== "string" || !menuStyle.textColorLight.trim()) {
            menuStyle.textColorLight = "#111827";
          }
          if (!hasMenuPreset || typeof menuStyle.textColorDark !== "string" || !menuStyle.textColorDark.trim()) {
            menuStyle.textColorDark = "#f2f3f5";
          }
          if (!hasMenuPreset || typeof menuStyle.mutedColorLight !== "string" || !menuStyle.mutedColorLight.trim()) {
            menuStyle.mutedColorLight = "#4b5563";
          }
          if (!hasMenuPreset || typeof menuStyle.mutedColorDark !== "string" || !menuStyle.mutedColorDark.trim()) {
            menuStyle.mutedColorDark = "#a1a5ad";
          }
          if (!hasMenuPreset || typeof menuStyle.buttonColorLight !== "string" || !menuStyle.buttonColorLight.trim()) {
            menuStyle.buttonColorLight = "#111827";
          }
          if (!hasMenuPreset || typeof menuStyle.buttonColorDark !== "string" || !menuStyle.buttonColorDark.trim()) {
            menuStyle.buttonColorDark = "#d3d6db";
          }
          if (!hasMenuPreset || typeof menuStyle.buttonTextColorLight !== "string" || !menuStyle.buttonTextColorLight.trim()) {
            menuStyle.buttonTextColorLight = "#ffffff";
          }
          if (!hasMenuPreset || typeof menuStyle.buttonTextColorDark !== "string" || !menuStyle.buttonTextColorDark.trim()) {
            menuStyle.buttonTextColorDark = "#0f1012";
          }
          if (!Number.isFinite(Number(menuStyle.shadowSize))) {
            menuStyle.shadowSize = 0;
          }
          if (typeof menuStyle.shadowColor !== "string" || !menuStyle.shadowColor.trim()) {
            menuStyle.shadowColor = "#111827";
          }
          menuStyle.blockBgDark = normalizeMenuColor(menuStyle.blockBgDark);
          menuStyle.sectionBgDark = normalizeMenuColor(menuStyle.sectionBgDark);
          menuStyle.subBlockBgDark = normalizeMenuColor(menuStyle.subBlockBgDark);
          menuStyle.borderColorLight = normalizeMenuColor(menuStyle.borderColorLight);
          menuStyle.borderColorDark = normalizeMenuColor(menuStyle.borderColorDark);
          menuStyle.borderColor = normalizeMenuColor(menuStyle.borderColor);
          menuStyle.shadowColor = normalizeMenuColor(menuStyle.shadowColor);
          if (String(menuStyle.borderColorLight).trim().toLowerCase() === "#e5e7eb") {
            menuStyle.borderColorLight = "transparent";
          }
          if (String(menuStyle.borderColorDark).trim().toLowerCase() === "#ffffff14") {
            menuStyle.borderColorDark = "transparent";
          }
          if (String(menuStyle.borderColor).trim().toLowerCase() === "#e5e7eb") {
            menuStyle.borderColor = "transparent";
          }
          if (!hasMenuPreset || typeof menuStyle.gradientEnabledLight !== "boolean") {
            menuStyle.gradientEnabledLight = false;
          }
          if (!hasMenuPreset || typeof menuStyle.gradientEnabledDark !== "boolean") {
            menuStyle.gradientEnabledDark = false;
          }
          if (!hasMenuPreset || typeof menuStyle.gradientDirectionLight !== "string" || !menuStyle.gradientDirectionLight.trim()) {
            menuStyle.gradientDirectionLight = "vertical";
          }
          if (!hasMenuPreset || typeof menuStyle.gradientDirectionDark !== "string" || !menuStyle.gradientDirectionDark.trim()) {
            menuStyle.gradientDirectionDark = "vertical";
          }
          if (!hasMenuPreset || typeof menuStyle.gradientFromLight !== "string" || !menuStyle.gradientFromLight.trim()) {
            menuStyle.gradientFromLight = "#ffffff";
          }
          if (!hasMenuPreset || typeof menuStyle.gradientToLight !== "string" || !menuStyle.gradientToLight.trim()) {
            menuStyle.gradientToLight = "#ffffff";
          }
          if (!hasMenuPreset || typeof menuStyle.gradientFromDark !== "string" || !menuStyle.gradientFromDark.trim()) {
            menuStyle.gradientFromDark = "#0c0e12";
          }
          if (!hasMenuPreset || typeof menuStyle.gradientToDark !== "string" || !menuStyle.gradientToDark.trim()) {
            menuStyle.gradientToDark = "#111318";
          }
          safeData.style = menuStyle;
        }
        if (block.type === "works") {
          const rawTitle = typeof safeData.title === "string" ? safeData.title.trim() : "";
          safeData.title = rawTitle === "Галерея" ? "" : rawTitle;
          const galleryHeightRaw = Number(safeData.galleryHeight);
          safeData.galleryHeight =
            Number.isFinite(galleryHeightRaw) && galleryHeightRaw >= 220 && galleryHeightRaw <= 900
              ? Math.round(galleryHeightRaw)
              : 550;
          const imageRadiusRaw = Number(safeData.imageRadius);
          safeData.imageRadius =
            Number.isFinite(imageRadiusRaw) && imageRadiusRaw >= 0 && imageRadiusRaw <= 60
              ? Math.round(imageRadiusRaw)
              : 0;
          const safeStyle =
            typeof safeData.style === "object" && safeData.style
              ? { ...(safeData.style as Record<string, unknown>) }
              : {};
          if (!Number.isFinite(Number(safeStyle.radius))) {
            safeStyle.radius = 0;
          }
          // Gallery content color is tied to block color by design.
          const sectionBgLight =
            typeof safeStyle.sectionBgLight === "string" ? safeStyle.sectionBgLight : "";
          const sectionBgDark = typeof safeStyle.sectionBgDark === "string" ? safeStyle.sectionBgDark : "";
          const sectionBg = typeof safeStyle.sectionBg === "string" ? safeStyle.sectionBg : "";
          safeStyle.blockBgLight = sectionBgLight;
          safeStyle.blockBgDark = sectionBgDark;
          safeStyle.blockBg = sectionBg;
          safeData.style = safeStyle;
          safeData.imageFit = safeData.imageFit === "contain" ? "contain" : "cover";
          const maxSlidesRaw = Number(safeData.maxSlides);
          safeData.maxSlides =
            Number.isFinite(maxSlidesRaw) && maxSlidesRaw >= 1 && maxSlidesRaw <= 30
              ? Math.round(maxSlidesRaw)
              : 12;
          const arrowColorRaw = typeof safeData.arrowColor === "string" ? safeData.arrowColor.trim() : "";
          const arrowBgColorRaw = typeof safeData.arrowBgColor === "string" ? safeData.arrowBgColor.trim() : "";
          const dotActiveColorRaw =
            typeof safeData.dotActiveColor === "string" ? safeData.dotActiveColor.trim() : "";
          const dotInactiveColorRaw =
            typeof safeData.dotInactiveColor === "string" ? safeData.dotInactiveColor.trim() : "";
          safeData.arrowColor = arrowColorRaw;
          safeData.arrowColorLight =
            typeof safeData.arrowColorLight === "string" ? safeData.arrowColorLight.trim() : arrowColorRaw;
          safeData.arrowColorDark =
            typeof safeData.arrowColorDark === "string" ? safeData.arrowColorDark.trim() : "";
          safeData.arrowBgColor = arrowBgColorRaw;
          safeData.arrowBgColorLight =
            typeof safeData.arrowBgColorLight === "string"
              ? safeData.arrowBgColorLight.trim()
              : arrowBgColorRaw;
          safeData.arrowBgColorDark =
            typeof safeData.arrowBgColorDark === "string" ? safeData.arrowBgColorDark.trim() : "";
          safeData.dotActiveColor = dotActiveColorRaw;
          safeData.dotActiveColorLight =
            typeof safeData.dotActiveColorLight === "string"
              ? safeData.dotActiveColorLight.trim()
              : dotActiveColorRaw;
          safeData.dotActiveColorDark =
            typeof safeData.dotActiveColorDark === "string" ? safeData.dotActiveColorDark.trim() : "";
          safeData.dotInactiveColor = dotInactiveColorRaw;
          safeData.dotInactiveColorLight =
            typeof safeData.dotInactiveColorLight === "string"
              ? safeData.dotInactiveColorLight.trim()
              : dotInactiveColorRaw;
          safeData.dotInactiveColorDark =
            typeof safeData.dotInactiveColorDark === "string" ? safeData.dotInactiveColorDark.trim() : "";
          safeData.arrowVariant =
            safeData.arrowVariant === "angle" || safeData.arrowVariant === "triangle"
              ? safeData.arrowVariant
              : "chevron";
        }
        return {
          // Deterministic fallback id to avoid SSR/CSR hydration mismatch.
          id:
            typeof block.id === "string" && block.id.trim()
              ? block.id
              : `legacy-${String(block.type ?? "block")}-${index}`,
          type: block.type,
          variant: block.variant ?? "v1",
          data: safeData,
        };
      })
      .filter((block) => block.type in BLOCK_LABELS);

  const fallbackPages = createDefaultDraft(safeAccountName).pages!;
  const hasStructuredPages = Boolean(draft.pages && typeof draft.pages === "object");
  const pagesInput = hasStructuredPages
    ? (draft.pages as Partial<SitePages>)
    : { home: draft.blocks };
  const normalizedHomeBlocks = normalizeBlocks(pagesInput.home ?? draft.blocks ?? fallbackPages.home);
  const legacyAishaBlocks = normalizedHomeBlocks.filter((block) => block.type === "aisha");

  const pages: SitePages = {
    home: normalizedHomeBlocks.filter((block) => block.type !== "aisha"),
    booking: normalizeBlocks(pagesInput.booking ?? fallbackPages.booking),
    aisha: normalizeBlocks(
      pagesInput.aisha && pagesInput.aisha.length > 0
        ? pagesInput.aisha
        : legacyAishaBlocks.length > 0
          ? legacyAishaBlocks
          : fallbackPages.aisha
    ),
    client: normalizeBlocks(
      pagesInput.client && pagesInput.client.length > 0 ? pagesInput.client : fallbackPages.client
    ),
    clientLogin: normalizeBlocks(
      pagesInput.clientLogin && pagesInput.clientLogin.length > 0
        ? pagesInput.clientLogin
        : fallbackPages.clientLogin
    ),
    clientCabinet: normalizeBlocks(
      pagesInput.clientCabinet && pagesInput.clientCabinet.length > 0
        ? pagesInput.clientCabinet
        : fallbackPages.clientCabinet
    ),
    legal: normalizeBlocks(
      pagesInput.legal && pagesInput.legal.length > 0 ? pagesInput.legal : fallbackPages.legal
    ),
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
    legalDocuments: normalizeEntityMap(rawEntityPages.legalDocuments),
  };

  if (!hasStructuredPages && !pages.home.some((block) => block.type === "menu")) {
    pages.home = [createMenuBlock(safeAccountName), ...pages.home];
  }
  const normalizeTheme = (
    source: Partial<SiteTheme> | undefined,
    fallback: SiteTheme
  ): SiteTheme => {
    const base = source ?? {};
    const mode = base.mode === "dark" ? "dark" : "light";
    const lightPalette = normalizePalette(
      base.lightPalette ?? (mode === "light" ? (base as Partial<SiteThemePalette>) : undefined),
      fallback.lightPalette
    );
    const darkPalette = normalizePalette(
      base.darkPalette ?? (mode === "dark" ? (base as Partial<SiteThemePalette>) : undefined),
      fallback.darkPalette
    );
    const activePalette = mode === "dark" ? darkPalette : lightPalette;
    return {
      ...activePalette,
      mode,
      lightPalette,
      darkPalette,
    };
  };

  const normalizedTheme = normalizeTheme(draft.theme as Partial<SiteTheme> | undefined, fallbackTheme);
  const rawPageThemes =
    draft.pageThemes && typeof draft.pageThemes === "object"
      ? (draft.pageThemes as Partial<Record<SitePageKey, Partial<SiteTheme>>>)
      : {};
  const pageThemes: Partial<Record<SitePageKey, SiteTheme>> = {};
  SITE_PAGE_KEYS.forEach((pageKey) => {
    const candidate = rawPageThemes[pageKey];
    if (candidate && typeof candidate === "object") {
      pageThemes[pageKey] = normalizeTheme(candidate, normalizedTheme);
    }
  });

  return {
    version: 1,
    theme: normalizedTheme,
    pageThemes,
    blocks: pages.home,
    pages,
    entityPages,
  };
};

