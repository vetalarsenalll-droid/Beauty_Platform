import Link from "next/link";
import { buildBookingLink } from "@/lib/booking-links";
import PublicBookingClient from "@/components/public-booking-client";
import MenuSearch from "@/components/menu-search";
import SiteThemeToggle from "@/components/site-theme-toggle";
import DetailsCloseButton from "@/components/details-close-button";
import GallerySlider from "@/components/gallery-slider";
import PublicParallaxLayer from "./public-parallax-layer";
import PublicCoverV2Hero, { type PublicCoverSlide } from "./public-cover-v2-hero";
import type { CSSProperties, ReactNode } from "react";
import {
  type SiteBlock,
  type SiteLoaderConfig,
  type SiteTheme,
} from "@/lib/site-builder";
import {
  resolveMenuBlockBackgroundVisual,
} from "@/features/site-builder/shared/background-visuals";
import type {
  SiteAccountProfile as AccountProfile,
  SiteBranding as Branding,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
  SiteWorkPhotos as WorkPhotos,
} from "@/features/site-builder/shared/site-data";

export type CurrentEntity =
  | { type: "location" | "service" | "specialist" | "promo"; id: number }
  | null;

const PAGE_LABELS = {
  home: "Главная",
  booking: "Онлайн-запись",
  client: "Личный кабинет",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
} as const;

type PageKey = keyof typeof PAGE_LABELS;
const COVER_BACKGROUND_POSITION_VALUES = new Set<string>([
  "left top",
  "center top",
  "right top",
  "left center",
  "center center",
  "right center",
  "left bottom",
  "center bottom",
  "right bottom",
]);

const SOCIAL_ICONS: Record<string, string> = {
  website: "/assets/socials/website.png",
  instagram: "/assets/socials/instagram.png",
  whatsapp: "/assets/socials/whatsapp.png",
  telegram: "/assets/socials/telegram.png",
  max: "/assets/socials/max.png",
  vk: "/assets/socials/vk.png",
  viber: "/assets/socials/viber.png",
  pinterest: "/assets/socials/pinterest.png",
  facebook: "/assets/socials/Facebook_black.png",
  tiktok: "/assets/socials/TikTok_black.png",
  youtube: "/assets/socials/YouTube_black.png",
  twitter: "/assets/socials/Twitter_black.png",
  dzen: "/assets/socials/Dzen_black.png",
  ok: "/assets/socials/Ok_black.png",
};

const SOCIAL_LABELS: Record<string, string> = {
  website: "Сайт",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  max: "MAX",
  vk: "VK",
  viber: "Viber",
  pinterest: "Pinterest",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "Twitter",
  dzen: "Дзен",
  ok: "Одноклассники",
};

type BlockStyle = {
  marginTop?: number;
  marginBottom?: number;
  blockWidth?: number | null;
  blockWidthColumns?: number | null;
  gridStartColumn?: number | null;
  gridEndColumn?: number | null;
  useCustomWidth?: boolean;
  radius?: number | null;
  buttonRadius?: number | null;
  subBlockBg?: string;
  subBlockBgLight?: string;
  subBlockBgDark?: string;
  sectionBg?: string;
  sectionBgLight?: string;
  sectionBgDark?: string;
  blockBg?: string;
  blockBgLight?: string;
  blockBgDark?: string;
  borderColor?: string;
  borderColorLight?: string;
  borderColorDark?: string;
  buttonColor?: string;
  buttonColorLight?: string;
  buttonColorDark?: string;
  buttonTextColor?: string;
  buttonTextColorLight?: string;
  buttonTextColorDark?: string;
  textColor?: string;
  textColorLight?: string;
  textColorDark?: string;
  mutedColor?: string;
  mutedColorLight?: string;
  mutedColorDark?: string;
  shadowColor?: string;
  shadowSize?: number | null;
  gradientEnabled?: boolean;
  gradientDirection?: "vertical" | "horizontal";
  gradientFrom?: string;
  gradientTo?: string;
  textAlign?: "left" | "center" | "right";
  textAlignHeading?: "left" | "center" | "right";
  textAlignSubheading?: "left" | "center" | "right";
  fontHeading?: string;
  fontSubheading?: string;
  fontBody?: string;
  fontWeightHeading?: number | null;
  fontWeightSubheading?: number | null;
  fontWeightBody?: number | null;
  headingSize?: number | null;
  subheadingSize?: number | null;
  textSize?: number | null;
  subBlockBgLightResolved?: string;
  subBlockBgDarkResolved?: string;
  blockBgLightResolved?: string;
  blockBgDarkResolved?: string;
  sectionBgLightResolved?: string;
  sectionBgDarkResolved?: string;
  borderColorLightResolved?: string;
  borderColorDarkResolved?: string;
  buttonColorLightResolved?: string;
  buttonColorDarkResolved?: string;
  buttonTextColorLightResolved?: string;
  buttonTextColorDarkResolved?: string;
  textColorLightResolved?: string;
  textColorDarkResolved?: string;
  mutedColorLightResolved?: string;
  mutedColorDarkResolved?: string;
  gradientEnabledLight?: boolean;
  gradientEnabledDark?: boolean;
  gradientFromLightResolved?: string;
  gradientToLightResolved?: string;
  gradientFromDarkResolved?: string;
  gradientToDarkResolved?: string;
  gradientDirectionLight?: "vertical" | "horizontal";
  gradientDirectionDark?: "vertical" | "horizontal";
};

const DEFAULT_BLOCK_WIDTH = 1000;
const MIN_BLOCK_WIDTH = 800;
const MAX_BLOCK_WIDTH = 2400;
const BLOCK_WIDTH_STEP = 100;
const LEGACY_WIDTH_REFERENCE = 2400;
const DEFAULT_BLOCK_COLUMNS = 6;
const MIN_BLOCK_COLUMNS = 1;
const MAX_BLOCK_COLUMNS = 12;
const BOOKING_MIN_BLOCK_COLUMNS = 10;
const BOOKING_MAX_BLOCK_COLUMNS = 15;
const PUBLIC_WIDTH_REFERENCE = 1600;

const normalizeHex = (value: string): string | null => {
  const trimmed = value.trim();
  const match = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  if (match[1].length === 3) {
    const [r, g, b] = match[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed.toLowerCase();
};

const hexToRgbaString = (hex: string, alpha: number) => {
  const normalized = normalizeHex(hex) ?? "#000000";
  const value = normalized.slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

function clampBlockColumns(columns: number, blockType: SiteBlock["type"] | string): number {
  if (blockType === "booking") {
    return Math.min(
      BOOKING_MAX_BLOCK_COLUMNS,
      Math.max(BOOKING_MIN_BLOCK_COLUMNS, Math.round(columns))
    );
  }
  return Math.min(MAX_BLOCK_COLUMNS, Math.max(MIN_BLOCK_COLUMNS, Math.round(columns)));
}

function bookingContentColumns(columns: number): number {
  return clampBlockColumns(columns, "booking") - 4;
}

function bookingCardsPerRow(columns: number): number {
  const clamped = clampBlockColumns(columns, "booking");
  const preset = clamped - (BOOKING_MIN_BLOCK_COLUMNS - 1);
  if (preset <= 2) return 2;
  if (preset <= 4) return 3;
  return 4;
}

function responsiveBlockWidthCss(columns: number, useEdgePad = true): string {
  const clampedColumns = Math.min(MAX_BLOCK_COLUMNS, Math.max(MIN_BLOCK_COLUMNS, columns));
  if (clampedColumns >= MAX_BLOCK_COLUMNS) {
    return "100%";
  }
  const targetPx = Math.round((PUBLIC_WIDTH_REFERENCE * clampedColumns) / MAX_BLOCK_COLUMNS);
  if (!useEdgePad) {
    return `min(${targetPx}px, 100%)`;
  }
  return `min(${targetPx}px, calc(100% - (var(--site-edge-pad, 0px) * 2)))`;
}

function isValidColorValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "transparent" || trimmed.toLowerCase() === "currentcolor") {
    return true;
  }
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return true;
  }
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|var)\(/i.test(trimmed)) {
    return true;
  }
  return /^[a-zA-Z]+$/.test(trimmed);
}

function isLightShadowColor(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "#fff" || normalized === "#ffffff" || normalized === "white") {
    return true;
  }
  return (
    normalized.includes("255,255,255") ||
    normalized.includes("255 255 255") ||
    /255\s*,\s*255\s*,\s*255/.test(normalized)
  );
}

export function normalizeStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
  const style = (block.data.style as Record<string, unknown>) ?? {};
  const isMenuBlock = block.type === "menu";
  const numOrNull = (value?: number | string | null) => {
    const parsed =
      typeof value === "string" ? Number(value) : (value as number | null | undefined);
    return Number.isFinite(parsed) ? (parsed as number) : null;
  };
  const toFontWeight = (value: unknown) => {
    const parsed = numOrNull(value as number | string | null);
    if (parsed === null) return null;
    const rounded = Math.round(parsed / 100) * 100;
    if (rounded < 100 || rounded > 900) return null;
    return rounded;
  };
  const readColor = (key: string) =>
    typeof style[key] === "string" ? (style[key] as string) : "";
  const resolveColor = (lightKey: string, darkKey: string, legacyKey: string) => {
    const light = readColor(lightKey) || readColor(legacyKey);
    const dark = readColor(darkKey);
    return theme.mode === "dark" ? dark || "" : light || "";
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
    const lightTrimmed = lightRaw.trim();
    const darkTrimmed = darkRaw.trim();
    const lightResolved =
      lightTrimmed.toLowerCase() === "transparent"
        ? "transparent"
        : !lightTrimmed
          ? lightFallback
          : isValidColorValue(lightTrimmed)
            ? lightTrimmed
            : lightFallback;
    const darkResolved =
      darkTrimmed.toLowerCase() === "transparent"
        ? "transparent"
        : !darkTrimmed
          ? darkFallback
          : isValidColorValue(darkTrimmed)
            ? darkTrimmed
            : darkFallback;
    return { lightResolved, darkResolved };
  };
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(style, key);
  const hasBorderOverride =
    hasOwn("borderColor") || hasOwn("borderColorLight") || hasOwn("borderColorDark");
  const borderClearedExplicitly =
    hasBorderOverride &&
    !readColor("borderColor").trim() &&
    !readColor("borderColorLight").trim() &&
    !readColor("borderColorDark").trim();
  const themeBorderLight = theme.lightPalette.borderColor?.trim() || "transparent";
  const themeBorderDark = theme.darkPalette.borderColor?.trim() || "transparent";
  const subBlockBgPair = resolvePair(
    "subBlockBgLight",
    "subBlockBgDark",
    "subBlockBg",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const sectionBgPair = resolvePair(
    "sectionBgLight",
    "sectionBgDark",
    "sectionBg",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const rawBlockWidth = numOrNull(style.blockWidth as number);
  const rawBlockWidthColumns = numOrNull(style.blockWidthColumns as number);
  const rawGridStartColumn = numOrNull(style.gridStartColumn as number);
  const rawGridEndColumn = numOrNull(style.gridEndColumn as number);
  const normalizedBlockWidth =
    rawBlockWidth === null
      ? null
      : Math.min(
          MAX_BLOCK_WIDTH,
          Math.max(
            MIN_BLOCK_WIDTH,
            Math.round(rawBlockWidth / BLOCK_WIDTH_STEP) * BLOCK_WIDTH_STEP
          )
        );
  const normalizedBlockWidthColumns =
    rawBlockWidthColumns === null
      ? null
      : clampBlockColumns(rawBlockWidthColumns, block.type);
  const legacyColumnsFromPx =
    normalizedBlockWidth === null
      ? null
      : clampBlockColumns(
          (normalizedBlockWidth / LEGACY_WIDTH_REFERENCE) * MAX_BLOCK_COLUMNS,
          block.type
        );
  const resolvedBlockWidthColumns = clampBlockColumns(
    normalizedBlockWidthColumns ?? legacyColumnsFromPx ?? DEFAULT_BLOCK_COLUMNS,
    block.type
  );
  const hasExplicitGrid =
    rawGridStartColumn !== null &&
    rawGridEndColumn !== null &&
    block.type !== "booking" &&
    block.type !== "menu";
  const explicitGridStart = hasExplicitGrid ? clampGridColumn(rawGridStartColumn as number) : null;
  const explicitGridEndPre = hasExplicitGrid ? clampGridColumn(rawGridEndColumn as number) : null;
  const explicitGridEnd =
    explicitGridStart !== null && explicitGridEndPre !== null
      ? Math.max(explicitGridStart, explicitGridEndPre)
      : null;
  const centeredGrid = centeredGridRange(
    block.type === "booking" || block.type === "menu"
      ? MAX_BLOCK_COLUMNS
      : resolvedBlockWidthColumns
  );
  const resolvedGridStart = explicitGridStart ?? centeredGrid.start;
  const resolvedGridEnd = explicitGridEnd ?? centeredGrid.end;
  const resolvedColumnsFromGrid =
    block.type === "booking" || block.type === "menu"
      ? resolvedBlockWidthColumns
      : Math.max(1, resolvedGridEnd - resolvedGridStart + 1);
  const useCustomWidth =
    style.useCustomWidth === true ||
    normalizedBlockWidth !== null ||
    normalizedBlockWidthColumns !== null ||
    hasExplicitGrid;
  const blockBgPair = resolvePair(
    "blockBgLight",
    "blockBgDark",
    "blockBg",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const borderPair = resolvePair(
    "borderColorLight",
    "borderColorDark",
    "borderColor",
    themeBorderLight,
    themeBorderDark
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
  const textPair = resolvePair(
    "textColorLight",
    "textColorDark",
    "textColor",
    theme.lightPalette.textColor,
    theme.darkPalette.textColor
  );
  const mutedPair = resolvePair(
    "mutedColorLight",
    "mutedColorDark",
    "mutedColor",
    theme.lightPalette.mutedColor,
    theme.darkPalette.mutedColor
  );
  const gradientEnabledLight =
    typeof style.gradientEnabledLight === "boolean"
      ? (style.gradientEnabledLight as boolean)
      : Boolean(style.gradientEnabled);
  const gradientEnabledDark =
    typeof style.gradientEnabledDark === "boolean"
      ? (style.gradientEnabledDark as boolean)
      : Boolean(style.gradientEnabled);
  const gradientDirectionLight =
    style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
      ? (style.gradientDirectionLight as "horizontal" | "vertical")
      : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? (style.gradientDirection as "horizontal" | "vertical")
        : "vertical";
  const gradientDirectionDark =
    style.gradientDirectionDark === "horizontal" || style.gradientDirectionDark === "vertical"
      ? (style.gradientDirectionDark as "horizontal" | "vertical")
      : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? (style.gradientDirection as "horizontal" | "vertical")
        : "vertical";
  const gradientFromLightResolved =
    (style.gradientFromLight as string) ||
    (style.gradientFrom as string) ||
    theme.lightPalette.gradientFrom;
  const gradientToLightResolved =
    (style.gradientToLight as string) ||
    (style.gradientTo as string) ||
    theme.lightPalette.gradientTo;
  const gradientFromDarkResolved =
    (style.gradientFromDark as string) || theme.darkPalette.gradientFrom;
  const gradientToDarkResolved =
    (style.gradientToDark as string) || theme.darkPalette.gradientTo;
  const resolvedBorderPair = borderClearedExplicitly
    ? { lightResolved: "transparent", darkResolved: "transparent" }
    : {
        lightResolved: borderPair.lightResolved || "transparent",
        darkResolved: borderPair.darkResolved || "transparent",
      };
  const resolvedBorder =
    (resolveColor("borderColorLight", "borderColorDark", "borderColor") || "").trim() ||
    (theme.mode === "dark" ? resolvedBorderPair.darkResolved : resolvedBorderPair.lightResolved);
  const normalizeAlign = (value: unknown): "left" | "center" | "right" =>
    value === "center" || value === "right" ? value : "left";
  const baseTextAlign = normalizeAlign(style.textAlign);
  const headingAlignRaw = normalizeAlign(style.textAlignHeading);
  const subheadingAlignRaw = normalizeAlign(style.textAlignSubheading);
  const headingAlign = headingAlignRaw === "left" ? baseTextAlign : headingAlignRaw;
  const subheadingAlign =
    subheadingAlignRaw === "left" ? baseTextAlign : subheadingAlignRaw;

  return {
    marginTop: numOrNull(style.marginTop as number | string | null) ?? 0,
    marginBottom: numOrNull(style.marginBottom as number | string | null) ?? 0,
    blockWidth: useCustomWidth ? normalizedBlockWidth ?? DEFAULT_BLOCK_WIDTH : null,
    blockWidthColumns: useCustomWidth ? resolvedColumnsFromGrid : null,
    gridStartColumn: useCustomWidth ? resolvedGridStart : null,
    gridEndColumn: useCustomWidth ? resolvedGridEnd : null,
    useCustomWidth,
    radius: isMenuBlock ? 0 : numOrNull(style.radius as number),
    buttonRadius: isMenuBlock ? 0 : numOrNull(style.buttonRadius as number),
    subBlockBg: resolveColor("subBlockBgLight", "subBlockBgDark", "subBlockBg"),
    sectionBg: resolveColor("sectionBgLight", "sectionBgDark", "sectionBg"),
    blockBg: resolveColor("blockBgLight", "blockBgDark", "blockBg"),
    borderColor: resolvedBorder,
    buttonColor: resolveColor("buttonColorLight", "buttonColorDark", "buttonColor"),
    buttonTextColor: resolveColor(
      "buttonTextColorLight",
      "buttonTextColorDark",
      "buttonTextColor"
    ),
    textColor: resolveColor("textColorLight", "textColorDark", "textColor"),
    mutedColor: resolveColor("mutedColorLight", "mutedColorDark", "mutedColor"),
    subBlockBgLightResolved: subBlockBgPair.lightResolved,
    subBlockBgDarkResolved: subBlockBgPair.darkResolved,
    sectionBgLightResolved: sectionBgPair.lightResolved,
    sectionBgDarkResolved: sectionBgPair.darkResolved,
    blockBgLightResolved: blockBgPair.lightResolved,
    blockBgDarkResolved: blockBgPair.darkResolved,
    borderColorLightResolved: resolvedBorderPair.lightResolved,
    borderColorDarkResolved: resolvedBorderPair.darkResolved,
    buttonColorLightResolved: buttonPair.lightResolved,
    buttonColorDarkResolved: buttonPair.darkResolved,
    buttonTextColorLightResolved: buttonTextPair.lightResolved,
    buttonTextColorDarkResolved: buttonTextPair.darkResolved,
    textColorLightResolved: textPair.lightResolved,
    textColorDarkResolved: textPair.darkResolved,
    mutedColorLightResolved: mutedPair.lightResolved,
    mutedColorDarkResolved: mutedPair.darkResolved,
    gradientEnabledLight,
    gradientEnabledDark,
    gradientFromLightResolved,
    gradientToLightResolved,
    gradientFromDarkResolved,
    gradientToDarkResolved,
    gradientDirectionLight,
    gradientDirectionDark,
    shadowColor: readColor("shadowColor"),
    shadowSize: numOrNull(style.shadowSize as number),
    gradientEnabled: Boolean(style.gradientEnabled),
    gradientDirection:
      style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
        ? (style.gradientDirection as "horizontal" | "vertical")
        : "vertical",
    gradientFrom: (style.gradientFrom as string) ?? "",
    gradientTo: (style.gradientTo as string) ?? "",
    textAlign: baseTextAlign,
    textAlignHeading: headingAlign,
    textAlignSubheading: subheadingAlign,
    fontHeading: (style.fontHeading as string) ?? "",
    fontSubheading: (style.fontSubheading as string) ?? "",
    fontBody: (style.fontBody as string) ?? "",
    fontWeightHeading: toFontWeight(style.fontWeightHeading),
    fontWeightSubheading: toFontWeight(style.fontWeightSubheading),
    fontWeightBody: toFontWeight(style.fontWeightBody),
    headingSize: numOrNull(style.headingSize as number),
    subheadingSize: numOrNull(style.subheadingSize as number),
    textSize: numOrNull(style.textSize as number),
  };
}

export function renderBlock(
  block: SiteBlock,
  accountName: string,
  accountSlug: string,
  publicSlug: string,
  branding: Branding,
  profile: AccountProfile,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  workPhotos: WorkPhotos,
  current: CurrentEntity,
  theme: SiteTheme,
  accountLinkOverride?: string,
  loaderConfig?: SiteLoaderConfig | null
) {
  switch (block.type) {
    case "cover":
      return renderCover(
        block,
        accountName,
        accountSlug,
        publicSlug,
        profile,
        branding,
        locations,
        services,
        specialists,
        theme
      );
    case "menu":
      return renderMenu(
        block,
        accountName,
        accountSlug,
        publicSlug,
        branding,
        profile,
        locations,
        services,
        specialists,
        promos,
        theme,
        accountLinkOverride
      );
    case "about":
      return renderAbout(block, accountName, profile, theme);
    case "loader":
      return null;
    case "booking":
      return renderBooking(block, accountSlug, publicSlug, theme, loaderConfig);
    case "locations":
      return renderLocations(block, publicSlug, locations, current, theme);
    case "services":
      return renderServices(block, publicSlug, services, current, theme);
    case "specialists":
      return renderSpecialists(block, publicSlug, specialists, current, theme);
    case "promos":
      return renderPromos(block, publicSlug, promos, current, theme);
    case "works":
      return renderWorks(block, workPhotos, current, theme);
    case "reviews":
      return renderReviews(block);
    case "contacts":
      return renderContacts(block, accountName, profile, locations);
    default:
      return null;
  }
}

function buildBookingVars(style: BlockStyle, theme: SiteTheme) {
  const blockWidthColumns = clampBlockColumns(
    style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
    "booking"
  );
  const blockWidthVisualColumns = bookingContentColumns(blockWidthColumns);
  const bookingCardsColumns = bookingCardsPerRow(blockWidthColumns);
  const blockWidthCss = responsiveBlockWidthCss(blockWidthVisualColumns, true);
  const palette = theme.mode === "dark" ? theme.darkPalette : theme.lightPalette;
  const radius = style.radius ?? palette.radius ?? theme.radius;
  const buttonRadius = style.buttonRadius ?? palette.buttonRadius ?? theme.buttonRadius;
  const shadowSize = style.shadowSize ?? palette.shadowSize ?? theme.shadowSize ?? 0;
  const shadowColor =
    style.shadowColor || palette.shadowColor || theme.shadowColor || "rgba(17, 24, 39, 0.12)";
  const textSize = style.textSize ?? palette.textSize ?? theme.textSize ?? 14;
  const subheadingSize =
    style.subheadingSize ?? palette.subheadingSize ?? theme.subheadingSize ?? textSize + 2;
  const headingSize =
    style.headingSize ?? palette.headingSize ?? theme.headingSize ?? subheadingSize + 2;
  const sizeXs = Math.max(10, textSize - 2);
  const subBlockLight =
    style.subBlockBgLightResolved || style.blockBgLightResolved || "var(--site-panel)";
  const subBlockDark =
    style.subBlockBgDarkResolved || style.blockBgDarkResolved || "var(--site-panel)";
  const subBlockCurrent =
    theme.mode === "dark" ? subBlockDark : subBlockLight;
    const bookingGradientLight = style.gradientEnabledLight
      ? `linear-gradient(${style.gradientDirectionLight === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromLightResolved}, ${style.gradientToLightResolved})`
      : "none";
  const bookingGradientDark = style.gradientEnabledDark
    ? `linear-gradient(${style.gradientDirectionDark === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromDarkResolved}, ${style.gradientToDarkResolved})`
    : "none";
  const bookingBorderLight = (style.borderColorLightResolved || "transparent").trim() || "transparent";
  const bookingBorderDark = (style.borderColorDarkResolved || "transparent").trim() || "transparent";
  const bookingBorderWidthLight = bookingBorderLight === "transparent" ? "0px" : "1px";
  const bookingBorderWidthDark = bookingBorderDark === "transparent" ? "0px" : "1px";
  const bookingBorderWidth = theme.mode === "dark" ? bookingBorderWidthDark : bookingBorderWidthLight;
  return {
    "--booking-bg-light": style.blockBgLightResolved || "var(--site-panel)",
    "--booking-bg-dark": style.blockBgDarkResolved || "var(--site-panel)",
    "--booking-border-light": bookingBorderLight,
    "--booking-border-dark": bookingBorderDark,
    "--booking-border-width-light": bookingBorderWidthLight,
    "--booking-border-width-dark": bookingBorderWidthDark,
    "--booking-border-width": bookingBorderWidth,
    "--booking-text-light": style.textColorLightResolved || "var(--site-text)",
    "--booking-text-dark": style.textColorDarkResolved || "var(--site-text)",
    "--booking-muted-light": style.mutedColorLightResolved || "var(--site-muted)",
    "--booking-muted-dark": style.mutedColorDarkResolved || "var(--site-muted)",
    "--booking-button-light": style.buttonColorLightResolved || "var(--site-button)",
    "--booking-button-dark": style.buttonColorDarkResolved || "var(--site-button)",
    "--booking-button-text-light":
      style.buttonTextColorLightResolved || "var(--site-button-text)",
    "--booking-button-text-dark":
      style.buttonTextColorDarkResolved || "var(--site-button-text)",
    "--booking-sub-bg-light": subBlockLight,
    "--booking-sub-bg-dark": subBlockDark,
    "--booking-sub-bg": subBlockCurrent,
    "--bp-button-text": "var(--booking-button-text)",
    "--booking-gradient-light": bookingGradientLight,
    "--booking-gradient-dark": bookingGradientDark,
    "--bp-shadow-soft": shadowSize > 0 ? `0 ${shadowSize}px ${shadowSize * 2}px ${shadowColor}` : "none",
    "--bp-radius": `${radius}px`,
    "--bp-button-radius": `${buttonRadius}px`,
    "--bp-font-heading": style.fontHeading || palette.fontHeading || theme.fontHeading,
    "--bp-font-body": style.fontBody || palette.fontBody || theme.fontBody,
    "--bp-text-size-xs": `${sizeXs}px`,
    "--bp-text-size-sm": `${textSize}px`,
    "--bp-text-size-base": `${subheadingSize}px`,
    "--bp-text-size-lg": `${headingSize}px`,
    "--bp-content-width": blockWidthCss,
    "--bp-cards-cols": String(bookingCardsColumns),
  } as Record<string, string>;
}

function clampGridColumn(value: number): number {
  return Math.min(MAX_BLOCK_COLUMNS, Math.max(1, Math.round(value)));
}

function centeredGridRange(columns: number): { start: number; end: number } {
  const span = Math.min(MAX_BLOCK_COLUMNS, Math.max(1, Math.round(columns)));
  const start = Math.max(1, Math.floor((MAX_BLOCK_COLUMNS - span) / 2) + 1);
  const end = Math.min(MAX_BLOCK_COLUMNS, start + span - 1);
  return { start, end };
}

function gridSpanWidthCss(start: number, end: number): string {
  const span = Math.max(1, end - start + 1);
  return `calc((100% - (var(--site-edge-pad, 0px) * 2)) * ${span} / ${MAX_BLOCK_COLUMNS})`;
}

function gridSpanLeftCss(start: number): string {
  const offset = Math.max(0, start - 1);
  return `calc(var(--site-edge-pad, 0px) + ((100% - (var(--site-edge-pad, 0px) * 2)) * ${offset} / ${MAX_BLOCK_COLUMNS}))`;
}

function renderBooking(
  block: SiteBlock,
  accountSlug: string,
  publicSlug: string,
  theme: SiteTheme,
  loaderConfig?: SiteLoaderConfig | null
) {
  const style = normalizeStyle(block, theme);
  const cssVars = buildBookingVars(style, theme);
  return (
    <div className="booking-root" style={cssVars}>
      <div className="booking-bleed">
        <PublicBookingClient
          accountSlug={accountSlug}
          accountPublicSlug={publicSlug}
          loaderConfig={loaderConfig}
        />
      </div>
    </div>
  );
}

function resolveEntities<T extends { id: number }>(
  mode: string,
  ids: number[],
  items: T[]
) {
  if (mode === "selected" && ids.length > 0) {
    const set = new Set(ids);
    return items.filter((item) => set.has(item.id));
  }
  return items;
}

function renderCover(
  block: SiteBlock,
  accountName: string,
  accountSlug: string,
  publicSlug: string,
  profile: AccountProfile,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const title = (data.title as string) || accountName;
  const subtitle = (data.subtitle as string) || "";
  const description = (data.description as string) || "";
  const alignRaw = (data.align as string) ?? "left";
  const align = alignRaw === "center" || alignRaw === "right" ? alignRaw : "left";
  const contentAlign = style.textAlign ?? align;
  const contentVerticalAlignRaw =
    typeof data.coverContentVerticalAlign === "string"
      ? data.coverContentVerticalAlign.trim().toLowerCase()
      : "";
  const contentVerticalAlign: "top" | "center" | "bottom" =
    contentVerticalAlignRaw === "top" || contentVerticalAlignRaw === "bottom"
      ? contentVerticalAlignRaw
      : "center";
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const showSecondaryButton = Boolean(data.showSecondaryButton);
  const secondaryButtonText = (data.secondaryButtonText as string) || "Наши соцсети";
  const secondaryButtonSource = (data.secondaryButtonSource as string) || "auto";
  const socialHref = resolvePrimarySocialHref(profile, secondaryButtonSource);
  const primaryButtonBorderColorRaw =
    typeof data.coverPrimaryButtonBorderColor === "string"
      ? data.coverPrimaryButtonBorderColor.trim()
      : "";
  const primaryButtonBorderColor =
    primaryButtonBorderColorRaw && isValidColorValue(primaryButtonBorderColorRaw)
      ? primaryButtonBorderColorRaw
      : "transparent";
  const secondaryButtonColorRaw =
    typeof data.coverSecondaryButtonColor === "string"
      ? data.coverSecondaryButtonColor.trim()
      : "";
  const secondaryButtonColor =
    secondaryButtonColorRaw && isValidColorValue(secondaryButtonColorRaw)
      ? secondaryButtonColorRaw
      : "transparent";
  const secondaryButtonTextColorRaw =
    typeof data.coverSecondaryButtonTextColor === "string"
      ? data.coverSecondaryButtonTextColor.trim()
      : "";
  const secondaryButtonTextColor =
    secondaryButtonTextColorRaw && isValidColorValue(secondaryButtonTextColorRaw)
      ? secondaryButtonTextColorRaw
      : "#ffffff";
  const secondaryButtonBorderColorRaw =
    typeof data.coverSecondaryButtonBorderColor === "string"
      ? data.coverSecondaryButtonBorderColor.trim()
      : "";
  const secondaryButtonBorderColor =
    secondaryButtonBorderColorRaw && isValidColorValue(secondaryButtonBorderColorRaw)
      ? secondaryButtonBorderColorRaw
      : "rgba(255,255,255,0.45)";
  const secondaryButtonRadius = Number.isFinite(Number(data.coverSecondaryButtonRadius))
    ? Math.max(0, Math.min(80, Math.round(Number(data.coverSecondaryButtonRadius))))
    : (style.buttonRadius ?? theme.buttonRadius);
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };
  const imageUrl = resolveCoverImage(imageSource, branding, locations, services, specialists);
  const scrollEffect =
    data.coverScrollEffect === "fixed" || data.coverScrollEffect === "parallax"
      ? (data.coverScrollEffect as "fixed" | "parallax")
      : "none";
  const coverBackgroundPositionRaw =
    typeof data.coverBackgroundPosition === "string"
      ? data.coverBackgroundPosition.trim().toLowerCase()
      : "";
  const coverBackgroundPosition = COVER_BACKGROUND_POSITION_VALUES.has(coverBackgroundPositionRaw)
    ? coverBackgroundPositionRaw
    : "center center";
  const coverHeightRawValue =
    typeof data.coverScrollHeight === "string" ? data.coverScrollHeight.trim() : "";
  const coverHeightCss = /^(?:\d+(?:\.\d+)?)(?:px|vh)$/i.test(coverHeightRawValue)
    ? coverHeightRawValue
    : "700px";
  const filterStartColorRaw =
    typeof data.coverFilterStartColor === "string" ? data.coverFilterStartColor.trim() : "";
  const filterStartColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(filterStartColorRaw)
    ? filterStartColorRaw
    : "#000000";
  const filterEndColorRaw =
    typeof data.coverFilterEndColor === "string" ? data.coverFilterEndColor.trim() : "";
  const filterEndColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(filterEndColorRaw)
    ? filterEndColorRaw
    : "#0f0f0f";
  const filterStartOpacity = Number.isFinite(Number(data.coverFilterStartOpacity))
    ? Math.max(0, Math.min(100, Number(data.coverFilterStartOpacity)))
    : 10;
  const filterEndOpacity = Number.isFinite(Number(data.coverFilterEndOpacity))
    ? Math.max(0, Math.min(100, Number(data.coverFilterEndOpacity)))
    : 60;
  const arrowMode = data.coverArrow === "down" ? "down" : "none";
  const arrowColorRaw = typeof data.coverArrowColor === "string" ? data.coverArrowColor.trim() : "";
  const arrowColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(arrowColorRaw)
    ? arrowColorRaw
    : "#ffffff";
  const animateArrow = Boolean(data.coverArrowAnimated);
  const subtitleColorRaw =
    typeof data.coverSubtitleColor === "string" ? data.coverSubtitleColor.trim() : "";
  const subtitleColor =
    subtitleColorRaw && isValidColorValue(subtitleColorRaw) ? subtitleColorRaw : "#ffffff";
  const descriptionColorRaw =
    typeof data.coverDescriptionColor === "string" ? data.coverDescriptionColor.trim() : "";
  const descriptionColor =
    descriptionColorRaw && isValidColorValue(descriptionColorRaw)
      ? descriptionColorRaw
      : "#ffffff";
  const headingDesktopSize =
    style.headingSize !== null && style.headingSize !== undefined
      ? style.headingSize
      : theme.headingSize;
  const subheadingDesktopSize =
    style.subheadingSize !== null && style.subheadingSize !== undefined
      ? style.subheadingSize
      : theme.subheadingSize;
  const textDesktopSize =
    style.textSize !== null && style.textSize !== undefined
      ? style.textSize
      : theme.textSize;
  const descriptionMobileSizeRaw = Number(data.coverDescriptionMobileSize);
  const headingMobileSize = Math.max(28, Math.min(56, Math.round(headingDesktopSize * 0.58)));
  const subheadingMobileSize = Math.max(18, Math.min(36, Math.round(subheadingDesktopSize * 0.72)));
  const textMobileSize =
    Number.isFinite(descriptionMobileSizeRaw) &&
    descriptionMobileSizeRaw >= 10 &&
    descriptionMobileSizeRaw <= 72
      ? Math.round(descriptionMobileSizeRaw)
      : Math.max(14, Math.min(26, Math.round(textDesktopSize * 0.9)));
  const sliderInfinite = data.coverSliderInfinite !== false;
  const sliderShowArrows = data.coverSliderShowArrows !== false;
  const sliderShowDots = data.coverSliderShowDots !== false;
  const sliderAutoplayMsRaw = Number(data.coverSliderAutoplayMs);
  const sliderAutoplayMs =
    Number.isFinite(sliderAutoplayMsRaw) && sliderAutoplayMsRaw >= 0
      ? Math.min(20000, Math.round(sliderAutoplayMsRaw))
      : 0;
  const sliderArrowSizeRaw = String(data.coverSliderArrowSize ?? "sm");
  const sliderArrowSize: "sm" | "md" | "lg" | "xl" =
    sliderArrowSizeRaw === "md" ||
    sliderArrowSizeRaw === "lg" ||
    sliderArrowSizeRaw === "xl"
      ? sliderArrowSizeRaw
      : "sm";
  const sliderArrowThicknessRaw = Number(data.coverSliderArrowThickness);
  const sliderArrowThickness =
    Number.isFinite(sliderArrowThicknessRaw) && sliderArrowThicknessRaw > 0
      ? Math.max(1, Math.min(8, Math.round(sliderArrowThicknessRaw)))
      : 3;
  const sliderArrowColorRaw =
    typeof data.coverSliderArrowColor === "string" ? data.coverSliderArrowColor.trim() : "";
  const sliderArrowColor =
    sliderArrowColorRaw && isValidColorValue(sliderArrowColorRaw)
      ? sliderArrowColorRaw
      : "#222222";
  const sliderArrowHoverColorRaw =
    typeof data.coverSliderArrowHoverColor === "string"
      ? data.coverSliderArrowHoverColor.trim()
      : "";
  const sliderArrowHoverColor =
    sliderArrowHoverColorRaw && isValidColorValue(sliderArrowHoverColorRaw)
      ? sliderArrowHoverColorRaw
      : "";
  const sliderArrowBgColorRaw =
    typeof data.coverSliderArrowBgColor === "string" ? data.coverSliderArrowBgColor.trim() : "";
  const sliderArrowBgColor =
    sliderArrowBgColorRaw && isValidColorValue(sliderArrowBgColorRaw)
      ? sliderArrowBgColorRaw
      : "#ffffff";
  const sliderArrowHoverBgColorRaw =
    typeof data.coverSliderArrowHoverBgColor === "string"
      ? data.coverSliderArrowHoverBgColor.trim()
      : "";
  const sliderArrowHoverBgColor =
    sliderArrowHoverBgColorRaw && isValidColorValue(sliderArrowHoverBgColorRaw)
      ? sliderArrowHoverBgColorRaw
      : "";
  const sliderArrowOutlineColorRaw =
    typeof data.coverSliderArrowOutlineColor === "string"
      ? data.coverSliderArrowOutlineColor.trim()
      : "";
  const sliderArrowOutlineColorCandidate =
    sliderArrowOutlineColorRaw && isValidColorValue(sliderArrowOutlineColorRaw)
      ? sliderArrowOutlineColorRaw
      : "";
  const sliderArrowOutlineThicknessRaw = Number(data.coverSliderArrowOutlineThickness);
  const sliderArrowOutlineThickness =
    Number.isFinite(sliderArrowOutlineThicknessRaw) && sliderArrowOutlineThicknessRaw > 0
      ? Math.max(1, Math.min(8, Math.round(sliderArrowOutlineThicknessRaw)))
      : 1;
  const sliderArrowOutlineColor =
    sliderArrowOutlineColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : sliderArrowOutlineColorCandidate || sliderArrowColor;
  const sliderArrowShowOutline =
    sliderArrowOutlineColor !== "transparent" ||
    sliderArrowOutlineThickness !== 1;
  const sliderDotSizeRaw = Number(data.coverSliderDotSize);
  const sliderDotSize =
    Number.isFinite(sliderDotSizeRaw) && sliderDotSizeRaw > 0
      ? Math.max(6, Math.min(24, Math.round(sliderDotSizeRaw)))
      : 10;
  const sliderDotColorRaw =
    typeof data.coverSliderDotColor === "string" ? data.coverSliderDotColor.trim() : "";
  const sliderDotColor =
    sliderDotColorRaw && isValidColorValue(sliderDotColorRaw)
      ? sliderDotColorRaw
      : "#000000";
  const sliderDotActiveColorRaw =
    typeof data.coverSliderDotActiveColor === "string"
      ? data.coverSliderDotActiveColor.trim()
      : "";
  const sliderDotActiveColor =
    sliderDotActiveColorRaw && isValidColorValue(sliderDotActiveColorRaw)
      ? sliderDotActiveColorRaw
      : "#ffffff";
  const sliderDotBorderWidthRaw = Number(data.coverSliderDotBorderWidth);
  const sliderDotBorderWidth =
    Number.isFinite(sliderDotBorderWidthRaw) && sliderDotBorderWidthRaw >= 0
      ? Math.max(0, Math.min(6, Math.round(sliderDotBorderWidthRaw)))
      : 2;
  const sliderDotBorderColorRaw =
    typeof data.coverSliderDotBorderColor === "string"
      ? data.coverSliderDotBorderColor.trim()
      : "";
  const sliderDotBorderColor =
    sliderDotBorderColorRaw && isValidColorValue(sliderDotBorderColorRaw)
      ? sliderDotBorderColorRaw
      : "#ffffff";
  const resolvePageHref = (pageKey: PageKey): string => {
    const basePath = publicSlug ? `/${publicSlug}` : "#";
    if (pageKey === "home") return basePath;
    if (pageKey === "booking") return `${basePath}/booking`;
    if (pageKey === "client") return accountSlug ? `/c?account=${accountSlug}` : "/c/login";
    return `${basePath}/${pageKey === "promos" ? "promos" : pageKey}`;
  };
  const resolveCoverSlideTargetHref = (target: string): string => {
    const normalizedTarget = target.trim();
    if (!normalizedTarget) return "";
    if ((Object.keys(PAGE_LABELS) as PageKey[]).includes(normalizedTarget as PageKey)) {
      return resolvePageHref(normalizedTarget as PageKey);
    }
    if (!publicSlug) return "";
    const basePath = `/${publicSlug}`;

    const locationMatch = normalizedTarget.match(/^location:(\d+)$/);
    if (locationMatch) {
      const locationId = Number(locationMatch[1]);
      return locations.some((item) => item.id === locationId)
        ? `${basePath}/locations/${locationId}`
        : "";
    }

    const specialistMatch = normalizedTarget.match(/^specialist:(\d+)$/);
    if (specialistMatch) {
      const specialistId = Number(specialistMatch[1]);
      return specialists.some((item) => item.id === specialistId)
        ? `${basePath}/specialists/${specialistId}`
        : "";
    }

    const serviceMatch = normalizedTarget.match(/^service:(\d+)$/);
    if (serviceMatch) {
      const serviceId = Number(serviceMatch[1]);
      return services.some((item) => item.id === serviceId)
        ? `${basePath}/services/${serviceId}`
        : "";
    }

    return "";
  };
  const rawSlides = Array.isArray(data.coverSlides)
    ? (data.coverSlides as Array<Record<string, unknown>>)
    : [];
  const coverSlides: PublicCoverSlide[] = rawSlides
    .map((slide, idx) => {
      const slideTitle = typeof slide.title === "string" ? slide.title.trim() : "";
      const slideDescription = typeof slide.description === "string" ? slide.description.trim() : "";
      const slideButtonText = typeof slide.buttonText === "string" ? slide.buttonText.trim() : "";
      const slideButtonPageRaw = typeof slide.buttonPage === "string" ? slide.buttonPage.trim() : "";
      const slideButtonHref = typeof slide.buttonHref === "string" ? slide.buttonHref.trim() : "";
      const slideImage = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : "";
      const resolvedButtonHref =
        resolveCoverSlideTargetHref(slideButtonPageRaw) ||
        (slideButtonHref.startsWith("#") ||
        slideButtonHref.startsWith("/") ||
        slideButtonHref.startsWith("mailto:") ||
        slideButtonHref.startsWith("tel:") ||
        slideButtonHref.startsWith("http://") ||
        slideButtonHref.startsWith("https://")
          ? slideButtonHref
          : slideButtonHref
            ? normalizeExternalHref(slideButtonHref)
            : publicSlug
              ? buildBookingLink({ publicSlug })
              : "#");
      return {
        id:
          typeof slide.id === "string" && slide.id.trim()
            ? slide.id.trim()
            : `slide-${idx + 1}`,
        title: slideTitle || title,
        description: slideDescription || description || subtitle,
        buttonText: slideButtonText || buttonText || "Подробнее",
        buttonHref: resolvedButtonHref,
        imageUrl: slideImage || null,
      };
    })
    .filter((slide) => Boolean(slide.title || slide.description || slide.buttonText || slide.imageUrl));
  const normalizedCoverSlides =
    coverSlides.length > 0
      ? coverSlides
      : [
          {
            id: "slide-fallback",
            title: title || accountName,
            description: description || subtitle,
            buttonText: buttonText || "Подробнее",
            buttonHref: publicSlug ? buildBookingLink({ publicSlug }) : "#",
            imageUrl: null,
          },
        ];
  const contentColumns = clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, "cover");
  const contentRange = centeredGridRange(contentColumns);
  const gridStart = clampGridColumn(style.gridStartColumn ?? contentRange.start);
  const gridEnd = Math.max(gridStart, clampGridColumn(style.gridEndColumn ?? contentRange.end));
  const gridSpan = Math.max(1, gridEnd - gridStart + 1);
  const gridWidthPercent = `${(gridSpan / MAX_BLOCK_COLUMNS) * 100}%`;
  const gridLeftPercent = `${((gridStart - 1) / MAX_BLOCK_COLUMNS) * 100}%`;
  const overlayGradient = `linear-gradient(180deg, ${hexToRgbaString(
    filterStartColor,
    filterStartOpacity / 100
  )}, ${hexToRgbaString(filterEndColor, filterEndOpacity / 100)})`;

  if (block.variant === "v2") {
    return (
      <PublicCoverV2Hero
        slides={normalizedCoverSlides}
        contentAlign={contentAlign}
        contentVerticalAlign={contentVerticalAlign}
        contentMaxWidth={gridWidthPercent}
        contentMarginLeft={gridLeftPercent}
        coverBackgroundPosition={coverBackgroundPosition}
        coverHeightCss={coverHeightCss}
        filterOverlay={overlayGradient}
        showArrows={sliderShowArrows}
        showDots={sliderShowDots}
        infinite={sliderInfinite}
        autoplayMs={sliderAutoplayMs}
        arrowSize={sliderArrowSize}
        arrowThickness={sliderArrowThickness}
        arrowColor={sliderArrowColor}
        arrowHoverColor={sliderArrowHoverColor}
        arrowBgColor={sliderArrowBgColor}
        arrowHoverBgColor={sliderArrowHoverBgColor}
        arrowShowOutline={sliderArrowShowOutline}
        arrowOutlineColor={sliderArrowOutlineColor}
        arrowOutlineThickness={sliderArrowOutlineThickness}
        dotSize={sliderDotSize}
        dotColor={sliderDotColor}
        dotActiveColor={sliderDotActiveColor}
        dotBorderWidth={sliderDotBorderWidth}
        dotBorderColor={sliderDotBorderColor}
        headingCss={headingStyle(style)}
        textCss={textStyle(style)}
        buttonCss={buttonStyle(style)}
        headingDesktopSize={headingDesktopSize}
        headingMobileSize={headingMobileSize}
        textDesktopSize={textDesktopSize}
        textMobileSize={textMobileSize}
        descriptionColor={descriptionColor}
      />
    );
  }
  const backgroundStyle = imageUrl
    ? {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: coverBackgroundPosition,
        backgroundAttachment: scrollEffect === "fixed" ? "fixed" : "scroll",
      }
    : {
        backgroundColor: "transparent",
        backgroundImage: "none",
      };
  const showMotionLayer = Boolean(imageUrl) && scrollEffect === "parallax";

  return (
    <section
      className="relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      style={{
        ...(showMotionLayer
          ? { backgroundColor: "transparent", backgroundImage: "none" }
          : backgroundStyle),
        minHeight: coverHeightCss,
        containerType: "inline-size",
      }}
    >
      {showMotionLayer && (
        <PublicParallaxLayer
          imageUrl={imageUrl as string}
          backgroundPosition={coverBackgroundPosition}
        />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: overlayGradient }} />
      <div className="relative z-[1] mx-auto flex w-full items-center" style={{ minHeight: coverHeightCss }}>
        <div
          className="bp-cover-content w-full"
          style={{
            maxWidth: gridWidthPercent,
            marginLeft: gridLeftPercent,
            marginRight: 0,
          }}
        >
          <h2
            className="text-white leading-[1.08] tracking-[-0.01em]"
            style={{
              ...headingStyle(style),
              textAlign: contentAlign,
              fontSize: `clamp(${headingMobileSize}px, 9cqw, ${Math.max(
                headingMobileSize,
                headingDesktopSize
              )}px)`,
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="mt-6 text-white/90 leading-[1.25]"
              style={{
                ...subheadingStyle(style),
                textAlign: contentAlign,
                color: subtitleColor,
                fontSize: `clamp(${subheadingMobileSize}px, 5.8cqw, ${Math.max(
                  subheadingMobileSize,
                  subheadingDesktopSize
                )}px)`,
              }}
            >
              {subtitle}
            </p>
          )}
          {description && (
            <p
              className="mt-5 max-w-[720px] text-white/80 leading-[1.45]"
              style={{
                ...textStyle(style),
                textAlign: contentAlign,
                marginLeft:
                  contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                marginRight: contentAlign === "center" ? "auto" : 0,
                color: descriptionColor,
                fontSize: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
                  textMobileSize,
                  textDesktopSize
                )}px)`,
              }}
            >
              {description}
            </p>
          )}
          <div
            className="mt-7 flex flex-wrap items-center gap-3"
            style={{
              justifyContent:
                contentAlign === "center"
                  ? "center"
                  : contentAlign === "right"
                    ? "flex-end"
                    : "flex-start",
            }}
          >
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({ publicSlug })}
                className="inline-flex items-center whitespace-nowrap font-semibold"
                style={{
                  ...buttonStyle(style),
                  color: "#ffffff",
                  borderStyle: "solid",
                  borderWidth:
                    primaryButtonBorderColor !== "transparent" &&
                    primaryButtonBorderColor.toLowerCase() !== "rgba(0,0,0,0)"
                      ? 1
                      : 0,
                  borderColor:
                    primaryButtonBorderColor !== "transparent" &&
                    primaryButtonBorderColor.toLowerCase() !== "rgba(0,0,0,0)"
                      ? primaryButtonBorderColor
                      : "transparent",
                  minHeight: "clamp(46px, 6cqw, 54px)",
                  paddingInline: "clamp(24px, 3.2cqw, 40px)",
                  paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                  fontSize: "clamp(14px, 2cqw, 16px)",
                }}
              >
                {buttonText}
              </Link>
            )}
            {showSecondaryButton && socialHref && (
              <a
                href={socialHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center whitespace-nowrap border font-semibold text-white transition hover:bg-white/10"
                style={{
                  backgroundColor:
                    secondaryButtonColor !== "transparent" &&
                    secondaryButtonColor.toLowerCase() !== "rgba(0,0,0,0)"
                      ? secondaryButtonColor
                      : "transparent",
                  color:
                    secondaryButtonTextColor !== "transparent" &&
                    secondaryButtonTextColor.toLowerCase() !== "rgba(0,0,0,0)"
                      ? secondaryButtonTextColor
                      : "#ffffff",
                  borderColor:
                    secondaryButtonBorderColor !== "transparent" &&
                    secondaryButtonBorderColor.toLowerCase() !== "rgba(0,0,0,0)"
                      ? secondaryButtonBorderColor
                      : "transparent",
                  borderWidth:
                    secondaryButtonBorderColor !== "transparent" &&
                    secondaryButtonBorderColor.toLowerCase() !== "rgba(0,0,0,0)"
                      ? 1
                      : 0,
                  borderRadius: secondaryButtonRadius,
                  minHeight: "clamp(46px, 6cqw, 54px)",
                  paddingInline: "clamp(24px, 3.2cqw, 40px)",
                  paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                  fontSize: "clamp(14px, 2cqw, 16px)",
                }}
              >
                {secondaryButtonText}
              </a>
            )}
          </div>
        </div>
      </div>
      {arrowMode === "down" && (
        <div
          className={`pointer-events-none absolute bottom-6 left-1/2 z-[2] -translate-x-1/2 ${
            animateArrow ? "animate-bounce" : ""
          }`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke={arrowColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      )}
    </section>
  );
}

function normalizeExternalHref(value: string): string {
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

function resolveSocialHrefByKey(profile: AccountProfile, key: string): string | null {
  const rawValue =
    key === "website"
      ? profile.websiteUrl
      : key === "instagram"
        ? profile.instagramUrl
        : key === "whatsapp"
          ? profile.whatsappUrl
          : key === "telegram"
            ? profile.telegramUrl
            : key === "max"
              ? profile.maxUrl
              : key === "vk"
                ? profile.vkUrl
                : key === "viber"
                  ? profile.viberUrl
                  : key === "pinterest"
                    ? profile.pinterestUrl
                    : key === "facebook"
                      ? profile.facebookUrl
                      : key === "tiktok"
                        ? profile.tiktokUrl
                        : key === "youtube"
                          ? profile.youtubeUrl
                          : key === "twitter"
                            ? profile.twitterUrl
                            : key === "dzen"
                              ? profile.dzenUrl
                              : key === "ok"
                                ? profile.okUrl
                                : undefined;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!trimmed) return null;
  return normalizeExternalHref(trimmed);
}

function resolvePrimarySocialHref(
  profile: AccountProfile,
  preferredSource: string = "auto"
): string | null {
  if (preferredSource && preferredSource !== "auto") {
    return resolveSocialHrefByKey(profile, preferredSource);
  }
  const priority = [
    "instagram",
    "telegram",
    "whatsapp",
    "vk",
    "website",
    "facebook",
    "tiktok",
    "youtube",
    "twitter",
    "pinterest",
    "max",
    "viber",
    "dzen",
    "ok",
  ];
  for (const key of priority) {
    const href = resolveSocialHrefByKey(profile, key);
    if (href) return href;
  }
  return null;
}

  function headingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontHeading || "var(--site-font-heading)",
      fontWeight: style.fontWeightHeading ?? undefined,
      fontSize: style.headingSize !== null && style.headingSize !== undefined ? `${style.headingSize}px` : "var(--site-h1)",
      textAlign: style.textAlignHeading ?? style.textAlign ?? "left",
      color: "var(--block-text, var(--bp-ink))",
    } as const;
  }

  function subheadingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontSubheading || style.fontBody || "var(--site-font-body)",
      fontWeight: style.fontWeightSubheading ?? undefined,
      fontSize:
        style.subheadingSize !== null && style.subheadingSize !== undefined
          ? `${style.subheadingSize}px`
          : "var(--site-h2)",
      textAlign: style.textAlignSubheading ?? style.textAlign ?? "left",
      color: "var(--block-muted, var(--bp-muted))",
    } as const;
  }

  function textStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontBody || "var(--site-font-body)",
      fontWeight: style.fontWeightBody ?? undefined,
      fontSize: style.textSize !== null && style.textSize !== undefined ? `${style.textSize}px` : "var(--site-text-size)",
      textAlign: style.textAlign ?? "left",
      color: "var(--block-muted, var(--bp-muted))",
    } as const;
  }

  function buttonStyle(style: BlockStyle) {
    return {
      backgroundColor: "var(--block-button, var(--site-button))",
      color: "var(--block-button-text, var(--site-button-text))",
      fontWeight: style.fontWeightBody ?? undefined,
      borderRadius: style.buttonRadius !== null ? style.buttonRadius : "var(--site-button-radius)",
    } as const;
  }

export function buildBlockWrapperStyle(
  style: BlockStyle,
  theme: SiteTheme,
  blockWidth: number,
  options: {
    isMenuSticky: boolean;
    blockType?: SiteBlock["type"];
    coverBackground?: { backgroundColor: string; backgroundImage: string };
    menuSectionBackground?: { backgroundColor: string; backgroundImage: string };
  }
) {
    const blockShadowSize = typeof style.shadowSize === "number" ? style.shadowSize : null;
    const blockShadowColorRaw =
      typeof style.shadowColor === "string" && style.shadowColor
        ? style.shadowColor
        : null;
    const blockShadowColorResolved =
      blockShadowColorRaw || theme.shadowColor || "rgba(17, 24, 39, 0.12)";
    const blockShadowColor =
      options.blockType === "menu" &&
      theme.mode === "dark" &&
      isLightShadowColor(blockShadowColorResolved)
        ? "rgba(0, 0, 0, 0.45)"
        : blockShadowColorResolved;
    const radius = typeof style.radius === "number" ? style.radius : "var(--site-radius)";
    const lightGradient = style.gradientEnabledLight
      ? `linear-gradient(${style.gradientDirectionLight === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromLightResolved}, ${style.gradientToLightResolved})`
      : "none";
    const darkGradient = style.gradientEnabledDark
      ? `linear-gradient(${style.gradientDirectionDark === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromDarkResolved}, ${style.gradientToDarkResolved})`
      : "none";
    const borderColorOverride =
      typeof style.borderColor === "string" && style.borderColor ? style.borderColor : null;
    const hasVisibleBorder = style.borderColor !== "transparent";
    const blockColumns =
      typeof style.blockWidthColumns === "number"
        ? style.blockWidthColumns
        : blockWidth > 0 && blockWidth <= MAX_BLOCK_COLUMNS
          ? blockWidth
          : DEFAULT_BLOCK_COLUMNS;
    const isBookingBlock = options.blockType === "booking";
    const isCoverBlock = options.blockType === "cover";
    const blockOuterColumns = isBookingBlock
      ? MAX_BLOCK_COLUMNS
      : Math.min(MAX_BLOCK_COLUMNS, Math.max(MIN_BLOCK_COLUMNS, Math.round(blockColumns)));
    const isMenu = options.blockType === "menu";
    const isGallery = options.blockType === "works";
    const hasGridRange =
      typeof style.gridStartColumn === "number" &&
      typeof style.gridEndColumn === "number" &&
      !isMenu &&
      !isBookingBlock &&
      !isCoverBlock;
    const gridStart = hasGridRange
      ? clampGridColumn(style.gridStartColumn as number)
      : centeredGridRange(blockOuterColumns).start;
    const gridEndRaw = hasGridRange
      ? clampGridColumn(style.gridEndColumn as number)
      : centeredGridRange(blockOuterColumns).end;
    const gridEnd = Math.max(gridStart, gridEndRaw);
    const gridWidthCss = gridSpanWidthCss(gridStart, gridEnd);
    const gridLeftCss = gridSpanLeftCss(gridStart);
    const contentWidth = responsiveBlockWidthCss(blockOuterColumns, true);
    const menuWidth =
      blockOuterColumns >= MAX_BLOCK_COLUMNS
        ? "100%"
        : responsiveBlockWidthCss(blockOuterColumns, true);
    return {
      className: isMenu
        ? "site-block overflow-visible border border-[color:var(--bp-stroke)] p-0"
        : isGallery || isBookingBlock || isCoverBlock
          ? "site-block p-0"
        : "site-block border border-[color:var(--bp-stroke)] p-6",
      style: {
        position: options.isMenuSticky ? "sticky" : undefined,
        top: options.isMenuSticky ? 0 : undefined,
        zIndex: options.isMenuSticky ? 40 : undefined,
        borderRadius: isMenu || isBookingBlock || isCoverBlock ? 0 : radius,
        backgroundColor:
          isCoverBlock
            ? (options.coverBackground?.backgroundColor ?? "var(--block-section-bg, var(--block-bg))")
            : isMenu
              ? (options.menuSectionBackground?.backgroundColor ?? "var(--block-section-bg, var(--block-bg))")
              : isGallery || isBookingBlock
              ? "var(--block-section-bg, var(--block-bg))"
              : "var(--block-bg)",
        backgroundImage:
          isCoverBlock
            ? (options.coverBackground?.backgroundImage ?? "none")
            : isMenu
              ? (options.menuSectionBackground?.backgroundImage ?? "none")
              : isGallery || isBookingBlock
              ? "none"
              : "var(--block-gradient)",
        borderColor: isGallery || isBookingBlock || isCoverBlock ? "transparent" : "var(--block-border)",
        borderWidth: isGallery || isBookingBlock || isCoverBlock ? 0 : hasVisibleBorder ? 1 : 0,
        boxShadow:
          isGallery || isBookingBlock || isCoverBlock
            ? "none"
            : blockShadowSize !== null
            ? `0 ${blockShadowSize}px ${blockShadowSize * 2}px ${blockShadowColor}`
            : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
        marginTop:
          options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock
            ? 0
            : typeof style.marginTop === "number"
              ? style.marginTop
              : 0,
        marginBottom:
          options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock
            ? 0
            : typeof style.marginBottom === "number"
              ? style.marginBottom
              : 0,
        paddingTop:
          (options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock) &&
          typeof style.marginTop === "number"
            ? style.marginTop
            : undefined,
        paddingBottom:
          (options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock) &&
          typeof style.marginBottom === "number"
            ? style.marginBottom
            : undefined,
        width: isMenu || isGallery || isBookingBlock || isCoverBlock ? "100%" : gridWidthCss,
        maxWidth: "100%",
        marginLeft: isMenu || isGallery || isBookingBlock || isCoverBlock ? "auto" : gridLeftCss,
        marginRight: isMenu || isGallery || isBookingBlock || isCoverBlock ? "auto" : 0,
        boxSizing: "border-box",
        color: "var(--block-text)",
        ["--works-content-width" as string]: gridWidthCss,
        ["--works-content-left" as string]: gridLeftCss,
        ["--bp-ink" as string]: "var(--block-text)",
        ["--bp-muted" as string]: "var(--block-muted)",
        ["--block-bg-light" as string]: style.blockBgLightResolved,
        ["--block-bg-dark" as string]: style.blockBgDarkResolved,
        ["--block-section-bg-light" as string]: style.sectionBgLightResolved,
        ["--block-section-bg-dark" as string]: style.sectionBgDarkResolved,
        ["--block-sub-bg-light" as string]: style.subBlockBgLightResolved,
        ["--block-sub-bg-dark" as string]: style.subBlockBgDarkResolved,
        ["--block-border-light" as string]: style.borderColorLightResolved,
        ["--block-border-dark" as string]: style.borderColorDarkResolved,
        ["--block-text-light" as string]: style.textColorLightResolved,
        ["--block-text-dark" as string]: style.textColorDarkResolved,
        ["--block-muted-light" as string]: style.mutedColorLightResolved,
        ["--block-muted-dark" as string]: style.mutedColorDarkResolved,
        ["--block-button-light" as string]: style.buttonColorLightResolved,
        ["--block-button-dark" as string]: style.buttonColorDarkResolved,
        ["--block-button-text-light" as string]: style.buttonTextColorLightResolved,
        ["--block-button-text-dark" as string]: style.buttonTextColorDarkResolved,
        ["--block-gradient-light" as string]: lightGradient,
        ["--block-gradient-dark" as string]: darkGradient,
        ...(borderColorOverride
          ? {
              ["--bp-stroke" as string]: "var(--block-border)",
              ["--site-border" as string]: "var(--block-border)",
            }
          : {}),
        } as CSSProperties,
      };
  }

function renderMenu(
  block: SiteBlock,
  accountName: string,
  accountSlug: string,
  publicSlug: string,
  branding: Branding,
  profile: AccountProfile,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  theme: SiteTheme,
  accountLinkOverride?: string
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const menuFallbackBg =
    style.blockBg ||
    (theme.mode === "dark" ? theme.darkPalette.panelColor : theme.lightPalette.panelColor) ||
    "#ffffff";
  const menuBarBackground = resolveMenuBlockBackgroundVisual(data ?? null, menuFallbackBg);
  const menuItems = Array.isArray(data.menuItems)
    ? (data.menuItems as PageKey[]).filter((item) => item in PAGE_LABELS)
    : (Object.keys(PAGE_LABELS) as PageKey[]);
  const showLogo = data.showLogo !== false;
  const showCompanyName = data.showCompanyName !== false;
  const showButton = data.showButton !== false;
  const ctaMode = (data.ctaMode as string) || "booking";
  const phoneOverride =
    typeof data.phoneOverride === "string" ? data.phoneOverride.trim() : "";
  const phoneValue = phoneOverride || profile.phone || "";
  const showSearch = Boolean(data.showSearch);
  const showAccount = Boolean(data.showAccount);
  const showThemeToggle = Boolean(data.showThemeToggle);
  const accountLink =
    accountLinkOverride && accountLinkOverride.trim().length > 0
      ? accountLinkOverride
      : accountSlug
        ? `/c/login?account=${accountSlug}`
        : "/c/login";
  const showSocials = Boolean(data.showSocials);
  const socialIconSizeRaw = Number(data.socialIconSize);
  const socialIconSize =
    Number.isFinite(socialIconSizeRaw) && socialIconSizeRaw >= 24 && socialIconSizeRaw <= 72
      ? Math.round(socialIconSizeRaw)
      : 40;
  const socialGlyphSize = Math.max(14, Math.round(socialIconSize * 0.55));
  const socialsMode = (data.socialsMode as string) || "auto";
  const socialsCustom = (data.socialsCustom as Record<string, string>) ?? {};
  const buttonText = (data.buttonText as string) || "Записаться";
  const menuButtonBorderColorRaw =
    typeof data.menuButtonBorderColor === "string" ? data.menuButtonBorderColor.trim() : "";
  const menuButtonBorderColor =
    menuButtonBorderColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : menuButtonBorderColorRaw && isValidColorValue(menuButtonBorderColorRaw)
        ? menuButtonBorderColorRaw
        : "transparent";
  const menuButtonRadiusRaw = Number(data.menuButtonRadius);
  const menuButtonRadius = Number.isFinite(menuButtonRadiusRaw)
    ? Math.max(0, Math.min(80, Math.round(menuButtonRadiusRaw)))
    : 0;
  const basePath = publicSlug ? `/${publicSlug}` : "#";
  const position = data.position === "sticky" ? "sticky" : "static";
  const accountTitleRaw =
    typeof data.accountTitle === "string" ? data.accountTitle.trim() : "";
  const accountTitle = accountTitleRaw || accountName;
  const menuHeightRaw = Number(data.menuHeight);
  const menuHeightMin = block.variant === "v1" ? 40 : 30;
  const menuHeight =
    Number.isFinite(menuHeightRaw) && menuHeightRaw >= menuHeightMin && menuHeightRaw <= 96
      ? Math.round(menuHeightRaw)
      : block.variant === "v1"
        ? 64
        : 56;
  const menuButtonSize = Math.max(18, Math.min(42, menuHeight - 4));
  const logoImageHeight = Math.max(14, Math.min(32, menuHeight - 10));
  const align = (style.textAlignHeading ?? style.textAlign ?? "left") as
    | "left"
    | "center"
    | "right";
  const alignClass =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";
  const stackAlignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left";

  const logoImageNode =
    showLogo && branding.logoUrl ? (
      <img src={branding.logoUrl} alt="" style={{ height: logoImageHeight, width: "auto" }} />
    ) : null;
  const companyNameNode = showCompanyName ? (
    <span
      className="font-semibold text-[color:var(--bp-muted)]"
      style={{ ...textStyle(style), lineHeight: 1.1 }}
    >
      {accountTitle}
    </span>
  ) : null;
  const logoNode =
    logoImageNode || companyNameNode ? (
      <div className="flex items-center gap-2">
        {logoImageNode}
        {companyNameNode}
      </div>
    ) : null;

  const linkItems = menuItems.map((key) => {
    const href =
      key === "home"
        ? basePath
        : key === "booking"
          ? `${basePath}/booking`
          : key === "client"
            ? accountSlug
              ? `/c?account=${accountSlug}`
              : "/c"
            : `${basePath}/${key === "promos" ? "promos" : key}`;
    return (
      <Link
        key={key}
        href={href}
        className="font-medium whitespace-nowrap"
        style={{
          ...headingStyle(style),
          color: "var(--block-text, var(--bp-ink))",
        }}
      >
        {PAGE_LABELS[key]}
      </Link>
    );
  });
  const overlayLinkItems = menuItems.map((key) => {
    const href =
      key === "home"
        ? basePath
        : key === "booking"
          ? `${basePath}/booking`
          : key === "client"
            ? accountSlug
              ? `/c?account=${accountSlug}`
              : "/c"
            : `${basePath}/${key === "promos" ? "promos" : key}`;
    return (
      <Link
        key={`${key}-overlay`}
        href={href}
        className="w-full text-3xl font-medium md:text-5xl"
        style={{
          ...headingStyle(style),
          color: "var(--block-text, var(--bp-ink))",
          textAlign: align,
          ...(block.variant === "v2"
            ? { fontSize: `${Math.max(26, Number(style.headingSize ?? 15) + 12)}px`, lineHeight: 1.25 }
            : {}),
        }}
      >
        {PAGE_LABELS[key]}
      </Link>
    );
  });

  const socialsAuto: Record<string, string | null | undefined> = {
    website: profile.websiteUrl,
    instagram: profile.instagramUrl,
    whatsapp: profile.whatsappUrl,
    telegram: profile.telegramUrl,
    max: profile.maxUrl,
    vk: profile.vkUrl,
    viber: profile.viberUrl,
    pinterest: profile.pinterestUrl,
    facebook: profile.facebookUrl,
    tiktok: profile.tiktokUrl,
    youtube: profile.youtubeUrl,
    twitter: profile.twitterUrl,
    dzen: profile.dzenUrl,
    ok: profile.okUrl,
  };

  const socialEntries = Object.keys(SOCIAL_ICONS)
    .map((key) => {
      const raw =
        socialsMode === "custom" ? socialsCustom[key] : socialsAuto[key];
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) return null;
      const href = value.startsWith("http") ? value : `https://${value}`;
      return { key, href };
    })
    .filter(Boolean) as Array<{ key: string; href: string }>;

  const socialsNode =
    showSocials && socialEntries.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2">
        {socialEntries.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-transparent bg-transparent"
            style={{ width: socialIconSize, height: socialIconSize }}
            title={SOCIAL_LABELS[item.key] ?? item.key}
            aria-label={SOCIAL_LABELS[item.key] ?? item.key}
          >
            <img
              src={SOCIAL_ICONS[item.key]}
              alt={SOCIAL_LABELS[item.key] ?? item.key}
              className="h-5 w-5"
              style={{ width: socialGlyphSize, height: socialGlyphSize }}
            />
          </a>
        ))}
      </div>
    ) : null;
  const canBook = Boolean(publicSlug);
  const canPhone = Boolean(phoneValue);
  const usePhone = ctaMode === "phone" && canPhone;
  const showCta = showButton && (canBook || canPhone);
  const isAccountExternal = false;
  const ctaTypographyStyle: CSSProperties = {
    fontFamily: style.fontSubheading || style.fontBody || "var(--site-font-body)",
    fontWeight: style.fontWeightSubheading ?? style.fontWeightBody ?? undefined,
    fontSize:
      style.subheadingSize !== null && style.subheadingSize !== undefined
        ? `${style.subheadingSize}px`
        : undefined,
    lineHeight: 1.15,
  };

  const ctaNode = showCta ? (
    usePhone ? (
      <a
        href={`tel:${phoneValue}`}
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={{
          ...buttonStyle(style),
          ...ctaTypographyStyle,
          borderRadius: `${menuButtonRadius}px`,
          borderStyle: "solid",
          borderWidth: menuButtonBorderColor === "transparent" ? 0 : 1,
          borderColor: menuButtonBorderColor,
        }}
      >
        {phoneValue}
      </a>
    ) : (
      <Link
        href={buildBookingLink({ publicSlug })}
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={{
          ...buttonStyle(style),
          ...ctaTypographyStyle,
          borderRadius: `${menuButtonRadius}px`,
          borderStyle: "solid",
          borderWidth: menuButtonBorderColor === "transparent" ? 0 : 1,
          borderColor: menuButtonBorderColor,
        }}
      >
        {buttonText}
      </Link>
    )
  ) : null;

  const searchNode =
    showSearch && publicSlug ? (
      <MenuSearch
        publicSlug={publicSlug}
        locations={locations.map((item) => ({ id: item.id, name: item.name }))}
        services={services.map((item) => ({ id: item.id, name: item.name }))}
        specialists={specialists.map((item) => ({ id: item.id, name: item.name }))}
        promos={promos.map((item) => ({ id: item.id, name: item.name }))}
      />
    ) : null;

  const accountNode = showAccount ? (
    isAccountExternal ? (
      <a
        href={accountLink}
        className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
        aria-label="Личный кабинет"
        title="Личный кабинет"
        target="_blank"
        rel="noreferrer"
      >
        <IconUser />
      </a>
    ) : (
      <Link
        href={accountLink}
        className="inline-flex h-10 w-10 items-center justify-center rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
        aria-label="Личный кабинет"
        title="Личный кабинет"
      >
        <IconUser />
      </Link>
    )
  ) : null;
  const themeToggleNode = showThemeToggle ? (
    <SiteThemeToggle
      mode={theme.mode}
      lightPalette={theme.lightPalette}
      darkPalette={theme.darkPalette}
    />
  ) : null;

  const actions = (
    <div className="flex flex-wrap items-center gap-4">
      {searchNode}
      {socialsNode}
      {accountNode}
      {themeToggleNode}
      {ctaNode}
    </div>
  );

  const actionsCentered = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {searchNode}
      {socialsNode}
      {accountNode}
      {themeToggleNode}
      {ctaNode}
    </div>
  );

  const navNode = (
    <div className="flex flex-wrap items-center gap-4">{linkItems}</div>
  );
  const drawerNavNode = (
    <div className={`flex w-full flex-col gap-2 ${stackAlignClass}`}>{linkItems}</div>
  );
  const overlayNavNode = (
    <div className={`flex w-full flex-col gap-6 ${stackAlignClass}`}>{overlayLinkItems}</div>
  );
  const drawerLinkItems = (
    <div className={`flex w-full flex-col gap-2 ${stackAlignClass}`}>
      {menuItems.map((key) => {
        const href =
          key === "home"
            ? basePath
            : key === "booking"
              ? `${basePath}/booking`
              : key === "client"
                ? accountSlug
                  ? `/c?account=${accountSlug}`
                  : "/c"
                : `${basePath}/${key === "promos" ? "promos" : key}`;
        return (
          <Link
            key={`${key}-drawer`}
            href={href}
            className={`w-full font-medium text-[color:var(--block-text,var(--bp-ink))] ${
              block.variant === "v3" ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
            }`}
            style={{
              ...headingStyle(style),
              textAlign: align,
              ...(block.variant === "v3"
                ? { fontSize: `${Math.max(32, Number(style.headingSize ?? 15) + 16)}px`, lineHeight: 1.25 }
                : {}),
            }}
          >
            {PAGE_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );

  const navPills = (
    <div className="flex flex-wrap items-center gap-2">
      {menuItems.map((key) => {
        const href =
          key === "home"
            ? basePath
            : key === "booking"
              ? `${basePath}/booking`
              : key === "client"
                ? accountSlug
                  ? `/c?account=${accountSlug}`
                  : "/c"
                : `${basePath}/${key === "promos" ? "promos" : key}`;
        return (
          <Link
            key={key}
            href={href}
            className="rounded-none border border-[color:var(--site-border)] px-3 py-1 text-xs"
          >
            {PAGE_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );
  const subBlockSurfaceStyle: CSSProperties = {
    backgroundColor: "var(--block-sub-bg, var(--block-bg))",
    borderColor: "var(--block-border, var(--site-border))",
    borderWidth: 1,
  };

  let desktopLayout: ReactNode = (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-4">{logoNode}</div>
      <div className={`flex flex-1 flex-wrap items-center gap-5 ${alignClass}`}>{navNode}</div>
      {actions}
    </div>
  );

  if (block.variant === "v1") {
    desktopLayout = (
      <div className="flex h-full items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">{logoNode}</div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-4 whitespace-nowrap ${alignClass}`}>{linkItems}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {searchNode}
          {socialsNode}
          {accountNode}
          {themeToggleNode}
          {ctaNode}
        </div>
      </div>
    );
  }

  if (block.variant === "v2") {
    return (
      <div
        className="w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 12, zIndex: 20 }
            : undefined
        }
      >
        <details
          suppressHydrationWarning
          className="group menu-v2-overlay w-full"
          style={
            {
              ["--menu-v2-top-bg" as string]: menuBarBackground.backgroundColor,
              ["--menu-v2-top-gradient" as string]: menuBarBackground.backgroundImage,
            } as CSSProperties
          }
        >
          <summary
            className="relative z-[60] flex cursor-pointer list-none items-center border-b py-0 pl-8 pr-24
              group-open:[--menu-v2-top-bg:var(--block-sub-bg)]
              group-open:[--menu-v2-top-gradient:none]
              [&::-webkit-details-marker]:hidden
              group-open:z-[180] group-open:py-0 group-open:pl-8 group-open:pr-24"
            style={{
              minHeight: menuHeight,
              backgroundColor: "var(--menu-v2-top-bg, var(--block-bg, var(--site-panel)))",
              backgroundImage: "var(--menu-v2-top-gradient, none)",
              borderColor: "var(--block-border, var(--site-border))",
            }}
          >
            <span className="inline-flex items-center gap-3">{logoNode}</span>
            {searchNode && (
              <span className="absolute right-24 top-1/2 hidden -translate-y-1/2 md:group-open:flex">
                {searchNode}
              </span>
            )}
            <span
              className="absolute right-8 top-1/2 inline-flex -translate-y-1/2 items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
              style={{ width: menuButtonSize, height: menuButtonSize }}
            >
              <span className="absolute left-1/2 top-[calc(50%-6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:rotate-45" />
              <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out group-open:opacity-0" />
              <span className="absolute left-1/2 top-[calc(50%+6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:-rotate-45" />
            </span>
          </summary>
          <div
            className="fixed inset-0 z-[160] flex flex-col overflow-hidden border px-6 py-6 pt-24 md:px-10 md:py-8 md:pt-28"
            style={subBlockSurfaceStyle}
          >
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              {overlayNavNode}
            </div>
            <div className="w-full md:hidden">
              <div className="space-y-3 text-center">
                {searchNode && <div className="flex justify-center">{searchNode}</div>}
                {socialsNode && <div className="flex justify-center">{socialsNode}</div>}
                {(accountNode || themeToggleNode) && (
                  <div className="flex items-center justify-center gap-3">
                    {accountNode}
                    {themeToggleNode}
                  </div>
                )}
                {ctaNode && <div className="flex justify-center">{ctaNode}</div>}
              </div>
            </div>
            <div className="hidden flex-wrap items-center justify-center gap-3 md:flex">
              {socialsNode}
              {accountNode}
              {themeToggleNode}
              {ctaNode}
            </div>
          </div>
        </details>
      </div>
    );
  }

  if (block.variant === "v3") {
    return (
      <div
        className="w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 12, zIndex: 20 }
            : undefined
        }
      >
        <details suppressHydrationWarning className="group relative menu-v3-overlay w-full">
          <summary
            className="relative flex list-none items-center px-4 md:px-8 [&::-webkit-details-marker]:hidden"
            style={{
              minHeight: menuHeight,
              backgroundColor: menuBarBackground.backgroundColor,
              backgroundImage: menuBarBackground.backgroundImage,
              borderColor: "var(--block-border, var(--site-border))",
              borderBottomWidth: 1,
            }}
          >
            <span
              className="relative inline-flex items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
              style={{ width: menuButtonSize, height: menuButtonSize }}
            >
              <span className="absolute left-1/2 top-[calc(50%-6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:rotate-45" />
              <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out group-open:opacity-0" />
              <span className="absolute left-1/2 top-[calc(50%+6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:-rotate-45" />
            </span>
            {logoNode ? (
              <span className="pointer-events-none absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center">
                {logoNode}
              </span>
            ) : null}
            <span className="ml-auto hidden items-center gap-2 md:inline-flex [&_a]:!rounded-none [&_a]:!border-0 [&_a]:!bg-transparent">
              {socialsNode}
            </span>
          </summary>
          <div className="fixed inset-0 z-[160] hidden group-open:block">
            <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" />
            <aside
              className="relative z-10 flex h-full w-full flex-col border-r pb-5 pt-0 text-[color:var(--block-text,var(--bp-ink))] sm:w-[min(360px,78vw)]"
              style={{
                backgroundColor: "var(--block-sub-bg, var(--block-bg, var(--site-panel)))",
                borderColor: "var(--block-border, var(--site-border))",
              }}
            >
              <div className="mb-8 flex items-center justify-between gap-3 px-4 md:px-8" style={{ minHeight: menuHeight }}>
                <DetailsCloseButton
                  className="relative inline-flex items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--block-text,var(--bp-ink))]"
                  style={{ width: menuButtonSize, height: menuButtonSize }}
                  title="Закрыть меню"
                  ariaLabel="Закрыть меню"
                >
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 opacity-0 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
                </DetailsCloseButton>
                <div className="min-w-0 flex flex-1 justify-end">{searchNode}</div>
              </div>
              <div className="space-y-3 px-6">
                {drawerLinkItems}
              </div>
              <div className="mt-auto space-y-4 px-6 pt-6">
                {ctaNode && <div className="flex justify-center">{ctaNode}</div>}
                {socialsNode && <div className="flex justify-center md:hidden">{socialsNode}</div>}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {accountNode}
                  {themeToggleNode}
                </div>
              </div>
            </aside>
          </div>
        </details>
      </div>
    );
  }

  if (block.variant === "v1") {
    const topBarStyle: CSSProperties = {
      height: menuHeight,
      backgroundColor: menuBarBackground.backgroundColor,
      backgroundImage: menuBarBackground.backgroundImage,
      borderColor: "var(--block-border, var(--site-border))",
      borderBottomWidth: 1,
    };
    return (
      <div
        className="w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 12, zIndex: 20 }
            : undefined
        }
      >
        <div className="hidden px-4 2xl:block 2xl:px-8" style={topBarStyle}>
          {desktopLayout}
        </div>
        <div className="2xl:hidden">
          <div
            className="flex items-center justify-between gap-3 px-4"
            style={topBarStyle}
          >
            {logoNode}
            <details suppressHydrationWarning className="group relative">
              <summary
                className="relative inline-flex cursor-pointer list-none items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)] [&::-webkit-details-marker]:hidden"
                style={{ width: menuButtonSize, height: menuButtonSize }}
              >
                <span className="absolute left-1/2 top-[calc(50%-6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:rotate-45" />
                <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out group-open:opacity-0" />
                <span className="absolute left-1/2 top-[calc(50%+6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:-rotate-45" />
              </summary>
              <div
                className="fixed inset-0 z-[160] flex flex-col overflow-hidden pb-6 pt-0"
                style={{ ...subBlockSurfaceStyle, borderWidth: 0 }}
              >
                <div className="mb-4 flex items-center justify-between gap-3 px-4" style={{ height: menuHeight }}>
                  {logoNode}
                  <DetailsCloseButton
                    className="relative inline-flex items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
                    style={{ width: menuButtonSize, height: menuButtonSize }}
                    title="Закрыть меню"
                    ariaLabel="Закрыть меню"
                  >
                    <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                    <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 opacity-0 bg-current" />
                    <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
                  </DetailsCloseButton>
                </div>
                {searchNode && <div className="mb-6 flex justify-center">{searchNode}</div>}
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-col gap-2">{linkItems}</div>
                  <div className="mt-auto space-y-3 pt-4">
                    {ctaNode && <div className="flex justify-center">{ctaNode}</div>}
                    {socialsNode && <div className="flex justify-center">{socialsNode}</div>}
                    <div className="flex items-center justify-center gap-2">
                      {accountNode}
                      {themeToggleNode}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  if (block.variant === "v4") {
    desktopLayout = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">{logoNode}</div>
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>
        <div className="rounded-none border px-3 py-2" style={subBlockSurfaceStyle}>
          <div className="flex flex-wrap items-center gap-2">{navPills}</div>
        </div>
      </div>
    );
  }

  if (block.variant === "v5") {
    desktopLayout = (
      <div className="flex flex-col items-center gap-4 text-center">
        {logoNode}
        <div className="w-full rounded-none border px-4 py-3" style={subBlockSurfaceStyle}>
          {navNode}
        </div>
        {actionsCentered}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="hidden md:block">{desktopLayout}</div>
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          {logoNode}
          <div className="flex items-center gap-2">
            {accountNode}
            {themeToggleNode}
            {ctaNode}
            <details suppressHydrationWarning className="relative">
              <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]">
                <IconMenu />
              </summary>
              <div
                className="absolute right-0 mt-2 w-72 rounded-none border p-4 shadow-lg"
                style={subBlockSurfaceStyle}
              >
                {searchNode && <div className="mb-3">{searchNode}</div>}
                <div className="flex flex-col gap-2">{linkItems}</div>
                {socialsNode && <div className="mt-3">{socialsNode}</div>}
                {ctaNode && <div className="mt-3">{ctaNode}</div>}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveCoverImage(
  imageSource: { type?: string; id?: number; url?: string },
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[]
) {
  if (imageSource.type === "custom") return imageSource.url ?? null;
  if (imageSource.type === "none") return null;
  if (imageSource.type === "account") return branding.coverUrl ?? null;
  if (imageSource.type === "location") {
    return locations.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  if (imageSource.type === "service") {
    return services.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  if (imageSource.type === "specialist") {
    return specialists.find((item) => item.id === imageSource.id)?.coverUrl ?? null;
  }
  return null;
}

function IconUser() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function renderAbout(
  block: SiteBlock,
  accountName: string,
  profile: AccountProfile,
  _theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const text = (data.text as string) || profile.description || "";
  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "О нас"}
      </h2>
      {text && <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{text}</p>}
      <div className="mt-3 text-xs text-[color:var(--bp-muted)]">Аккаунт: {accountName}</div>
    </div>
  );
}

function renderLocations(
  block: SiteBlock,
  publicSlug: string,
  locations: LocationItem[],
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "location" ? current.id : null;
  const items =
    useCurrent && currentId
      ? locations.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, locations);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Локации"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((location) => (
          <div key={location.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {location.coverUrl && (
              <img
                src={location.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <Link
              href={`/${publicSlug}/locations/${location.id}`}
              className="text-base font-semibold"
            >
              {location.name}
            </Link>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{location.address}</div>
            {location.phone && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                Телефон: {location.phone}
              </div>
            )}
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId: location.id,
                  scenario: "dateFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                style={buttonStyle(style)}
              >
                {buttonText}
              </Link>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет локаций для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderServices(
  block: SiteBlock,
  publicSlug: string,
  services: ServiceItem[],
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "service" ? current.id : null;
  const items =
    useCurrent && currentId
      ? services.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, services);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const showPrice = data.showPrice !== false;
  const showDuration = data.showDuration !== false;
  const cardsPerRowRaw = Number(data.cardsPerRow);
  const cardsPerRow =
    Number.isFinite(cardsPerRowRaw) && cardsPerRowRaw >= 1 && cardsPerRowRaw <= 4
      ? Math.round(cardsPerRowRaw)
      : 3;
  const gridClassName =
    cardsPerRow === 1
      ? "grid-cols-1"
      : cardsPerRow === 2
        ? "grid-cols-1 md:grid-cols-2"
        : cardsPerRow === 3
          ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
          : "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const specialistId = typeof data.specialistId === "number" ? data.specialistId : null;
  const currentLocationId = current?.type === "location" ? current.id : null;
  const currentSpecialistId = current?.type === "specialist" ? current.id : null;
  const effectiveSpecialistId = currentSpecialistId ?? specialistId;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Услуги"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className={`mt-4 grid gap-4 ${gridClassName}`}>
        {items.map((service) => {
          const serviceHref = `/${publicSlug}/services/${service.id}`;
          return (
            <article key={service.id} className="relative">
              {service.coverUrl ? (
                <div className="group relative min-h-[300px] overflow-hidden rounded-2xl">
                  <img
                    src={service.coverUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/45" />
                  <div className="relative z-[1] flex h-full min-h-[300px] flex-col p-5 text-white">
                    <div className="mb-auto flex items-start justify-between gap-3">
                      <Link href={serviceHref} className="text-lg font-semibold leading-tight hover:underline">
                        {service.name}
                      </Link>
                      <Link
                        href={serviceHref}
                        aria-label={`Открыть услугу ${service.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 text-xl leading-none"
                      >
                        ›
                      </Link>
                    </div>
                    <div className="mt-4">
                      {service.description && (
                        <div className="text-sm text-white/90">{service.description}</div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/90">
                        {showDuration && <span>{service.baseDurationMin} мин</span>}
                        {showPrice && <span>{service.basePrice} ₽</span>}
                      </div>
                    </div>
                    {showButton && publicSlug && (
                      <div className="mt-4">
                        <Link
                          href={buildBookingLink({
                            publicSlug,
                            locationId:
                              currentLocationId ??
                              locationId ??
                              (service.locationIds.length === 1 ? service.locationIds[0] : null),
                            specialistId: effectiveSpecialistId,
                            serviceId: service.id,
                            scenario: "serviceFirst",
                          })}
                          className="inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                          style={buttonStyle(style)}
                        >
                          {buttonText}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 py-1">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={serviceHref}
                      className="text-lg font-semibold leading-tight hover:underline"
                      style={{ color: "var(--block-text, var(--bp-ink))" }}
                    >
                      {service.name}
                    </Link>
                    <Link
                      href={serviceHref}
                      aria-label={`Открыть услугу ${service.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xl leading-none"
                      style={{
                        color: "var(--block-text, var(--bp-ink))",
                        borderColor: "var(--block-border, var(--site-border))",
                      }}
                    >
                      ›
                    </Link>
                  </div>
                  {service.description && (
                    <div className="text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                      {service.description}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--block-muted,var(--bp-muted))]">
                    {showDuration && <span>{service.baseDurationMin} мин</span>}
                    {showPrice && <span>{service.basePrice} ₽</span>}
                  </div>
                  {showButton && publicSlug && (
                    <div>
                      <Link
                        href={buildBookingLink({
                          publicSlug,
                          locationId:
                            currentLocationId ??
                            locationId ??
                            (service.locationIds.length === 1 ? service.locationIds[0] : null),
                          specialistId: effectiveSpecialistId,
                          serviceId: service.id,
                          scenario: "serviceFirst",
                        })}
                        className="inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                        style={buttonStyle(style)}
                      >
                        {buttonText}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет услуг для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderSpecialists(
  block: SiteBlock,
  publicSlug: string,
  specialists: SpecialistItem[],
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "specialist" ? current.id : null;
  const items =
    useCurrent && currentId
      ? specialists.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, specialists);
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const currentLocationId = current?.type === "location" ? current.id : null;
  const visibleItems = currentLocationId
    ? items.filter((item) => item.locationIds.includes(currentLocationId))
    : items;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Специалисты"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {visibleItems.map((specialist) => (
          <div key={specialist.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {specialist.coverUrl && (
              <img
                src={specialist.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <Link
              href={`/${publicSlug}/specialists/${specialist.id}`}
              className="text-base font-semibold"
            >
              {specialist.name}
            </Link>
            {specialist.level && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{specialist.level}</div>
            )}
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId:
                    currentLocationId ??
                    locationId ??
                    (specialist.locationIds.length === 1 ? specialist.locationIds[0] : null),
                  specialistId: specialist.id,
                  scenario: "specialistFirst",
                })}
                className="mt-3 inline-flex rounded-full border border-[color:var(--bp-stroke)] px-3 py-2 text-xs"
                style={buttonStyle(style)}
              >
                {buttonText}
              </Link>
            )}
          </div>
        ))}
        {visibleItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет специалистов для отображения.
          </div>
        )}
      </div>
    </div>
  );
}

function renderPromos(
  block: SiteBlock,
  publicSlug: string,
  promos: PromoItem[],
  current: CurrentEntity,
  _theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = current?.type === "promo" ? current.id : null;
  const items =
    useCurrent && currentId
      ? promos.filter((item) => item.id === currentId)
      : resolveEntities(mode, ids, promos);
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Промо и скидки"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((promo) => (
          <div key={promo.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            <Link
              href={`/${publicSlug}/promos/${promo.id}`}
              className="text-base font-semibold"
            >
              {promo.name}
            </Link>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} ₽`}
              {promo.startsAt || promo.endsAt ? " В· " : ""}
              {promo.startsAt ? `с ${promo.startsAt}` : ""}
              {promo.endsAt ? ` по ${promo.endsAt}` : ""}
            </div>
            {promo.codes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {promo.codes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full border border-[color:var(--bp-stroke)] px-2 py-1 text-xs"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )}
            {!promo.isActive && (
              <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                Неактивно
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет активных промо.
          </div>
        )}
      </div>
    </div>
  );
}

function renderWorks(
  block: SiteBlock,
  workPhotos: WorkPhotos,
  current: CurrentEntity,
  theme: SiteTheme
) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const source = (data.source as string) ?? "locations";
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const galleryHeightRaw = Number(data.galleryHeight);
  const galleryHeight =
    Number.isFinite(galleryHeightRaw) && galleryHeightRaw >= 220 && galleryHeightRaw <= 900
      ? Math.round(galleryHeightRaw)
      : 550;
  const imageRadiusRaw = Number(data.imageRadius);
  const imageRadius =
    Number.isFinite(imageRadiusRaw) && imageRadiusRaw >= 0 && imageRadiusRaw <= 60
      ? Math.round(imageRadiusRaw)
      : 0;
  const imageFit = data.imageFit === "contain" ? "contain" : "cover";
  const maxSlidesRaw = Number(data.maxSlides);
  const maxSlides =
    Number.isFinite(maxSlidesRaw) && maxSlidesRaw >= 1 && maxSlidesRaw <= 30
      ? Math.round(maxSlidesRaw)
      : 12;
  const colorMode = theme.mode === "dark" ? "dark" : "light";
  const arrowColorLight =
    typeof data.arrowColorLight === "string"
      ? data.arrowColorLight.trim()
      : typeof data.arrowColor === "string"
        ? data.arrowColor.trim()
        : "";
  const arrowColorDark = typeof data.arrowColorDark === "string" ? data.arrowColorDark.trim() : "";
  const arrowBgColorLight =
    typeof data.arrowBgColorLight === "string"
      ? data.arrowBgColorLight.trim()
      : typeof data.arrowBgColor === "string"
        ? data.arrowBgColor.trim()
        : "";
  const arrowBgColorDark = typeof data.arrowBgColorDark === "string" ? data.arrowBgColorDark.trim() : "";
  const dotActiveColorLight =
    typeof data.dotActiveColorLight === "string"
      ? data.dotActiveColorLight.trim()
      : typeof data.dotActiveColor === "string"
        ? data.dotActiveColor.trim()
        : "";
  const dotActiveColorDark = typeof data.dotActiveColorDark === "string" ? data.dotActiveColorDark.trim() : "";
  const dotInactiveColorLight =
    typeof data.dotInactiveColorLight === "string"
      ? data.dotInactiveColorLight.trim()
      : typeof data.dotInactiveColor === "string"
        ? data.dotInactiveColor.trim()
        : "";
  const dotInactiveColorDark =
    typeof data.dotInactiveColorDark === "string" ? data.dotInactiveColorDark.trim() : "";
  const arrowColor =
    colorMode === "dark" ? arrowColorDark || arrowColorLight : arrowColorLight || arrowColorDark;
  const arrowBgColor =
    colorMode === "dark" ? arrowBgColorDark || arrowBgColorLight : arrowBgColorLight || arrowBgColorDark;
  const dotActiveColor =
    colorMode === "dark" ? dotActiveColorDark || dotActiveColorLight : dotActiveColorLight || dotActiveColorDark;
  const dotInactiveColor =
    colorMode === "dark"
      ? dotInactiveColorDark || dotInactiveColorLight
      : dotInactiveColorLight || dotInactiveColorDark;
  const arrowVariant =
    data.arrowVariant === "angle" || data.arrowVariant === "triangle" ? data.arrowVariant : "chevron";
  const imageBorderColor = style.borderColor === "transparent" ? "transparent" : "var(--block-border)";
  const imageBorderWidth = style.borderColor === "transparent" ? 0 : 1;
  const imageShadow =
    typeof style.shadowSize === "number"
      ? style.shadowSize > 0
        ? `0 ${style.shadowSize}px ${style.shadowSize * 2}px ${style.shadowColor || "var(--site-shadow-color)"}`
        : "none"
      : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)";
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const titleRaw = typeof data.title === "string" ? data.title.trim() : "";
  const title = titleRaw === "Галерея" ? "" : titleRaw;
  const items =
    source === "services"
      ? workPhotos.services
      : source === "specialists"
        ? workPhotos.specialists
        : workPhotos.locations;
  const currentId =
    current?.type === "service" && source === "services"
      ? current.id
      : current?.type === "specialist" && source === "specialists"
        ? current.id
        : current?.type === "location" && source === "locations"
          ? current.id
          : null;
  const filtered = useCurrent && currentId
    ? items.filter((item) => Number(item.entityId) === currentId)
    : useCurrent
      ? items.slice(0, 6)
      : mode === "selected" && ids.length > 0
        ? items.filter((item) => ids.includes(Number(item.entityId)))
        : items;
  const galleryImages = filtered.slice(0, maxSlides).map((item) => item.url).filter(Boolean);
  const hasGalleryText = Boolean(title || subtitle);
  const isFullscreenVariant = block.variant === "v2";
  const containBackgroundColor = style.blockBg || "var(--block-bg, var(--site-panel))";

  if (isFullscreenVariant) {
    return (
      <div className="relative w-full">
        <GallerySlider
          images={galleryImages}
          height={galleryHeight}
          radius={imageRadius}
          imageFit={imageFit}
          containBackgroundColor={containBackgroundColor}
          imageBorderColor={imageBorderColor}
          imageBorderWidth={imageBorderWidth}
          imageShadow={imageShadow}
          dotsOverlay={true}
          arrowColor={arrowColor || "var(--bp-ink)"}
          arrowBgColor={arrowBgColor || "#ffffffd1"}
          dotActiveColor={dotActiveColor || "var(--bp-ink)"}
          dotInactiveColor={dotInactiveColor || "var(--bp-muted)"}
          arrowVariant={arrowVariant}
        />
        {hasGalleryText && (
          <>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-14 z-[2]">
              <div
                className="px-4 text-center text-white"
                style={{
                  width: "var(--works-content-width, 100%)",
                  maxWidth: "100%",
                  marginLeft: "var(--works-content-left, auto)",
                  marginRight: 0,
                }}
              >
                {title && <h2 className="font-semibold" style={{ ...headingStyle(style), color: "white" }}>{title}</h2>}
                {subtitle && (
                  <p
                    className={`${title ? "mt-2" : ""}`}
                    style={{ ...subheadingStyle(style), color: "rgba(255,255,255,0.9)" }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "var(--works-content-width, 100%)",
        maxWidth: "100%",
        marginLeft: "var(--works-content-left, auto)",
        marginRight: 0,
      }}
    >
      <div
        className="p-0"
        style={{
          backgroundColor: "var(--block-bg)",
          backgroundImage: "var(--block-gradient)",
          borderColor: "var(--block-border)",
          borderWidth: 0,
          borderRadius: typeof style.radius === "number" ? style.radius : undefined,
          boxShadow: "none",
        }}
      >
        {hasGalleryText && (
          <div className="px-6 pt-6">
            {title && <h2 className="font-semibold" style={headingStyle(style)}>{title}</h2>}
            {subtitle && (
              <p className={`${title ? "mt-2" : ""} text-[color:var(--bp-muted)]`} style={subheadingStyle(style)}>
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className={hasGalleryText ? "mt-5" : ""}>
          <GallerySlider
            images={galleryImages}
            height={galleryHeight}
            radius={imageRadius}
            imageFit={imageFit}
            containBackgroundColor={containBackgroundColor}
            imageBorderColor={imageBorderColor}
            imageBorderWidth={imageBorderWidth}
            imageShadow={imageShadow}
            arrowColor={arrowColor || "var(--bp-ink)"}
            arrowBgColor={arrowBgColor || "#ffffffd1"}
            dotActiveColor={dotActiveColor || "var(--bp-ink)"}
            dotInactiveColor={dotInactiveColor || "var(--bp-muted)"}
            arrowVariant={arrowVariant}
          />
        </div>
      </div>
    </div>
  );
}

function renderReviews(block: SiteBlock) {
  const data = block.data as Record<string, unknown>;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  return (
    <div>
      <h2
        className="text-2xl font-semibold"
        style={{ fontFamily: "var(--site-font-heading)" }}
      >
        {(data.title as string) || "Отзывы"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]"
          >
            Отзывы будут отображаться здесь после их появления.
          </div>
        ))}
      </div>
    </div>
  );
}

function renderContacts(
  block: SiteBlock,
  accountName: string,
  profile: AccountProfile,
  locations: LocationItem[]
) {
  const data = block.data as Record<string, unknown>;
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const location = locationId
    ? locations.find((item) => item.id === locationId)
    : locations[0];
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
      <div>
        <h2
          className="text-2xl font-semibold"
          style={{ fontFamily: "var(--site-font-heading)" }}
        >
          {(data.title as string) || "Контакты"}
        </h2>
        {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
        <div className="mt-4 space-y-2 text-sm text-[color:var(--bp-muted)]">
          <div>Аккаунт: {accountName}</div>
          {profile.phone && <div>Телефон: {profile.phone}</div>}
          {profile.email && <div>Email: {profile.email}</div>}
          {(profile.address || location?.address) && (
            <div>Адрес: {profile.address || location?.address}</div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-xs text-[color:var(--bp-muted)]">
        Здесь можно будет подключить карту.
      </div>
    </div>
  );
}


