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
  | "client"
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
  | "client"
  | "locations"
  | "services"
  | "specialists"
  | "promos";

export const SITE_PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "client",
  "locations",
  "services",
  "specialists",
  "promos",
];
export const DEFAULT_ACCOUNT_NAME = "Салон красоты";

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
  messageRadiusPx: number | null;
  panelShadowColor: string | null;
  panelShadowSize: number | null;
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
    fixedDurationEnabled:
      typeof data.fixedDurationEnabled === "boolean"
        ? data.fixedDurationEnabled
        : DEFAULT_LOADER_CONFIG.fixedDurationEnabled,
    fixedDurationSec: clamp(data.fixedDurationSec, 1, 10, DEFAULT_LOADER_CONFIG.fixedDurationSec),
  };
}


export function resolveAishaWidgetConfig(draft: SiteDraft, modeOverride?: "light" | "dark"): SiteAishaWidgetConfig {
  const homeBlocks = draft.pages?.home ?? draft.blocks;
  const aishaBlock = homeBlocks.find((block) => block.type === "aisha") ?? null;
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
      buttonColor: null,
      buttonTextColor: null,
      panelColor: null,
      textColor: null,
      borderColor: null,
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
    offsetBottomPx: numInRange(data.offsetBottomPx, 8, 64, 16),
    offsetRightPx: numInRange(data.offsetRightPx, 8, 64, 16),
    panelWidthPx: 400,
    panelHeightVh: 74,
    radiusPx: Number.isFinite(Number(style.radius)) ? numInRange(style.radius, 0, 36, 16) : theme.radius,
    buttonRadiusPx: Number.isFinite(Number(style.buttonRadius))
      ? numInRange(style.buttonRadius, 0, 36, 999)
      : theme.buttonRadius,
    buttonColor: byMode(style.buttonColor, style.buttonColorLight, style.buttonColorDark),
    buttonTextColor: byMode(style.buttonTextColor, style.buttonTextColorLight, style.buttonTextColorDark),
    panelColor: byMode(style.blockBg, style.blockBgLight, style.blockBgDark),
    textColor: byMode(style.textColor, style.textColorLight, style.textColorDark),
    borderColor: byMode(style.borderColor, style.borderColorLight, style.borderColorDark),
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
    menuItems: ["home", "booking", "client", "locations", "services", "specialists", "promos"],
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
      borderColorLight: "#e5e7eb",
      borderColorDark: "#ffffff14",
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

export const createDefaultDraft = (accountName: string): SiteDraft => {
  const safeAccountName = accountName?.trim() || DEFAULT_ACCOUNT_NAME;
  const homeBlocks: SiteBlock[] = [
    createMenuBlock(safeAccountName),
    {
      id: makeBlockId(),
      type: "cover",
      variant: "v1",
      data: {
        title: safeAccountName,
        subtitle: "Онлайн-запись и лучшие специалисты рядом",
        description: "Выберите услугу, специалиста и удобное время.",
        buttonText: "Записаться",
        showButton: true,
        secondaryButtonText: "Наши соцсети",
        showSecondaryButton: false,
        secondaryButtonSource: "auto",
        coverScrollEffect: "none",
        coverScrollHeight: "700px",
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
        color: "#111827",
        size: 36,
        speedMs: 900,
        thickness: 3,
        fixedDurationEnabled: false,
        fixedDurationSec: 1,
        style: {
          useCustomWidth: false,
          blockWidth: null,
          blockWidthColumns: null,
        },
      },
    },
    {
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
    },
  ];

  const baseTheme: SiteThemePalette = {
    fontHeading: "var(--font-manrope), sans-serif",
    fontBody: "var(--font-manrope), sans-serif",
    accentColor: "#111827",
    shadowColor: "#111827",
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
      client: [],
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
  });
  const normalizeBlocks = (blocks: SiteBlock[]) =>
    blocks
      .filter((block) => block && typeof block === "object")
      .map((block, index) => {
        const safeData =
          typeof block.data === "object" && block.data ? { ...block.data } : {};
        if (block.type === "cover") {
          const rawTitle = typeof safeData.title === "string" ? safeData.title.trim() : "";
          if (!rawTitle || rawTitle.toLowerCase() === DEFAULT_ACCOUNT_NAME.toLowerCase()) {
            safeData.title = safeAccountName;
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
            const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
            if (!raw) return value;
            if (/^rgba\(\s*22\s*,\s*24\s*,\s*29\s*,\s*0?\.?9\s*\)$/.test(raw)) return "#16181d";
            if (/^rgba\(\s*26\s*,\s*28\s*,\s*34\s*,\s*0?\.?92\s*\)$/.test(raw)) return "#1a1c22";
            if (/^rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.?08\s*\)$/.test(raw)) return "#ffffff14";
            if (/^rgba\(\s*17\s*,\s*24\s*,\s*39\s*,\s*0?\.?12\s*\)$/.test(raw)) return "#111827";
            return value;
          };
          const menuItems = Array.isArray(safeData.menuItems)
            ? (safeData.menuItems as SitePageKey[]).filter((item) =>
                ["home", "booking", "client", "locations", "services", "specialists", "promos"].includes(item)
              )
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
            : ["home", "booking", "client", "locations", "services", "specialists", "promos"];
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
            menuStyle.borderColorLight = "#e5e7eb";
          }
          if (!hasMenuPreset || typeof menuStyle.borderColorDark !== "string" || !menuStyle.borderColorDark.trim()) {
            menuStyle.borderColorDark = "#ffffff14";
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
          menuStyle.borderColorDark = normalizeMenuColor(menuStyle.borderColorDark);
          menuStyle.shadowColor = normalizeMenuColor(menuStyle.shadowColor);
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

  if (!hasStructuredPages && !pages.home.some((block) => block.type === "menu")) {
    pages.home = [createMenuBlock(safeAccountName), ...pages.home];
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

