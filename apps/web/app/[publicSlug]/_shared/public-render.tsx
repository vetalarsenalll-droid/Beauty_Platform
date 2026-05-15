import { UnoptimizedImage } from "@/components/unoptimized-image";
import Link from "next/link";
import { buildBookingLink } from "@/lib/booking-links";
import PublicBookingClient from "@/components/public-booking-client";
import MenuSearch from "@/components/menu-search";
import SiteThemeToggle from "@/components/site-theme-toggle";
import DetailsCloseButton from "@/components/details-close-button";
import GallerySlider from "@/components/gallery-slider";
import PublicReviewAuthModal from "@/components/public-review-auth-modal";
import PublicParallaxLayer from "./public-parallax-layer";
import PublicCoverV2Hero, { type PublicCoverSlide } from "./public-cover-v2-hero";
import { ServicesCatalog } from "@/features/site-builder/blocks/services/services-catalog";
import { SpecialistsCatalog } from "@/features/site-builder/blocks/specialists/specialists-catalog";
import { LocationsCatalog } from "@/features/site-builder/blocks/locations/locations-catalog";
import type { CSSProperties, ReactNode } from "react";
import {
  type SiteBlock,
  type SiteLoaderConfig,
  type SiteTheme,
} from "@/lib/site-builder";
import type {
  SiteAccountProfile as AccountProfile,
  SiteBranding as Branding,
  SiteLegalDocumentItem as LegalDocumentItem,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteReviewItem as ReviewItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
  SiteWorkPhotos as WorkPhotos,
} from "@/features/site-builder/shared/site-data";
import {
  resolveCoverBackgroundVisual,
  resolveServiceCardBackgroundVisual,
  resolveServiceModalBackgroundVisual,
  resolveServicesSectionBackgroundVisual,
  resolveSpecialistCardBackgroundVisual,
} from "@/features/site-builder/shared/background-visuals";

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
  mobileBlockWidthColumns?: number | null;
  gridStartColumn?: number | null;
  gridEndColumn?: number | null;
  useCustomWidth?: boolean;
  radius?: number | null;
  buttonRadius?: number | null;
  cardRadius?: number | null;
  bookingImageRadius?: number | null;
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
  panelBorderColorLight?: string;
  panelBorderColorDark?: string;
  cardBgLight?: string;
  cardBgDark?: string;
  cardBackgroundModeLight?: "solid" | "linear" | "radial";
  cardBackgroundModeDark?: "solid" | "linear" | "radial";
  cardBackgroundToLight?: string;
  cardBackgroundToDark?: string;
  cardBackgroundAngleLight?: number;
  cardBackgroundAngleDark?: number;
  cardBackgroundStopALight?: number;
  cardBackgroundStopADark?: number;
  cardBackgroundStopBLight?: number;
  cardBackgroundStopBDark?: number;
  cardBorderColorLight?: string;
  cardBorderColorDark?: string;
  fieldBgLight?: string;
  fieldBgDark?: string;
  fieldBackgroundModeLight?: "solid" | "linear" | "radial";
  fieldBackgroundModeDark?: "solid" | "linear" | "radial";
  fieldBackgroundToLight?: string;
  fieldBackgroundToDark?: string;
  fieldBackgroundAngleLight?: number;
  fieldBackgroundAngleDark?: number;
  fieldBackgroundStopALight?: number;
  fieldBackgroundStopADark?: number;
  fieldBackgroundStopBLight?: number;
  fieldBackgroundStopBDark?: number;
  fieldBorderColorLight?: string;
  fieldBorderColorDark?: string;
  primaryButtonBorderColorLight?: string;
  primaryButtonBorderColorDark?: string;
  secondaryButtonBgLight?: string;
  secondaryButtonBgDark?: string;
  secondaryButtonTextColorLight?: string;
  secondaryButtonTextColorDark?: string;
  secondaryButtonBorderColorLight?: string;
  secondaryButtonBorderColorDark?: string;
  bookingCardActionBgLight?: string;
  bookingCardActionBgDark?: string;
  bookingCardActionTextColorLight?: string;
  bookingCardActionTextColorDark?: string;
  bookingCardActionBorderColorLight?: string;
  bookingCardActionBorderColorDark?: string;
  bookingCardTitleColorLight?: string;
  bookingCardTitleColorDark?: string;
  bookingCardTitleSizeLight?: number;
  bookingCardTitleSizeDark?: number;
  bookingCardTitleWeightLight?: number | null;
  bookingCardTitleWeightDark?: number | null;
  bookingCardSubtitleColorLight?: string;
  bookingCardSubtitleColorDark?: string;
  bookingCardSubtitleSizeLight?: number;
  bookingCardSubtitleSizeDark?: number;
  bookingCardSubtitleWeightLight?: number | null;
  bookingCardSubtitleWeightDark?: number | null;
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
  servicesHeadingColor?: string;
  servicesHeadingColorLight?: string;
  servicesHeadingColorDark?: string;
  servicesDescriptionColor?: string;
  servicesDescriptionColorLight?: string;
  servicesDescriptionColorDark?: string;
  shadowColor?: string;
  shadowSize?: number | null;
  gradientEnabled?: boolean;
  gradientDirection?: "vertical" | "horizontal";
  gradientModeLight?: "solid" | "linear" | "radial";
  gradientModeDark?: "solid" | "linear" | "radial";
  gradientAngleLight?: number;
  gradientAngleDark?: number;
  gradientStopALight?: number;
  gradientStopADark?: number;
  gradientStopBLight?: number;
  gradientStopBDark?: number;
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
  mobileHeadingSize?: number | null;
  mobileSubheadingSize?: number | null;
  mobileTextSize?: number | null;
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
  servicesHeadingColorLightResolved?: string;
  servicesHeadingColorDarkResolved?: string;
  servicesDescriptionColorLightResolved?: string;
  servicesDescriptionColorDarkResolved?: string;
  gradientEnabledLight?: boolean;
  gradientEnabledDark?: boolean;
  gradientFromLightResolved?: string;
  gradientToLightResolved?: string;
  gradientFromDarkResolved?: string;
  gradientToDarkResolved?: string;
  gradientDirectionLight?: "vertical" | "horizontal";
  gradientDirectionDark?: "vertical" | "horizontal";
  servicesSectionBackgroundModeLight?: "solid" | "linear" | "radial";
  servicesSectionBackgroundModeDark?: "solid" | "linear" | "radial";
  servicesSectionBackgroundFromLight?: string;
  servicesSectionBackgroundFromDark?: string;
  servicesSectionBackgroundToLight?: string;
  servicesSectionBackgroundToDark?: string;
  servicesSectionBackgroundAngleLight?: number;
  servicesSectionBackgroundAngleDark?: number;
  servicesSectionBackgroundStopALight?: number;
  servicesSectionBackgroundStopADark?: number;
  servicesSectionBackgroundStopBLight?: number;
  servicesSectionBackgroundStopBDark?: number;
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
const BOOKING_MAX_BLOCK_COLUMNS = 16;
const DEFAULT_PUBLIC_SECTION_BG_LIGHT = "#f6f7f9";
const DEFAULT_PUBLIC_SECTION_BG_DARK = "#111318";
const DEFAULT_PUBLIC_TRANSPARENT_BG = "transparent";

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

function defaultMobileHeadingSize(desktopSize: number) {
  return Math.max(24, Math.min(40, Math.round(desktopSize * 0.72)));
}

function defaultMobileSubheadingSize(desktopSize: number) {
  return Math.max(18, Math.min(28, Math.round(desktopSize * 0.8)));
}

function defaultMobileTextSize(desktopSize: number) {
  return Math.max(14, Math.min(18, Math.round(desktopSize * 0.9)));
}

function defaultServiceModalMobileTextSize(key: string, desktopSize: number) {
  if (key === "modalTitle") {
    return Math.max(26, Math.min(36, Math.round(desktopSize * 0.68)));
  }
  if (key === "modalCategory") {
    return Math.max(11, Math.min(14, Math.round(desktopSize * 0.9)));
  }
  if (key === "modalPrice" || key === "modalDuration") {
    return Math.max(15, Math.min(18, Math.round(desktopSize * 0.85)));
  }
  return Math.max(14, Math.min(17, Math.round(desktopSize * 0.9)));
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
  const colorKey = (value: string) => normalizeHex(value) ?? value.trim().toLowerCase();
  const isLegacyUnselectedSectionBgLight = (value: string) => {
    const key = colorKey(value);
    if (!key) return false;
    return new Set([
      colorKey(theme.lightPalette.surfaceColor),
      colorKey(theme.lightPalette.panelColor),
      "#f5f2f0",
      "#f7f3f0",
      "#fff7f2",
    ]).has(key);
  };
  const isLegacyUnselectedSectionBgDark = (value: string) => {
    const key = colorKey(value);
    if (!key) return false;
    return new Set([
      colorKey(theme.darkPalette.surfaceColor),
      colorKey(theme.darkPalette.panelColor),
      "#14161a",
      "#16181d",
    ]).has(key);
  };
  const sectionBackgroundPrefix =
    block.type === "booking"
      ? "bookingSectionBackground"
      : block.type === "specialists"
        ? "specialistSectionBackground"
        : block.type === "locations"
          ? "locationSectionBackground"
          : block.type === "services"
            ? "serviceSectionBackground"
            : "servicesSectionBackground";
  const sectionBackgroundValue = (suffix: string) =>
    style[`${sectionBackgroundPrefix}${suffix}`] ?? style[`servicesSectionBackground${suffix}`];
  const sectionBackgroundColor = (suffix: string) => {
    const value = sectionBackgroundValue(suffix);
    return typeof value === "string" ? value : "";
  };
  const normalizeUnselectedSectionBgLight = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "transparent") return "";
    return isLegacyUnselectedSectionBgLight(trimmed) ? "" : trimmed;
  };
  const normalizeUnselectedSectionBgDark = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "transparent") return "";
    return isLegacyUnselectedSectionBgDark(trimmed) ? "" : trimmed;
  };
  const isUnselectedSectionBgLight = (value: string) => {
    const trimmed = value.trim();
    return !trimmed || trimmed.toLowerCase() === "transparent" || isLegacyUnselectedSectionBgLight(trimmed);
  };
  const isUnselectedSectionBgDark = (value: string) => {
    const trimmed = value.trim();
    return !trimmed || trimmed.toLowerCase() === "transparent" || isLegacyUnselectedSectionBgDark(trimmed);
  };
  const sectionBackgroundNumber = (suffix: string) =>
    numOrNull(sectionBackgroundValue(suffix) as number | string | null);
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
  const sectionFallbackLight =
    block.type === "booking" ? DEFAULT_PUBLIC_TRANSPARENT_BG : DEFAULT_PUBLIC_SECTION_BG_LIGHT;
  const sectionFallbackDark =
    block.type === "booking" ? DEFAULT_PUBLIC_TRANSPARENT_BG : DEFAULT_PUBLIC_SECTION_BG_DARK;
  const rawSectionBgPair = resolvePair(
    "sectionBgLight",
    "sectionBgDark",
    "sectionBg",
    sectionFallbackLight,
    sectionFallbackDark
  );
  const legacySectionBgLight = readColor("sectionBgLight") || readColor("sectionBg");
  const legacySectionBgDark = readColor("sectionBgDark");
  const hasSectionBackgroundValue = (suffix: string) =>
    hasOwn(`${sectionBackgroundPrefix}${suffix}`) || hasOwn(`servicesSectionBackground${suffix}`);
  const explicitSectionBgLightRaw = sectionBackgroundColor("FromLight").trim();
  const explicitSectionBgDarkRaw = sectionBackgroundColor("FromDark").trim();
  const explicitSectionBgLightIsTransparent = explicitSectionBgLightRaw.toLowerCase() === "transparent";
  const explicitSectionBgDarkIsTransparent = explicitSectionBgDarkRaw.toLowerCase() === "transparent";
  const explicitSectionBgLight =
    block.type === "booking" && hasSectionBackgroundValue("FromLight") && !explicitSectionBgLightIsTransparent
      ? explicitSectionBgLightRaw
      : normalizeUnselectedSectionBgLight(explicitSectionBgLightRaw);
  const explicitSectionBgDark =
    block.type === "booking" && hasSectionBackgroundValue("FromDark") && !explicitSectionBgDarkIsTransparent
      ? explicitSectionBgDarkRaw
      : normalizeUnselectedSectionBgDark(explicitSectionBgDarkRaw);
  const hasExplicitSectionBgLight = Boolean(explicitSectionBgLight);
  const hasExplicitSectionBgDark = Boolean(explicitSectionBgDark);
  const sectionBgPair = {
    lightResolved:
      !hasExplicitSectionBgLight && isUnselectedSectionBgLight(legacySectionBgLight)
        ? sectionFallbackLight
        : rawSectionBgPair.lightResolved,
    darkResolved:
      !hasExplicitSectionBgDark && isUnselectedSectionBgDark(legacySectionBgDark)
        ? sectionFallbackDark
        : rawSectionBgPair.darkResolved,
  };
  const rawBlockWidth = numOrNull(style.blockWidth as number);
  const rawBlockWidthColumns = numOrNull(style.blockWidthColumns as number);
  const rawMobileBlockWidthColumns = numOrNull(style.mobileBlockWidthColumns as number);
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
  const normalizedMobileBlockWidthColumns =
    rawMobileBlockWidthColumns === null
      ? null
      : clampBlockColumns(rawMobileBlockWidthColumns, block.type);
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
  const isCoverBlock = block.type === "cover";
  const buttonPairResolved = {
    lightResolved:
      isCoverBlock && buttonPair.lightResolved.trim().toLowerCase() === "#111827"
        ? "#000000"
        : buttonPair.lightResolved,
    darkResolved:
      isCoverBlock && buttonPair.darkResolved.trim().toLowerCase() === "#d3d6db"
        ? "#000000"
        : buttonPair.darkResolved,
  };
  const buttonTextPairResolved = {
    lightResolved: buttonTextPair.lightResolved,
    darkResolved:
      isCoverBlock && buttonTextPair.darkResolved.trim().toLowerCase() === "#0f1012"
        ? "#ffffff"
        : buttonTextPair.darkResolved,
  };
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
  const servicesHeadingPair = resolvePair(
    "servicesHeadingColorLight",
    "servicesHeadingColorDark",
    "servicesHeadingColor",
    theme.lightPalette.textColor,
    theme.darkPalette.textColor
  );
  const servicesDescriptionPair = resolvePair(
    "servicesDescriptionColorLight",
    "servicesDescriptionColorDark",
    "servicesDescriptionColor",
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
  const servicesSectionBackgroundModeLight =
    sectionBackgroundValue("ModeLight") === "linear" ||
    sectionBackgroundValue("ModeLight") === "radial"
      ? (sectionBackgroundValue("ModeLight") as "linear" | "radial")
      : "solid";
  const servicesSectionBackgroundModeDark =
    sectionBackgroundValue("ModeDark") === "linear" ||
    sectionBackgroundValue("ModeDark") === "radial"
      ? (sectionBackgroundValue("ModeDark") as "linear" | "radial")
      : servicesSectionBackgroundModeLight;
  const legacyServicesSectionBackgroundFromLight =
    readColor("sectionBgLight") || readColor("sectionBg");
  const legacyServicesSectionBackgroundFromDark = readColor("sectionBgDark");
  const servicesSectionBackgroundFromLightRaw =
    explicitSectionBgLight ||
    (isUnselectedSectionBgLight(legacyServicesSectionBackgroundFromLight)
      ? ""
      : legacyServicesSectionBackgroundFromLight);
  const servicesSectionBackgroundFromDarkRaw =
    explicitSectionBgDark ||
    (isUnselectedSectionBgDark(legacyServicesSectionBackgroundFromDark)
      ? ""
      : legacyServicesSectionBackgroundFromDark);
  const servicesSectionBackgroundToLightRaw = normalizeUnselectedSectionBgLight(
    sectionBackgroundColor("ToLight")
  );
  const servicesSectionBackgroundToDarkRaw = normalizeUnselectedSectionBgDark(
    sectionBackgroundColor("ToDark")
  );
  const servicesSectionBackgroundFromLight =
    servicesSectionBackgroundFromLightRaw || sectionFallbackLight;
  const servicesSectionBackgroundFromDark =
    servicesSectionBackgroundFromDarkRaw || sectionFallbackDark;
  const servicesSectionBackgroundToLight =
    servicesSectionBackgroundToLightRaw || servicesSectionBackgroundFromLight;
  const servicesSectionBackgroundToDark =
    servicesSectionBackgroundToDarkRaw || servicesSectionBackgroundFromDark;
  const servicesSectionBackgroundAngleLightRaw = sectionBackgroundNumber("AngleLight");
  const servicesSectionBackgroundAngleDarkRaw = sectionBackgroundNumber("AngleDark");
  const servicesSectionBackgroundStopALightRaw = sectionBackgroundNumber("StopALight");
  const servicesSectionBackgroundStopADarkRaw = sectionBackgroundNumber("StopADark");
  const servicesSectionBackgroundStopBLightRaw = sectionBackgroundNumber("StopBLight");
  const servicesSectionBackgroundStopBDarkRaw = sectionBackgroundNumber("StopBDark");
  const servicesSectionBackgroundAngleLight =
    servicesSectionBackgroundAngleLightRaw === null
      ? 135
      : Math.max(0, Math.min(360, servicesSectionBackgroundAngleLightRaw));
  const servicesSectionBackgroundAngleDark =
    servicesSectionBackgroundAngleDarkRaw === null
      ? servicesSectionBackgroundAngleLight
      : Math.max(0, Math.min(360, servicesSectionBackgroundAngleDarkRaw));
  const servicesSectionBackgroundStopALight =
    servicesSectionBackgroundStopALightRaw === null
      ? 0
      : Math.max(0, Math.min(100, servicesSectionBackgroundStopALightRaw));
  const servicesSectionBackgroundStopADark =
    servicesSectionBackgroundStopADarkRaw === null
      ? servicesSectionBackgroundStopALight
      : Math.max(0, Math.min(100, servicesSectionBackgroundStopADarkRaw));
  const servicesSectionBackgroundStopBLight =
    servicesSectionBackgroundStopBLightRaw === null
      ? 100
      : Math.max(0, Math.min(100, servicesSectionBackgroundStopBLightRaw));
  const servicesSectionBackgroundStopBDark =
    servicesSectionBackgroundStopBDarkRaw === null
      ? servicesSectionBackgroundStopBLight
      : Math.max(0, Math.min(100, servicesSectionBackgroundStopBDarkRaw));
  const resolvedBorderPair = borderClearedExplicitly
    ? { lightResolved: "transparent", darkResolved: "transparent" }
    : {
        lightResolved: borderPair.lightResolved || "transparent",
        darkResolved: borderPair.darkResolved || "transparent",
      };
  const resolvedBorder =
    (resolveColor("borderColorLight", "borderColorDark", "borderColor") || "").trim() ||
    (theme.mode === "dark" ? resolvedBorderPair.darkResolved : resolvedBorderPair.lightResolved);
  const bookingBorderFallbackLight = hasBorderOverride ? resolvedBorderPair.lightResolved : "transparent";
  const bookingBorderFallbackDark = hasBorderOverride ? resolvedBorderPair.darkResolved : "transparent";
  const readBackgroundMode = (key: string, fallback: "solid" | "linear" | "radial" = "solid") =>
    style[key] === "linear" || style[key] === "radial" || style[key] === "solid"
      ? (style[key] as "solid" | "linear" | "radial")
      : fallback;
  const clampAngle = (value: unknown, fallback: number) => {
    const parsed = numOrNull(value as number | string | null);
    return parsed === null ? fallback : Math.max(0, Math.min(360, parsed));
  };
  const clampStop = (value: unknown, fallback: number) => {
    const parsed = numOrNull(value as number | string | null);
    return parsed === null ? fallback : Math.max(0, Math.min(100, parsed));
  };
  const panelBorderPair = resolvePair(
    "panelBorderColorLight",
    "panelBorderColorDark",
    "panelBorderColor",
    bookingBorderFallbackLight,
    bookingBorderFallbackDark
  );
  const cardBgPair = resolvePair(
    "cardBgLight",
    "cardBgDark",
    "cardBg",
    subBlockBgPair.lightResolved,
    subBlockBgPair.darkResolved
  );
  const cardBorderPair = resolvePair(
    "cardBorderColorLight",
    "cardBorderColorDark",
    "cardBorderColor",
    bookingBorderFallbackLight,
    bookingBorderFallbackDark
  );
  const fieldBgPair = resolvePair(
    "fieldBgLight",
    "fieldBgDark",
    "fieldBg",
    cardBgPair.lightResolved,
    cardBgPair.darkResolved
  );
  const fieldBorderPair = resolvePair(
    "fieldBorderColorLight",
    "fieldBorderColorDark",
    "fieldBorderColor",
    cardBorderPair.lightResolved,
    cardBorderPair.darkResolved
  );
  const primaryButtonBorderPair = resolvePair(
    "primaryButtonBorderColorLight",
    "primaryButtonBorderColorDark",
    "primaryButtonBorderColor",
    "transparent",
    "transparent"
  );
  const secondaryButtonBgPair = resolvePair(
    "secondaryButtonBgLight",
    "secondaryButtonBgDark",
    "secondaryButtonBg",
    cardBgPair.lightResolved,
    cardBgPair.darkResolved
  );
  const secondaryButtonTextPair = resolvePair(
    "secondaryButtonTextColorLight",
    "secondaryButtonTextColorDark",
    "secondaryButtonTextColor",
    textPair.lightResolved,
    textPair.darkResolved
  );
  const secondaryButtonBorderPair = resolvePair(
    "secondaryButtonBorderColorLight",
    "secondaryButtonBorderColorDark",
    "secondaryButtonBorderColor",
    cardBorderPair.lightResolved,
    cardBorderPair.darkResolved
  );
  const bookingCardActionBgPair = resolvePair(
    "bookingCardActionBgLight",
    "bookingCardActionBgDark",
    "bookingCardActionBg",
    secondaryButtonBgPair.lightResolved,
    secondaryButtonBgPair.darkResolved
  );
  const bookingCardActionTextPair = resolvePair(
    "bookingCardActionTextColorLight",
    "bookingCardActionTextColorDark",
    "bookingCardActionTextColor",
    secondaryButtonTextPair.lightResolved,
    secondaryButtonTextPair.darkResolved
  );
  const bookingCardActionBorderPair = resolvePair(
    "bookingCardActionBorderColorLight",
    "bookingCardActionBorderColorDark",
    "bookingCardActionBorderColor",
    secondaryButtonBorderPair.lightResolved,
    secondaryButtonBorderPair.darkResolved
  );
  const bookingCardTitleColorPair = resolvePair(
    "bookingCardTitleColorLight",
    "bookingCardTitleColorDark",
    "bookingCardTitleColor",
    "#111827",
    "#F8FAFC"
  );
  const bookingCardSubtitleColorPair = resolvePair(
    "bookingCardSubtitleColorLight",
    "bookingCardSubtitleColorDark",
    "bookingCardSubtitleColor",
    "#6B7280",
    "#CBD5E1"
  );
  const bookingCardNumber = (key: string, fallback: number, min: number, max: number) => {
    const parsed = numOrNull(style[key] as number | string | null);
    return parsed === null ? fallback : Math.max(min, Math.min(max, Math.round(parsed)));
  };
  const bookingCardWeight = (key: string, fallback: number | null) => {
    const parsed = numOrNull(style[key] as number | string | null);
    return parsed === null ? fallback : Math.max(100, Math.min(900, Math.round(parsed)));
  };
  const cardBackgroundModeLight = readBackgroundMode("cardBackgroundModeLight");
  const cardBackgroundModeDark = readBackgroundMode("cardBackgroundModeDark", cardBackgroundModeLight);
  const fieldBackgroundModeLight = readBackgroundMode("fieldBackgroundModeLight");
  const fieldBackgroundModeDark = readBackgroundMode("fieldBackgroundModeDark", fieldBackgroundModeLight);
  const gradientModeLight = readBackgroundMode("gradientModeLight", gradientEnabledLight ? "linear" : "solid");
  const gradientModeDark = readBackgroundMode("gradientModeDark", gradientEnabledDark ? gradientModeLight : "solid");
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
    mobileBlockWidthColumns: normalizedMobileBlockWidthColumns,
    gridStartColumn: useCustomWidth ? resolvedGridStart : null,
    gridEndColumn: useCustomWidth ? resolvedGridEnd : null,
    useCustomWidth,
    radius: isMenuBlock ? 0 : numOrNull(style.radius as number),
    buttonRadius: isMenuBlock ? 0 : numOrNull(style.buttonRadius as number),
    cardRadius: numOrNull(style.cardRadius as number),
    bookingImageRadius: numOrNull(style.bookingImageRadius as number),
    subBlockBgLight: readColor("subBlockBgLight") || readColor("subBlockBg"),
    subBlockBgDark: readColor("subBlockBgDark"),
    subBlockBg: resolveColor("subBlockBgLight", "subBlockBgDark", "subBlockBg"),
    sectionBgLight: readColor("sectionBgLight") || readColor("sectionBg"),
    sectionBgDark: readColor("sectionBgDark"),
    sectionBg: resolveColor("sectionBgLight", "sectionBgDark", "sectionBg"),
    blockBgLight: readColor("blockBgLight") || readColor("blockBg"),
    blockBgDark: readColor("blockBgDark"),
    blockBg: resolveColor("blockBgLight", "blockBgDark", "blockBg"),
    borderColorLight: readColor("borderColorLight") || readColor("borderColor"),
    borderColorDark: readColor("borderColorDark"),
    borderColor: resolvedBorder,
    panelBorderColorLight: panelBorderPair.lightResolved,
    panelBorderColorDark: panelBorderPair.darkResolved,
    cardBgLight: cardBgPair.lightResolved,
    cardBgDark: cardBgPair.darkResolved,
    cardBackgroundModeLight,
    cardBackgroundModeDark,
    cardBackgroundToLight: readColor("cardBackgroundToLight") || cardBgPair.lightResolved,
    cardBackgroundToDark: readColor("cardBackgroundToDark") || cardBgPair.darkResolved,
    cardBackgroundAngleLight: clampAngle(style.cardBackgroundAngleLight, 135),
    cardBackgroundAngleDark: clampAngle(style.cardBackgroundAngleDark, clampAngle(style.cardBackgroundAngleLight, 135)),
    cardBackgroundStopALight: clampStop(style.cardBackgroundStopALight, 0),
    cardBackgroundStopADark: clampStop(style.cardBackgroundStopADark, clampStop(style.cardBackgroundStopALight, 0)),
    cardBackgroundStopBLight: clampStop(style.cardBackgroundStopBLight, 100),
    cardBackgroundStopBDark: clampStop(style.cardBackgroundStopBDark, clampStop(style.cardBackgroundStopBLight, 100)),
    cardBorderColorLight: cardBorderPair.lightResolved,
    cardBorderColorDark: cardBorderPair.darkResolved,
    fieldBgLight: fieldBgPair.lightResolved,
    fieldBgDark: fieldBgPair.darkResolved,
    fieldBackgroundModeLight,
    fieldBackgroundModeDark,
    fieldBackgroundToLight: readColor("fieldBackgroundToLight") || fieldBgPair.lightResolved,
    fieldBackgroundToDark: readColor("fieldBackgroundToDark") || fieldBgPair.darkResolved,
    fieldBackgroundAngleLight: clampAngle(style.fieldBackgroundAngleLight, 135),
    fieldBackgroundAngleDark: clampAngle(style.fieldBackgroundAngleDark, clampAngle(style.fieldBackgroundAngleLight, 135)),
    fieldBackgroundStopALight: clampStop(style.fieldBackgroundStopALight, 0),
    fieldBackgroundStopADark: clampStop(style.fieldBackgroundStopADark, clampStop(style.fieldBackgroundStopALight, 0)),
    fieldBackgroundStopBLight: clampStop(style.fieldBackgroundStopBLight, 100),
    fieldBackgroundStopBDark: clampStop(style.fieldBackgroundStopBDark, clampStop(style.fieldBackgroundStopBLight, 100)),
    fieldBorderColorLight: fieldBorderPair.lightResolved,
    fieldBorderColorDark: fieldBorderPair.darkResolved,
    primaryButtonBorderColorLight: primaryButtonBorderPair.lightResolved,
    primaryButtonBorderColorDark: primaryButtonBorderPair.darkResolved,
    secondaryButtonBgLight: secondaryButtonBgPair.lightResolved,
    secondaryButtonBgDark: secondaryButtonBgPair.darkResolved,
    secondaryButtonTextColorLight: secondaryButtonTextPair.lightResolved,
    secondaryButtonTextColorDark: secondaryButtonTextPair.darkResolved,
    secondaryButtonBorderColorLight: secondaryButtonBorderPair.lightResolved,
    secondaryButtonBorderColorDark: secondaryButtonBorderPair.darkResolved,
    bookingCardActionBgLight: bookingCardActionBgPair.lightResolved,
    bookingCardActionBgDark: bookingCardActionBgPair.darkResolved,
    bookingCardActionTextColorLight: bookingCardActionTextPair.lightResolved,
    bookingCardActionTextColorDark: bookingCardActionTextPair.darkResolved,
    bookingCardActionBorderColorLight: bookingCardActionBorderPair.lightResolved,
    bookingCardActionBorderColorDark: bookingCardActionBorderPair.darkResolved,
    bookingCardTitleColorLight: bookingCardTitleColorPair.lightResolved,
    bookingCardTitleColorDark: bookingCardTitleColorPair.darkResolved,
    bookingCardTitleSizeLight: bookingCardNumber("bookingCardTitleSizeLight", 16, 10, 36),
    bookingCardTitleSizeDark: bookingCardNumber("bookingCardTitleSizeDark", bookingCardNumber("bookingCardTitleSizeLight", 16, 10, 36), 10, 36),
    bookingCardTitleWeightLight: bookingCardWeight("bookingCardTitleWeightLight", 600),
    bookingCardTitleWeightDark: bookingCardWeight("bookingCardTitleWeightDark", bookingCardWeight("bookingCardTitleWeightLight", 600)),
    bookingCardSubtitleColorLight: bookingCardSubtitleColorPair.lightResolved,
    bookingCardSubtitleColorDark: bookingCardSubtitleColorPair.darkResolved,
    bookingCardSubtitleSizeLight: bookingCardNumber("bookingCardSubtitleSizeLight", 14, 10, 32),
    bookingCardSubtitleSizeDark: bookingCardNumber("bookingCardSubtitleSizeDark", bookingCardNumber("bookingCardSubtitleSizeLight", 14, 10, 32), 10, 32),
    bookingCardSubtitleWeightLight: bookingCardWeight("bookingCardSubtitleWeightLight", 400),
    bookingCardSubtitleWeightDark: bookingCardWeight("bookingCardSubtitleWeightDark", bookingCardWeight("bookingCardSubtitleWeightLight", 400)),
    buttonColor:
      theme.mode === "dark"
        ? buttonPairResolved.darkResolved || buttonPairResolved.lightResolved
        : buttonPairResolved.lightResolved || buttonPairResolved.darkResolved,
    buttonTextColor:
      theme.mode === "dark"
        ? buttonTextPairResolved.darkResolved || buttonTextPairResolved.lightResolved
        : buttonTextPairResolved.lightResolved || buttonTextPairResolved.darkResolved,
    textColor: resolveColor("textColorLight", "textColorDark", "textColor"),
    mutedColor: resolveColor("mutedColorLight", "mutedColorDark", "mutedColor"),
    servicesHeadingColor:
      theme.mode === "dark"
        ? servicesHeadingPair.darkResolved || servicesHeadingPair.lightResolved
        : servicesHeadingPair.lightResolved || servicesHeadingPair.darkResolved,
    servicesDescriptionColor:
      theme.mode === "dark"
        ? servicesDescriptionPair.darkResolved || servicesDescriptionPair.lightResolved
        : servicesDescriptionPair.lightResolved || servicesDescriptionPair.darkResolved,
    subBlockBgLightResolved: subBlockBgPair.lightResolved,
    subBlockBgDarkResolved: subBlockBgPair.darkResolved,
    sectionBgLightResolved: sectionBgPair.lightResolved,
    sectionBgDarkResolved: sectionBgPair.darkResolved,
    blockBgLightResolved: blockBgPair.lightResolved,
    blockBgDarkResolved: blockBgPair.darkResolved,
    borderColorLightResolved: resolvedBorderPair.lightResolved,
    borderColorDarkResolved: resolvedBorderPair.darkResolved,
    buttonColorLightResolved: buttonPairResolved.lightResolved,
    buttonColorDarkResolved: buttonPairResolved.darkResolved,
    buttonTextColorLightResolved: buttonTextPairResolved.lightResolved,
    buttonTextColorDarkResolved: buttonTextPairResolved.darkResolved,
    textColorLightResolved: textPair.lightResolved,
    textColorDarkResolved: textPair.darkResolved,
    mutedColorLightResolved: mutedPair.lightResolved,
    mutedColorDarkResolved: mutedPair.darkResolved,
    servicesHeadingColorLightResolved: servicesHeadingPair.lightResolved,
    servicesHeadingColorDarkResolved: servicesHeadingPair.darkResolved,
    servicesDescriptionColorLightResolved: servicesDescriptionPair.lightResolved,
    servicesDescriptionColorDarkResolved: servicesDescriptionPair.darkResolved,
    gradientEnabledLight,
    gradientEnabledDark,
    gradientFromLightResolved,
    gradientToLightResolved,
    gradientFromDarkResolved,
    gradientToDarkResolved,
    gradientDirectionLight,
    gradientDirectionDark,
    gradientModeLight,
    gradientModeDark,
    gradientAngleLight: clampAngle(style.gradientAngleLight, 135),
    gradientAngleDark: clampAngle(style.gradientAngleDark, clampAngle(style.gradientAngleLight, 135)),
    gradientStopALight: clampStop(style.gradientStopALight, 0),
    gradientStopADark: clampStop(style.gradientStopADark, clampStop(style.gradientStopALight, 0)),
    gradientStopBLight: clampStop(style.gradientStopBLight, 100),
    gradientStopBDark: clampStop(style.gradientStopBDark, clampStop(style.gradientStopBLight, 100)),
    servicesSectionBackgroundModeLight,
    servicesSectionBackgroundModeDark,
    servicesSectionBackgroundFromLight,
    servicesSectionBackgroundFromDark,
    servicesSectionBackgroundToLight,
    servicesSectionBackgroundToDark,
    servicesSectionBackgroundAngleLight,
    servicesSectionBackgroundAngleDark,
    servicesSectionBackgroundStopALight,
    servicesSectionBackgroundStopADark,
    servicesSectionBackgroundStopBLight,
    servicesSectionBackgroundStopBDark,
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
    mobileHeadingSize: numOrNull(style.mobileHeadingSize as number),
    mobileSubheadingSize: numOrNull(style.mobileSubheadingSize as number),
    mobileTextSize: numOrNull(style.mobileTextSize as number),
  };
}

export function renderBlock(
  block: SiteBlock,
  accountId: number,
  accountName: string,
  accountSlug: string,
  accountTimeZone: string,
  accountSlotStepMinutes: number | undefined,
  publicSlug: string,
  branding: Branding,
  profile: AccountProfile,
  locations: LocationItem[],
  legalDocuments: LegalDocumentItem[],
  platformLegalDocuments: LegalDocumentItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  reviews: ReviewItem[],
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
      return renderAbout(block, accountName, profile);
    case "loader":
      return null;
    case "booking":
      return renderBooking(
        block,
        accountId,
        accountName,
        accountSlug,
        accountTimeZone,
        accountSlotStepMinutes,
        publicSlug,
        locations,
        legalDocuments,
        platformLegalDocuments,
        services,
        specialists,
        workPhotos,
        theme,
        loaderConfig
      );
    case "locations":
      return renderLocations(block, publicSlug, locations, current, theme);
    case "services":
      return renderServices(block, publicSlug, locations, services, current, theme);
    case "specialists":
      return renderSpecialists(block, publicSlug, locations, specialists, current, theme);
    case "promos":
      return renderPromos(block, publicSlug, promos, current);
    case "works":
      return renderWorks(block, workPhotos, current, theme);
    case "reviews":
      return renderReviews(block, reviews, accountSlug, publicSlug, theme);
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
  const mobileBlockWidthColumns = clampBlockColumns(
    style.mobileBlockWidthColumns ?? BOOKING_MAX_BLOCK_COLUMNS,
    "booking"
  );
  const blockWidthVisualColumns = bookingContentColumns(blockWidthColumns);
  const mobileBlockWidthVisualColumns = bookingContentColumns(mobileBlockWidthColumns);
  const bookingCardsColumns = bookingCardsPerRow(blockWidthColumns);
  const blockWidthPercent = (blockWidthVisualColumns / MAX_BLOCK_COLUMNS) * 100;
  const mobileBlockWidthPercent = (mobileBlockWidthVisualColumns / MAX_BLOCK_COLUMNS) * 100;
  const palette = theme.mode === "dark" ? theme.darkPalette : theme.lightPalette;
  const radius = style.radius ?? palette.radius ?? theme.radius;
  const buttonRadius = style.buttonRadius ?? palette.buttonRadius ?? theme.buttonRadius;
  const cardRadius = style.cardRadius ?? 24;
  const bookingImageRadius = style.bookingImageRadius ?? Math.min(cardRadius, 18);
  const shadowSize = style.shadowSize ?? palette.shadowSize ?? theme.shadowSize ?? 0;
  const shadowColorRaw =
    style.shadowColor || palette.shadowColor || theme.shadowColor || "rgba(17, 24, 39, 0.12)";
  const shadowColor =
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(shadowColorRaw.trim())
      ? hexToRgbaString(shadowColorRaw, 0.16)
      : shadowColorRaw;
  const textSize = style.textSize ?? palette.textSize ?? theme.textSize ?? 14;
  const subheadingSize =
    style.subheadingSize ?? palette.subheadingSize ?? theme.subheadingSize ?? textSize + 2;
  const headingSize =
    style.headingSize ?? palette.headingSize ?? theme.headingSize ?? subheadingSize + 2;
  const sizeXs = Math.max(10, textSize - 2);
  const subBlockLight =
    style.cardBgLight || style.subBlockBgLightResolved || style.blockBgLightResolved || "var(--site-panel)";
  const subBlockDark =
    style.cardBgDark || style.subBlockBgDarkResolved || style.blockBgDarkResolved || "var(--site-panel)";
  const subBlockCurrent =
    theme.mode === "dark" ? subBlockDark : subBlockLight;
  const bookingPanelBackground = (
    mode: unknown,
    enabled: boolean,
    direction: "vertical" | "horizontal",
    from: string,
    to: string,
    angle: unknown,
    stopA: unknown,
    stopB: unknown
  ) => {
    if (!enabled && mode !== "linear" && mode !== "radial") return "none";
    if (mode === "radial") {
      const a = Number.isFinite(Number(stopA)) ? Math.max(0, Math.min(100, Number(stopA))) : 0;
      const b = Number.isFinite(Number(stopB)) ? Math.max(0, Math.min(100, Number(stopB))) : 100;
      return `radial-gradient(circle, ${from} ${a}%, ${to} ${b}%)`;
    }
    const deg = Number.isFinite(Number(angle)) ? Math.max(0, Math.min(360, Number(angle))) : null;
    const linearDirection = deg === null ? (direction === "horizontal" ? "to right" : "to bottom") : `${deg}deg`;
    return `linear-gradient(${linearDirection}, ${from}, ${to})`;
  };
  const bookingGradientLight = bookingPanelBackground(
    style.gradientModeLight,
    Boolean(style.gradientEnabledLight),
    style.gradientDirectionLight ?? "vertical",
    style.gradientFromLightResolved || "transparent",
    style.gradientToLightResolved || "transparent",
    style.gradientAngleLight,
    style.gradientStopALight,
    style.gradientStopBLight
  );
  const bookingGradientDark = bookingPanelBackground(
    style.gradientModeDark,
    Boolean(style.gradientEnabledDark),
    style.gradientDirectionDark ?? "vertical",
    style.gradientFromDarkResolved || "transparent",
    style.gradientToDarkResolved || "transparent",
    style.gradientAngleDark,
    style.gradientStopADark,
    style.gradientStopBDark
  );
  const cardGradientLight = bookingPanelBackground(
    style.cardBackgroundModeLight,
    style.cardBackgroundModeLight === "linear" || style.cardBackgroundModeLight === "radial",
    "vertical",
    style.cardBgLight || subBlockLight,
    style.cardBackgroundToLight || style.cardBgLight || subBlockLight,
    style.cardBackgroundAngleLight,
    style.cardBackgroundStopALight,
    style.cardBackgroundStopBLight
  );
  const cardGradientDark = bookingPanelBackground(
    style.cardBackgroundModeDark,
    style.cardBackgroundModeDark === "linear" || style.cardBackgroundModeDark === "radial",
    "vertical",
    style.cardBgDark || subBlockDark,
    style.cardBackgroundToDark || style.cardBgDark || subBlockDark,
    style.cardBackgroundAngleDark,
    style.cardBackgroundStopADark,
    style.cardBackgroundStopBDark
  );
  const fieldGradientLight = bookingPanelBackground(
    style.fieldBackgroundModeLight,
    style.fieldBackgroundModeLight === "linear" || style.fieldBackgroundModeLight === "radial",
    "vertical",
    style.fieldBgLight || subBlockLight,
    style.fieldBackgroundToLight || style.fieldBgLight || subBlockLight,
    style.fieldBackgroundAngleLight,
    style.fieldBackgroundStopALight,
    style.fieldBackgroundStopBLight
  );
  const fieldGradientDark = bookingPanelBackground(
    style.fieldBackgroundModeDark,
    style.fieldBackgroundModeDark === "linear" || style.fieldBackgroundModeDark === "radial",
    "vertical",
    style.fieldBgDark || subBlockDark,
    style.fieldBackgroundToDark || style.fieldBgDark || subBlockDark,
    style.fieldBackgroundAngleDark,
    style.fieldBackgroundStopADark,
    style.fieldBackgroundStopBDark
  );
  const bookingBorderLight = style.borderColorLight?.trim()
    ? style.borderColorLightResolved || "transparent"
    : "transparent";
  const bookingBorderDark = style.borderColorDark?.trim()
    ? style.borderColorDarkResolved || "transparent"
    : "transparent";
  const isVisibleBorder = (value: string | undefined) =>
    Boolean(value && value.trim() && value.trim().toLowerCase() !== "transparent");
  const bookingBorderWidthLight = [
    bookingBorderLight,
    style.panelBorderColorLight,
    style.cardBorderColorLight,
    style.fieldBorderColorLight,
    style.primaryButtonBorderColorLight,
    style.secondaryButtonBorderColorLight,
  ].some(isVisibleBorder)
    ? "1px"
    : "0px";
  const bookingBorderWidthDark = [
    bookingBorderDark,
    style.panelBorderColorDark,
    style.cardBorderColorDark,
    style.fieldBorderColorDark,
    style.primaryButtonBorderColorDark,
    style.secondaryButtonBorderColorDark,
  ].some(isVisibleBorder)
    ? "1px"
    : "0px";
  const bookingBorderWidth = theme.mode === "dark" ? bookingBorderWidthDark : bookingBorderWidthLight;
  return {
    "--booking-bg-light": style.blockBgLightResolved || "var(--site-panel)",
    "--booking-bg-dark": style.blockBgDarkResolved || "var(--site-panel)",
    "--booking-border-light": bookingBorderLight,
    "--booking-border-dark": bookingBorderDark,
    "--booking-border-width-light": bookingBorderWidthLight,
    "--booking-border-width-dark": bookingBorderWidthDark,
    "--booking-border-width": bookingBorderWidth,
    "--booking-panel-border-light": style.panelBorderColorLight || bookingBorderLight,
    "--booking-panel-border-dark": style.panelBorderColorDark || bookingBorderDark,
    "--booking-card-border-light": style.cardBorderColorLight || bookingBorderLight,
    "--booking-card-border-dark": style.cardBorderColorDark || bookingBorderDark,
    "--booking-field-border-light": style.fieldBorderColorLight || style.cardBorderColorLight || bookingBorderLight,
    "--booking-field-border-dark": style.fieldBorderColorDark || style.cardBorderColorDark || bookingBorderDark,
    "--booking-primary-button-border-light": style.primaryButtonBorderColorLight || "transparent",
    "--booking-primary-button-border-dark": style.primaryButtonBorderColorDark || "transparent",
    "--booking-secondary-button-bg-light": style.secondaryButtonBgLight || subBlockLight,
    "--booking-secondary-button-bg-dark": style.secondaryButtonBgDark || subBlockDark,
    "--booking-secondary-button-text-light": style.secondaryButtonTextColorLight || style.textColorLightResolved || "var(--site-text)",
    "--booking-secondary-button-text-dark": style.secondaryButtonTextColorDark || style.textColorDarkResolved || "var(--site-text)",
    "--booking-secondary-button-border-light": style.secondaryButtonBorderColorLight || style.cardBorderColorLight || bookingBorderLight,
    "--booking-secondary-button-border-dark": style.secondaryButtonBorderColorDark || style.cardBorderColorDark || bookingBorderDark,
    "--booking-card-action-bg-light": style.bookingCardActionBgLight || style.secondaryButtonBgLight || subBlockLight,
    "--booking-card-action-bg-dark": style.bookingCardActionBgDark || style.secondaryButtonBgDark || subBlockDark,
    "--booking-card-action-text-light": style.bookingCardActionTextColorLight || style.secondaryButtonTextColorLight || style.textColorLightResolved || "var(--site-text)",
    "--booking-card-action-text-dark": style.bookingCardActionTextColorDark || style.secondaryButtonTextColorDark || style.textColorDarkResolved || "var(--site-text)",
    "--booking-card-action-border-light": style.bookingCardActionBorderColorLight || style.secondaryButtonBorderColorLight || style.cardBorderColorLight || bookingBorderLight,
    "--booking-card-action-border-dark": style.bookingCardActionBorderColorDark || style.secondaryButtonBorderColorDark || style.cardBorderColorDark || bookingBorderDark,
    "--booking-card-title-color-light": style.bookingCardTitleColorLight || style.textColorLightResolved || "var(--site-text)",
    "--booking-card-title-color-dark": style.bookingCardTitleColorDark || style.textColorDarkResolved || "var(--site-text)",
    "--booking-card-title-size-light": `${style.bookingCardTitleSizeLight ?? 16}px`,
    "--booking-card-title-size-dark": `${style.bookingCardTitleSizeDark ?? style.bookingCardTitleSizeLight ?? 16}px`,
    "--booking-card-title-weight-light": String(style.bookingCardTitleWeightLight ?? 600),
    "--booking-card-title-weight-dark": String(style.bookingCardTitleWeightDark ?? style.bookingCardTitleWeightLight ?? 600),
    "--booking-card-subtitle-color-light": style.bookingCardSubtitleColorLight || style.textColorLightResolved || "var(--site-text)",
    "--booking-card-subtitle-color-dark": style.bookingCardSubtitleColorDark || style.textColorDarkResolved || "var(--site-text)",
    "--booking-card-subtitle-size-light": `${style.bookingCardSubtitleSizeLight ?? 14}px`,
    "--booking-card-subtitle-size-dark": `${style.bookingCardSubtitleSizeDark ?? style.bookingCardSubtitleSizeLight ?? 14}px`,
    "--booking-card-subtitle-weight-light": String(style.bookingCardSubtitleWeightLight ?? 400),
    "--booking-card-subtitle-weight-dark": String(style.bookingCardSubtitleWeightDark ?? style.bookingCardSubtitleWeightLight ?? 400),
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
    "--booking-card-gradient-light": cardGradientLight,
    "--booking-card-gradient-dark": cardGradientDark,
    "--booking-field-bg-light": style.fieldBgLight || subBlockLight,
    "--booking-field-bg-dark": style.fieldBgDark || subBlockDark,
    "--booking-field-gradient-light": fieldGradientLight,
    "--booking-field-gradient-dark": fieldGradientDark,
    "--bp-button-text": "var(--booking-button-text)",
    "--booking-gradient-light": bookingGradientLight,
    "--booking-gradient-dark": bookingGradientDark,
    "--booking-gradient": theme.mode === "dark" ? bookingGradientDark : bookingGradientLight,
    "--bp-shadow-soft": shadowSize > 0 ? `0 ${shadowSize}px ${shadowSize * 2}px ${shadowColor}` : "none",
    "--bp-radius": `${radius}px`,
    "--bp-button-radius": `${buttonRadius}px`,
    "--booking-panel-radius": `${radius}px`,
    "--booking-card-radius": `${cardRadius}px`,
    "--booking-image-radius": `${bookingImageRadius}px`,
    "--booking-button-radius": `${buttonRadius}px`,
    "--booking-field-radius": `${Math.min(cardRadius, 18)}px`,
    "--bp-font-heading": style.fontHeading || palette.fontHeading || theme.fontHeading,
    "--bp-font-body": style.fontBody || palette.fontBody || theme.fontBody,
    "--bp-text-size-xs": `${sizeXs}px`,
    "--bp-text-size-sm": `${textSize}px`,
    "--bp-text-size-base": `${subheadingSize}px`,
    "--bp-text-size-lg": `${headingSize}px`,
    "--bp-content-width": `${blockWidthPercent}%`,
    "--bp-content-width-mobile": `${mobileBlockWidthPercent}%`,
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
  accountId: number,
  accountName: string,
  accountSlug: string,
  accountTimeZone: string,
  accountSlotStepMinutes: number | undefined,
  publicSlug: string,
  locations: LocationItem[],
  legalDocuments: LegalDocumentItem[],
  platformLegalDocuments: LegalDocumentItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  workPhotos: WorkPhotos,
  theme: SiteTheme,
  loaderConfig?: SiteLoaderConfig | null
) {
  const style = normalizeStyle(block, theme);
  const cssVars = buildBookingVars(style, theme);
  const bookingDesignVariant = block.variant === "v2" ? "future" : "classic";
  const initialContext = {
    account: {
      id: accountId,
      name: accountName,
      slug: accountSlug,
      timeZone: accountTimeZone || "UTC",
      slotStepMinutes: accountSlotStepMinutes,
    },
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      address: location.address || null,
      description: location.description ?? null,
      coverUrl: location.coverUrl ?? null,
      photoUrls: location.photoUrls ?? [],
      workPhotoUrls: workPhotos.locations
        .filter((item) => item.entityId === String(location.id))
        .map((item) => item.url),
      hours: location.hours,
      exceptions: location.exceptions,
    })),
    legalDocuments,
    platformLegalDocuments,
    workPhotos,
  };
  return (
    <div
      className={`booking-root p-0${bookingDesignVariant === "future" ? " booking-root--future" : ""}`}
      style={cssVars}
    >
      <div className="booking-bleed">
        <PublicBookingClient
          accountSlug={accountSlug}
          accountPublicSlug={publicSlug}
          loaderConfig={loaderConfig}
          designVariant={bookingDesignVariant}
          initialContext={initialContext}
          initialServices={services.map((service) => ({
            id: service.id,
            name: service.name,
            description: service.description,
            categoryName: service.categoryName ?? null,
            categorySlug: service.categorySlug ?? null,
            baseDurationMin: service.baseDurationMin,
            basePrice: service.basePrice,
            computedDurationMin: service.computedDurationMin ?? service.baseDurationMin,
            computedPrice: service.computedPrice ?? service.basePrice,
            minDurationMin: service.minDurationMin ?? service.baseDurationMin,
            minPrice: service.minPrice ?? service.basePrice,
            specialistIds: service.specialistIds ?? [],
            allowMultiServiceBooking: service.allowMultiServiceBooking,
            bookingType: service.bookingType,
            groupCapacityDefault: service.groupCapacityDefault,
            coverUrl: service.coverUrl,
            photoUrls: service.photoUrls ?? [],
            workPhotoUrls: workPhotos.services
              .filter((item) => item.entityId === String(service.id))
              .map((item) => item.url),
            locationIds: service.locationIds,
          }))}
          initialSpecialists={specialists.map((specialist) => ({
            id: specialist.id,
            name: specialist.name,
            role: specialist.role ?? specialist.level ?? null,
            bio: specialist.bio ?? null,
            levelId: specialist.levelId ?? null,
            avatarUrl: specialist.avatarUrl ?? null,
            coverUrl: specialist.coverUrl,
            photoUrls: specialist.photoUrls ?? [],
            workPhotoUrls: workPhotos.specialists
              .filter((item) => item.entityId === String(specialist.id))
              .map((item) => item.url),
            categories: specialist.categories ?? [],
            locationIds: specialist.locationIds,
          }))}
          initialWorkPhotos={workPhotos}
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
  const animHeading = String(data.animHeading ?? "none");
  const animDescription = String(data.animDescription ?? "none");
  const animButton = String(data.animButton ?? "none");
  const resolveAnimClass = (value: string) => (value && value !== "none" ? `bp-anim bp-anim-${value}` : "");
  const resolveAnimStyle = (value: string, delayMs: number) =>
    value && value !== "none" ? ({ animationDelay: `${delayMs}ms` } as CSSProperties) : undefined;
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
  const pickCoverButtonModeValue = (
    lightRaw: string,
    darkRaw: string,
    lightFallback: string,
    darkFallback: string = lightFallback
  ) =>
    theme.mode === "dark"
      ? darkRaw || lightRaw || darkFallback
      : lightRaw || lightFallback;
  const primaryButtonBorderColorLightRaw =
    typeof data.coverPrimaryButtonBorderColor === "string"
      ? data.coverPrimaryButtonBorderColor.trim()
      : "";
  const primaryButtonBorderColorDarkRaw =
    typeof data.coverPrimaryButtonBorderColorDark === "string"
      ? data.coverPrimaryButtonBorderColorDark.trim()
      : "";
  const primaryButtonBorderColorRaw = pickCoverButtonModeValue(
    primaryButtonBorderColorLightRaw,
    primaryButtonBorderColorDarkRaw,
    "transparent"
  );
  const primaryButtonBorderColor =
    primaryButtonBorderColorRaw && isValidColorValue(primaryButtonBorderColorRaw)
      ? primaryButtonBorderColorRaw
      : "transparent";
  const primaryButtonHoverBgColorLightRaw =
    typeof data.coverPrimaryButtonHoverBgColor === "string"
      ? data.coverPrimaryButtonHoverBgColor.trim()
      : "";
  const primaryButtonHoverBgColorDarkRaw =
    typeof data.coverPrimaryButtonHoverBgColorDark === "string"
      ? data.coverPrimaryButtonHoverBgColorDark.trim()
      : "";
  const primaryButtonHoverBgColorRaw = pickCoverButtonModeValue(
    primaryButtonHoverBgColorLightRaw,
    primaryButtonHoverBgColorDarkRaw,
    "transparent"
  );
  const primaryButtonHoverBgColorLight =
    primaryButtonHoverBgColorLightRaw &&
    primaryButtonHoverBgColorLightRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(primaryButtonHoverBgColorLightRaw)
      ? primaryButtonHoverBgColorLightRaw
      : "transparent";
  const primaryButtonHoverBgColorDark =
    primaryButtonHoverBgColorDarkRaw &&
    primaryButtonHoverBgColorDarkRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(primaryButtonHoverBgColorDarkRaw)
      ? primaryButtonHoverBgColorDarkRaw
      : primaryButtonHoverBgColorLight;
  const primaryButtonHoverBgColor =
    primaryButtonHoverBgColorRaw &&
    primaryButtonHoverBgColorRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(primaryButtonHoverBgColorRaw)
      ? primaryButtonHoverBgColorRaw
      : "";
  const secondaryButtonColorLightRaw =
    typeof data.coverSecondaryButtonColor === "string"
      ? data.coverSecondaryButtonColor.trim()
      : "";
  const secondaryButtonColorDarkRaw =
    typeof data.coverSecondaryButtonColorDark === "string"
      ? data.coverSecondaryButtonColorDark.trim()
      : "";
  const secondaryButtonColorRaw = pickCoverButtonModeValue(
    secondaryButtonColorLightRaw,
    secondaryButtonColorDarkRaw,
    "transparent"
  );
  const secondaryButtonColor =
    secondaryButtonColorRaw && isValidColorValue(secondaryButtonColorRaw)
      ? secondaryButtonColorRaw
      : "transparent";
  const secondaryButtonTextColorLightRaw =
    typeof data.coverSecondaryButtonTextColor === "string"
      ? data.coverSecondaryButtonTextColor.trim()
      : "";
  const secondaryButtonTextColorDarkRaw =
    typeof data.coverSecondaryButtonTextColorDark === "string"
      ? data.coverSecondaryButtonTextColorDark.trim()
      : "";
  const secondaryButtonTextColorRaw = pickCoverButtonModeValue(
    secondaryButtonTextColorLightRaw,
    secondaryButtonTextColorDarkRaw,
    "#ffffff"
  );
  const secondaryButtonTextColor =
    secondaryButtonTextColorRaw && isValidColorValue(secondaryButtonTextColorRaw)
      ? secondaryButtonTextColorRaw
      : "#ffffff";
  const secondaryButtonBorderColorLightRaw =
    typeof data.coverSecondaryButtonBorderColor === "string"
      ? data.coverSecondaryButtonBorderColor.trim()
      : "";
  const secondaryButtonBorderColorDarkRaw =
    typeof data.coverSecondaryButtonBorderColorDark === "string"
      ? data.coverSecondaryButtonBorderColorDark.trim()
      : "";
  const secondaryButtonBorderColorRaw = pickCoverButtonModeValue(
    secondaryButtonBorderColorLightRaw,
    secondaryButtonBorderColorDarkRaw,
    "#ffffff"
  );
  const secondaryButtonBorderColor =
    secondaryButtonBorderColorRaw && isValidColorValue(secondaryButtonBorderColorRaw)
      ? secondaryButtonBorderColorRaw
      : "#ffffff";
  const secondaryButtonHoverBgColorLightRaw =
    typeof data.coverSecondaryButtonHoverBgColor === "string"
      ? data.coverSecondaryButtonHoverBgColor.trim()
      : "";
  const secondaryButtonHoverBgColorDarkRaw =
    typeof data.coverSecondaryButtonHoverBgColorDark === "string"
      ? data.coverSecondaryButtonHoverBgColorDark.trim()
      : "";
  const secondaryButtonHoverBgColorRaw = pickCoverButtonModeValue(
    secondaryButtonHoverBgColorLightRaw,
    secondaryButtonHoverBgColorDarkRaw,
    "transparent"
  );
  const secondaryButtonHoverBgColorLight =
    secondaryButtonHoverBgColorLightRaw &&
    secondaryButtonHoverBgColorLightRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(secondaryButtonHoverBgColorLightRaw)
      ? secondaryButtonHoverBgColorLightRaw
      : "transparent";
  const secondaryButtonHoverBgColorDark =
    secondaryButtonHoverBgColorDarkRaw &&
    secondaryButtonHoverBgColorDarkRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(secondaryButtonHoverBgColorDarkRaw)
      ? secondaryButtonHoverBgColorDarkRaw
      : secondaryButtonHoverBgColorLight;
  const secondaryButtonHoverBgColor =
    secondaryButtonHoverBgColorRaw &&
    secondaryButtonHoverBgColorRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(secondaryButtonHoverBgColorRaw)
      ? secondaryButtonHoverBgColorRaw
      : "";
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
    : "900px";
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
  const headingMobileSize =
    style.mobileHeadingSize ?? Math.max(28, Math.min(56, Math.round(headingDesktopSize * 0.58)));
  const subheadingMobileSize =
    style.mobileSubheadingSize ??
    Math.max(18, Math.min(36, Math.round(subheadingDesktopSize * 0.72)));
  const textMobileSize =
    style.mobileTextSize ??
    (Number.isFinite(descriptionMobileSizeRaw) &&
    descriptionMobileSizeRaw >= 10 &&
    descriptionMobileSizeRaw <= 72
      ? Math.round(descriptionMobileSizeRaw)
      : Math.max(14, Math.min(26, Math.round(textDesktopSize * 0.9))));
  const effectiveHeadingMobileSize = Math.max(24, Math.min(38, headingMobileSize));
  const effectiveSubheadingMobileSize = Math.max(16, Math.min(22, subheadingMobileSize));
  const effectiveTextMobileSize = Math.max(13, Math.min(17, textMobileSize));
  const v1SubheadingMobileSize = Math.max(15, Math.min(20, effectiveSubheadingMobileSize));
  const v1TextMobileSize = Math.max(13, Math.min(16, effectiveTextMobileSize));
  const coverHeightMobileCss = "min(680px, 100svh)";
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
  const sliderArrowColorLightRaw =
    typeof data.coverSliderArrowColor === "string" ? data.coverSliderArrowColor.trim() : "";
  const sliderArrowColorDarkRaw =
    typeof data.coverSliderArrowColorDark === "string" ? data.coverSliderArrowColorDark.trim() : "";
  const sliderArrowColorLight =
    sliderArrowColorLightRaw && isValidColorValue(sliderArrowColorLightRaw)
      ? sliderArrowColorLightRaw
      : "#222222";
  const sliderArrowColorDark =
    sliderArrowColorDarkRaw && isValidColorValue(sliderArrowColorDarkRaw)
      ? sliderArrowColorDarkRaw
      : sliderArrowColorLight;
  const sliderArrowHoverColorLightRaw =
    typeof data.coverSliderArrowHoverColor === "string"
      ? data.coverSliderArrowHoverColor.trim()
      : "";
  const sliderArrowHoverColorDarkRaw =
    typeof data.coverSliderArrowHoverColorDark === "string"
      ? data.coverSliderArrowHoverColorDark.trim()
      : "";
  const sliderArrowHoverColorLight =
    sliderArrowHoverColorLightRaw && isValidColorValue(sliderArrowHoverColorLightRaw)
      ? sliderArrowHoverColorLightRaw
      : "";
  const sliderArrowHoverColorDark =
    sliderArrowHoverColorDarkRaw && isValidColorValue(sliderArrowHoverColorDarkRaw)
      ? sliderArrowHoverColorDarkRaw
      : sliderArrowHoverColorLight;
  const sliderArrowBgColorLightRaw =
    typeof data.coverSliderArrowBgColor === "string" ? data.coverSliderArrowBgColor.trim() : "";
  const sliderArrowBgColorDarkRaw =
    typeof data.coverSliderArrowBgColorDark === "string" ? data.coverSliderArrowBgColorDark.trim() : "";
  const sliderArrowBgColorLight =
    sliderArrowBgColorLightRaw && isValidColorValue(sliderArrowBgColorLightRaw)
      ? sliderArrowBgColorLightRaw
      : "#ffffff";
  const sliderArrowBgColorDark =
    sliderArrowBgColorDarkRaw && isValidColorValue(sliderArrowBgColorDarkRaw)
      ? sliderArrowBgColorDarkRaw
      : sliderArrowBgColorLight;
  const sliderArrowHoverBgColorLightRaw =
    typeof data.coverSliderArrowHoverBgColor === "string"
      ? data.coverSliderArrowHoverBgColor.trim()
      : "";
  const sliderArrowHoverBgColorDarkRaw =
    typeof data.coverSliderArrowHoverBgColorDark === "string"
      ? data.coverSliderArrowHoverBgColorDark.trim()
      : "";
  const sliderArrowHoverBgColorLight =
    sliderArrowHoverBgColorLightRaw && isValidColorValue(sliderArrowHoverBgColorLightRaw)
      ? sliderArrowHoverBgColorLightRaw
      : "";
  const sliderArrowHoverBgColorDark =
    sliderArrowHoverBgColorDarkRaw && isValidColorValue(sliderArrowHoverBgColorDarkRaw)
      ? sliderArrowHoverBgColorDarkRaw
      : sliderArrowHoverBgColorLight;
  const sliderArrowOutlineColorLightRaw =
    typeof data.coverSliderArrowOutlineColor === "string"
      ? data.coverSliderArrowOutlineColor.trim()
      : "";
  const sliderArrowOutlineColorDarkRaw =
    typeof data.coverSliderArrowOutlineColorDark === "string"
      ? data.coverSliderArrowOutlineColorDark.trim()
      : "";
  const sliderArrowOutlineColorLightCandidate =
    sliderArrowOutlineColorLightRaw && isValidColorValue(sliderArrowOutlineColorLightRaw)
      ? sliderArrowOutlineColorLightRaw
      : "";
  const sliderArrowOutlineThicknessRaw = Number(data.coverSliderArrowOutlineThickness);
  const sliderArrowOutlineThickness =
    Number.isFinite(sliderArrowOutlineThicknessRaw) && sliderArrowOutlineThicknessRaw > 0
      ? Math.max(1, Math.min(8, Math.round(sliderArrowOutlineThicknessRaw)))
      : 1;
  const sliderArrowOutlineColorLight =
    sliderArrowOutlineColorLightRaw.toLowerCase() === "transparent"
      ? "transparent"
      : sliderArrowOutlineColorLightCandidate || sliderArrowColorLight;
  const sliderArrowOutlineColorDarkCandidate =
    sliderArrowOutlineColorDarkRaw && isValidColorValue(sliderArrowOutlineColorDarkRaw)
      ? sliderArrowOutlineColorDarkRaw
      : "";
  const sliderArrowOutlineColorDark =
    sliderArrowOutlineColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : sliderArrowOutlineColorDarkCandidate || sliderArrowOutlineColorLight || sliderArrowColorDark;
  const sliderArrowShowOutline =
    sliderArrowOutlineColorLight !== "transparent" ||
    sliderArrowOutlineColorDark !== "transparent" ||
    sliderArrowOutlineThickness !== 1;
  const sliderDotSizeRaw = Number(data.coverSliderDotSize);
  const sliderDotSize =
    Number.isFinite(sliderDotSizeRaw) && sliderDotSizeRaw > 0
      ? Math.max(6, Math.min(24, Math.round(sliderDotSizeRaw)))
      : 10;
  const sliderDotColorLightRaw =
    typeof data.coverSliderDotColor === "string" ? data.coverSliderDotColor.trim() : "";
  const sliderDotColorDarkRaw =
    typeof data.coverSliderDotColorDark === "string" ? data.coverSliderDotColorDark.trim() : "";
  const sliderDotColorLight =
    sliderDotColorLightRaw && isValidColorValue(sliderDotColorLightRaw)
      ? sliderDotColorLightRaw
      : "#000000";
  const sliderDotColorDark =
    sliderDotColorDarkRaw && isValidColorValue(sliderDotColorDarkRaw)
      ? sliderDotColorDarkRaw
      : sliderDotColorLight;
  const sliderDotActiveColorLightRaw =
    typeof data.coverSliderDotActiveColor === "string"
      ? data.coverSliderDotActiveColor.trim()
      : "";
  const sliderDotActiveColorDarkRaw =
    typeof data.coverSliderDotActiveColorDark === "string"
      ? data.coverSliderDotActiveColorDark.trim()
      : "";
  const sliderDotActiveColorLight =
    sliderDotActiveColorLightRaw && isValidColorValue(sliderDotActiveColorLightRaw)
      ? sliderDotActiveColorLightRaw
      : "#ffffff";
  const sliderDotActiveColorDark =
    sliderDotActiveColorDarkRaw && isValidColorValue(sliderDotActiveColorDarkRaw)
      ? sliderDotActiveColorDarkRaw
      : sliderDotActiveColorLight;
  const sliderDotBorderWidthRaw = Number(data.coverSliderDotBorderWidth);
  const sliderDotBorderWidth =
    Number.isFinite(sliderDotBorderWidthRaw) && sliderDotBorderWidthRaw >= 0
      ? Math.max(0, Math.min(6, Math.round(sliderDotBorderWidthRaw)))
      : 2;
  const sliderDotBorderColorLightRaw =
    typeof data.coverSliderDotBorderColor === "string"
      ? data.coverSliderDotBorderColor.trim()
      : "";
  const sliderDotBorderColorDarkRaw =
    typeof data.coverSliderDotBorderColorDark === "string"
      ? data.coverSliderDotBorderColorDark.trim()
      : "";
  const sliderDotBorderColorLight =
    sliderDotBorderColorLightRaw && isValidColorValue(sliderDotBorderColorLightRaw)
      ? sliderDotBorderColorLightRaw
      : "#ffffff";
  const sliderDotBorderColorDark =
    sliderDotBorderColorDarkRaw && isValidColorValue(sliderDotBorderColorDarkRaw)
      ? sliderDotBorderColorDarkRaw
      : sliderDotBorderColorLight;
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
  const legacyInset20 = Boolean(data.coverImageInset20);
  const coverImageInsetPx = Number.isFinite(Number(data.coverImageInsetPx))
    ? Math.max(0, Math.min(120, Math.round(Number(data.coverImageInsetPx))))
    : legacyInset20
      ? 20
      : 0;
  const coverImageRadiusPx = Number.isFinite(Number(data.coverImageRadiusPx))
    ? Math.max(0, Math.min(120, Math.round(Number(data.coverImageRadiusPx))))
    : 0;
  const coverFlipHorizontal = Boolean(data.coverFlipHorizontal);
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
        arrowColorLight={sliderArrowColorLight}
        arrowColorDark={sliderArrowColorDark}
        arrowHoverColorLight={sliderArrowHoverColorLight}
        arrowHoverColorDark={sliderArrowHoverColorDark}
        arrowBgColorLight={sliderArrowBgColorLight}
        arrowBgColorDark={sliderArrowBgColorDark}
        arrowHoverBgColorLight={sliderArrowHoverBgColorLight}
        arrowHoverBgColorDark={sliderArrowHoverBgColorDark}
        arrowShowOutline={sliderArrowShowOutline}
        arrowOutlineColorLight={sliderArrowOutlineColorLight}
        arrowOutlineColorDark={sliderArrowOutlineColorDark}
        arrowOutlineThickness={sliderArrowOutlineThickness}
        dotSize={sliderDotSize}
        dotColorLight={sliderDotColorLight}
        dotColorDark={sliderDotColorDark}
        dotActiveColorLight={sliderDotActiveColorLight}
        dotActiveColorDark={sliderDotActiveColorDark}
        dotBorderWidth={sliderDotBorderWidth}
        dotBorderColorLight={sliderDotBorderColorLight}
        dotBorderColorDark={sliderDotBorderColorDark}
        primaryButtonBorderColor={primaryButtonBorderColor}
        primaryButtonHoverBgColorLight={primaryButtonHoverBgColorLightRaw}
        primaryButtonHoverBgColorDark={primaryButtonHoverBgColorDarkRaw}
        themeMode={theme.mode}
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

  if (block.variant === "v3") {
    const textHorizontalJustify =
      contentAlign === "center" ? "center" : contentAlign === "right" ? "flex-end" : "flex-start";
    const textVerticalAlignItems =
      contentVerticalAlign === "top"
        ? "flex-start"
        : contentVerticalAlign === "bottom"
          ? "flex-end"
          : "center";
    const splitBackgroundLight =
      style.sectionBgLightResolved || style.sectionBgLight || style.blockBgLightResolved || "#f3f4f6";
    const splitBackgroundDark =
      style.sectionBgDarkResolved || style.sectionBgDark || style.blockBgDarkResolved || "#14161a";
    const splitBackground =
      theme.mode === "dark"
        ? splitBackgroundDark || splitBackgroundLight
        : splitBackgroundLight || splitBackgroundDark;
    const textPanelBackground = resolveCoverBackgroundVisual(
      data,
      splitBackground,
      theme.mode === "dark" ? "dark" : "light"
    );
    const backgroundModeRaw =
      theme.mode === "dark"
        ? typeof data.coverBackgroundModeDark === "string"
          ? data.coverBackgroundModeDark
          : data.coverBackgroundMode
        : typeof data.coverBackgroundMode === "string"
          ? data.coverBackgroundMode
          : data.coverBackgroundModeDark;
    const isGradientMode = backgroundModeRaw === "linear" || backgroundModeRaw === "radial";
    const hasGradientBackground =
      isGradientMode && typeof textPanelBackground.backgroundImage === "string";
    const sectionBackground = textPanelBackground;
    const imagePanelBackground =
      coverImageInsetPx > 0
        ? hasGradientBackground
          ? { backgroundColor: "transparent", backgroundImage: "none" }
          : textPanelBackground
        : { backgroundColor: "transparent", backgroundImage: "none" };
    const textColumnBackground = hasGradientBackground
      ? { backgroundColor: "transparent", backgroundImage: "none" }
      : textPanelBackground;

    return (
      <section
        className="bp-cover-hero bp-cover-v3-hero relative overflow-hidden"
        style={{
          ["--bp-cover-height-desktop" as string]: coverHeightCss,
          ["--bp-cover-height-mobile" as string]: coverHeightMobileCss,
          ["--bp-cover-heading-size-desktop" as string]: `clamp(${headingMobileSize}px, 9cqw, ${Math.max(
            headingMobileSize,
            headingDesktopSize
          )}px)`,
          ["--bp-cover-heading-size-mobile" as string]: `${effectiveHeadingMobileSize}px`,
          ["--bp-cover-subheading-size-desktop" as string]: `clamp(${subheadingMobileSize}px, 5.8cqw, ${Math.max(
            subheadingMobileSize,
            subheadingDesktopSize
          )}px)`,
          ["--bp-cover-subheading-size-mobile" as string]: `${v1SubheadingMobileSize}px`,
          ["--bp-cover-text-size-desktop" as string]: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
            textMobileSize,
            textDesktopSize
          )}px)`,
          ["--bp-cover-text-size-mobile" as string]: `${effectiveTextMobileSize}px`,
          height: coverHeightCss,
          minHeight: coverHeightCss,
          containerType: "inline-size",
          backgroundColor: sectionBackground.backgroundColor,
          backgroundImage: sectionBackground.backgroundImage,
        }}
      >
        <div
          className={`bp-cover-v3-layout mx-auto flex w-full flex-col ${
            coverFlipHorizontal ? "md:flex-row-reverse" : "md:flex-row"
          }`}
          style={{
            height: coverHeightCss,
            minHeight: coverHeightCss,
            width: "100%",
          }}
        >
          <div
            className="bp-cover-v3-image w-full md:w-1/2"
            style={{
              ["--bp-cover-image-inset" as string]: `${coverImageInsetPx}px`,
              height: coverHeightCss,
              minHeight: coverHeightCss,
              padding: coverImageInsetPx,
              backgroundColor: imagePanelBackground.backgroundColor,
              backgroundImage: imagePanelBackground.backgroundImage,
              boxSizing: "border-box",
            }}
          >
            <div
              className="relative h-full w-full overflow-hidden"
              style={{
                height: "100%",
                minHeight: "100%",
                borderRadius: coverImageRadiusPx,
                backgroundImage: imageUrl ? `url(${imageUrl})` : "none",
                backgroundColor: imageUrl ? "transparent" : "var(--block-sub-bg, var(--block-bg))",
                backgroundSize: "cover",
                backgroundPosition: coverBackgroundPosition,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: overlayGradient }}
              />
            </div>
          </div>

          <div
            className="bp-cover-v3-text w-full px-5 py-10 md:w-1/2 md:px-16 md:py-14"
            style={{
              display: "flex",
              justifyContent: textHorizontalJustify,
              alignItems: textVerticalAlignItems,
              height: "100%",
              minHeight: coverHeightCss,
              backgroundColor: textColumnBackground.backgroundColor,
              backgroundImage: textColumnBackground.backgroundImage,
              boxSizing: "border-box",
            }}
          >
            <div style={{ width: "min(100%, 640px)" }}>
              <h2
                className={`leading-[1.08] tracking-[-0.01em] ${resolveAnimClass(animHeading)}`}
                style={{
                  ...headingStyle(style),
                  textAlign: contentAlign,
                  fontSize: "var(--bp-cover-heading-size)",
                  ...(resolveAnimStyle(animHeading, 0) ?? {}),
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className={`mt-6 leading-[1.25] ${resolveAnimClass(animDescription)}`}
                  style={{
                    ...subheadingStyle(style),
                    color: subtitleColor,
                    textAlign: contentAlign,
                    fontSize: "var(--bp-cover-subheading-size)",
                    ...(resolveAnimStyle(animDescription, 120) ?? {}),
                  }}
                >
                  {subtitle}
                </p>
              )}
              {description && (
                <p
                  className={`mt-5 max-w-[720px] leading-[1.45] ${resolveAnimClass(animDescription)}`}
                  style={{
                    ...textStyle(style),
                    color: descriptionColor,
                    textAlign: contentAlign,
                    marginLeft:
                      contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                    marginRight: contentAlign === "center" ? "auto" : 0,
                    fontSize: "var(--bp-cover-text-size)",
                    ...(resolveAnimStyle(animDescription, subtitle ? 220 : 120) ?? {}),
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
                    className={`bp-cover-primary-hover inline-flex items-center whitespace-nowrap font-semibold transition ${resolveAnimClass(animButton)}`}
                    style={{
                      ...buttonStyle(style),
                      ["--cover-primary-hover-bg" as string]:
                        primaryButtonHoverBgColor || "transparent",
                      ["--cover-primary-hover-bg-light" as string]:
                        primaryButtonHoverBgColorLight,
                      ["--cover-primary-hover-bg-dark" as string]:
                        primaryButtonHoverBgColorDark,
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
                      fontSize: "var(--bp-cover-button-size, clamp(14px, 2cqw, 16px))",
                      transition: "background-color 180ms ease",
                      ...(resolveAnimStyle(animButton, 320) ?? {}),
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
                    className={`bp-cover-secondary-hover inline-flex items-center whitespace-nowrap border font-semibold transition ${resolveAnimClass(animButton)}`}
                    style={{
                      ["--cover-secondary-hover-bg" as string]:
                        secondaryButtonHoverBgColor || "rgba(255,255,255,0.1)",
                      ["--cover-secondary-hover-bg-light" as string]:
                        secondaryButtonHoverBgColorLight,
                      ["--cover-secondary-hover-bg-dark" as string]:
                        secondaryButtonHoverBgColorDark,
                      backgroundColor:
                        secondaryButtonColor !== "transparent" &&
                        secondaryButtonColor.toLowerCase() !== "rgba(0,0,0,0)"
                          ? secondaryButtonColor
                          : "transparent",
                      color:
                        secondaryButtonTextColor !== "transparent" &&
                        secondaryButtonTextColor.toLowerCase() !== "rgba(0,0,0,0)"
                          ? secondaryButtonTextColor
                          : buttonStyle(style).color,
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
                      fontSize: "var(--bp-cover-button-size, clamp(14px, 2cqw, 16px))",
                      transition: "background-color 180ms ease",
                      ...(resolveAnimStyle(animButton, 380) ?? {}),
                    }}
                  >
                    {secondaryButtonText}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
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
      className="bp-cover-hero relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      style={{
        ["--bp-cover-height-desktop" as string]: coverHeightCss,
        ["--bp-cover-height-mobile" as string]: coverHeightMobileCss,
        ["--bp-cover-heading-size-desktop" as string]: `clamp(${headingMobileSize}px, 9cqw, ${Math.max(
          headingMobileSize,
          headingDesktopSize
        )}px)`,
        ["--bp-cover-heading-size-mobile" as string]: `${effectiveHeadingMobileSize}px`,
        ["--bp-cover-subheading-size-desktop" as string]: `clamp(${subheadingMobileSize}px, 5.8cqw, ${Math.max(
          subheadingMobileSize,
          subheadingDesktopSize
        )}px)`,
        ["--bp-cover-subheading-size-mobile" as string]: `${v1SubheadingMobileSize}px`,
        ["--bp-cover-text-size-desktop" as string]: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
          textMobileSize,
          textDesktopSize
        )}px)`,
        ["--bp-cover-text-size-mobile" as string]: `${v1TextMobileSize}px`,
        ...(showMotionLayer
          ? { backgroundColor: "transparent", backgroundImage: "none" }
          : backgroundStyle),
        height: "var(--bp-cover-height, var(--bp-cover-height-desktop))",
        minHeight: "var(--bp-cover-height, var(--bp-cover-height-desktop))",
        containerType: "inline-size",
        boxSizing: "border-box",
      }}
    >
      {showMotionLayer && (
        <PublicParallaxLayer
          imageUrl={imageUrl as string}
          backgroundPosition={coverBackgroundPosition}
        />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: overlayGradient }} />
      <div className="relative z-[1] mx-auto flex w-full items-center" style={{ height: "100%", minHeight: "100%" }}>
        <div
          className="bp-cover-content w-full"
          style={{
            maxWidth: gridWidthPercent,
            marginLeft: gridLeftPercent,
            marginRight: 0,
          }}
        >
          <h2
            className={`text-white leading-[1.08] tracking-[-0.01em] ${resolveAnimClass(animHeading)}`}
            style={{
              ...headingStyle(style),
              textAlign: contentAlign,
              fontSize: "var(--bp-cover-heading-size)",
              ...(resolveAnimStyle(animHeading, 0) ?? {}),
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`mt-6 text-white/90 leading-[1.25] ${resolveAnimClass(animDescription)}`}
              style={{
                ...subheadingStyle(style),
                textAlign: contentAlign,
                color: subtitleColor,
                fontSize: "var(--bp-cover-subheading-size)",
                ...(resolveAnimStyle(animDescription, 120) ?? {}),
              }}
            >
              {subtitle}
            </p>
          )}
          {description && (
            <p
              className={`mt-5 max-w-[720px] text-white/80 leading-[1.45] ${resolveAnimClass(animDescription)}`}
              style={{
                ...textStyle(style),
                textAlign: contentAlign,
                marginLeft:
                  contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                marginRight: contentAlign === "center" ? "auto" : 0,
                color: descriptionColor,
                fontSize: "var(--bp-cover-text-size)",
                ...(resolveAnimStyle(animDescription, subtitle ? 220 : 120) ?? {}),
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
                className={`bp-cover-primary-hover inline-flex items-center whitespace-nowrap font-semibold transition ${resolveAnimClass(animButton)}`}
                style={{
                  ...buttonStyle(style),
                  ["--cover-primary-hover-bg" as string]:
                    primaryButtonHoverBgColor || "transparent",
                  ["--cover-primary-hover-bg-light" as string]:
                    primaryButtonHoverBgColorLight,
                  ["--cover-primary-hover-bg-dark" as string]:
                    primaryButtonHoverBgColorDark,
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
                  fontSize: "var(--bp-cover-button-size, clamp(14px, 2cqw, 16px))",
                  transition: "background-color 180ms ease",
                  ...(resolveAnimStyle(animButton, 320) ?? {}),
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
                className={`bp-cover-secondary-hover inline-flex items-center whitespace-nowrap border font-semibold text-white transition ${resolveAnimClass(animButton)}`}
                style={{
                  ["--cover-secondary-hover-bg" as string]:
                    secondaryButtonHoverBgColor || "rgba(255,255,255,0.1)",
                  ["--cover-secondary-hover-bg-light" as string]:
                    secondaryButtonHoverBgColorLight,
                  ["--cover-secondary-hover-bg-dark" as string]:
                    secondaryButtonHoverBgColorDark,
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
                  fontSize: "var(--bp-cover-button-size, clamp(14px, 2cqw, 16px))",
                  transition: "background-color 180ms ease",
                  ...(resolveAnimStyle(animButton, 380) ?? {}),
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
      fontSize: "var(--block-heading-size)",
      textAlign: style.textAlignHeading ?? style.textAlign ?? "left",
      color: "var(--block-text, var(--bp-ink))",
    } as const;
  }

  function subheadingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontSubheading || style.fontBody || "var(--site-font-body)",
      fontWeight: style.fontWeightSubheading ?? undefined,
      fontSize: "var(--block-subheading-size)",
      textAlign: style.textAlignSubheading ?? style.textAlign ?? "left",
      color: "var(--block-muted, var(--bp-muted))",
    } as const;
  }

  function textStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontBody || "var(--site-font-body)",
      fontWeight: style.fontWeightBody ?? undefined,
      fontSize: "var(--block-text-size)",
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
    coverVariant?: SiteBlock["variant"];
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
    const isServicesBlock =
      options.blockType === "services" ||
      options.blockType === "specialists" ||
      options.blockType === "locations";
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
    const mobileServicesColumns = clampBlockColumns(
      style.mobileBlockWidthColumns ?? MAX_BLOCK_COLUMNS,
      options.blockType ?? "services"
    );
    const mobileServicesGrid = centeredGridRange(mobileServicesColumns);
    const mobileServicesWidthCss = gridSpanWidthCss(
      mobileServicesGrid.start,
      mobileServicesGrid.end
    );
    const mobileServicesLeftCss = gridSpanLeftCss(mobileServicesGrid.start);
    const servicesSectionBackgroundSource = isServicesBlock || isBookingBlock
      ? {
          servicesSectionBackgroundModeLight: style.servicesSectionBackgroundModeLight,
          servicesSectionBackgroundFromLight: style.servicesSectionBackgroundFromLight,
          servicesSectionBackgroundToLight: style.servicesSectionBackgroundToLight,
          servicesSectionBackgroundAngleLight: style.servicesSectionBackgroundAngleLight,
          servicesSectionBackgroundStopALight: style.servicesSectionBackgroundStopALight,
          servicesSectionBackgroundStopBLight: style.servicesSectionBackgroundStopBLight,
          servicesSectionBackgroundModeDark: style.servicesSectionBackgroundModeDark,
          servicesSectionBackgroundFromDark: style.servicesSectionBackgroundFromDark,
          servicesSectionBackgroundToDark: style.servicesSectionBackgroundToDark,
          servicesSectionBackgroundAngleDark: style.servicesSectionBackgroundAngleDark,
          servicesSectionBackgroundStopADark: style.servicesSectionBackgroundStopADark,
          servicesSectionBackgroundStopBDark: style.servicesSectionBackgroundStopBDark,
        }
      : null;
    const servicesSectionBackgroundLight = resolveServicesSectionBackgroundVisual(
      servicesSectionBackgroundSource,
      style.sectionBgLightResolved || DEFAULT_PUBLIC_SECTION_BG_LIGHT,
      "light"
    );
    const servicesSectionBackgroundDark = resolveServicesSectionBackgroundVisual(
      servicesSectionBackgroundSource,
      style.sectionBgDarkResolved || DEFAULT_PUBLIC_SECTION_BG_DARK,
      "dark"
    );
      return {
        className: isMenu
          ? "site-block overflow-visible border border-[color:var(--bp-stroke)] p-0"
          : isGallery || isBookingBlock || isCoverBlock || isServicesBlock
          ? "site-block p-0"
        : "site-block border border-[color:var(--bp-stroke)] p-6",
      style: {
        position: options.isMenuSticky ? "sticky" : undefined,
        top: options.isMenuSticky ? 0 : undefined,
        zIndex: options.isMenuSticky ? 40 : undefined,
        borderRadius: isMenu || isBookingBlock || isCoverBlock || isServicesBlock ? 0 : radius,
        backgroundColor:
          isCoverBlock
            ? (options.coverBackground?.backgroundColor ?? "var(--block-section-bg, var(--block-bg))")
            : isMenu
              ? (options.menuSectionBackground?.backgroundColor ?? "var(--block-section-bg, var(--block-bg))")
              : isServicesBlock || isBookingBlock
              ? "var(--services-section-bg, var(--block-section-bg, var(--block-bg)))"
              : isGallery || isBookingBlock || isServicesBlock
              ? "var(--block-section-bg, var(--block-bg))"
              : "var(--block-bg)",
        backgroundImage:
          isCoverBlock
            ? (options.coverBackground?.backgroundImage ?? "none")
            : isMenu
              ? (options.menuSectionBackground?.backgroundImage ?? "none")
              : isServicesBlock || isBookingBlock
              ? "var(--services-section-image, none)"
              : isGallery || isBookingBlock || isServicesBlock
              ? "none"
              : "var(--block-gradient)",
        borderColor: isGallery || isBookingBlock || isCoverBlock || isServicesBlock ? "transparent" : "var(--block-border)",
        borderWidth: isGallery || isBookingBlock || isCoverBlock || isServicesBlock ? 0 : hasVisibleBorder ? 1 : 0,
        boxShadow:
          isGallery || isBookingBlock || isCoverBlock || isServicesBlock
            ? "none"
            : blockShadowSize !== null
            ? `0 ${blockShadowSize}px ${blockShadowSize * 2}px ${blockShadowColor}`
            : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
        marginTop:
          options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock || isServicesBlock
            ? 0
            : typeof style.marginTop === "number"
              ? style.marginTop
              : 0,
        marginBottom:
          options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock || isServicesBlock
            ? 0
            : typeof style.marginBottom === "number"
              ? style.marginBottom
              : 0,
        paddingTop:
          (options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock || isServicesBlock) &&
          typeof style.marginTop === "number"
            ? style.marginTop
            : undefined,
        paddingBottom:
          (options.blockType === "menu" || options.blockType === "works" || isBookingBlock || isCoverBlock || isServicesBlock) &&
          typeof style.marginBottom === "number"
            ? style.marginBottom
            : undefined,
        width: isMenu || isGallery || isBookingBlock || isCoverBlock || isServicesBlock ? "100%" : gridWidthCss,
        maxWidth: "100%",
        marginLeft: isMenu || isGallery || isBookingBlock || isCoverBlock || isServicesBlock ? "auto" : gridLeftCss,
        marginRight: isMenu || isGallery || isBookingBlock || isCoverBlock || isServicesBlock ? "auto" : 0,
        boxSizing: "border-box",
        color: "var(--block-text)",
        ["--works-content-width" as string]: gridWidthCss,
        ["--works-content-left" as string]: gridLeftCss,
        ["--works-content-width-desktop" as string]: gridWidthCss,
        ["--works-content-left-desktop" as string]: gridLeftCss,
        ["--works-content-width-mobile" as string]: isServicesBlock
          ? mobileServicesWidthCss
          : undefined,
        ["--works-content-left-mobile" as string]: isServicesBlock
          ? mobileServicesLeftCss
          : undefined,
        ["--bp-ink" as string]: "var(--block-text)",
        ["--bp-muted" as string]: "var(--block-muted)",
        ["--block-heading-size-desktop" as string]: `${
          style.headingSize ?? theme.headingSize
        }px`,
        ["--block-subheading-size-desktop" as string]: `${
          style.subheadingSize ?? theme.subheadingSize
        }px`,
        ["--block-text-size-desktop" as string]: `${style.textSize ?? theme.textSize}px`,
        ["--block-heading-size-mobile" as string]: `${
          style.mobileHeadingSize ??
          defaultMobileHeadingSize(style.headingSize ?? theme.headingSize)
        }px`,
        ["--block-subheading-size-mobile" as string]: `${
          style.mobileSubheadingSize ??
          defaultMobileSubheadingSize(style.subheadingSize ?? theme.subheadingSize)
        }px`,
        ["--block-text-size-mobile" as string]: `${
          style.mobileTextSize ?? defaultMobileTextSize(style.textSize ?? theme.textSize)
        }px`,
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
        ["--services-heading-color-light" as string]: style.servicesHeadingColorLightResolved,
        ["--services-heading-color-dark" as string]: style.servicesHeadingColorDarkResolved,
        ["--services-description-color-light" as string]: style.servicesDescriptionColorLightResolved,
        ["--services-description-color-dark" as string]: style.servicesDescriptionColorDarkResolved,
        ["--services-section-bg-light" as string]: servicesSectionBackgroundLight.backgroundColor,
        ["--services-section-bg-dark" as string]: servicesSectionBackgroundDark.backgroundColor,
        ["--services-section-image-light" as string]: servicesSectionBackgroundLight.backgroundImage,
        ["--services-section-image-dark" as string]: servicesSectionBackgroundDark.backgroundImage,
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
  const menuButtonBorderColorDarkRaw =
    typeof data.menuButtonBorderColorDark === "string" ? data.menuButtonBorderColorDark.trim() : "";
  const menuButtonBorderColorDark =
    menuButtonBorderColorDarkRaw.toLowerCase() === "transparent"
      ? "transparent"
      : menuButtonBorderColorDarkRaw && isValidColorValue(menuButtonBorderColorDarkRaw)
        ? menuButtonBorderColorDarkRaw
        : menuButtonBorderColor;
  const menuButtonBorderColorByMode =
    theme.mode === "dark" ? menuButtonBorderColorDark : menuButtonBorderColor;
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
      <UnoptimizedImage src={branding.logoUrl} alt="" style={{ height: logoImageHeight, width: "auto" }} />
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
        className="bp-menu-overlay-link w-full max-w-full break-words text-3xl font-medium leading-tight md:text-5xl"
        style={{
          ...headingStyle(style),
          color: "var(--block-text, var(--bp-ink))",
          textAlign: align,
          maxWidth: "100%",
          overflowWrap: "anywhere",
          ...(block.variant === "v2"
            ? { fontSize: "calc(var(--block-heading-size) + 12px)", lineHeight: 1.25 }
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
            <UnoptimizedImage
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
    fontSize: "var(--block-subheading-size)",
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
          borderWidth: menuButtonBorderColorByMode === "transparent" ? 0 : 1,
          borderColor: menuButtonBorderColorByMode,
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
          borderWidth: menuButtonBorderColorByMode === "transparent" ? 0 : 1,
          borderColor: menuButtonBorderColorByMode,
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
            className={`bp-menu-drawer-link w-full max-w-full break-words font-medium leading-tight text-[color:var(--block-text,var(--bp-ink))] ${
              block.variant === "v3" ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
            }`}
            style={{
              ...headingStyle(style),
              textAlign: align,
              maxWidth: "100%",
              overflowWrap: "anywhere",
              ...(block.variant === "v3"
                ? { fontSize: "calc(var(--block-heading-size) + 16px)", lineHeight: 1.25 }
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
        className="bp-public-menu bp-public-menu-v2 w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 12, zIndex: 20 }
            : undefined
        }
      >
        <details
          suppressHydrationWarning
          className="group menu-v2-overlay w-full"
        >
          <summary
            className="relative z-[60] flex cursor-pointer list-none items-center border-b py-0 pl-8 pr-24
              group-open:[--menu-v2-top-bg:var(--block-sub-bg)]
              group-open:[--menu-v2-top-gradient:none]
              [&::-webkit-details-marker]:hidden
              group-open:z-[180] group-open:py-0 group-open:pl-8 group-open:pr-24"
            style={{
              minHeight: menuHeight,
              backgroundColor: "var(--block-bg, var(--site-panel))",
              backgroundImage: "none",
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
            <div className="bp-menu-v2-desktop-nav flex flex-1 flex-col items-center justify-center py-6">
              {overlayNavNode}
            </div>
            <div className="bp-menu-v2-mobile-nav hidden min-w-0 flex-1 flex-col items-center justify-center overflow-hidden py-6">
              {drawerNavNode}
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
        className="bp-public-menu bp-public-menu-v3 w-full"
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
              backgroundColor: "var(--block-bg, var(--site-panel))",
              backgroundImage: "none",
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
      backgroundColor: "var(--block-bg, var(--site-panel))",
      backgroundImage: "none",
      borderColor: "var(--block-border, var(--site-border))",
      borderBottomWidth: 1,
    };
    return (
      <div
        className="bp-public-menu bp-public-menu-v1 w-full"
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
                  <div className="min-w-0 overflow-hidden">{drawerNavNode}</div>
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
  profile: AccountProfile
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
  const showButton = data.showButton !== false;
  const buttonAlignment =
    data.buttonAlignment === "left" || data.buttonAlignment === "right" ? data.buttonAlignment : "center";
  const buttonText =
    typeof data.buttonText === "string" && data.buttonText.trim() ? data.buttonText.trim() : "Записаться";
  const showDetailsButton = data.showDetailsButton !== false;
  const detailsButtonText =
    showDetailsButton && typeof data.detailsButtonText === "string" && data.detailsButtonText.trim()
      ? data.detailsButtonText.trim()
      : showDetailsButton
        ? "Подробнее"
        : "";
  const readDataColor = (key: string) =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : "";
  const readOptionalDataColor = (key: string) => {
    const value = readDataColor(key);
    return value && value !== "transparent" ? value : "";
  };
  const readDataNumberValue = (key: string, fallback: number, min = 8, max = 96) => {
    const value = Number(data[key]);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  };
  const readDataFont = (key: string, fallback = "Manrope") =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : fallback;
  const readDataFontFallback = (key: string, legacyKey: string, fallback = "Manrope") =>
    typeof data[key] === "string" && String(data[key]).trim()
      ? String(data[key]).trim()
      : readDataFont(legacyKey, fallback);
  const readDataWeight = (key: string, fallback?: number) => {
    if (data[key] === "" || data[key] === null || data[key] === undefined) return fallback;
    const value = Number(data[key]);
    return Number.isFinite(value) ? Math.max(100, Math.min(900, Math.round(value))) : fallback;
  };
  const readDataWeightFallback = (key: string, legacyKey: string, fallback?: number) =>
    data[key] !== "" && data[key] !== null && data[key] !== undefined
      ? readDataWeight(key, fallback)
      : readDataWeight(legacyKey, fallback);
  const cardTextColor = (key: string, lightFallback: string, darkFallback: string, legacyKey?: string) => {
    const sharedColor = readOptionalDataColor(key);
    const legacySharedColor = legacyKey ? readOptionalDataColor(legacyKey) : "";
    return {
      light:
        readOptionalDataColor(`${key}Light`) ||
        sharedColor ||
        (legacyKey ? readOptionalDataColor(`${legacyKey}Light`) || legacySharedColor : "") ||
        lightFallback,
      dark:
        readOptionalDataColor(`${key}Dark`) ||
        sharedColor ||
        (legacyKey ? readOptionalDataColor(`${legacyKey}Dark`) || legacySharedColor : "") ||
        darkFallback,
    };
  };
  const cardTextStyle = (
    key: string,
    lightFallback: string,
    darkFallback: string,
    sizeFallback: number,
    weightFallback?: number,
    legacyKey?: string
  ): CSSProperties => {
    const color = cardTextColor(`${key}Color`, lightFallback, darkFallback, legacyKey ? `${legacyKey}Color` : undefined);
    const desktopSize = readDataNumberValue(`${key}Size`, sizeFallback);
    const legacyDesktopSize = legacyKey ? readDataNumberValue(`${legacyKey}Size`, desktopSize) : desktopSize;
    const resolvedDesktopSize = Number.isFinite(Number(data[`${key}Size`])) ? desktopSize : legacyDesktopSize;
    const mobileSize = readDataNumberValue(
      `${key}MobileSize`,
      key === "catalogCardTitle"
        ? Math.max(15, Math.min(28, Math.round(resolvedDesktopSize * 0.82)))
        : Math.max(12, Math.min(17, Math.round(resolvedDesktopSize * 0.9)))
    );
    return {
      color: color.light,
      ["--card-dark-color" as string]: color.dark,
      ["--specialist-card-text-size-desktop" as string]: `${resolvedDesktopSize}px`,
      ["--specialist-card-text-size-mobile" as string]: `${mobileSize}px`,
      fontSize: "var(--specialist-card-text-size)",
      fontFamily: legacyKey
        ? readDataFontFallback(`${key}Font`, `${legacyKey}Font`, "Manrope")
        : readDataFont(`${key}Font`, "Manrope"),
      fontWeight: legacyKey
        ? readDataWeightFallback(`${key}Weight`, `${legacyKey}Weight`, weightFallback)
        : readDataWeight(`${key}Weight`, weightFallback),
    };
  };
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const cardsPerRowRaw = Number(data.cardsPerRow);
  const cardsPerRow =
    Number.isFinite(cardsPerRowRaw) && cardsPerRowRaw >= 1 && cardsPerRowRaw <= 6
      ? Math.round(cardsPerRowRaw)
      : 4;
  const catalogItems = items.map((location) => ({
    id: location.id,
    name: location.name,
    bio: [location.description, location.phone ? `Телефон: ${location.phone}` : ""].filter(Boolean).join("\n"),
    level: location.address || null,
    locationIds: [location.id],
    coverUrl: location.coverUrl,
    photoUrls: location.photoUrls ?? [],
    ratingAvg: location.ratingAvg,
    ratingCount: location.ratingCount,
  }));

  return (
    <div
      className="mx-auto w-full"
      style={{
        width: "var(--works-content-width, 100%)",
        maxWidth: "100%",
        marginLeft: "var(--works-content-left, auto)",
        marginRight: 0,
      }}
    >
      <LocationsCatalog
        variant={block.variant === "v2" ? "v2" : "v1"}
        listView={data.listView === "list" ? "list" : "tile"}
        title={typeof data.title === "string" ? data.title : "Филиалы"}
        subtitle={subtitle}
        items={catalogItems}
        publicSlug={publicSlug}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        cardsPerRow={cardsPerRow}
        mobileCardsPerRow={Number(data.mobileCardsPerRow) === 1 ? 1 : 2}
        showCategoryTabs={false}
        categoryAllLabel="Все филиалы"
        showSearch={data.showSearch !== false}
        searchPlaceholder={
          typeof data.searchPlaceholder === "string" && data.searchPlaceholder.trim()
            ? data.searchPlaceholder.trim()
            : "Поиск филиала"
        }
        showSort={data.showSort !== false}
        defaultSort={typeof data.defaultSort === "string" && data.defaultSort.trim() ? data.defaultSort.trim() : "default"}
        searchSortAlignment={
          data.filtersAlignment === "left" || data.filtersAlignment === "center" || data.filtersAlignment === "right"
            ? data.filtersAlignment
            : data.searchSortAlignment === "left" ||
                data.searchSortAlignment === "center" ||
                data.searchSortAlignment === "right"
              ? data.searchSortAlignment
            : "right"
        }
        filtersAlignment={
          data.filtersAlignment === "left" || data.filtersAlignment === "center" || data.filtersAlignment === "right"
            ? data.filtersAlignment
            : "left"
        }
        sortTextColor={readOptionalDataColor("sortTextColor")}
        sortActiveColor={readOptionalDataColor("sortActiveColor")}
        sortTextColorDark={readOptionalDataColor("sortTextColorDark")}
        sortActiveColorDark={readOptionalDataColor("sortActiveColorDark")}
        showLocationFilter={false}
        showLevel={data.showAddress !== false && data.showLevel !== false}
        showDescription={data.showDescription !== false}
        showButton={showButton}
        buttonText={buttonText}
        buttonAlignment={buttonAlignment}
        showDetailsButton={showDetailsButton}
        detailsButtonText={detailsButtonText}
        detailsButtonColor={readDataColor("detailsButtonColor") || "transparent"}
        detailsButtonTextColor={readDataColor("detailsButtonTextColor") || "#111111"}
        detailsButtonBorderColor={readDataColor("detailsButtonBorderColor") || "transparent"}
        detailsButtonColorDark={readDataColor("detailsButtonColorDark") || readDataColor("detailsButtonColor") || "transparent"}
        detailsButtonTextColorDark={readDataColor("detailsButtonTextColorDark") || "#f8fafc"}
        detailsButtonBorderColorDark={readDataColor("detailsButtonBorderColorDark") || readDataColor("detailsButtonBorderColor") || "transparent"}
        showImage={data.showImage !== false}
        imageAspectRatio={typeof data.imageAspectRatio === "string" ? data.imageAspectRatio : "1 / 1"}
        imageRadius={Number.isFinite(Number(data.imageRadius)) ? Number(data.imageRadius) : 10}
        imageFit={(data.locationCardImageFit ?? data.specialistCardImageFit) === "contain" ? "contain" : "cover"}
        imageZoomOnHover={data.imageZoomOnHover === true}
        imageZoomOnClick={
          data.locationCardImageZoomOnClick === true ||
          data.modalImageZoomOnClick === true ||
          data.specialistCardImageZoomOnClick === true
        }
        alignButtonsBottom={data.alignButtonsBottom !== false}
        cardClickEnabled={data.modalImageClickEnabled !== false}
        cardStyle={data.cardStyle === "filled" || data.cardStyle === "boxed" ? "filled" : "plain"}
        cardGapX={Number.isFinite(Number(data.cardGapX)) ? Number(data.cardGapX) : 20}
        cardGapY={Number.isFinite(Number(data.cardGapY)) ? Number(data.cardGapY) : 40}
        cardPaddingX={Number.isFinite(Number(data.cardPaddingX)) ? Number(data.cardPaddingX) : 30}
        cardPaddingY={Number.isFinite(Number(data.cardPaddingY)) ? Number(data.cardPaddingY) : 30}
        maxVisibleItems={Number.isFinite(Number(data.maxVisibleItems)) ? Number(data.maxVisibleItems) : 8}
        usePagination={data.usePagination === true}
        headingStyle={{ ...headingStyle(style), textAlign: style.textAlignHeading ?? "center" }}
        subheadingStyle={{ ...subheadingStyle(style), textAlign: style.textAlignSubheading ?? "left" }}
        cardTitleTextStyle={cardTextStyle("catalogCardTitle", "#111827", "#F8FAFC", 18, 600, "specialistCardTitle")}
        cardDescriptionTextStyle={cardTextStyle("catalogCardText", "#6B7280", "#CBD5E1", 14, undefined, "specialistCardDescription")}
        buttonStyle={{ ...buttonStyle(style), borderRadius: style.buttonRadius ?? 0 }}
        textAlign={style.textAlign}
        ratingAlignment={
          data.ratingAlignment === "left" || data.ratingAlignment === "center" || data.ratingAlignment === "right"
            ? data.ratingAlignment
            : "right"
        }
        ratingVerticalAlignment={
          data.ratingVerticalAlignment === "top" || data.ratingVerticalAlignment === "bottom"
            ? data.ratingVerticalAlignment
            : undefined
        }
        ratingTextColor={readDataColor("ratingTextColorLight") || "#111827"}
        ratingTextColorDark={readDataColor("ratingTextColorDark") || readDataColor("ratingTextColorLight") || "#F8FAFC"}
        ratingStarColor={readDataColor("ratingStarColorLight") || "#ffb020"}
        ratingStarColorDark={readDataColor("ratingStarColorDark") || readDataColor("ratingStarColorLight") || "#ffb020"}
        ratingBackgroundColor={readDataColor("ratingBackgroundColorLight") || "transparent"}
        ratingBackgroundColorDark={
          readDataColor("ratingBackgroundColorDark") || readDataColor("ratingBackgroundColorLight") || "transparent"
        }
        ratingBackgroundOpacity={readDataNumberValue("ratingBackgroundOpacity", 50)}
        ratingBackgroundRadius={readDataNumberValue("ratingBackgroundRadius", 0)}
        ratingTextSize={readDataNumberValue("ratingTextSize", 16)}
        ratingTextFont={typeof data.ratingTextFont === "string" && data.ratingTextFont.trim() ? data.ratingTextFont : "Manrope"}
        ratingTextWeight={data.ratingTextWeight === "" || data.ratingTextWeight == null ? undefined : String(data.ratingTextWeight)}
        emptyText="Нет филиалов для отображения."
      />
    </div>
  );
}

function renderServices(
  block: SiteBlock,
  publicSlug: string,
  locations: LocationItem[],
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
  const buttonAlignment =
    data.buttonAlignment === "left" || data.buttonAlignment === "right" ? data.buttonAlignment : "center";
  const buttonText = (data.buttonText as string) || "Записаться";
  const detailsButtonText =
    typeof data.detailsButtonText === "string" && data.detailsButtonText.trim()
      ? data.detailsButtonText.trim()
      : "Подробнее";
  const readDataColor = (key: string) =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : "";
  const readDataNumber = (key: string, fallback: number) =>
    Number.isFinite(Number(data[key])) ? Number(data[key]) : fallback;
  const readOptionalDataColor = (key: string) => {
    const value = readDataColor(key);
    return value && value !== "transparent" ? value : "";
  };
  const detailsButtonColor = readDataColor("detailsButtonColor") || "transparent";
  const detailsButtonTextColor = readDataColor("detailsButtonTextColor") || "#111111";
  const detailsButtonBorderColor = readDataColor("detailsButtonBorderColor") || "transparent";
  const detailsButtonColorDark = readDataColor("detailsButtonColorDark") || detailsButtonColor;
  const detailsButtonTextColorDark = readDataColor("detailsButtonTextColorDark") || "#f8fafc";
  const detailsButtonBorderColorDark =
    readDataColor("detailsButtonBorderColorDark") || detailsButtonBorderColor;
  const servicePageButtonMode =
    data.servicePageButtonMode === "booking" ? "booking" : "entityPage";
  const cardStyle = data.cardStyle === "plain" ? "plain" : "filled";
  const serviceCardBackgroundSource = {
    ...data,
    serviceCardBackgroundFromLight:
      readDataColor("serviceCardBackgroundFromLight") || style.subBlockBgLightResolved || style.subBlockBg || "#fafafa",
    serviceCardBackgroundFromDark:
      readDataColor("serviceCardBackgroundFromDark") || style.subBlockBgDarkResolved || "#24282e",
  };
  const serviceCardBackgroundLight = resolveServiceCardBackgroundVisual(
    serviceCardBackgroundSource,
    "var(--block-sub-bg,var(--bp-paper))",
    "light"
  );
  const serviceCardBackgroundDark = resolveServiceCardBackgroundVisual(
    serviceCardBackgroundSource,
    serviceCardBackgroundLight.backgroundColor,
    "dark"
  );
  const cardGapX = Number(data.cardGapX);
  const cardGapY = Number(data.cardGapY);
  const imageAspectRatio =
    typeof data.imageAspectRatio === "string" && data.imageAspectRatio.trim()
      ? data.imageAspectRatio.trim()
      : "1 / 1";
  const imageRadius = Number(data.imageRadius);
  const cardPaddingX = Number(data.cardPaddingX);
  const cardPaddingY = Number(data.cardPaddingY);
  const mobileCardsPerRow = Number(data.mobileCardsPerRow) === 1 ? 1 : 2;
  const showSecondImageOnHover = data.showSecondImageOnHover === true;
  const imageZoomOnHover = data.imageZoomOnHover === true;
  const alignButtonsBottom = data.alignButtonsBottom !== false;
  const modalImageClickEnabled = data.modalImageClickEnabled !== false;
  const serviceModalShowDescription = data.serviceModalShowDescription !== false;
  const serviceModalShowMeta = data.serviceModalShowMeta !== false;
  const serviceModalBackgroundSource = {
    ...data,
    serviceModalBackgroundFromLight:
      readDataColor("serviceModalBackgroundFromLight") || readDataColor("serviceModalBgColor"),
    serviceModalBackgroundFromDark:
      readDataColor("serviceModalBackgroundFromDark") || readDataColor("serviceModalBgColorDark"),
  };
  const serviceModalBackgroundLight = resolveServiceModalBackgroundVisual(
    serviceModalBackgroundSource,
    "var(--block-bg,var(--bp-paper))",
    "light"
  );
  const serviceModalBackgroundDark = resolveServiceModalBackgroundVisual(
    serviceModalBackgroundSource,
    serviceModalBackgroundLight.backgroundColor,
    "dark"
  );
  const serviceModalMediaColumnsRaw = Number(data.serviceModalMediaColumns);
  const serviceModalInfoColumnsRaw = Number(data.serviceModalInfoColumns);
  const serviceModalMediaColumns =
    Number.isFinite(serviceModalMediaColumnsRaw)
      ? Math.max(1, Math.min(11, Math.round(serviceModalMediaColumnsRaw)))
      : 6;
  const serviceModalInfoColumns =
    Number.isFinite(serviceModalInfoColumnsRaw)
      ? Math.max(1, Math.min(11, Math.round(serviceModalInfoColumnsRaw)))
      : 6;
  const modalGalleryBgColor =
    typeof data.modalGalleryBgColor === "string" && data.modalGalleryBgColor.trim()
      ? data.modalGalleryBgColor.trim()
      : "#ebebeb";
  const modalImageFit = data.modalImageFit === "contain" ? "contain" : "cover";
  const modalImageRadiusRaw = Number(data.modalImageRadius);
  const modalImageRadius = Number.isFinite(modalImageRadiusRaw)
    ? Math.max(0, Math.min(80, Math.round(modalImageRadiusRaw)))
    : 8;
  const modalImageAspectRatio =
    typeof data.modalImageAspectRatio === "string" && data.modalImageAspectRatio.trim()
      ? data.modalImageAspectRatio.trim()
      : "1 / 1";
  const modalControls =
    data.modalControls === "arrows" ||
    data.modalControls === "dots" ||
    data.modalControls === "thumbnails"
      ? data.modalControls
      : "arrowsAndDots";
  const modalArrowSize =
    data.modalArrowSize === "sm" || data.modalArrowSize === "lg" ? data.modalArrowSize : "md";
  const modalArrowThickness = Number(data.modalArrowThickness);
  const modalArrowColor =
    typeof data.modalArrowColor === "string" && data.modalArrowColor.trim()
      ? data.modalArrowColor.trim()
      : "#000000";
  const modalArrowHoverColor =
    typeof data.modalArrowHoverColor === "string" && data.modalArrowHoverColor.trim()
      ? data.modalArrowHoverColor.trim()
      : modalArrowColor;
  const modalArrowBgColor =
    typeof data.modalArrowBgColor === "string" && data.modalArrowBgColor.trim()
      ? data.modalArrowBgColor.trim()
      : "#ffffff";
  const modalArrowHoverBgColor =
    typeof data.modalArrowHoverBgColor === "string" && data.modalArrowHoverBgColor.trim()
      ? data.modalArrowHoverBgColor.trim()
      : "#000000";
  const modalArrowBgOpacity = Number(data.modalArrowBgOpacity);
  const modalArrowHoverBgOpacity = Number(data.modalArrowHoverBgOpacity);
  const modalArrowBorderEnabled = data.modalArrowBorderEnabled === true;
  const modalDotsSize = Number(data.modalDotsSize);
  const modalDotsColor =
    typeof data.modalDotsColor === "string" && data.modalDotsColor.trim()
      ? data.modalDotsColor.trim()
      : "#000000";
  const modalDotsActiveColor =
    typeof data.modalDotsActiveColor === "string" && data.modalDotsActiveColor.trim()
      ? data.modalDotsActiveColor.trim()
      : "#cccccc";
  const modalDotsBorderWidth = Number(data.modalDotsBorderWidth);
  const modalThumbnailsPosition = "bottom" as const;
  const modalInfiniteGallery = data.modalInfiniteGallery !== false;
  const modalImageZoomOnClick = data.modalImageZoomOnClick === true;
  const modalImageZoomOnHover = data.modalImageZoomOnHover === true;
  const readDataNumberValue = (key: string, fallback: number, min = 8, max = 96) => {
    const value = Number(data[key]);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  };
  const readDataFont = (key: string, fallback = "Manrope") =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : fallback;
  const readDataWeight = (key: string, fallback?: number) => {
    if (data[key] === "" || data[key] === null || data[key] === undefined) return fallback;
    const value = Number(data[key]);
    return Number.isFinite(value) ? Math.max(100, Math.min(900, Math.round(value))) : fallback;
  };
  const modalTextColor = (key: string, lightFallback: string, darkFallback: string) => {
    const sharedColor = readOptionalDataColor(key);
    return {
      light: readOptionalDataColor(`${key}Light`) || sharedColor || lightFallback,
      dark: readOptionalDataColor(`${key}Dark`) || sharedColor || darkFallback,
    };
  };
  const modalTextStyle = (
    key: string,
    lightFallback: string,
    darkFallback: string,
    sizeFallback: number,
    weightFallback?: number
  ): React.CSSProperties => {
    const color = modalTextColor(`${key}Color`, lightFallback, darkFallback);
    const desktopSize = readDataNumberValue(`${key}Size`, sizeFallback);
    const mobileSize = readDataNumberValue(
      `${key}MobileSize`,
      defaultServiceModalMobileTextSize(key, desktopSize)
    );
    return {
      color: color.light,
      ["--modal-dark-color" as string]: color.dark,
      ["--service-modal-text-size-desktop" as string]: `${desktopSize}px`,
      ["--service-modal-text-size-mobile" as string]: `${mobileSize}px`,
      fontSize: "var(--service-modal-text-size)",
      fontFamily: readDataFont(`${key}Font`, "Manrope"),
      fontWeight: readDataWeight(`${key}Weight`, weightFallback),
    };
  };
  const modalCategoryTextStyle = modalTextStyle("modalCategory", "#6B7280", "#A7B0C0", 14);
  const modalTitleTextStyle = modalTextStyle("modalTitle", "#111827", "#F8FAFC", 48, 600);
  const modalDescriptionTextStyle = modalTextStyle("modalDescription", "#6B7280", "#CBD5E1", 17);
  const modalPriceTextStyle = modalTextStyle("modalPrice", "#111827", "#F8FAFC", 20, 600);
  const modalDurationTextStyle = modalTextStyle("modalDuration", "#6B7280", "#CBD5E1", 20);
  const servicesButtonStyle = {
    ...buttonStyle(style),
    borderRadius: style.buttonRadius ?? 0,
  };
  const showCategoryTabs = data.showCategoryTabs !== false;
  const categoryAllLabel =
    typeof data.categoryAllLabel === "string" && data.categoryAllLabel.trim()
      ? data.categoryAllLabel.trim()
      : "Все услуги";
  const showSearch = data.showSearch !== false;
  const searchPlaceholder =
    typeof data.searchPlaceholder === "string" && data.searchPlaceholder.trim()
      ? data.searchPlaceholder.trim()
      : "Поиск услуги";
  const showSort = data.showSort !== false;
  const defaultSort =
    typeof data.defaultSort === "string" && data.defaultSort.trim()
      ? data.defaultSort.trim()
      : "default";
  const searchSortAlignment =
    data.searchSortAlignment === "left" ||
    data.searchSortAlignment === "center" ||
    data.searchSortAlignment === "right"
      ? data.searchSortAlignment
      : "right";
  const filtersAlignment =
    data.filtersAlignment === "left" || data.filtersAlignment === "center" || data.filtersAlignment === "right"
      ? data.filtersAlignment
      : "left";
  const categoryTextColor = readOptionalDataColor("categoryTextColor");
  const categoryActiveColor = readOptionalDataColor("categoryActiveColor");
  const sortTextColor = readOptionalDataColor("sortTextColor");
  const sortActiveColor = readOptionalDataColor("sortActiveColor");
  const locationTextColor = readOptionalDataColor("locationTextColor");
  const locationActiveColor = readOptionalDataColor("locationActiveColor");
  const categoryTextColorDark = readOptionalDataColor("categoryTextColorDark");
  const categoryActiveColorDark = readOptionalDataColor("categoryActiveColorDark");
  const sortTextColorDark = readOptionalDataColor("sortTextColorDark");
  const sortActiveColorDark = readOptionalDataColor("sortActiveColorDark");
  const locationTextColorDark = readOptionalDataColor("locationTextColorDark");
  const locationActiveColorDark = readOptionalDataColor("locationActiveColorDark");
  const showDescription = data.showDescription !== false;
  const showPrice = data.showPrice !== false;
  const showDuration = data.showDuration !== false;
  const cardsPerRowRaw = Number(data.cardsPerRow);
  const cardsPerRow =
    Number.isFinite(cardsPerRowRaw) && cardsPerRowRaw >= 1 && cardsPerRowRaw <= 6
      ? Math.round(cardsPerRowRaw)
      : 3;
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
  const servicesHeadingStyle = {
    ...headingStyle(style),
    color: "var(--services-heading-color,var(--site-text,var(--block-text,var(--bp-ink))))",
  };
  const servicesSubheadingStyle = {
    ...subheadingStyle(style),
    color: "var(--services-description-color,var(--site-muted,var(--block-muted,var(--bp-muted))))",
  };

  return (
    <div
      className="mx-auto w-full"
      style={{
        width: "var(--works-content-width, 100%)",
        maxWidth: "100%",
        marginLeft: "var(--works-content-left, auto)",
        marginRight: 0,
      }}
    >
      <ServicesCatalog
        variant={block.variant === "v2" ? "v2" : "v1"}
        listView={data.listView === "list" ? "list" : "tile"}
        title={typeof data.title === "string" ? data.title : "Услуги"}
        subtitle={subtitle}
        items={items}
        publicSlug={publicSlug}
        currentLocationId={currentLocationId}
        locationId={locationId}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        effectiveSpecialistId={effectiveSpecialistId}
        cardsPerRow={cardsPerRow}
        showCategoryTabs={showCategoryTabs}
        categoryAllLabel={categoryAllLabel}
        showSearch={showSearch}
        searchPlaceholder={searchPlaceholder}
        showSort={showSort}
        defaultSort={defaultSort}
        searchSortAlignment={searchSortAlignment}
        filtersAlignment={filtersAlignment}
        categoryTextColor={categoryTextColor}
        categoryActiveColor={categoryActiveColor}
        sortTextColor={sortTextColor}
        sortActiveColor={sortActiveColor}
        locationTextColor={locationTextColor}
        locationActiveColor={locationActiveColor}
        categoryTextColorDark={categoryTextColorDark}
        categoryActiveColorDark={categoryActiveColorDark}
        sortTextColorDark={sortTextColorDark}
        sortActiveColorDark={sortActiveColorDark}
        locationTextColorDark={locationTextColorDark}
        locationActiveColorDark={locationActiveColorDark}
        themeMode={theme.mode === "dark" ? "dark" : "light"}
        showDescription={showDescription}
        showPrice={showPrice}
        showDuration={showDuration}
        showButton={showButton}
        buttonText={buttonText}
        buttonAlignment={buttonAlignment}
        detailsButtonText={detailsButtonText}
        detailsButtonColor={detailsButtonColor}
        detailsButtonTextColor={detailsButtonTextColor}
        detailsButtonBorderColor={detailsButtonBorderColor}
        detailsButtonColorDark={detailsButtonColorDark}
        detailsButtonTextColorDark={detailsButtonTextColorDark}
        detailsButtonBorderColorDark={detailsButtonBorderColorDark}
        servicePageButtonMode={servicePageButtonMode}
        cardStyle={cardStyle}
        cardBackgroundColorLight={serviceCardBackgroundLight.backgroundColor}
        cardBackgroundImageLight={serviceCardBackgroundLight.backgroundImage}
        cardBackgroundColorDark={serviceCardBackgroundDark.backgroundColor}
        cardBackgroundImageDark={serviceCardBackgroundDark.backgroundImage}
        cardLiquidGlass={data.serviceCardLiquidGlass === true}
        cardBackgroundStartOpacityLight={readDataNumber("serviceCardBackgroundStartOpacityLight", 0)}
        cardBackgroundEndOpacityLight={readDataNumber("serviceCardBackgroundEndOpacityLight", 10)}
        cardBackgroundStartOpacityDark={readDataNumber(
          "serviceCardBackgroundStartOpacityDark",
          readDataNumber("serviceCardBackgroundStartOpacityLight", 0)
        )}
        cardBackgroundEndOpacityDark={readDataNumber(
          "serviceCardBackgroundEndOpacityDark",
          readDataNumber("serviceCardBackgroundEndOpacityLight", 10)
        )}
        cardGapX={cardGapX}
        cardGapY={cardGapY}
        imageAspectRatio={imageAspectRatio}
        imageRadius={imageRadius}
        cardPaddingX={cardPaddingX}
        cardPaddingY={cardPaddingY}
        mobileCardsPerRow={mobileCardsPerRow}
        showSecondImageOnHover={showSecondImageOnHover}
        imageZoomOnHover={imageZoomOnHover}
        alignButtonsBottom={alignButtonsBottom}
        modalImageClickEnabled={modalImageClickEnabled}
        serviceModalShowDescription={serviceModalShowDescription}
        serviceModalShowMeta={serviceModalShowMeta}
        serviceModalBgColor={serviceModalBackgroundLight.backgroundColor}
        serviceModalBgColorDark={serviceModalBackgroundDark.backgroundColor}
        serviceModalBgImage={serviceModalBackgroundLight.backgroundImage}
        serviceModalBgImageDark={serviceModalBackgroundDark.backgroundImage}
        serviceModalMediaColumns={serviceModalMediaColumns}
        serviceModalInfoColumns={serviceModalInfoColumns}
        modalGalleryBgColor={modalGalleryBgColor}
        modalImageFit={modalImageFit}
        modalImageRadius={modalImageRadius}
        modalImageAspectRatio={modalImageAspectRatio}
        modalControls={modalControls}
        modalArrowSize={modalArrowSize}
        modalArrowThickness={modalArrowThickness}
        modalArrowColor={modalArrowColor}
        modalArrowHoverColor={modalArrowHoverColor}
        modalArrowBgColor={modalArrowBgColor}
        modalArrowHoverBgColor={modalArrowHoverBgColor}
        modalArrowBgOpacity={modalArrowBgOpacity}
        modalArrowHoverBgOpacity={modalArrowHoverBgOpacity}
        modalArrowBorderEnabled={modalArrowBorderEnabled}
        modalDotsSize={modalDotsSize}
        modalDotsColor={modalDotsColor}
        modalDotsActiveColor={modalDotsActiveColor}
        modalDotsBorderWidth={modalDotsBorderWidth}
        modalThumbnailsPosition={modalThumbnailsPosition}
        modalInfiniteGallery={modalInfiniteGallery}
        modalImageZoomOnClick={modalImageZoomOnClick}
        modalImageZoomOnHover={modalImageZoomOnHover}
        modalCategoryTextStyle={modalCategoryTextStyle}
        modalTitleTextStyle={modalTitleTextStyle}
        modalDescriptionTextStyle={modalDescriptionTextStyle}
        modalPriceTextStyle={modalPriceTextStyle}
        modalDurationTextStyle={modalDurationTextStyle}
        maxVisibleItems={Number.isFinite(Number(data.maxVisibleItems)) ? Number(data.maxVisibleItems) : 8}
        usePagination={data.usePagination === true}
        headingStyle={servicesHeadingStyle}
        subheadingStyle={servicesSubheadingStyle}
        buttonStyle={servicesButtonStyle}
        textAlign={style.textAlign}
        ratingAlignment={
          data.ratingAlignment === "left" || data.ratingAlignment === "center" || data.ratingAlignment === "right"
            ? data.ratingAlignment
            : "right"
        }
        ratingVerticalAlignment={
          data.ratingVerticalAlignment === "top" || data.ratingVerticalAlignment === "bottom"
            ? data.ratingVerticalAlignment
            : undefined
        }
        ratingTextColor={readDataColor("ratingTextColorLight") || "#111827"}
        ratingTextColorDark={readDataColor("ratingTextColorDark") || readDataColor("ratingTextColorLight") || "#F8FAFC"}
        ratingStarColor={readDataColor("ratingStarColorLight") || "#ffb020"}
        ratingStarColorDark={readDataColor("ratingStarColorDark") || readDataColor("ratingStarColorLight") || "#ffb020"}
        ratingBackgroundColor={readDataColor("ratingBackgroundColorLight") || "transparent"}
        ratingBackgroundColorDark={
          readDataColor("ratingBackgroundColorDark") || readDataColor("ratingBackgroundColorLight") || "transparent"
        }
        ratingBackgroundOpacity={readDataNumber("ratingBackgroundOpacity", 50)}
        ratingBackgroundRadius={readDataNumber("ratingBackgroundRadius", 0)}
        ratingTextSize={readDataNumber("ratingTextSize", 16)}
        ratingTextFont={typeof data.ratingTextFont === "string" && data.ratingTextFont.trim() ? data.ratingTextFont : "Manrope"}
        ratingTextWeight={data.ratingTextWeight === "" || data.ratingTextWeight == null ? undefined : String(data.ratingTextWeight)}
      />
    </div>
  );
}

function renderSpecialists(
  block: SiteBlock,
  publicSlug: string,
  locations: LocationItem[],
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
      : useCurrent
        ? specialists.slice(0, 1)
      : resolveEntities(mode, ids, specialists);
  const showButton = data.showButton !== false;
  const buttonAlignment =
    data.buttonAlignment === "left" || data.buttonAlignment === "right" ? data.buttonAlignment : "center";
  const buttonText =
    typeof data.buttonText === "string" && data.buttonText.trim()
      ? data.buttonText.trim()
      : "Записаться";
  const showDetailsButton = data.showDetailsButton !== false;
  const detailsButtonText =
    showDetailsButton && typeof data.detailsButtonText === "string" && data.detailsButtonText.trim()
      ? data.detailsButtonText.trim()
      : showDetailsButton
        ? "Подробнее"
        : "";
  const readDataColor = (key: string) =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : "";
  const detailsButtonColor = readDataColor("detailsButtonColor") || "transparent";
  const detailsButtonTextColor = readDataColor("detailsButtonTextColor") || "#111111";
  const detailsButtonBorderColor = readDataColor("detailsButtonBorderColor") || "transparent";
  const detailsButtonColorDark = readDataColor("detailsButtonColorDark") || detailsButtonColor;
  const detailsButtonTextColorDark = readDataColor("detailsButtonTextColorDark") || "#f8fafc";
  const detailsButtonBorderColorDark =
    readDataColor("detailsButtonBorderColorDark") || detailsButtonBorderColor;
  const alignButtonsBottom = data.alignButtonsBottom !== false;
  const specialistModalMediaColumnsRaw = Number(data.specialistModalMediaColumns);
  const specialistModalInfoColumnsRaw = Number(data.specialistModalInfoColumns);
  const specialistModalMediaColumns =
    Number.isFinite(specialistModalMediaColumnsRaw)
      ? Math.max(1, Math.min(11, Math.round(specialistModalMediaColumnsRaw)))
      : 6;
  const specialistModalInfoColumns =
    Number.isFinite(specialistModalInfoColumnsRaw)
      ? Math.max(1, Math.min(11, Math.round(specialistModalInfoColumnsRaw)))
      : 6;
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const currentLocationId = current?.type === "location" ? current.id : null;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const cardsPerRowRaw = Number(data.cardsPerRow);
  const cardsPerRow =
    Number.isFinite(cardsPerRowRaw) && cardsPerRowRaw >= 1 && cardsPerRowRaw <= 6
      ? Math.round(cardsPerRowRaw)
      : 3;
  const mobileCardsPerRow = Number(data.mobileCardsPerRow) === 1 ? 1 : 2;
  const listView = data.listView === "list" ? "list" : "tile";
  const cardStyle = data.cardStyle === "filled" || data.cardStyle === "boxed" ? "filled" : "plain";
  const maxVisibleItems = Number(data.maxVisibleItems);
  const imageAspectRatio =
    typeof data.imageAspectRatio === "string" && data.imageAspectRatio.trim()
      ? data.imageAspectRatio.trim()
      : "1 / 1";
  const imageRadius = Number(data.imageRadius);
  const cardGapX = Number(data.cardGapX);
  const cardGapY = Number(data.cardGapY);
  const cardPaddingX = Number(data.cardPaddingX);
  const cardPaddingY = Number(data.cardPaddingY);
  const specialistCardBackgroundSource = {
    ...data,
    specialistCardBackgroundFromLight:
      readDataColor("specialistCardBackgroundFromLight") || style.subBlockBgLightResolved || style.subBlockBg || "#fafafa",
    specialistCardBackgroundFromDark:
      readDataColor("specialistCardBackgroundFromDark") || style.subBlockBgDarkResolved || "#24282e",
  };
  const specialistCardBackgroundLight = resolveSpecialistCardBackgroundVisual(
    specialistCardBackgroundSource,
    "var(--block-sub-bg,var(--bp-paper))",
    "light"
  );
  const specialistCardBackgroundDark = resolveSpecialistCardBackgroundVisual(
    specialistCardBackgroundSource,
    specialistCardBackgroundLight.backgroundColor,
    "dark"
  );
  const readOptionalDataColor = (key: string) =>
    typeof data[key] === "string" && String(data[key]).trim() && String(data[key]).trim() !== "transparent"
      ? String(data[key]).trim()
      : "";
  const readDataNumberValue = (key: string, fallback: number, min = 8, max = 96) => {
    const value = Number(data[key]);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  };
  const readDataFont = (key: string, fallback = "Manrope") =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : fallback;
  const readDataWeight = (key: string, fallback?: number) => {
    if (data[key] === "" || data[key] === null || data[key] === undefined) return fallback;
    const value = Number(data[key]);
    return Number.isFinite(value) ? Math.max(100, Math.min(900, Math.round(value))) : fallback;
  };
  const cardTextColor = (key: string, lightFallback: string, darkFallback: string) => {
    const sharedColor = readOptionalDataColor(key);
    return {
      light: readOptionalDataColor(`${key}Light`) || sharedColor || lightFallback,
      dark: readOptionalDataColor(`${key}Dark`) || sharedColor || darkFallback,
    };
  };
  const cardTextStyle = (
    key: string,
    lightFallback: string,
    darkFallback: string,
    sizeFallback: number,
    weightFallback?: number
  ): CSSProperties => {
    const color = cardTextColor(`${key}Color`, lightFallback, darkFallback);
    const desktopSize = readDataNumberValue(`${key}Size`, sizeFallback);
    const mobileSize = readDataNumberValue(
      `${key}MobileSize`,
      key === "specialistCardTitle"
        ? Math.max(15, Math.min(28, Math.round(desktopSize * 0.82)))
        : Math.max(12, Math.min(17, Math.round(desktopSize * 0.9)))
    );
    return {
      color: color.light,
      ["--card-dark-color" as string]: color.dark,
      ["--specialist-card-text-size-desktop" as string]: `${desktopSize}px`,
      ["--specialist-card-text-size-mobile" as string]: `${mobileSize}px`,
      fontSize: "var(--specialist-card-text-size)",
      fontFamily: readDataFont(`${key}Font`, "Manrope"),
      fontWeight: readDataWeight(`${key}Weight`, weightFallback),
    };
  };
  const specialistCardTitleTextStyle = cardTextStyle("specialistCardTitle", "#111827", "#F8FAFC", 18, 600);
  const specialistCardDescriptionTextStyle = cardTextStyle("specialistCardDescription", "#6B7280", "#CBD5E1", 14);
  const specialistsHeadingStyle = {
    ...headingStyle(style),
    textAlign: style.textAlignHeading ?? "center",
    color: "var(--services-heading-color,var(--site-text,var(--block-text,var(--bp-ink))))",
  };
  const specialistsSubheadingStyle = {
    ...subheadingStyle(style),
    textAlign: style.textAlignSubheading ?? "left",
    color: "var(--services-description-color,var(--site-muted,var(--block-muted,var(--bp-muted))))",
  };
  const specialistsButtonStyle = {
    ...buttonStyle(style),
    borderRadius: style.buttonRadius ?? 0,
  };

  return (
    <div
      className="mx-auto w-full"
      style={{
        width: "var(--works-content-width, 100%)",
        maxWidth: "100%",
        marginLeft: "var(--works-content-left, auto)",
        marginRight: 0,
      }}
    >
      <SpecialistsCatalog
        variant={block.variant === "v2" ? "v2" : "v1"}
        listView={listView}
        title={typeof data.title === "string" ? data.title : "Специалисты"}
        subtitle={subtitle}
        items={items}
        publicSlug={publicSlug}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        currentLocationId={currentLocationId}
        locationId={locationId}
        cardsPerRow={cardsPerRow}
        mobileCardsPerRow={mobileCardsPerRow}
        showCategoryTabs={data.showCategoryTabs !== false}
        categoryAllLabel={
          typeof data.categoryAllLabel === "string" && data.categoryAllLabel.trim()
            ? data.categoryAllLabel.trim()
            : "Все специалисты"
        }
        showSearch={data.showSearch !== false}
        searchPlaceholder={
          typeof data.searchPlaceholder === "string" && data.searchPlaceholder.trim()
            ? data.searchPlaceholder.trim()
            : "Поиск специалиста"
        }
        showSort={data.showSort !== false}
        defaultSort={
          typeof data.defaultSort === "string" && data.defaultSort.trim()
            ? data.defaultSort.trim()
            : "default"
        }
        searchSortAlignment={
          data.searchSortAlignment === "left" ||
          data.searchSortAlignment === "center" ||
          data.searchSortAlignment === "right"
            ? data.searchSortAlignment
            : "right"
        }
        filtersAlignment={
          data.filtersAlignment === "left" ||
          data.filtersAlignment === "center" ||
          data.filtersAlignment === "right"
            ? data.filtersAlignment
            : "left"
        }
        categoryTextColor={readOptionalDataColor("categoryTextColor")}
        categoryActiveColor={readOptionalDataColor("categoryActiveColor")}
        sortTextColor={readOptionalDataColor("sortTextColor")}
        sortActiveColor={readOptionalDataColor("sortActiveColor")}
        locationTextColor={readOptionalDataColor("locationTextColor")}
        locationActiveColor={readOptionalDataColor("locationActiveColor")}
        categoryTextColorDark={readOptionalDataColor("categoryTextColorDark")}
        categoryActiveColorDark={readOptionalDataColor("categoryActiveColorDark")}
        sortTextColorDark={readOptionalDataColor("sortTextColorDark")}
        sortActiveColorDark={readOptionalDataColor("sortActiveColorDark")}
        locationTextColorDark={readOptionalDataColor("locationTextColorDark")}
        locationActiveColorDark={readOptionalDataColor("locationActiveColorDark")}
        showLocationFilter={data.showLocationFilter !== false}
        showLevel={data.showLevel !== false}
        showDescription={data.showDescription !== false}
        showButton={showButton}
        buttonText={buttonText}
        buttonAlignment={buttonAlignment}
        showDetailsButton={showDetailsButton}
        detailsButtonText={detailsButtonText}
        detailsButtonColor={detailsButtonColor}
        detailsButtonTextColor={detailsButtonTextColor}
        detailsButtonBorderColor={detailsButtonBorderColor}
        detailsButtonColorDark={detailsButtonColorDark}
        detailsButtonTextColorDark={detailsButtonTextColorDark}
        detailsButtonBorderColorDark={detailsButtonBorderColorDark}
        showImage={data.showImage !== false}
        imageAspectRatio={imageAspectRatio}
        imageRadius={Number.isFinite(imageRadius) ? imageRadius : 0}
        imageFit={data.specialistCardImageFit === "contain" ? "contain" : "cover"}
        imageZoomOnHover={data.imageZoomOnHover !== false}
        imageZoomOnClick={data.specialistCardImageZoomOnClick === true}
        modalMediaColumns={specialistModalMediaColumns}
        modalInfoColumns={specialistModalInfoColumns}
        alignButtonsBottom={alignButtonsBottom}
        cardBackgroundColorLight={specialistCardBackgroundLight.backgroundColor}
        cardBackgroundImageLight={specialistCardBackgroundLight.backgroundImage}
        cardBackgroundColorDark={specialistCardBackgroundDark.backgroundColor}
        cardBackgroundImageDark={specialistCardBackgroundDark.backgroundImage}
        cardLiquidGlass={data.specialistCardLiquidGlass === true}
        cardTitleTextStyle={specialistCardTitleTextStyle}
        cardDescriptionTextStyle={specialistCardDescriptionTextStyle}
        cardClickEnabled={data.modalImageClickEnabled !== false}
        cardStyle={cardStyle}
        cardGapX={Number.isFinite(cardGapX) ? cardGapX : 20}
        cardGapY={Number.isFinite(cardGapY) ? cardGapY : 40}
        cardPaddingX={Number.isFinite(cardPaddingX) ? cardPaddingX : 30}
        cardPaddingY={Number.isFinite(cardPaddingY) ? cardPaddingY : 30}
        maxVisibleItems={Number.isFinite(maxVisibleItems) ? maxVisibleItems : 8}
        usePagination={data.usePagination === true}
        headingStyle={specialistsHeadingStyle}
        subheadingStyle={specialistsSubheadingStyle}
        buttonStyle={specialistsButtonStyle}
        textAlign={style.textAlign}
        ratingAlignment={
          data.ratingAlignment === "left" || data.ratingAlignment === "center" || data.ratingAlignment === "right"
            ? data.ratingAlignment
            : "right"
        }
        ratingVerticalAlignment={
          data.ratingVerticalAlignment === "top" || data.ratingVerticalAlignment === "bottom"
            ? data.ratingVerticalAlignment
            : undefined
        }
        ratingTextColor={readDataColor("ratingTextColorLight") || "#111827"}
        ratingTextColorDark={readDataColor("ratingTextColorDark") || readDataColor("ratingTextColorLight") || "#F8FAFC"}
        ratingStarColor={readDataColor("ratingStarColorLight") || "#ffb020"}
        ratingStarColorDark={readDataColor("ratingStarColorDark") || readDataColor("ratingStarColorLight") || "#ffb020"}
        ratingBackgroundColor={readDataColor("ratingBackgroundColorLight") || "transparent"}
        ratingBackgroundColorDark={
          readDataColor("ratingBackgroundColorDark") || readDataColor("ratingBackgroundColorLight") || "transparent"
        }
        ratingBackgroundOpacity={readDataNumberValue("ratingBackgroundOpacity", 50)}
        ratingBackgroundRadius={readDataNumberValue("ratingBackgroundRadius", 0)}
        ratingTextSize={readDataNumberValue("ratingTextSize", 16)}
        ratingTextFont={typeof data.ratingTextFont === "string" && data.ratingTextFont.trim() ? data.ratingTextFont : "Manrope"}
        ratingTextWeight={data.ratingTextWeight === "" || data.ratingTextWeight == null ? undefined : String(data.ratingTextWeight)}
      />
    </div>
  );
}

function renderPromos(
  block: SiteBlock,
  publicSlug: string,
  promos: PromoItem[],
  current: CurrentEntity
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
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} ?`}
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

function renderPublicReviewStars(rating: number, starColor = "#ff9f0a") {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div className="whitespace-nowrap leading-none" style={{ color: starColor }} aria-label={`Оценка ${safeRating} из 5`}>
      {"★".repeat(safeRating)}
      <span style={{ color: "#d9dee8" }}>{"★".repeat(Math.max(0, 5 - safeRating))}</span>
    </div>
  );
}

function renderReviews(block: SiteBlock, reviews: ReviewItem[], accountSlug: string, publicSlug: string, theme: SiteTheme) {
  const data = block.data as Record<string, unknown>;
  const style = normalizeStyle(block, theme);
  const limit = Math.max(1, Math.min(24, Number(data.limit) || 6));
  const visibleReviews = reviews.slice(0, limit);
  const extraReviews = reviews.slice(limit);
  const ratingCount = reviews.length;
  const ratingAvg = ratingCount > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount : 0;
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => review.rating === rating).length,
  }));
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const cardRadius = style.cardRadius ?? style.radius ?? 8;
  const buttonRadius = style.buttonRadius ?? 8;
  const cardBgLight = style.cardBgLight || style.subBlockBgLightResolved || "#ffffff";
  const cardBgDark = style.cardBgDark || style.subBlockBgDarkResolved || "#16181d";
  const cardBorderLight = style.cardBorderColorLight || "transparent";
  const cardBorderDark = style.cardBorderColorDark || "transparent";
  const textColorLight = style.textColorLightResolved || "#111827";
  const textColorDark = style.textColorDarkResolved || "#f8fafc";
  const mutedColorLight = style.mutedColorLightResolved || "#6b7280";
  const mutedColorDark = style.mutedColorDarkResolved || "#a1a5ad";
  const textColor = "var(--review-text)";
  const mutedColor = "var(--review-muted)";
  const visibleColor = (value: string | undefined, fallback: string) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.toLowerCase() !== "transparent" ? trimmed : fallback;
  };
  const starColorLight = visibleColor(style.secondaryButtonBgLight, "#ff9f0a");
  const starColorDark = visibleColor(style.secondaryButtonBgDark, starColorLight);
  const ratingTrackColorLight = visibleColor(style.fieldBorderColorLight, "#e2e8f0");
  const ratingTrackColorDark = visibleColor(style.fieldBorderColorDark, "#303642");
  const starColor = "var(--review-star)";
  const ratingTrackColor = "var(--review-track)";
  const buttonBgLight = style.buttonColorLightResolved || "#111827";
  const buttonBgDark = style.buttonColorDarkResolved || "#f8fafc";
  const buttonTextLight = style.buttonTextColorLightResolved || "#ffffff";
  const buttonTextDark = style.buttonTextColorDarkResolved || "#111827";
  const buttonBg = "var(--review-button-bg)";
  const buttonText = "var(--review-button-text)";
  const reviewThemeStyle = {
    "--review-card-bg-light": cardBgLight,
    "--review-card-bg-dark": cardBgDark,
    "--review-card-border-light": cardBorderLight,
    "--review-card-border-dark": cardBorderDark,
    "--review-text-light": textColorLight,
    "--review-text-dark": textColorDark,
    "--review-muted-light": mutedColorLight,
    "--review-muted-dark": mutedColorDark,
    "--review-star-light": starColorLight,
    "--review-star-dark": starColorDark,
    "--review-track-light": ratingTrackColorLight,
    "--review-track-dark": ratingTrackColorDark,
    "--review-button-bg-light": buttonBgLight,
    "--review-button-bg-dark": buttonBgDark,
    "--review-button-text-light": buttonTextLight,
    "--review-button-text-dark": buttonTextDark,
  } as CSSProperties;
  const cardStyle = {
    backgroundColor: "var(--review-card-bg)",
    borderColor: "var(--review-card-border)",
    borderRadius: cardRadius,
    color: textColor,
  } as CSSProperties;
  const entityLinkStyle = { color: "#2563eb" };
  const renderReviewServices = (review: ReviewItem) => {
    const numericEntityId = review.entityId ? Number(review.entityId) : null;
    const fallbackServiceId =
      review.entityType === "service" && Number.isFinite(numericEntityId) ? numericEntityId : null;
    const services = review.services?.length
      ? review.services
      : fallbackServiceId && review.servicesLabel
        ? [{ id: fallbackServiceId, name: review.servicesLabel }]
        : [];

    if (services.length > 0) {
      return (
        <div className="mt-5 flex flex-wrap gap-x-2 gap-y-1 text-xs uppercase tracking-wide">
          {services.map((service, index) => (
            <span key={`${service.id}-${index}`}>
              {index > 0 ? <span style={{ color: mutedColor }}>, </span> : null}
              <Link href={`/${publicSlug}/services/${service.id}`} style={{ ...entityLinkStyle, color: mutedColor }}>
                {service.name}
              </Link>
            </span>
          ))}
        </div>
      );
    }

    return review.servicesLabel ? (
      <div className="mt-5 text-xs uppercase tracking-wide" style={{ color: mutedColor }}>
        {review.servicesLabel}
      </div>
    ) : null;
  };
  const renderReviewCard = (review: ReviewItem) => (
    <article key={review.id} className="border p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" style={cardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{review.clientName}</div>
          <div className="mt-1 text-xs" style={{ color: mutedColor }}>
            {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(review.createdAt))}
          </div>
        </div>
        {renderPublicReviewStars(review.rating, starColor)}
      </div>
      {renderReviewServices(review)}
      {review.specialistName ? (
        review.specialistId ? (
          <Link href={`/${publicSlug}/specialists/${review.specialistId}`} className="mt-1 block text-sm" style={entityLinkStyle}>
            {review.specialistName}
          </Link>
        ) : (
          <div className="mt-1 text-sm" style={entityLinkStyle}>{review.specialistName}</div>
        )
      ) : null}
      {review.locationName ? (
        review.locationId ? (
          <Link href={`/${publicSlug}/locations/${review.locationId}`} className="mt-1 block text-xs" style={{ color: mutedColor }}>
            {review.locationName}
          </Link>
        ) : (
          <div className="mt-1 text-xs" style={{ color: mutedColor }}>{review.locationName}</div>
        )
      ) : null}
      {review.comment ? <p className="mt-5 leading-6" style={{ fontSize: "var(--block-text-size)" }}>{review.comment}</p> : null}
      {review.replyText ? (
        <div className="mt-5 border-l-2 border-slate-200 pl-4 text-sm" style={{ color: mutedColor }}>
          <div className="font-semibold" style={{ color: textColor }}>Ответ салона</div>
          <div className="mt-1">{review.replyText}</div>
        </div>
      ) : null}
    </article>
  );

  return (
    <div className="site-review-theme" style={reviewThemeStyle}>
      <h2 className="font-semibold" style={headingStyle(style)}>
        {(data.title as string) || "Отзывы"}
      </h2>
      {subtitle ? <p className="mt-2" style={subheadingStyle(style)}>{subtitle}</p> : null}
      <div className="mt-5 grid max-h-[900px] items-start gap-5 overflow-y-auto pr-2 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="h-[300px] self-start overflow-hidden border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" style={cardStyle}>
          <div className="flex items-baseline gap-1 leading-none">
            <span className="text-3xl font-semibold leading-none">{ratingAvg ? ratingAvg.toFixed(1) : "0.0"}</span>
            <span className="text-xl font-semibold leading-none" style={{ color: "#cbd5e1" }}>/5</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: mutedColor }}>{ratingCount} отзывов</div>
          <div className="mt-4 space-y-2">
            {distribution.map((item) => (
              <div key={item.rating} className="flex items-center gap-2 text-xs">
                <span className="w-20 whitespace-nowrap leading-none" style={{ color: starColor }}>{"★".repeat(item.rating)}</span>
                <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: ratingTrackColor }}>
                  <div className="h-full rounded-full" style={{ width: `${ratingCount ? (item.count / ratingCount) * 100 : 0}%`, backgroundColor: starColor }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 text-xs leading-5" style={{ color: mutedColor }}>
            Чтобы оставлять отзывы, вам необходимо авторизоваться
          </div>
          <PublicReviewAuthModal
            accountSlug={accountSlug}
            buttonLabel="Авторизоваться"
            buttonClassName="mt-3 inline-flex w-full items-center justify-center px-4 py-3 text-sm font-semibold"
            buttonStyle={{ borderRadius: buttonRadius, backgroundColor: buttonBg, color: buttonText }}
            modalStyle={{ backgroundColor: "var(--review-card-bg)", borderRadius: cardRadius }}
            modalTextColor={textColor}
            modalMutedColor={mutedColor}
            modalButtonStyle={{ borderRadius: buttonRadius, backgroundColor: buttonBg, color: buttonText }}
            modalFieldStyle={{ borderRadius: cardRadius }}
            starColor={starColor}
          />
        </aside>

        <div className="space-y-3">
          {visibleReviews.length > 0 ? (
            visibleReviews.map(renderReviewCard)
          ) : (
            <div className="border p-5 text-sm shadow-[0_10px_28px_rgba(15,23,42,0.06)]" style={{ ...cardStyle, color: mutedColor }}>
              Отзывы будут отображаться здесь после их появления.
            </div>
          )}
          {extraReviews.length > 0 ? (
            <details className="group">
              <summary className="mt-4 inline-flex cursor-pointer list-none items-center justify-center px-5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden" style={{ borderRadius: buttonRadius, backgroundColor: buttonBg, color: buttonText }}>
                Показать еще
              </summary>
              <div className="mt-3 space-y-3">{extraReviews.map(renderReviewCard)}</div>
            </details>
          ) : null}
        </div>
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


