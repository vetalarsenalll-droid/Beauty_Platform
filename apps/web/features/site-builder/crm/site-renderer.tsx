import { UnoptimizedImage } from "@/components/unoptimized-image";
import * as React from "react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  SiteAishaWidgetConfig,
  SiteBlock,
  SiteLoaderConfig,
  SitePageKey,
  SiteTheme,
} from "@/lib/site-builder";
import { buildBookingLink } from "@/lib/booking-links";
import MenuSearch from "@/components/menu-search";
import BookingClient from "@/app/booking/booking-client";
import SiteLoader from "@/components/site-loader";
import GallerySlider from "@/components/gallery-slider";
import PublicReviewAuthModal from "@/components/public-review-auth-modal";
import ReviewPhotoGallery from "@/components/review-photo-gallery";
import PublicAiChatWidget from "@/components/public-ai-chat-widget";
import {
  resolveCoverBackgroundVisual,
  resolveLocationCardBackgroundVisual,
  resolveMenuBlockBackgroundVisual,
  resolveMenuSectionBackgroundVisual,
  resolveServiceCardBackgroundVisual,
  resolveServiceModalBackgroundVisual,
  resolveServicesSectionBackgroundVisual,
  resolveSpecialistCardBackgroundVisual,
} from "@/features/site-builder/shared/background-visuals";
import { ServicesCatalog } from "@/features/site-builder/blocks/services/services-catalog";
import { SpecialistsCatalog } from "@/features/site-builder/blocks/specialists/specialists-catalog";
import { LocationsCatalog } from "@/features/site-builder/blocks/locations/locations-catalog";
import type {
  SiteAccountInfoWithPublicSlug as AccountInfo,
  SiteBranding as Branding,
  SiteEditorAccountProfile as AccountProfile,
  SiteLocationItem as LocationItem,
  SiteLegalDocumentItem as LegalDocumentItem,
  SitePromoItem as PromoItem,
  SiteReviewItem as ReviewItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
  SiteWorkPhotos as WorkPhotos,
} from "@/features/site-builder/shared/site-data";
import {
  BLOCK_OFFSET_STEP_PX,
  BOOKING_MAX_BLOCK_COLUMNS,
  BLOCK_WIDTH_STEP,
  COVER_BACKGROUND_POSITION_VALUES,
  DEFAULT_BLOCK_COLUMNS,
  DEFAULT_BLOCK_WIDTH,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  MAX_BLOCK_WIDTH,
  MIN_BLOCK_WIDTH,
  PAGE_KEYS,
  PAGE_LABELS,
  SOCIAL_ICONS,
  SOCIAL_LABELS,
  bookingCardsPerRow,
  bookingContentColumns,
  centeredGridRange,
  clamp01,
  clampBlockColumns,
  clampGridColumn,
  hexToRgbaString,
  parseBackdropColor,
} from "./site-client-core";
import type { CurrentEntity } from "./site-client-core";

export type BlockStyle = {
  marginTop: number;
  marginBottom: number;
  blockWidth: number | null;
  blockWidthColumns: number | null;
  mobileBlockWidthColumns: number | null;
  gridStartColumn: number | null;
  gridEndColumn: number | null;
  useCustomWidth: boolean;
  radius: number | null;
  buttonRadius: number | null;
  cardRadius?: number | null;
  authPageBg?: string;
  authBlockBg?: string;
  authSideBg?: string;
  authRightBg?: string;
  authBlockHeight?: number | null;
  authRadius?: number | null;
  authButtonRadius?: number | null;
  authFieldRadius?: number | null;
  authHintRadius?: number | null;
  cabinetPageBg?: string;
  cabinetBlockBg?: string;
  cabinetRadius?: number | null;
  cabinetButtonRadius?: number | null;
  bookingImageRadius?: number | null;
  sectionBgLight: string;
  sectionBgDark: string;
  sectionBg: string;
  blockBgLight: string;
  blockBgDark: string;
  blockBg: string;
  subBlockBgLight: string;
  subBlockBgDark: string;
  subBlockBg: string;
  borderColorLight: string;
  borderColorDark: string;
  borderColor: string;
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
  bookingNavSecondaryBgLight?: string;
  bookingNavSecondaryBgDark?: string;
  bookingNavSecondaryTextColorLight?: string;
  bookingNavSecondaryTextColorDark?: string;
  bookingNavSecondaryBorderColorLight?: string;
  bookingNavSecondaryBorderColorDark?: string;
  bookingScenarioBgLight?: string;
  bookingScenarioBgDark?: string;
  bookingScenarioTextColorLight?: string;
  bookingScenarioTextColorDark?: string;
  bookingScenarioBorderColorLight?: string;
  bookingScenarioBorderColorDark?: string;
  bookingScenarioActiveBgLight?: string;
  bookingScenarioActiveBgDark?: string;
  bookingScenarioActiveTextColorLight?: string;
  bookingScenarioActiveTextColorDark?: string;
  bookingScenarioActiveBorderColorLight?: string;
  bookingScenarioActiveBorderColorDark?: string;
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
  buttonColorLight: string;
  buttonColorDark: string;
  buttonColor: string;
  buttonTextColorLight: string;
  buttonTextColorDark: string;
  buttonTextColor: string;
  textColorLight: string;
  textColorDark: string;
  textColor: string;
  mutedColorLight: string;
  mutedColorDark: string;
  mutedColor: string;
  servicesHeadingColorLight: string;
  servicesHeadingColorDark: string;
  servicesHeadingColor: string;
  servicesDescriptionColorLight: string;
  servicesDescriptionColorDark: string;
  servicesDescriptionColor: string;
  assistantBubbleColorLight: string;
  assistantBubbleColorDark: string;
  assistantBubbleColor: string;
  assistantTextColorLight: string;
  assistantTextColorDark: string;
  assistantTextColor: string;
  clientBubbleColorLight: string;
  clientBubbleColorDark: string;
  clientBubbleColor: string;
  clientTextColorLight: string;
  clientTextColorDark: string;
  clientTextColor: string;
  headerBgColorLight: string;
  headerBgColorDark: string;
  headerBgColor: string;
  headerTextColorLight: string;
  headerTextColorDark: string;
  headerTextColor: string;
  quickReplyButtonColorLight: string;
  quickReplyButtonColorDark: string;
  quickReplyButtonColor: string;
  quickReplyTextColorLight: string;
  quickReplyTextColorDark: string;
  quickReplyTextColor: string;
  messageRadius: number | null;
  shadowColor: string;
  shadowSize: number | null;
  gradientEnabled: boolean;
  gradientEnabledLight: boolean;
  gradientEnabledDark: boolean;
  gradientDirection: "vertical" | "horizontal";
  gradientDirectionLight: "vertical" | "horizontal";
  gradientDirectionDark: "vertical" | "horizontal";
  gradientModeLight?: "solid" | "linear" | "radial";
  gradientModeDark?: "solid" | "linear" | "radial";
  gradientAngleLight?: number;
  gradientAngleDark?: number;
  gradientStopALight?: number;
  gradientStopADark?: number;
  gradientStopBLight?: number;
  gradientStopBDark?: number;
  gradientFrom: string;
  gradientTo: string;
  gradientFromLight: string;
  gradientToLight: string;
  gradientFromDark: string;
  gradientToDark: string;
  gradientFromLightResolved: string;
  gradientToLightResolved: string;
  gradientFromDarkResolved: string;
  gradientToDarkResolved: string;
  servicesSectionBackgroundModeLight: "solid" | "linear" | "radial";
  servicesSectionBackgroundModeDark: "solid" | "linear" | "radial";
  servicesSectionBackgroundFromLight: string;
  servicesSectionBackgroundFromDark: string;
  servicesSectionBackgroundToLight: string;
  servicesSectionBackgroundToDark: string;
  servicesSectionBackgroundAngleLight: number;
  servicesSectionBackgroundAngleDark: number;
  servicesSectionBackgroundStopALight: number;
  servicesSectionBackgroundStopADark: number;
  servicesSectionBackgroundStopBLight: number;
  servicesSectionBackgroundStopBDark: number;
  textAlign: "left" | "center" | "right";
  textAlignHeading: "left" | "center" | "right";
  textAlignSubheading: "left" | "center" | "right";
  fontHeading: string;
  fontSubheading: string;
  fontBody: string;
  fontWeightHeading: number | null;
  fontWeightSubheading: number | null;
  fontWeightBody: number | null;
  headingSize: number | null;
  subheadingSize: number | null;
  textSize: number | null;
  mobileHeadingSize: number | null;
  mobileSubheadingSize: number | null;
  mobileTextSize: number | null;
  sectionBgLightResolved: string;
  sectionBgDarkResolved: string;
  blockBgLightResolved: string;
  blockBgDarkResolved: string;
  subBlockBgLightResolved: string;
  subBlockBgDarkResolved: string;
  borderColorLightResolved: string;
  borderColorDarkResolved: string;
  buttonColorLightResolved: string;
  buttonColorDarkResolved: string;
  buttonTextColorLightResolved: string;
  buttonTextColorDarkResolved: string;
  textColorLightResolved: string;
  textColorDarkResolved: string;
  mutedColorLightResolved: string;
  mutedColorDarkResolved: string;
  servicesHeadingColorLightResolved: string;
  servicesHeadingColorDarkResolved: string;
  servicesDescriptionColorLightResolved: string;
  servicesDescriptionColorDarkResolved: string;
  assistantBubbleColorLightResolved: string;
  assistantBubbleColorDarkResolved: string;
  assistantTextColorLightResolved: string;
  assistantTextColorDarkResolved: string;
  clientBubbleColorLightResolved: string;
  clientBubbleColorDarkResolved: string;
  clientTextColorLightResolved: string;
  clientTextColorDarkResolved: string;
  headerBgColorLightResolved: string;
  headerBgColorDarkResolved: string;
  headerTextColorLightResolved: string;
  headerTextColorDarkResolved: string;
  quickReplyButtonColorLightResolved: string;
  quickReplyButtonColorDarkResolved: string;
  quickReplyTextColorLightResolved: string;
  quickReplyTextColorDarkResolved: string;
};

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

export function isValidColorValue(value: string): boolean {
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

export function isLightShadowColor(value: string): boolean {
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

function resolveClientPageBackground(block: SiteBlock, theme: SiteTheme) {
  const data = block.data as Record<string, unknown>;
  const rawStyle =
    data.style && typeof data.style === "object" ? (data.style as Record<string, unknown>) : {};
  const view =
    block.type === "clientCabinet" || data.clientView === "cabinet" ? "cabinet" : "login";
  const prefix = view === "cabinet" ? "cabinetPageBg" : "authPageBg";
  const fallback = theme.mode === "dark"
    ? view === "cabinet" ? "#0f1012" : "#0f1012"
    : view === "cabinet" ? "#eef2f7" : "#f3f4f6";
  const suffix = theme.mode === "dark" ? "Dark" : "Light";
  const legacyKey = theme.mode === "dark" ? `${prefix}Dark` : prefix;
  const readColor = (key: string, colorFallback: string) => {
    const value = rawStyle[key];
    return typeof value === "string" && value.trim() ? value.trim() : colorFallback;
  };
  const readNumber = (key: string, numberFallback: number) => {
    const value = Number(rawStyle[key]);
    return Number.isFinite(value) ? Math.round(value) : numberFallback;
  };
  const modeRaw = rawStyle[`${prefix}Mode${suffix}`];
  const mode = modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
  const from = readColor(`${prefix}From${suffix}`, readColor(legacyKey, fallback));
  const to = readColor(`${prefix}To${suffix}`, from);
  const angle = readNumber(`${prefix}Angle${suffix}`, 135);
  const stopA = Math.max(0, Math.min(100, readNumber(`${prefix}StopA${suffix}`, 0)));
  const stopB = Math.max(0, Math.min(100, readNumber(`${prefix}StopB${suffix}`, 100)));

  if (mode === "linear") {
    return {
      backgroundColor: from,
      backgroundImage: `linear-gradient(${angle}deg, ${from} ${stopA}%, ${to} ${stopB}%)`,
    };
  }
  if (mode === "radial") {
    return {
      backgroundColor: from,
      backgroundImage: `radial-gradient(circle, ${from} ${stopA}%, ${to} ${stopB}%)`,
    };
  }
  return { backgroundColor: from, backgroundImage: "none" };
}

export function normalizeBlockStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
  const style = (block.data.style as Record<string, unknown>) ?? {};
  const isServicesBlock = block.type === "services" || block.type === "specialists" || block.type === "locations";
  const toNumber = (value: unknown) => {
    const parsed =
      typeof value === "string" ? Number(value) : (value as number | null | undefined);
    return Number.isFinite(parsed) ? (parsed as number) : null;
  };
  const toFontWeight = (value: unknown) => {
    const parsed = toNumber(value);
    if (parsed === null) return null;
    const rounded = Math.round(parsed / 100) * 100;
    if (rounded < 100 || rounded > 900) return null;
    return rounded;
  };
  const readColor = (key: string) =>
    typeof style[key] === "string" ? (style[key] as string) : "";
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
  const sectionBackgroundNumber = (suffix: string) => toNumber(sectionBackgroundValue(suffix));
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
  const isBookingBlock = block.type === "booking";
  const sectionFallbackLight = isBookingBlock ? "transparent" : theme.lightPalette.panelColor;
  const sectionFallbackDark = isBookingBlock ? "transparent" : theme.darkPalette.panelColor;
  const blockBgPair = resolvePair(
    "blockBgLight",
    "blockBgDark",
    "blockBg",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const sectionBgPair = resolvePair(
    "sectionBgLight",
    "sectionBgDark",
    "sectionBg",
    sectionFallbackLight,
    sectionFallbackDark
  );
  const subBlockBgPair = resolvePair(
    "subBlockBgLight",
    "subBlockBgDark",
    "subBlockBg",
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
  const buttonColorLightRaw = readColor("buttonColorLight");
  const buttonColorDarkRaw = readColor("buttonColorDark");
  const buttonTextColorDarkRaw = readColor("buttonTextColorDark");
  const normalizedButtonColorLightRaw =
    isCoverBlock && buttonColorLightRaw.trim().toLowerCase() === "#111827"
      ? "#000000"
      : buttonColorLightRaw;
  const buttonColorLegacyRaw = readColor("buttonColor");
  const normalizedButtonColorLegacyRaw =
    isCoverBlock && buttonColorLegacyRaw.trim().toLowerCase() === "#111827"
      ? "#000000"
      : buttonColorLegacyRaw;
  const normalizedButtonColorDarkRaw =
    isCoverBlock && buttonColorDarkRaw.trim().toLowerCase() === "#d3d6db"
      ? "#000000"
      : buttonColorDarkRaw;
  const normalizedButtonTextColorDarkRaw =
    isCoverBlock && buttonTextColorDarkRaw.trim().toLowerCase() === "#0f1012"
      ? "#ffffff"
      : buttonTextColorDarkRaw;
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
  const assistantBubblePair = resolvePair(
    "assistantBubbleColorLight",
    "assistantBubbleColorDark",
    "assistantBubbleColor",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const assistantTextPair = resolvePair(
    "assistantTextColorLight",
    "assistantTextColorDark",
    "assistantTextColor",
    theme.lightPalette.textColor,
    theme.darkPalette.textColor
  );
  const clientBubblePair = resolvePair(
    "clientBubbleColorLight",
    "clientBubbleColorDark",
    "clientBubbleColor",
    theme.lightPalette.buttonColor,
    theme.darkPalette.buttonColor
  );
  const clientTextPair = resolvePair(
    "clientTextColorLight",
    "clientTextColorDark",
    "clientTextColor",
    theme.lightPalette.buttonTextColor,
    theme.darkPalette.buttonTextColor
  );
  const headerBgPair = resolvePair(
    "headerBgColorLight",
    "headerBgColorDark",
    "headerBgColor",
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
  );
  const headerTextPair = resolvePair(
    "headerTextColorLight",
    "headerTextColorDark",
    "headerTextColor",
    theme.lightPalette.textColor,
    theme.darkPalette.textColor
  );
  const quickReplyButtonPair = resolvePair(
    "quickReplyButtonColorLight",
    "quickReplyButtonColorDark",
    "quickReplyButtonColor",
    theme.lightPalette.buttonColor,
    theme.darkPalette.buttonColor
  );
  const quickReplyTextPair = resolvePair(
    "quickReplyTextColorLight",
    "quickReplyTextColorDark",
    "quickReplyTextColor",
    theme.lightPalette.buttonTextColor,
    theme.darkPalette.buttonTextColor
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
  const gradientFromLightRaw = readColor("gradientFromLight") || readColor("gradientFrom");
  const gradientToLightRaw = readColor("gradientToLight") || readColor("gradientTo");
  const gradientFromDarkRaw = readColor("gradientFromDark");
  const gradientToDarkRaw = readColor("gradientToDark");
  const gradientFromLightResolved = gradientFromLightRaw || theme.lightPalette.gradientFrom;
  const gradientToLightResolved = gradientToLightRaw || theme.lightPalette.gradientTo;
  const gradientFromDarkResolved = gradientFromDarkRaw || theme.darkPalette.gradientFrom;
  const gradientToDarkResolved = gradientToDarkRaw || theme.darkPalette.gradientTo;
  const gradientEnabled = theme.mode === "dark" ? gradientEnabledDark : gradientEnabledLight;
  const gradientDirection = theme.mode === "dark" ? gradientDirectionDark : gradientDirectionLight;
  const gradientFrom = theme.mode === "dark" ? gradientFromDarkResolved : gradientFromLightResolved;
  const gradientTo = theme.mode === "dark" ? gradientToDarkResolved : gradientToLightResolved;
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
  const servicesSectionBackgroundFromLightRaw =
    sectionBackgroundColor("FromLight") || readColor("sectionBgLight") || readColor("sectionBg");
  const servicesSectionBackgroundFromDarkRaw =
    sectionBackgroundColor("FromDark") || readColor("sectionBgDark");
  const servicesSectionBackgroundToLightRaw = sectionBackgroundColor("ToLight");
  const servicesSectionBackgroundToDarkRaw = sectionBackgroundColor("ToDark");
  const servicesSectionBackgroundFromLight = servicesSectionBackgroundFromLightRaw || sectionFallbackLight;
  const servicesSectionBackgroundFromDark = servicesSectionBackgroundFromDarkRaw || sectionFallbackDark;
  const servicesSectionBackgroundToLight = servicesSectionBackgroundToLightRaw || servicesSectionBackgroundFromLight;
  const servicesSectionBackgroundToDark = servicesSectionBackgroundToDarkRaw || servicesSectionBackgroundFromDark;
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
  const rawBlockWidth = toNumber(style.blockWidth);
  const rawBlockWidthColumns = toNumber(style.blockWidthColumns);
  const rawMobileBlockWidthColumns = toNumber(style.mobileBlockWidthColumns);
  const rawGridStartColumn = toNumber(style.gridStartColumn);
  const rawGridEndColumn = toNumber(style.gridEndColumn);
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
  const explicitGridEndRaw = hasExplicitGrid ? clampGridColumn(rawGridEndColumn as number) : null;
  const explicitGridEnd =
    explicitGridStart !== null && explicitGridEndRaw !== null
      ? Math.max(explicitGridStart, explicitGridEndRaw)
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
    const parsed = toNumber(value);
    return parsed === null ? fallback : Math.max(0, Math.min(360, parsed));
  };
  const clampStop = (value: unknown, fallback: number) => {
    const parsed = toNumber(value);
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
  const bookingNavSecondaryBgPair = resolvePair(
    "bookingNavSecondaryBgLight",
    "bookingNavSecondaryBgDark",
    "bookingNavSecondaryBg",
    secondaryButtonBgPair.lightResolved,
    secondaryButtonBgPair.darkResolved
  );
  const bookingNavSecondaryTextPair = resolvePair(
    "bookingNavSecondaryTextColorLight",
    "bookingNavSecondaryTextColorDark",
    "bookingNavSecondaryTextColor",
    secondaryButtonTextPair.lightResolved,
    secondaryButtonTextPair.darkResolved
  );
  const bookingNavSecondaryBorderPair = resolvePair(
    "bookingNavSecondaryBorderColorLight",
    "bookingNavSecondaryBorderColorDark",
    "bookingNavSecondaryBorderColor",
    secondaryButtonBorderPair.lightResolved,
    secondaryButtonBorderPair.darkResolved
  );
  const bookingScenarioBgPair = resolvePair("bookingScenarioBgLight", "bookingScenarioBgDark", "bookingScenarioBg", subBlockBgPair.lightResolved, subBlockBgPair.darkResolved);
  const bookingScenarioTextPair = resolvePair("bookingScenarioTextColorLight", "bookingScenarioTextColorDark", "bookingScenarioTextColor", mutedPair.lightResolved, mutedPair.darkResolved);
  const bookingScenarioBorderPair = resolvePair("bookingScenarioBorderColorLight", "bookingScenarioBorderColorDark", "bookingScenarioBorderColor", "transparent", "transparent");
  const bookingScenarioActiveBgPair = resolvePair("bookingScenarioActiveBgLight", "bookingScenarioActiveBgDark", "bookingScenarioActiveBg", buttonPairResolved.lightResolved, buttonPairResolved.darkResolved);
  const bookingScenarioActiveTextPair = resolvePair("bookingScenarioActiveTextColorLight", "bookingScenarioActiveTextColorDark", "bookingScenarioActiveTextColor", buttonTextPairResolved.lightResolved, buttonTextPairResolved.darkResolved);
  const bookingScenarioActiveBorderPair = resolvePair("bookingScenarioActiveBorderColorLight", "bookingScenarioActiveBorderColorDark", "bookingScenarioActiveBorderColor", primaryButtonBorderPair.lightResolved, primaryButtonBorderPair.darkResolved);
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
    const parsed = toNumber(style[key]);
    return parsed === null ? fallback : Math.max(min, Math.min(max, Math.round(parsed)));
  };
  const bookingCardWeight = (key: string, fallback: number | null) => {
    const parsed = toNumber(style[key]);
    return parsed === null ? fallback : Math.max(100, Math.min(900, Math.round(parsed)));
  };
  const cardBackgroundModeLight = readBackgroundMode("cardBackgroundModeLight");
  const cardBackgroundModeDark = readBackgroundMode("cardBackgroundModeDark", cardBackgroundModeLight);
  const fieldBackgroundModeLight = readBackgroundMode("fieldBackgroundModeLight");
  const fieldBackgroundModeDark = readBackgroundMode("fieldBackgroundModeDark", fieldBackgroundModeLight);
  const gradientModeLight = readBackgroundMode("gradientModeLight", gradientEnabledLight ? "linear" : "solid");
  const gradientModeDark = readBackgroundMode("gradientModeDark", gradientEnabledDark ? gradientModeLight : "solid");
  return {
    marginTop: toNumber(style.marginTop) ?? 0,
    marginBottom: toNumber(style.marginBottom) ?? 0,
    blockWidth: useCustomWidth ? normalizedBlockWidth ?? DEFAULT_BLOCK_WIDTH : null,
    blockWidthColumns: useCustomWidth ? resolvedColumnsFromGrid : null,
    mobileBlockWidthColumns: normalizedMobileBlockWidthColumns,
    gridStartColumn: useCustomWidth ? resolvedGridStart : null,
    gridEndColumn: useCustomWidth ? resolvedGridEnd : null,
    useCustomWidth,
    radius: block.type === "menu" ? 0 : toNumber(style.radius),
    buttonRadius: block.type === "menu" ? 0 : toNumber(style.buttonRadius),
    cardRadius: toNumber(style.cardRadius),
    bookingImageRadius: toNumber(style.bookingImageRadius),
    sectionBgLight: readColor("sectionBgLight") || readColor("sectionBg"),
    sectionBgDark: readColor("sectionBgDark"),
    sectionBg: resolveColor("sectionBgLight", "sectionBgDark", "sectionBg"),
    blockBgLight: readColor("blockBgLight") || readColor("blockBg"),
    blockBgDark: readColor("blockBgDark"),
    blockBg: resolveColor("blockBgLight", "blockBgDark", "blockBg"),
    subBlockBgLight: readColor("subBlockBgLight") || readColor("subBlockBg"),
    subBlockBgDark: readColor("subBlockBgDark"),
    subBlockBg: resolveColor("subBlockBgLight", "subBlockBgDark", "subBlockBg"),
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
    bookingNavSecondaryBgLight: bookingNavSecondaryBgPair.lightResolved,
    bookingNavSecondaryBgDark: bookingNavSecondaryBgPair.darkResolved,
    bookingNavSecondaryTextColorLight: bookingNavSecondaryTextPair.lightResolved,
    bookingNavSecondaryTextColorDark: bookingNavSecondaryTextPair.darkResolved,
    bookingNavSecondaryBorderColorLight: bookingNavSecondaryBorderPair.lightResolved,
    bookingNavSecondaryBorderColorDark: bookingNavSecondaryBorderPair.darkResolved,
    bookingScenarioBgLight: bookingScenarioBgPair.lightResolved,
    bookingScenarioBgDark: bookingScenarioBgPair.darkResolved,
    bookingScenarioTextColorLight: bookingScenarioTextPair.lightResolved,
    bookingScenarioTextColorDark: bookingScenarioTextPair.darkResolved,
    bookingScenarioBorderColorLight: bookingScenarioBorderPair.lightResolved,
    bookingScenarioBorderColorDark: bookingScenarioBorderPair.darkResolved,
    bookingScenarioActiveBgLight: bookingScenarioActiveBgPair.lightResolved,
    bookingScenarioActiveBgDark: bookingScenarioActiveBgPair.darkResolved,
    bookingScenarioActiveTextColorLight: bookingScenarioActiveTextPair.lightResolved,
    bookingScenarioActiveTextColorDark: bookingScenarioActiveTextPair.darkResolved,
    bookingScenarioActiveBorderColorLight: bookingScenarioActiveBorderPair.lightResolved,
    bookingScenarioActiveBorderColorDark: bookingScenarioActiveBorderPair.darkResolved,
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
    buttonColorLight: normalizedButtonColorLightRaw || normalizedButtonColorLegacyRaw,
    buttonColorDark: normalizedButtonColorDarkRaw,
    buttonColor:
      theme.mode === "dark"
        ? buttonPairResolved.darkResolved || buttonPairResolved.lightResolved
        : buttonPairResolved.lightResolved || buttonPairResolved.darkResolved,
    buttonTextColorLight:
      readColor("buttonTextColorLight") || readColor("buttonTextColor"),
    buttonTextColorDark: normalizedButtonTextColorDarkRaw,
    buttonTextColor:
      theme.mode === "dark"
        ? buttonTextPairResolved.darkResolved || buttonTextPairResolved.lightResolved
        : buttonTextPairResolved.lightResolved || buttonTextPairResolved.darkResolved,
    textColorLight: readColor("textColorLight") || readColor("textColor"),
    textColorDark: readColor("textColorDark"),
    textColor: resolveColor("textColorLight", "textColorDark", "textColor"),
    mutedColorLight: readColor("mutedColorLight") || readColor("mutedColor"),
    mutedColorDark: readColor("mutedColorDark"),
    mutedColor: resolveColor("mutedColorLight", "mutedColorDark", "mutedColor"),
    servicesHeadingColorLight:
      readColor("servicesHeadingColorLight") || readColor("servicesHeadingColor"),
    servicesHeadingColorDark: readColor("servicesHeadingColorDark"),
    servicesHeadingColor:
      theme.mode === "dark"
        ? servicesHeadingPair.darkResolved || servicesHeadingPair.lightResolved
        : servicesHeadingPair.lightResolved || servicesHeadingPair.darkResolved,
    servicesDescriptionColorLight:
      readColor("servicesDescriptionColorLight") || readColor("servicesDescriptionColor"),
    servicesDescriptionColorDark: readColor("servicesDescriptionColorDark"),
    servicesDescriptionColor:
      theme.mode === "dark"
        ? servicesDescriptionPair.darkResolved || servicesDescriptionPair.lightResolved
        : servicesDescriptionPair.lightResolved || servicesDescriptionPair.darkResolved,
    assistantBubbleColorLight:
      readColor("assistantBubbleColorLight") || readColor("assistantBubbleColor"),
    assistantBubbleColorDark: readColor("assistantBubbleColorDark"),
    assistantBubbleColor: resolveColor(
      "assistantBubbleColorLight",
      "assistantBubbleColorDark",
      "assistantBubbleColor"
    ),
    assistantTextColorLight:
      readColor("assistantTextColorLight") || readColor("assistantTextColor"),
    assistantTextColorDark: readColor("assistantTextColorDark"),
    assistantTextColor: resolveColor(
      "assistantTextColorLight",
      "assistantTextColorDark",
      "assistantTextColor"
    ),
    clientBubbleColorLight:
      readColor("clientBubbleColorLight") || readColor("clientBubbleColor"),
    clientBubbleColorDark: readColor("clientBubbleColorDark"),
    clientBubbleColor: resolveColor(
      "clientBubbleColorLight",
      "clientBubbleColorDark",
      "clientBubbleColor"
    ),
    clientTextColorLight:
      readColor("clientTextColorLight") || readColor("clientTextColor"),
    clientTextColorDark: readColor("clientTextColorDark"),
    clientTextColor: resolveColor(
      "clientTextColorLight",
      "clientTextColorDark",
      "clientTextColor"
    ),
    headerBgColorLight: readColor("headerBgColorLight") || readColor("headerBgColor"),
    headerBgColorDark: readColor("headerBgColorDark"),
    headerBgColor: resolveColor("headerBgColorLight", "headerBgColorDark", "headerBgColor"),
    headerTextColorLight:
      readColor("headerTextColorLight") || readColor("headerTextColor"),
    headerTextColorDark: readColor("headerTextColorDark"),
    headerTextColor: resolveColor(
      "headerTextColorLight",
      "headerTextColorDark",
      "headerTextColor"
    ),
    quickReplyButtonColorLight:
      readColor("quickReplyButtonColorLight") || readColor("quickReplyButtonColor"),
    quickReplyButtonColorDark: readColor("quickReplyButtonColorDark"),
    quickReplyButtonColor: resolveColor(
      "quickReplyButtonColorLight",
      "quickReplyButtonColorDark",
      "quickReplyButtonColor"
    ),
    quickReplyTextColorLight:
      readColor("quickReplyTextColorLight") || readColor("quickReplyTextColor"),
    quickReplyTextColorDark: readColor("quickReplyTextColorDark"),
    quickReplyTextColor: resolveColor(
      "quickReplyTextColorLight",
      "quickReplyTextColorDark",
      "quickReplyTextColor"
    ),
    messageRadius: toNumber(style.messageRadius),
    sectionBgLightResolved: sectionBgPair.lightResolved,
    sectionBgDarkResolved: sectionBgPair.darkResolved,
    blockBgLightResolved: blockBgPair.lightResolved,
    blockBgDarkResolved: blockBgPair.darkResolved,
    subBlockBgLightResolved: subBlockBgPair.lightResolved,
    subBlockBgDarkResolved: subBlockBgPair.darkResolved,
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
    assistantBubbleColorLightResolved: assistantBubblePair.lightResolved,
    assistantBubbleColorDarkResolved: assistantBubblePair.darkResolved,
    assistantTextColorLightResolved: assistantTextPair.lightResolved,
    assistantTextColorDarkResolved: assistantTextPair.darkResolved,
    clientBubbleColorLightResolved: clientBubblePair.lightResolved,
    clientBubbleColorDarkResolved: clientBubblePair.darkResolved,
    clientTextColorLightResolved: clientTextPair.lightResolved,
    clientTextColorDarkResolved: clientTextPair.darkResolved,
    headerBgColorLightResolved: headerBgPair.lightResolved,
    headerBgColorDarkResolved: headerBgPair.darkResolved,
    headerTextColorLightResolved: headerTextPair.lightResolved,
    headerTextColorDarkResolved: headerTextPair.darkResolved,
    quickReplyButtonColorLightResolved: quickReplyButtonPair.lightResolved,
    quickReplyButtonColorDarkResolved: quickReplyButtonPair.darkResolved,
    quickReplyTextColorLightResolved: quickReplyTextPair.lightResolved,
    quickReplyTextColorDarkResolved: quickReplyTextPair.darkResolved,
    shadowColor: readColor("shadowColor"),
    shadowSize: toNumber(style.shadowSize),
    gradientEnabled,
    gradientEnabledLight,
    gradientEnabledDark,
    gradientDirection,
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
    gradientFrom,
    gradientTo,
    gradientFromLight: gradientFromLightRaw,
    gradientToLight: gradientToLightRaw,
    gradientFromDark: gradientFromDarkRaw,
    gradientToDark: gradientToDarkRaw,
    gradientFromLightResolved,
    gradientToLightResolved,
    gradientFromDarkResolved,
    gradientToDarkResolved,
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
    textAlign:
      style.textAlign === "center" || style.textAlign === "right"
        ? style.textAlign
        : "left",
    textAlignHeading:
      style.textAlignHeading === "center" || style.textAlignHeading === "right"
        ? style.textAlignHeading
        : isServicesBlock
          ? "center"
        : style.textAlign === "center" || style.textAlign === "right"
          ? style.textAlign
          : "left",
    textAlignSubheading:
      style.textAlignSubheading === "center" || style.textAlignSubheading === "right"
        ? style.textAlignSubheading
        : isServicesBlock
          ? "left"
        : style.textAlign === "center" || style.textAlign === "right"
          ? style.textAlign
          : "left",
    fontHeading: typeof style.fontHeading === "string" ? style.fontHeading : "",
    fontSubheading: typeof style.fontSubheading === "string" ? style.fontSubheading : "",
    fontBody: typeof style.fontBody === "string" ? style.fontBody : "",
    fontWeightHeading: toFontWeight(style.fontWeightHeading),
    fontWeightSubheading: toFontWeight(style.fontWeightSubheading),
    fontWeightBody: toFontWeight(style.fontWeightBody),
    headingSize: toNumber(style.headingSize),
    subheadingSize: toNumber(style.subheadingSize),
    textSize: toNumber(style.textSize),
    mobileHeadingSize: toNumber(style.mobileHeadingSize),
    mobileSubheadingSize: toNumber(style.mobileSubheadingSize),
    mobileTextSize: toNumber(style.mobileTextSize),
  };
}

export function updateBlockStyle(
  block: SiteBlock,
  patch: Partial<BlockStyle>
): SiteBlock {
  const current = (block.data.style as Record<string, unknown>) ?? {};
  return {
    ...block,
    data: {
      ...block.data,
      style: { ...current, ...patch },
    },
  };
}

export function FlatCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center border text-[10px] leading-none transition ${
          checked
            ? "border-[#ff5a5f] bg-transparent text-[#ff5a5f]"
            : "border-[color:var(--bp-stroke)] bg-transparent text-transparent"
        }`}
      >
        <span
          className={`h-2 w-1 rotate-45 border-b border-r ${
            checked ? "border-[#ff5a5f]" : "border-transparent"
          }`}
        />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function TildaInlineNumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <div className="min-h-[32px] text-[11px] font-semibold uppercase tracking-[0.15em] leading-4 text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = raw.trim() === "" ? 0 : Number(raw);
            if (!Number.isFinite(parsed)) return;
            let next = parsed;
            if (typeof min === "number") next = Math.max(min, next);
            if (typeof max === "number") next = Math.min(max, next);
            onChange(next);
          }}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-sm text-[color:var(--bp-ink)] font-normal normal-case tracking-normal shadow-none outline-none ring-0 placeholder:text-[color:var(--bp-muted)] focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "textfield",
            appearance: "none",
          }}
        />
      </div>
    </label>
  );
}

export function SliderTrack({
  label,
  value,
  min,
  max,
  onChange,
  accentColor,
  railColor,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  accentColor: string;
  railColor: string;
}) {
  const draggingRef = useRef(false);
  const clamp = (next: number) => Math.max(min, Math.min(max, Math.round(next)));
  const ratio = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const percent = ratio * 100;

  const applyFromClientX = (node: HTMLDivElement, clientX: number) => {
    const rect = node.getBoundingClientRect();
    const nextRatio =
      rect.width <= 0 ? 0 : Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(clamp(min + nextRatio * (max - min)));
  };

  return (
    <div
      className="relative h-4 w-full cursor-pointer select-none touch-none"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(clamp(value - 1));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(clamp(value + 1));
        }
      }}
      onPointerDown={(event) => {
        const node = event.currentTarget;
        draggingRef.current = true;
        try {
          node.setPointerCapture(event.pointerId);
        } catch {}
        applyFromClientX(node, event.clientX);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        applyFromClientX(event.currentTarget, event.clientX);
      }}
      onPointerUp={(event) => {
        draggingRef.current = false;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {}
      }}
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <div
        className="absolute left-0 top-1/2 h-[2px] w-full"
        style={{ transform: "translateY(-50%)", backgroundColor: railColor }}
      />
      <div
        className="absolute left-0 top-1/2 h-[2px]"
        style={{
          transform: "translateY(-50%)",
          width: `${percent}%`,
          backgroundColor: accentColor,
        }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 rounded-full"
        style={{
          left: `${percent}%`,
          transform: "translate(-50%, -50%)",
          backgroundColor: accentColor,
          boxShadow: "0 0 0 4px rgba(0,0,0,0.05)",
        }}
      />
    </div>
  );
}

export function FieldText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]";
  return (
    <label className="block">
      <div className={labelClassName}>{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
      />
    </label>
  );
}

export function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const labelClassName =
    "text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]";
  return (
    <label className="block">
      <div className={labelClassName}>{label}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
      />
    </label>
  );
}

export function EntityListEditor({
  block,
  items,
  showTitleFields = true,
  showUseCurrent = true,
  onChange,
}: {
  block: SiteBlock;
  items: Array<{ id: number; label: string }>;
  showTitleFields?: boolean;
  showUseCurrent?: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const mode = (block.data.mode as string) ?? "all";
  const selected = new Set<number>(
    Array.isArray(block.data.ids) ? (block.data.ids as number[]) : []
  );
  const useCurrent = Boolean(block.data.useCurrent);

  return (
    <>
      {showTitleFields && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => onChange({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => onChange({ subtitle: value })}
          />
        </>
      )}
      {showUseCurrent && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useCurrent}
            onChange={(event) => {
              const checked = event.target.checked;
              onChange({
                useCurrent: checked,
                mode: checked ? "selected" : mode,
                ids: checked ? [] : Array.from(selected),
              });
            }}
          />
          Использовать текущую страницу
        </label>
      )}
      <label className="text-sm">
        Отображение
        <select
          value={mode}
          onChange={(event) => onChange({ mode: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="all">Все</option>
          <option value="selected">Выбранные</option>
        </select>
      </label>
      {mode === "selected" && (
        <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3 text-xs">
          <div className="mb-2 text-[color:var(--bp-muted)]">Выберите элементы</div>
          <div className="max-h-48 space-y-2 overflow-auto pr-2">
            {items.map((item) => {
              const checked = selected.has(item.id);
              return (
                <label key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      onChange({ ids: Array.from(next) });
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
            {items.length === 0 && (
              <div className="text-[color:var(--bp-muted)]">
                Пока нет данных.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function CoverImageEditor({
  data,
  branding,
  onChange,
}: {
  data: Record<string, unknown>;
  branding: Branding;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };
  const [customImages, setCustomImages] = useState<{ id: number; url: string }[]>([]);
  const [customSelectedId, setCustomSelectedId] = useState<number | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setSource = useCallback((next: { type: string; id?: number | null; url?: string }) => {
    onChange({ imageSource: next });
  }, [onChange]);

  useEffect(() => {
    let active = true;
    const fetchLibrary = async (retry401 = true) => {
      const response = await fetch("/api/v1/crm/account/media?type=siteCover", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401 && retry401) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return fetchLibrary(false);
      }
      return response;
    };
    const load = async () => {
      setCustomLoading(true);
      try {
        const response = await fetchLibrary();
        const payload = await response.json().catch(() => null);
        if (!response.ok) return;
        const itemsRaw = payload?.data?.items;
        const items = Array.isArray(itemsRaw)
          ? itemsRaw
              .map((item) => {
                if (!item || typeof item !== "object") return null;
                const record = item as Record<string, unknown>;
                const id = record.id;
                const url = record.url;
                if (typeof id !== "number" || !Number.isFinite(id)) return null;
                if (typeof url !== "string" || url.trim().length === 0) return null;
                return { id, url } as const;
              })
              .filter((item): item is { id: number; url: string } => item !== null)
          : [];
        if (!active) return;
        setCustomImages(items);
      } finally {
        if (active) setCustomLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const selectedCustomImage =
    customSelectedId === null
      ? null
      : customImages.find((item) => item.id === customSelectedId) ?? null;
  const fallbackCustomImage = selectedCustomImage ?? customImages[0] ?? null;

  const previewUrl =
    imageSource.type === "custom"
      ? (imageSource.url && imageSource.url.trim().length > 0
          ? imageSource.url
          : (fallbackCustomImage?.url ?? null))
      : imageSource.type === "account"
        ? (branding.coverUrl ?? null)
        : null;

  useEffect(() => {
    if (imageSource.type !== "custom") return;
    const currentUrl = typeof imageSource.url === "string" ? imageSource.url.trim() : "";
    if (currentUrl.length > 0) return;
    const first = customImages[0];
    if (!first) return;
    if (customSelectedId !== first.id) setCustomSelectedId(first.id);
    setSource({ type: "custom", url: first.url });
  }, [customImages, customSelectedId, imageSource.type, imageSource.url, setSource]);

  const uploadCustomImage = async (file: File) => {
    const formData = new FormData();
    formData.append("type", "siteCover");
    formData.append("file", file);

    setUploading(true);
    setUploadError(null);

    try {
      const response = await fetch("/api/v1/crm/account/media", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data?.url || typeof payload?.data?.id !== "number") {
        const errorMessage =
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : "Не удалось загрузить изображение.";
        setUploadError(errorMessage);
        return;
      }
      const nextImage = { id: payload.data.id, url: String(payload.data.url) };
      setCustomImages((prev) => [
        nextImage,
        ...prev.filter((item) => item.id !== nextImage.id && item.url !== nextImage.url),
      ]);
      setCustomSelectedId(nextImage.id);
      setSource({ type: "custom", url: nextImage.url });
    } catch {
      setUploadError("Не удалось загрузить изображение.");
    } finally {
      setUploading(false);
    }
  };

  const selectCustomImage = (next: { id: number; url: string }) => {
    if (customSelectedId !== next.id) setCustomSelectedId(next.id);
    setSource({ type: "custom", url: next.url });
  };

  const removeCustomImage = async (image: { id: number; url: string }) => {
    setRemovingId(image.id);
    setUploadError(null);
    try {
      const response = await fetch(`/api/v1/crm/account/media/${image.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setUploadError("Не удалось удалить изображение.");
        return;
      }
      const nextImages = customImages.filter((item) => item.id !== image.id);
      const nextSelectedId =
        customSelectedId === image.id ? (nextImages[0]?.id ?? null) : customSelectedId;
      setCustomImages(nextImages);
      setCustomSelectedId(nextSelectedId);
      if (imageSource.type === "custom") {
        const nextUrl =
          nextSelectedId === null
            ? ""
            : (nextImages.find((item) => item.id === nextSelectedId)?.url ?? "");
        setSource({ type: "custom", url: nextUrl });
      }
    } catch {
      setUploadError("Не удалось удалить изображение.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
          Фоновое изображение
        </div>
        <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
          <select
            value={
              imageSource.type === "custom"
                ? "custom"
                : imageSource.type === "none"
                  ? "none"
                  : "account"
            }
            onChange={(event) => {
              if (event.target.value === "custom") {
                const currentUrl = typeof imageSource.url === "string" ? imageSource.url.trim() : "";
                const matchByUrl =
                  currentUrl.length > 0
                    ? customImages.find((item) => item.url === currentUrl) ?? null
                    : null;
                const matchById =
                  customSelectedId === null
                    ? null
                    : customImages.find((item) => item.id === customSelectedId) ?? null;
                const nextImage = matchByUrl ?? matchById ?? customImages[0] ?? null;
                if (nextImage) {
                  setCustomSelectedId(nextImage.id);
                  setSource({ type: "custom", url: nextImage.url });
                } else {
                  setCustomSelectedId(null);
                  setSource({ type: "custom", url: currentUrl });
                }
                return;
              }
              setSource(event.target.value === "none" ? { type: "none" } : { type: "account" });
            }}
            className="w-full appearance-none border-0 bg-transparent px-0 py-1 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
            style={{
              border: 0,
              borderRadius: 0,
              backgroundColor: "transparent",
              boxShadow: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
          >
            <option value="none">Без изображения</option>
            <option value="account">Профиль аккаунта</option>
            <option value="custom">Своё изображение</option>
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
            ?
          </span>
        </div>
      </label>

      {previewUrl ? (
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-32 overflow-hidden rounded-md bg-[color:var(--bp-base)]">
            <UnoptimizedImage src={previewUrl} alt="Превью обложки" className="h-full w-full object-cover" />
          </div>
          <div className="text-xs text-[color:var(--bp-muted)]">Изображение выбрано</div>
        </div>
      ) : (
        <div className="text-xs text-[color:var(--bp-muted)]">Изображение не выбрано</div>
      )}

      {imageSource.type === "custom" && (
        <div className="space-y-2">
          {customLoading && (
            <div className="text-xs text-[color:var(--bp-muted)]">Загрузка изображений...</div>
          )}
          {customImages.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {customImages.map((image) => {
                const isSelected =
                  customSelectedId === image.id ||
                  (customSelectedId === null && image.url === previewUrl);
                return (
                  <div
                    key={image.id}
                    className={`relative overflow-hidden rounded-lg border bg-[color:var(--bp-paper)] ${
                      isSelected
                        ? "border-[color:var(--bp-save-close,var(--bp-accent))]"
                        : "border-[color:var(--bp-stroke)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectCustomImage(image)}
                      className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bp-save-close,var(--bp-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bp-paper)]"
                      disabled={removingId === image.id}
                      aria-label="Выбрать изображение"
                    >
                      <div className="flex aspect-[16/10] w-full items-center justify-center bg-[color:var(--bp-base)]">
                        <UnoptimizedImage src={image.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCustomImage(image)}
                      disabled={removingId === image.id}
                      className="absolute right-1 top-1 inline-flex h-6 items-center justify-center rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 text-[11px] text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bp-save-close,var(--bp-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bp-paper)]"
                    >
                      {removingId === image.id ? "..." : "?"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void uploadCustomImage(file);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removingId !== null}
            className="inline-flex h-9 items-center justify-center border border-[color:var(--bp-stroke)] px-3 text-sm disabled:opacity-60"
          >
            {uploading ? "Загрузка..." : "Загрузить файл"}
          </button>
          {uploadError ? <div className="text-xs text-[#c2410c]">{uploadError}</div> : null}
        </div>
      )}
    </div>
  );
}

export function BlockPreview({
  block,
  account,
  accountProfile,
  branding,
  locations,
  services,
  specialists,
  promos,
  reviews,
  workPhotos,
  legalDocuments,
  platformLegalDocuments,
  theme,
  loaderConfig,
  currentEntity,
  previewMode,
  previewViewportWidth,
  onThemeToggle,
  onSelect,
  isSelected,
}: {
  block: SiteBlock;
  account: AccountInfo;
  accountProfile: AccountProfile;
  branding: Branding;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  reviews: ReviewItem[];
  workPhotos: WorkPhotos;
  legalDocuments?: LegalDocumentItem[];
  platformLegalDocuments?: LegalDocumentItem[];
  theme: SiteTheme;
  loaderConfig: SiteLoaderConfig | null;
  currentEntity: CurrentEntity;
  previewMode: "desktop" | "mobile";
  previewViewportWidth?: number;
  onThemeToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const previewRootRef = useRef<HTMLDivElement | null>(null);
  const [coverParallaxOffset, setCoverParallaxOffset] = useState(0);
  const style = normalizeBlockStyle(block, theme);
  const blockRadius =
    style.radius !== null && Number.isFinite(style.radius)
      ? style.radius
      : theme.radius;
  const sectionBg =
    theme.mode === "dark" ? style.sectionBgDarkResolved : style.sectionBgLightResolved;
  const blockBg = (block.type === "menu" ? style.blockBg || style.sectionBg : style.blockBg) || theme.panelColor;
  const borderColor = (style.borderColor || theme.borderColor || "").trim() || "transparent";
  const shadowSize = style.shadowSize ?? theme.shadowSize ?? 0;
  const rawShadowColor = style.shadowColor || theme.shadowColor || "rgba(17, 24, 39, 0.12)";
  const shadowColor =
    block.type === "menu" && theme.mode === "dark" && isLightShadowColor(rawShadowColor)
      ? "rgba(0, 0, 0, 0.45)"
      : rawShadowColor;
  const textColor = style.textColor || theme.textColor;
  const mutedColor = style.mutedColor || theme.mutedColor;
  const isBooking = block.type === "booking";
  const isMenu = block.type === "menu";
  const isGallery = block.type === "works";
  const isCover = block.type === "cover";
  const isAisha = block.type === "aisha";
  const isLoader = block.type === "loader";
  const isClient =
    block.type === "client" || block.type === "clientLogin" || block.type === "clientCabinet";
  const isServices = block.type === "services" || block.type === "specialists" || block.type === "locations";
  const useFramelessContainer = true;
  const isFlatSection =
    block.type === "about" ||
    block.type === "heading" ||
    block.type === "text" ||
    block.type === "image" ||
    block.type === "gallery" ||
    block.type === "form" ||
    block.type === "button" ||
    block.type === "advantages" ||
    block.type === "project" ||
    block.type === "footer" ||
    block.type === "team" ||
    block.type === "news" ||
    block.type === "widget" ||
    block.type === "locationProfile" ||
    block.type === "serviceProfile" ||
    block.type === "specialistProfile" ||
    block.type === "reviews" ||
    block.type === "contacts" ||
    block.type === "promos";
  const coverData = isCover ? (block.data as Record<string, unknown>) : null;
  const coverScrollEffect =
    coverData?.coverScrollEffect === "fixed" || coverData?.coverScrollEffect === "parallax"
      ? (coverData.coverScrollEffect as "fixed" | "parallax")
      : "none";
  useEffect(() => {
    if (!isCover || coverScrollEffect !== "parallax") {
      return;
    }
    let baselineDelta: number | null = null;
    const updateParallax = () => {
      const node = previewRootRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const blockCenter = rect.top + rect.height / 2;
      const delta = blockCenter - viewportCenter;
      if (baselineDelta === null) {
        baselineDelta = delta;
      }
      const relativeDelta = delta - baselineDelta;
      const nextOffset = Math.max(-140, Math.min(140, relativeDelta * -0.18));
      setCoverParallaxOffset((prev) => prev + (nextOffset - prev) * 0.16);
    };
    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateParallax();
      });
    };
    updateParallax();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isCover, coverScrollEffect]);
  const menuBlockBgLight =
    isMenu && !style.blockBgLight.trim() ? style.sectionBgLightResolved : style.blockBgLightResolved;
  const menuBlockBgDark =
    isMenu && !style.blockBgDark.trim() ? style.sectionBgDarkResolved : style.blockBgDarkResolved;
  const isFullscreenGallery = isGallery && block.variant === "v2";
  const useMobileLayout =
    typeof previewViewportWidth === "number" &&
    Number.isFinite(previewViewportWidth) &&
    previewViewportWidth <= 480;
  const blockWidthColumnsDesktop = isMenu
    ? MAX_BLOCK_COLUMNS
    : clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, block.type);
  const mobileBlockWidthColumns = clampBlockColumns(
    style.mobileBlockWidthColumns ?? MAX_BLOCK_COLUMNS,
    block.type
  );
  const blockWidthColumns = isServices && useMobileLayout ? mobileBlockWidthColumns : blockWidthColumnsDesktop;
  const gridFallback = centeredGridRange(
    isMenu || isBooking ? MAX_BLOCK_COLUMNS : blockWidthColumns
  );
  const gridStart = isMenu || isBooking
    ? 1
    : isServices && useMobileLayout
      ? gridFallback.start
      : clampGridColumn(style.gridStartColumn ?? gridFallback.start);
  const gridEnd = isMenu || isBooking
    ? MAX_BLOCK_COLUMNS
    : isServices && useMobileLayout
      ? gridFallback.end
      : Math.max(gridStart, clampGridColumn(style.gridEndColumn ?? gridFallback.end));
  const gridSpan = Math.max(1, gridEnd - gridStart + 1);
  const gridWidthPercent = `${(gridSpan / MAX_BLOCK_COLUMNS) * 100}%`;
  const gridLeftPercent = `${((gridStart - 1) / MAX_BLOCK_COLUMNS) * 100}%`;
  const gradientFrom = style.gradientFrom || theme.gradientFrom;
  const gradientTo = style.gradientTo || theme.gradientTo;
  const gradientDirection =
    style.gradientDirection || theme.gradientDirection || "vertical";
  const gradientEnabled = style.gradientEnabled;
  const lightGradient = style.gradientEnabledLight
    ? `linear-gradient(${style.gradientDirectionLight === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromLightResolved}, ${style.gradientToLightResolved})`
    : "none";
  const darkGradient = style.gradientEnabledDark
    ? `linear-gradient(${style.gradientDirectionDark === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromDarkResolved}, ${style.gradientToDarkResolved})`
    : "none";
  const blockFont = style.fontBody || theme.fontBody;
  const loaderUsesCustomWidth = isLoader && Boolean(style.useCustomWidth) && Boolean(style.blockWidthColumns);
  const containerClass = "p-0";
  const blockContent = renderBlock(
    block,
    account,
    accountProfile,
    branding,
    locations,
    services,
    specialists,
    promos,
    reviews,
    workPhotos,
    legalDocuments,
    platformLegalDocuments,
    theme,
    loaderConfig,
    currentEntity,
    previewMode,
    previewViewportWidth,
    onThemeToggle,
    coverScrollEffect === "parallax" ? coverParallaxOffset : 0
  );
  const desktopHeadingSize = style.headingSize ?? theme.headingSize;
  const desktopSubheadingSize = style.subheadingSize ?? theme.subheadingSize;
  const desktopTextSize = style.textSize ?? theme.textSize;
  const useMobileTypography = useMobileLayout;
  const currentHeadingSize =
    useMobileTypography ? style.mobileHeadingSize ?? defaultMobileHeadingSize(desktopHeadingSize) : desktopHeadingSize;
  const currentSubheadingSize =
    useMobileTypography
      ? style.mobileSubheadingSize ?? defaultMobileSubheadingSize(desktopSubheadingSize)
      : desktopSubheadingSize;
  const currentTextSize =
    useMobileTypography ? style.mobileTextSize ?? defaultMobileTextSize(desktopTextSize) : desktopTextSize;
  const coverBackground = resolveCoverBackgroundVisual(
    isCover ? (block.data as Record<string, unknown>) : null,
    sectionBg || theme.panelColor,
    theme.mode
  );
  const menuSectionBackground = resolveMenuSectionBackgroundVisual(
    isMenu ? (block.data as Record<string, unknown>) : null,
    sectionBg || theme.panelColor,
    theme.mode
  );
  const servicesSectionBackground = resolveServicesSectionBackgroundVisual(
    isServices || isBooking
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
      : null,
    sectionBg || theme.panelColor,
    theme.mode
  );
  const clientPageBackground = isClient ? resolveClientPageBackground(block, theme) : null;
  return (
    <div
      ref={previewRootRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`text-left relative${block.type === "booking" ? " booking-preview" : ""}`}
      style={{
        width: isGallery || isBooking || isMenu || isCover || isAisha || isClient || isServices || isFlatSection || (isLoader && !loaderUsesCustomWidth)
          ? "100%"
          : gridWidthPercent,
        maxWidth: "100%",
        marginLeft: isGallery || isBooking || isMenu || isCover || isAisha || isClient || isServices || isFlatSection || (isLoader && !loaderUsesCustomWidth)
          ? "auto"
          : gridLeftPercent,
        marginRight: isGallery || isBooking || isMenu || isCover || isAisha || isClient || isServices || isFlatSection || (isLoader && !loaderUsesCustomWidth)
          ? "auto"
          : 0,
        marginTop: isGallery || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection ? 0 : style.marginTop,
        marginBottom: isGallery || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection ? 0 : style.marginBottom,
        paddingTop: isGallery || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection ? style.marginTop : undefined,
        paddingBottom: isGallery || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection ? style.marginBottom : undefined,
        ["--booking-page-top-offset" as string]: isBooking ? `${Math.max(0, style.marginTop)}px` : undefined,
        backgroundColor: isLoader
          ? "transparent"
          : isMenu
            ? menuSectionBackground.backgroundColor
          : isAisha
            ? "transparent"
          : isCover
            ? coverBackground.backgroundColor
          : isClient
            ? clientPageBackground?.backgroundColor
          : isServices || isBooking || isFlatSection
              ? servicesSectionBackground.backgroundColor
            : sectionBg,
        backgroundImage: isLoader
          ? "none"
          : isCover
            ? coverBackground.backgroundImage
          : isMenu
            ? menuSectionBackground.backgroundImage
            : isClient
              ? clientPageBackground?.backgroundImage
            : isServices || isBooking || isFlatSection
              ? servicesSectionBackground.backgroundImage
            : "none",
      }}
    >
      <div
        style={
          (isGallery && !isFullscreenGallery) || isFlatSection
            ? {
                width: gridWidthPercent,
                maxWidth: "100%",
                marginLeft: gridLeftPercent,
                marginRight: 0,
              }
            : undefined
        }
      >
        <div
          className={`${containerClass} relative`}
          style={{
            borderRadius: useFramelessContainer || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection ? 0 : blockRadius,
            backgroundColor: useFramelessContainer || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection
              ? "transparent"
              : gradientEnabled
                ? gradientFrom
                : blockBg,
            backgroundImage: useFramelessContainer || isBooking || isMenu || isCover || isAisha || isLoader || isClient || isServices || isFlatSection
              ? "none"
              : gradientEnabled
                ? `linear-gradient(${gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${gradientFrom}, ${gradientTo})`
                : "none",
            color: textColor,
            fontFamily: blockFont,
            borderColor: useFramelessContainer || isBooking || isMenu || isGallery || isCover || isAisha || isLoader || isClient || isServices || isFlatSection ? "transparent" : borderColor,
            borderWidth: useFramelessContainer || isBooking || isMenu || isGallery || isCover || isAisha || isLoader || isClient || isServices || isFlatSection || borderColor === "transparent" ? 0 : 1,
            boxShadow:
              useFramelessContainer || isBooking || isGallery || isCover || isAisha || isLoader || isClient || isServices || isFlatSection || shadowSize <= 0
                ? "none"
                : `0 ${shadowSize}px ${shadowSize * 2}px ${shadowColor}`,
            ["--bp-ink" as string]: textColor,
            ["--bp-muted" as string]: mutedColor,
            ["--bp-stroke" as string]: borderColor,
            ["--block-heading-size" as string]: `${currentHeadingSize}px`,
            ["--block-subheading-size" as string]: `${currentSubheadingSize}px`,
            ["--block-text-size" as string]: `${currentTextSize}px`,
            ["--block-bg-light" as string]: menuBlockBgLight,
            ["--block-bg-dark" as string]: menuBlockBgDark,
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
            ["--services-description-color-light" as string]:
              style.servicesDescriptionColorLightResolved,
            ["--services-description-color-dark" as string]:
              style.servicesDescriptionColorDarkResolved,
            ["--block-button-light" as string]: style.buttonColorLightResolved,
            ["--block-button-dark" as string]: style.buttonColorDarkResolved,
            ["--block-button-text-light" as string]: style.buttonTextColorLightResolved,
            ["--block-button-text-dark" as string]: style.buttonTextColorDarkResolved,
            ["--block-gradient-light" as string]: lightGradient,
            ["--block-gradient-dark" as string]: darkGradient,
            ["--block-bg" as string]:
              theme.mode === "dark" ? menuBlockBgDark : menuBlockBgLight,
            ["--block-section-bg" as string]:
              theme.mode === "dark" ? style.sectionBgDarkResolved : style.sectionBgLightResolved,
            ["--block-sub-bg" as string]:
              theme.mode === "dark" ? style.subBlockBgDarkResolved : style.subBlockBgLightResolved,
            ["--block-border" as string]:
              theme.mode === "dark" ? style.borderColorDarkResolved : style.borderColorLightResolved,
            ["--block-text" as string]:
              theme.mode === "dark" ? style.textColorDarkResolved : style.textColorLightResolved,
            ["--block-muted" as string]:
              theme.mode === "dark" ? style.mutedColorDarkResolved : style.mutedColorLightResolved,
            ["--services-heading-color" as string]:
              theme.mode === "dark"
                ? style.servicesHeadingColorDarkResolved
                : style.servicesHeadingColorLightResolved,
            ["--services-description-color" as string]:
              theme.mode === "dark"
                ? style.servicesDescriptionColorDarkResolved
                : style.servicesDescriptionColorLightResolved,
            ["--block-button" as string]:
              theme.mode === "dark" ? style.buttonColorDarkResolved : style.buttonColorLightResolved,
            ["--block-button-text" as string]:
              theme.mode === "dark"
                ? style.buttonTextColorDarkResolved
                : style.buttonTextColorLightResolved,
            ["--block-gradient" as string]: theme.mode === "dark" ? darkGradient : lightGradient,
            ["--works-content-width" as string]: gridWidthPercent,
            ["--works-content-left" as string]: gridLeftPercent,
          }}
        >
            {isMenu ? <div className="overflow-visible rounded-[inherit]">{blockContent}</div> : blockContent}
        </div>
      </div>
    </div>
  );
}

export function InsertSlot({
  index,
  slotRef,
  activeOffset,
  hideAddButton = false,
  persistent = false,
  active = false,
  showValue = false,
  onDragStateChange,
  onAdjustSpacing,
  onInsert,
}: {
  index: number;
  slotRef?: (el: HTMLDivElement | null) => void;
  spacing: number;
  activeOffset: number;
  hideAddButton?: boolean;
  persistent?: boolean;
  active?: boolean;
  showValue?: boolean;
  onDragStateChange?: (dragging: boolean, target?: "prev" | "next") => void;
  onAdjustSpacing?: (deltaY: number, target: "prev" | "next") => void;
  onInsert: () => void;
}) {
  const slotHeight = 0;
  const top = "50%";
  const handleResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onAdjustSpacing) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const target: "prev" | "next" =
      event.clientY <= rect.top + rect.height / 2 ? "prev" : "next";
    onDragStateChange?.(true, target);
    const startY = event.clientY;
    let lastAppliedDelta = 0;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    const handleMove = (nextEvent: PointerEvent) => {
      const totalDelta = nextEvent.clientY - startY;
      const snappedDelta = Math.round(totalDelta / BLOCK_OFFSET_STEP_PX) * BLOCK_OFFSET_STEP_PX;
      if (snappedDelta !== lastAppliedDelta) {
        onAdjustSpacing(snappedDelta - lastAppliedDelta, target);
        lastAppliedDelta = snappedDelta;
      }
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      onDragStateChange?.(false);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };
  return (
    <div
      ref={slotRef}
      className="relative flex items-center justify-center"
      style={{ height: slotHeight }}
    >
      {onAdjustSpacing && (
        <div
          role="slider"
          aria-label={`Изменить отступ между блоками ${index}`}
          aria-valuemin={0}
          aria-valuemax={BLOCK_OFFSET_STEP_PX * 20}
          aria-valuenow={Math.max(0, Math.round(activeOffset))}
          className="absolute inset-x-0 top-1/2 z-[40] h-10 -translate-y-1/2 cursor-ns-resize touch-none"
          style={{ cursor: "ns-resize" }}
          onPointerDown={handleResizeStart}
        >
          {showValue && (
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-full bg-black px-2 py-0.5 text-[11px] font-semibold text-white">
              {Math.round(activeOffset)}px
            </div>
          )}
          <div
            className={`absolute inset-x-3 top-1/2 -translate-y-1/2 border-t border-dashed ${
              active || persistent ? "opacity-100" : "opacity-45"
            }`}
            style={{ borderColor: "rgba(148,163,184,0.85)" }}
          />
        </div>
      )}
      {!hideAddButton && (
        <button
          type="button"
          onClick={onInsert}
          className="absolute z-[41] flex h-8 w-8 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-sm text-[#0f172a] shadow-sm"
          style={{ top, left: "50%", transform: "translate(-50%, -50%)" }}
          aria-label={`Добавить блок ${index}`}
          title="Добавить блок"
        >
          <span
            className="leading-none"
            style={index === 0 ? { transform: "translateY(5px)" } : undefined}
          >
            +
          </span>
        </button>
      )}
    </div>
  );
}

export function renderBlock(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  reviews: ReviewItem[],
  workPhotos: WorkPhotos,
  legalDocuments: LegalDocumentItem[] | undefined,
  platformLegalDocuments: LegalDocumentItem[] | undefined,
  theme: SiteTheme,
  loaderConfig: SiteLoaderConfig | null,
  currentEntity: CurrentEntity,
  previewMode: "desktop" | "mobile",
  previewViewportWidth: number | undefined,
  onThemeToggle: () => void,
  coverParallaxOffset = 0
) {
  const style = normalizeBlockStyle(block, theme);
  const blockType = String(block.type);
  switch (blockType) {
    case "cover":
      return renderCover(
        block,
        account,
        accountProfile,
        branding,
        locations,
        services,
        specialists,
        theme,
        style,
        previewMode === "mobile",
        coverParallaxOffset
      );
    case "menu":
      return renderMenuBlock(
        block,
        account,
        accountProfile,
        branding,
        locations,
        services,
        specialists,
        promos,
        theme,
        style,
        onThemeToggle,
        previewViewportWidth
      );
    case "about":
      return renderAbout(block, account, accountProfile, theme, style);
    case "heading":
      return renderHeadingBlock(block, theme, style);
    case "text":
      return renderTextBlock(block, theme, style);
    case "image":
      return renderImageBlock(block, theme, style);
    case "gallery":
      return renderManualGalleryBlock(block, theme, style, previewViewportWidth);
    case "form":
      return renderFormBlock(block, theme, style);
    case "button":
      return renderButtonBlock(block, account, theme, style);
    case "advantages":
      return renderAdvantagesBlock(block, theme, style, previewViewportWidth);
    case "project":
      return renderProjectBlock(block, theme, style, previewViewportWidth);
    case "footer":
      return renderFooterBlock(block, account, accountProfile, locations, theme, style, previewViewportWidth);
    case "team":
      return renderTeamBlock(block, account, locations, specialists, theme, style, currentEntity, previewViewportWidth);
    case "news":
      return renderNewsBlock(block, theme, style, previewViewportWidth);
    case "widget":
      return renderWidgetBlock(block, theme, style);
    case "locationProfile":
      return renderLocationProfileBlock(block, account, accountProfile, locations, services, specialists, theme, style, currentEntity, previewViewportWidth);
    case "serviceProfile":
      return renderServiceProfileBlock(block, account, locations, services, specialists, theme, style, currentEntity, previewViewportWidth);
    case "specialistProfile":
      return renderSpecialistProfileBlock(block, account, locations, services, specialists, theme, style, currentEntity, previewViewportWidth);
    case "client":
    case "clientLogin":
    case "clientCabinet":
      return renderClient(block, account, theme, style);
    case "legal":
      return renderLegal(block, theme, style, legalDocuments ?? [], platformLegalDocuments ?? [], currentEntity);
    case "booking":
      return renderBooking(block, account, theme, style, loaderConfig, previewViewportWidth);
    case "loader":
      return renderLoaderPreview(block, theme, style);
    case "locations":
      return renderLocations(
        block,
        account,
        accountProfile,
        locations,
        theme,
        style,
        currentEntity,
        previewViewportWidth
      );
    case "services":
      return renderServices(block, account, locations, services, theme, style, currentEntity, previewViewportWidth);
    case "specialists":
      return renderSpecialists(block, account, locations, specialists, theme, style, currentEntity, previewViewportWidth);
    case "promos":
      return renderPromos(block, promos, theme, style, currentEntity, previewViewportWidth);
    case "works":
      return renderWorks(block, workPhotos, theme, style, currentEntity);
    case "reviews":
      return renderReviews(block, account.slug, account.name, reviews, theme, style, previewViewportWidth);
    case "contacts":
      return renderContacts(block, account, accountProfile, locations, theme, style, previewViewportWidth);
    case "aisha":
      return renderAisha(block, account, theme, style, previewViewportWidth);
    default:
      return null;
  }
}

export function buildBookingVars(style: BlockStyle, theme: SiteTheme, previewViewportWidth?: number) {
  const useMobileLayout =
    typeof previewViewportWidth === "number" &&
    Number.isFinite(previewViewportWidth) &&
    previewViewportWidth <= 480;
  const blockWidthColumns = clampBlockColumns(
    useMobileLayout
      ? style.mobileBlockWidthColumns ?? style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS
      : style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
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
  const radius = style.radius ?? 5;
  const buttonRadius = style.buttonRadius ?? palette.buttonRadius ?? theme.buttonRadius;
  const cardRadius = style.cardRadius ?? 24;
  const bookingImageRadius = style.bookingImageRadius ?? Math.min(cardRadius, 18);
  const shadowSize = style.shadowSize ?? 0;
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
  const subBlockCurrent = theme.mode === "dark" ? subBlockDark : subBlockLight;
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
    style.gradientEnabledLight,
    style.gradientDirectionLight,
    style.gradientFromLightResolved,
    style.gradientToLightResolved,
    style.gradientAngleLight,
    style.gradientStopALight,
    style.gradientStopBLight
  );
  const bookingGradientDark = bookingPanelBackground(
    style.gradientModeDark,
    style.gradientEnabledDark,
    style.gradientDirectionDark,
    style.gradientFromDarkResolved,
    style.gradientToDarkResolved,
    style.gradientAngleDark,
    style.gradientStopADark,
    style.gradientStopBDark
  );
  const bookingGradient = theme.mode === "dark" ? bookingGradientDark : bookingGradientLight;
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
  const bookingBorderLight = style.borderColorLight.trim()
    ? style.borderColorLightResolved || "transparent"
    : "transparent";
  const bookingBorderDark = style.borderColorDark.trim()
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
    "--booking-nav-secondary-bg-light": style.bookingNavSecondaryBgLight || style.secondaryButtonBgLight || subBlockLight,
    "--booking-nav-secondary-bg-dark": style.bookingNavSecondaryBgDark || style.secondaryButtonBgDark || subBlockDark,
    "--booking-nav-secondary-text-light": style.bookingNavSecondaryTextColorLight || style.secondaryButtonTextColorLight || style.textColorLightResolved || "var(--site-text)",
    "--booking-nav-secondary-text-dark": style.bookingNavSecondaryTextColorDark || style.secondaryButtonTextColorDark || style.textColorDarkResolved || "var(--site-text)",
    "--booking-nav-secondary-border-light": style.bookingNavSecondaryBorderColorLight || style.secondaryButtonBorderColorLight || style.cardBorderColorLight || bookingBorderLight,
    "--booking-nav-secondary-border-dark": style.bookingNavSecondaryBorderColorDark || style.secondaryButtonBorderColorDark || style.cardBorderColorDark || bookingBorderDark,
    "--booking-scenario-bg-light": style.bookingScenarioBgLight || subBlockLight,
    "--booking-scenario-bg-dark": style.bookingScenarioBgDark || subBlockDark,
    "--booking-scenario-text-light": style.bookingScenarioTextColorLight || style.mutedColorLightResolved || "var(--site-muted)",
    "--booking-scenario-text-dark": style.bookingScenarioTextColorDark || style.mutedColorDarkResolved || "var(--site-muted)",
    "--booking-scenario-border-light": style.bookingScenarioBorderColorLight || "transparent",
    "--booking-scenario-border-dark": style.bookingScenarioBorderColorDark || "transparent",
    "--booking-scenario-active-bg-light": style.bookingScenarioActiveBgLight || style.buttonColorLightResolved || "var(--site-button)",
    "--booking-scenario-active-bg-dark": style.bookingScenarioActiveBgDark || style.buttonColorDarkResolved || "var(--site-button)",
    "--booking-scenario-active-text-light": style.bookingScenarioActiveTextColorLight || style.buttonTextColorLightResolved || "var(--site-button-text)",
    "--booking-scenario-active-text-dark": style.bookingScenarioActiveTextColorDark || style.buttonTextColorDarkResolved || "var(--site-button-text)",
    "--booking-scenario-active-border-light": style.bookingScenarioActiveBorderColorLight || style.primaryButtonBorderColorLight || "transparent",
    "--booking-scenario-active-border-dark": style.bookingScenarioActiveBorderColorDark || style.primaryButtonBorderColorDark || "transparent",
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
    "--booking-gradient": bookingGradient,
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

export function renderBooking(
  block: SiteBlock,
  account: AccountInfo,
  theme: SiteTheme,
  style: BlockStyle,
  loaderConfig: SiteLoaderConfig | null,
  previewViewportWidth?: number
) {
  const accountSlug = account.slug;
  const accountPublicSlug = account.publicSlug ?? undefined;
  const cssVars = buildBookingVars(style, theme, previewViewportWidth);
  const bookingDesignVariant = block.variant === "v2" ? "future" : "classic";
  const previewViewportClass =
    typeof previewViewportWidth === "number" && Number.isFinite(previewViewportWidth)
      ? previewViewportWidth < 640
        ? " booking-root--mobile"
        : previewViewportWidth < 960
          ? " booking-root--tablet"
          : ""
      : "";
  return (
    <div
      className={`booking-root${bookingDesignVariant === "future" ? " booking-root--future" : ""}${previewViewportClass}`}
      style={cssVars}
    >
      <div className="booking-bleed">
        <BookingClient
          accountSlug={accountSlug}
          accountPublicSlug={accountPublicSlug}
          loaderConfig={loaderConfig}
          designVariant={bookingDesignVariant}
        />
      </div>
    </div>
  );
}

export function renderLoaderPreview(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const isDark = theme.mode === "dark";
  const enabled = data.enabled !== false;
  const resolvedColorCandidate = isDark ? data.colorDark : data.color;
  const color =
    typeof resolvedColorCandidate === "string" && resolvedColorCandidate.trim()
      ? resolvedColorCandidate.trim()
      : typeof data.color === "string" && data.color.trim()
        ? data.color.trim()
      : style.buttonColor || theme.buttonColor;
  const size =
    Number.isFinite(Number(data.size)) && Number(data.size) > 0 ? Number(data.size) : 36;
  const speedMs =
    Number.isFinite(Number(data.speedMs)) && Number(data.speedMs) > 0
      ? Number(data.speedMs)
      : 900;
  const thickness =
    Number.isFinite(Number(data.thickness)) && Number(data.thickness) > 0
      ? Number(data.thickness)
      : 3;
  const fixedDurationEnabled = Boolean(data.fixedDurationEnabled);
  const fixedDurationSec =
    Number.isFinite(Number(data.fixedDurationSec)) && Number(data.fixedDurationSec) > 0
      ? Number(data.fixedDurationSec)
      : 1;
  const backdropEnabled = Boolean(data.backdropEnabled);
  const parsedBackdrop = parseBackdropColor(isDark ? data.backdropColorDark : data.backdropColor);
  const backdropHex =
    typeof (isDark ? data.backdropHexDark : data.backdropHex) === "string" &&
    String(isDark ? data.backdropHexDark : data.backdropHex).trim()
      ? String(isDark ? data.backdropHexDark : data.backdropHex).trim()
      : parsedBackdrop.hex;
  const backdropOpacity =
    Number.isFinite(Number(isDark ? data.backdropOpacityDark : data.backdropOpacity))
      ? clamp01(Number(isDark ? data.backdropOpacityDark : data.backdropOpacity))
      : parsedBackdrop.alpha;
  const backdropColor = hexToRgbaString(backdropHex, backdropOpacity);

  const visual =
    block.variant === "v2" ? "dots" : block.variant === "v3" ? "pulse" : "spinner";

  return (
    <div className="relative flex min-h-[180px] w-full items-center justify-center">
      <div
        className="absolute left-1/2 top-0 h-full w-screen -translate-x-1/2"
        style={
          backdropEnabled && backdropOpacity > 0
            ? { backgroundColor: backdropColor }
            : undefined
        }
      />
      {enabled ? (
        <SiteLoader
          config={{
            visual,
            size,
            color,
            speedMs,
            thickness,
            showPageOverlay: true,
            showBookingInline: true,
            backdropEnabled,
            backdropColor,
            fixedDurationEnabled,
            fixedDurationSec,
          }}
        />
      ) : (
        <span className="relative z-[1] text-xs text-[color:var(--bp-muted)]">
          Включите блок в настройках
        </span>
      )}
    </div>
  );
}

export function resolveEntities<T extends { id: number }>(
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

export function headingStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontHeading || theme.fontHeading,
    fontWeight: style.fontWeightHeading ?? undefined,
    fontSize: "var(--block-heading-size)",
    textAlign: style.textAlignHeading ?? style.textAlign,
    color: style.textColor || theme.textColor,
  } as const;
}

export function subheadingStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontSubheading || style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightSubheading ?? undefined,
    fontSize: "var(--block-subheading-size)",
    textAlign: style.textAlignSubheading ?? style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

export function textStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightBody ?? undefined,
    fontSize: "var(--block-text-size)",
    textAlign: style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

function resolvePreviewGridClassName(
  previewViewportWidth: number | undefined,
  fallbackClassName: string,
  desktopColumns: 2 | 3,
  tabletColumns: 1 | 2 = 2
) {
  if (typeof previewViewportWidth !== "number" || !Number.isFinite(previewViewportWidth)) {
    return fallbackClassName;
  }
  if (previewViewportWidth < 640) return "grid-cols-1";
  if (previewViewportWidth < 960) {
    return tabletColumns === 2 ? "grid-cols-2" : "grid-cols-1";
  }
  return desktopColumns === 3 ? "grid-cols-3" : "grid-cols-2";
}

export function buttonStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    backgroundColor: style.buttonColor || theme.buttonColor,
    color: style.buttonTextColor || theme.buttonTextColor,
    fontWeight: style.fontWeightBody ?? undefined,
    borderRadius:
      style.buttonRadius !== null ? style.buttonRadius : theme.buttonRadius,
  } as const;
}

export function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

type CoverSlideItem = {
  id: string;
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  imageUrl: string | null;
};

function CoverVariantV2Hero({
  slides,
  style,
  theme,
  contentAlign,
  contentVerticalAlign,
  contentMaxWidth,
  contentMarginLeft,
  coverBackgroundPosition,
  coverHeightCss,
  filterOverlay,
  showArrows,
  showDots,
  infinite,
  autoplayMs,
  arrowSize,
  arrowThickness,
  arrowColorLight,
  arrowColorDark,
  arrowHoverColorLight,
  arrowHoverColorDark,
  arrowBgColorLight,
  arrowBgColorDark,
  arrowHoverBgColorLight,
  arrowHoverBgColorDark,
  arrowShowOutline,
  arrowOutlineColorLight,
  arrowOutlineColorDark,
  arrowOutlineThickness,
  dotSize,
  dotColorLight,
  dotColorDark,
  dotActiveColorLight,
  dotActiveColorDark,
  dotBorderWidth,
  dotBorderColorLight,
  dotBorderColorDark,
  primaryButtonBorderColor,
  primaryButtonHoverBgColorLight,
  primaryButtonHoverBgColorDark,
  themeMode,
  subtitleColor,
  descriptionColor,
  headingDesktopSize,
  textDesktopSize,
  headingMobileSize,
  textMobileSize,
  forceMobileLayout,
}: {
  slides: CoverSlideItem[];
  style: BlockStyle;
  theme: SiteTheme;
  contentAlign: "left" | "center" | "right";
  contentVerticalAlign: "top" | "center" | "bottom";
  contentMaxWidth: string;
  contentMarginLeft: string | number;
  coverBackgroundPosition: string;
  coverHeightCss: string;
  filterOverlay: string;
  showArrows: boolean;
  showDots: boolean;
  infinite: boolean;
  autoplayMs: number;
  arrowSize: "sm" | "md" | "lg" | "xl";
  arrowThickness: number;
  arrowColorLight: string;
  arrowColorDark: string;
  arrowHoverColorLight: string;
  arrowHoverColorDark: string;
  arrowBgColorLight: string;
  arrowBgColorDark: string;
  arrowHoverBgColorLight: string;
  arrowHoverBgColorDark: string;
  arrowShowOutline: boolean;
  arrowOutlineColorLight: string;
  arrowOutlineColorDark: string;
  arrowOutlineThickness: number;
  dotSize: number;
  dotColorLight: string;
  dotColorDark: string;
  dotActiveColorLight: string;
  dotActiveColorDark: string;
  dotBorderWidth: number;
  dotBorderColorLight: string;
  dotBorderColorDark: string;
  primaryButtonBorderColor: string;
  primaryButtonHoverBgColorLight: string;
  primaryButtonHoverBgColorDark: string;
  themeMode: "light" | "dark";
  subtitleColor: string;
  descriptionColor: string;
  headingDesktopSize: number;
  textDesktopSize: number;
  headingMobileSize: number;
  textMobileSize: number;
  forceMobileLayout: boolean;
}) {
  const [index, setIndex] = useState(0);
  const canSlide = slides.length > 1;
  const [hoveredArrow, setHoveredArrow] = useState<"prev" | "next" | null>(null);
  const [hoveredPrimaryButton, setHoveredPrimaryButton] = useState(false);
  const propThemeMode = themeMode === "dark" ? "dark" : "light";
  const [domThemeMode, setDomThemeMode] = useState<"light" | "dark" | null>(null);
  const activeThemeMode = domThemeMode ?? propThemeMode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resolveModeFromDom = () => {
      const root = document.getElementById("public-site-root");
      const mode = root?.getAttribute("data-site-theme");
      if (mode === "light" || mode === "dark") {
        setDomThemeMode(mode);
      }
    };
    resolveModeFromDom();
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: string }>).detail;
      const mode = detail?.mode;
      if (mode === "light" || mode === "dark") {
        setDomThemeMode(mode);
        return;
      }
      resolveModeFromDom();
    };
    window.addEventListener("site-theme-change", onThemeChange as EventListener);
    const root = document.getElementById("public-site-root");
    let observer: MutationObserver | null = null;
    if (root) {
      observer = new MutationObserver(() => resolveModeFromDom());
      observer.observe(root, { attributes: true, attributeFilter: ["data-site-theme"] });
    }
    return () => {
      window.removeEventListener("site-theme-change", onThemeChange as EventListener);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!canSlide || autoplayMs <= 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        const currentIndex = Math.min(prev, slides.length - 1);
        if (infinite) return (currentIndex + 1) % slides.length;
        if (currentIndex >= slides.length - 1) return currentIndex;
        return currentIndex + 1;
      });
    }, autoplayMs);
    return () => clearInterval(timer);
  }, [autoplayMs, canSlide, infinite, slides.length]);

  const safeIndex = slides.length === 0 ? 0 : Math.min(index, slides.length - 1);
  const current = slides[safeIndex] ?? slides[0];
  if (!current) return null;

  const arrowSizeMap = { sm: 40, md: 48, lg: 56, xl: 64 } as const;
  const arrowPx = forceMobileLayout ? 34 : arrowSizeMap[arrowSize] ?? 40;
  const canGoPrev = infinite || safeIndex > 0;
  const canGoNext = infinite || safeIndex < slides.length - 1;
  const goPrev = () => {
    if (!canGoPrev) return;
    setIndex((prev) => {
      const currentIndex = Math.min(prev, slides.length - 1);
      if (infinite) return (currentIndex - 1 + slides.length) % slides.length;
      return Math.max(0, currentIndex - 1);
    });
  };
  const goNext = () => {
    if (!canGoNext) return;
    setIndex((prev) => {
      const currentIndex = Math.min(prev, slides.length - 1);
      if (infinite) return (currentIndex + 1) % slides.length;
      return Math.min(slides.length - 1, currentIndex + 1);
    });
  };

  const buttonHref = current.buttonHref.trim();
  const resolvedButtonHref =
    buttonHref.startsWith("#") ||
    buttonHref.startsWith("/") ||
    buttonHref.startsWith("mailto:") ||
    buttonHref.startsWith("tel:") ||
    buttonHref.startsWith("http://") ||
    buttonHref.startsWith("https://")
      ? buttonHref
      : buttonHref
        ? normalizeExternalHref(buttonHref)
        : "";

  const pickModeColor = (light: string, dark: string) =>
    activeThemeMode === "dark" ? dark || light : light || dark;
  const baseArrowBg = pickModeColor(arrowBgColorLight, arrowBgColorDark);
  const hoverArrowBg = pickModeColor(arrowHoverBgColorLight, arrowHoverBgColorDark) || baseArrowBg;
  const baseArrowColor = pickModeColor(arrowColorLight, arrowColorDark);
  const hoverArrowColor = pickModeColor(arrowHoverColorLight, arrowHoverColorDark) || baseArrowColor;
  const outlineColor = pickModeColor(arrowOutlineColorLight, arrowOutlineColorDark);
  const effectiveOutlineColor =
    outlineColor && outlineColor !== "transparent" ? outlineColor : baseArrowColor;
  const dotColor = pickModeColor(dotColorLight, dotColorDark);
  const dotActiveColor = pickModeColor(dotActiveColorLight, dotActiveColorDark);
  const dotBorderColor = pickModeColor(dotBorderColorLight, dotBorderColorDark);
  const hasPrimaryButtonBorder =
    primaryButtonBorderColor !== "transparent" &&
    primaryButtonBorderColor.toLowerCase() !== "rgba(0,0,0,0)";
  const primaryButtonHoverBgColorRaw = pickModeColor(
    primaryButtonHoverBgColorLight,
    primaryButtonHoverBgColorDark
  );
  const primaryButtonHoverBgColor =
    primaryButtonHoverBgColorRaw &&
    primaryButtonHoverBgColorRaw.toLowerCase() !== "transparent" &&
    isValidColorValue(primaryButtonHoverBgColorRaw)
      ? primaryButtonHoverBgColorRaw
      : "";

  return (
    <section
      className={
        forceMobileLayout
          ? "relative overflow-hidden px-5 py-12"
          : "relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      }
      style={{
        height: coverHeightCss,
        minHeight: coverHeightCss,
        backgroundImage: current.imageUrl ? `url(${current.imageUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: coverBackgroundPosition,
        containerType: "inline-size",
        boxSizing: "border-box",
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: filterOverlay }} />
      <div
        className="relative z-[1] mx-auto flex w-full"
        style={{
          height: "100%",
          minHeight: "100%",
          alignItems:
            contentVerticalAlign === "top"
              ? "flex-start"
              : contentVerticalAlign === "bottom"
                ? "flex-end"
                : "center",
        }}
      >
        <div
          className="w-full"
          style={{
            maxWidth: contentMaxWidth,
            marginLeft: contentMarginLeft,
            marginRight: 0,
          }}
        >
          <h2
            className="text-white leading-[1.08] tracking-[-0.01em]"
            style={{
              ...headingStyle(style, theme),
              textAlign: contentAlign,
              fontSize: `clamp(${headingMobileSize}px, 9cqw, ${Math.max(
                headingMobileSize,
                forceMobileLayout ? headingMobileSize : headingDesktopSize
              )}px)`,
            }}
          >
            {current.title}
          </h2>
          {current.description && (
            <p
              className="mt-5 max-w-[760px] text-white/80 leading-[1.45]"
              style={{
                ...textStyle(style, theme),
                textAlign: contentAlign,
                color: descriptionColor || subtitleColor,
                marginLeft:
                  contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                marginRight: contentAlign === "center" ? "auto" : 0,
                maxWidth: forceMobileLayout ? "calc(100% - 92px)" : 760,
                fontSize: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
                  textMobileSize,
                  forceMobileLayout ? textMobileSize : textDesktopSize
                )}px)`,
              }}
            >
              {current.description}
            </p>
          )}
          {current.buttonText && resolvedButtonHref && (
            <div
              className="mt-6 flex"
              style={{
                justifyContent:
                  contentAlign === "center"
                    ? "center"
                    : contentAlign === "right"
                      ? "flex-end"
                      : "flex-start",
              }}
            >
              <a
                href={resolvedButtonHref}
                className="inline-flex items-center whitespace-nowrap font-semibold"
                onMouseEnter={() => setHoveredPrimaryButton(true)}
                onMouseLeave={() => setHoveredPrimaryButton(false)}
                style={{
                  ...buttonStyle(style, theme),
                  ...(hoveredPrimaryButton && primaryButtonHoverBgColor
                    ? { backgroundColor: primaryButtonHoverBgColor }
                    : {}),
                  borderStyle: "solid",
                  borderWidth: hasPrimaryButtonBorder ? 1 : 0,
                  borderColor: hasPrimaryButtonBorder ? primaryButtonBorderColor : "transparent",
                  minHeight: "clamp(40px, 5.2cqw, 48px)",
                  paddingInline: "clamp(18px, 3cqw, 30px)",
                  paddingBlock: "clamp(8px, 1.1cqw, 11px)",
                  fontSize: "clamp(14px, 2.6cqw, 16px)",
                  transition: "background-color 180ms ease",
                }}
              >
                {current.buttonText}
              </a>
            </div>
          )}
        </div>
      </div>

      {showArrows && canSlide && (
        <>
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="absolute z-[3] inline-flex items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              left: forceMobileLayout ? 10 : 24,
              top: "50%",
              transform: "translateY(-50%)",
              width: arrowPx,
              height: arrowPx,
              color: hoveredArrow === "prev" ? hoverArrowColor : baseArrowColor,
              backgroundColor: hoveredArrow === "prev" ? hoverArrowBg : baseArrowBg,
              borderWidth: arrowShowOutline ? arrowOutlineThickness : 0,
              borderColor: arrowShowOutline ? effectiveOutlineColor : "transparent",
              borderStyle: "solid",
              fontSize: Math.max(18, Math.round(arrowPx * 0.48)),
              lineHeight: 1,
            }}
            aria-label="Предыдущий слайд"
            onMouseEnter={() => setHoveredArrow("prev")}
            onMouseLeave={() => setHoveredArrow(null)}
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto"
              style={{ width: arrowPx * 0.5, height: arrowPx * 0.5 }}
              fill="none"
              stroke={hoveredArrow === "prev" ? hoverArrowColor : baseArrowColor}
              strokeWidth={arrowThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="absolute z-[3] inline-flex items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              right: forceMobileLayout ? 10 : 24,
              top: "50%",
              transform: "translateY(-50%)",
              width: arrowPx,
              height: arrowPx,
              color: hoveredArrow === "next" ? hoverArrowColor : baseArrowColor,
              backgroundColor: hoveredArrow === "next" ? hoverArrowBg : baseArrowBg,
              borderWidth: arrowShowOutline ? arrowOutlineThickness : 0,
              borderColor: arrowShowOutline ? effectiveOutlineColor : "transparent",
              borderStyle: "solid",
              fontSize: Math.max(18, Math.round(arrowPx * 0.48)),
              lineHeight: 1,
            }}
            aria-label="Следующий слайд"
            onMouseEnter={() => setHoveredArrow("next")}
            onMouseLeave={() => setHoveredArrow(null)}
          >
            <svg
              viewBox="0 0 24 24"
              className="mx-auto"
              style={{ width: arrowPx * 0.5, height: arrowPx * 0.5 }}
              fill="none"
              stroke={hoveredArrow === "next" ? hoverArrowColor : baseArrowColor}
              strokeWidth={arrowThickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </>
      )}

      {showDots && canSlide && (
        <div className="absolute bottom-6 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id || `cover-slide-dot-${slideIndex}`}
              type="button"
              onClick={() => setIndex(slideIndex)}
              className="rounded-full transition"
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: 999,
                backgroundColor: slideIndex === safeIndex ? dotActiveColor : dotColor,
                borderStyle: "solid",
                borderWidth: dotBorderWidth,
                borderColor: dotBorderColor,
              }}
              aria-label={`Слайд ${slideIndex + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function renderCover(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  theme: SiteTheme,
  style: BlockStyle,
  forceMobileLayout = false,
  parallaxOffset = 0
) {
  const data = block.data as Record<string, unknown>;
  const animHeading = String(data.animHeading ?? "none");
  const animSubtitle = String(data.animSubtitle ?? "none");
  const animDescription = String(data.animDescription ?? "none");
  const animButton = String(data.animButton ?? "none");
  const resolveAnimClass = (value: string) => (value && value !== "none" ? `bp-anim bp-anim-${value}` : "");
  const resolveAnimStyle = (value: string, delayMs: number) =>
    value && value !== "none" ? ({ animationDelay: `${delayMs}ms` } as CSSProperties) : undefined;
  const title = (data.title as string) || "Онлайн-запись";
  const subtitle = (data.subtitle as string) || "";
  const description = (data.description as string) || "";
  const align = (data.align as "left" | "center" | "right") ?? style.textAlign;
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
  const secondaryButtonHrefRaw =
    typeof data.secondaryButtonHref === "string" ? data.secondaryButtonHref.trim() : "";
  const socialHref = resolvePrimarySocialHref(accountProfile, secondaryButtonSource);
  const secondaryButtonHref = secondaryButtonHrefRaw || socialHref;
  const pickCoverModeValue = (lightRaw: string, darkRaw: string) =>
    theme.mode === "dark" ? darkRaw || lightRaw : lightRaw || darkRaw;
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
  const filterStartColorLightRaw =
    typeof data.coverFilterStartColor === "string" ? data.coverFilterStartColor.trim() : "";
  const filterStartColorDarkRaw =
    typeof data.coverFilterStartColorDark === "string" ? data.coverFilterStartColorDark.trim() : "";
  const filterStartColorRaw = pickCoverModeValue(filterStartColorLightRaw, filterStartColorDarkRaw);
  const filterStartColor =
    filterStartColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(filterStartColorRaw)
        ? filterStartColorRaw
        : "#000000";
  const filterEndColorLightRaw =
    typeof data.coverFilterEndColor === "string" ? data.coverFilterEndColor.trim() : "";
  const filterEndColorDarkRaw =
    typeof data.coverFilterEndColorDark === "string" ? data.coverFilterEndColorDark.trim() : "";
  const filterEndColorRaw = pickCoverModeValue(filterEndColorLightRaw, filterEndColorDarkRaw);
  const filterEndColor =
    filterEndColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(filterEndColorRaw)
        ? filterEndColorRaw
        : "#0f0f0f";
  const filterStartOpacityLight = Number.isFinite(Number(data.coverFilterStartOpacity))
    ? Math.max(0, Math.min(100, Number(data.coverFilterStartOpacity)))
    : 10;
  const filterStartOpacityDark = Number.isFinite(Number(data.coverFilterStartOpacityDark))
    ? Math.max(0, Math.min(100, Number(data.coverFilterStartOpacityDark)))
    : filterStartOpacityLight;
  const filterStartOpacity = theme.mode === "dark" ? filterStartOpacityDark : filterStartOpacityLight;
  const filterEndOpacityLight = Number.isFinite(Number(data.coverFilterEndOpacity))
    ? Math.max(0, Math.min(100, Number(data.coverFilterEndOpacity)))
    : 60;
  const filterEndOpacityDark = Number.isFinite(Number(data.coverFilterEndOpacityDark))
    ? Math.max(0, Math.min(100, Number(data.coverFilterEndOpacityDark)))
    : filterEndOpacityLight;
  const filterEndOpacity = theme.mode === "dark" ? filterEndOpacityDark : filterEndOpacityLight;
  const toOverlayRgba = (color: string, opacity: number, fallbackHex: string) => {
    if (color === "transparent") return "rgba(0, 0, 0, 0)";
    const safeHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallbackHex;
    return hexToRgbaString(safeHex, opacity / 100);
  };
  const filterOverlay = `linear-gradient(180deg, ${toOverlayRgba(
    filterStartColor,
    filterStartOpacity,
    "#000000"
  )}, ${toOverlayRgba(filterEndColor, filterEndOpacity, "#0f0f0f")})`;
  const arrowModeLight = data.coverArrow === "down" ? "down" : "none";
  const arrowModeDarkRaw =
    data.coverArrowDark === "down" ? "down" : data.coverArrowDark === "none" ? "none" : "";
  const arrowMode = theme.mode === "dark" ? arrowModeDarkRaw || arrowModeLight : arrowModeLight;
  const arrowColorLightRaw = typeof data.coverArrowColor === "string" ? data.coverArrowColor.trim() : "";
  const arrowColorDarkRaw = typeof data.coverArrowColorDark === "string" ? data.coverArrowColorDark.trim() : "";
  const arrowColorRaw = pickCoverModeValue(arrowColorLightRaw, arrowColorDarkRaw);
  const arrowColor =
    arrowColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(arrowColorRaw)
        ? arrowColorRaw
        : "#ffffff";
  const animateArrow = Boolean(data.coverArrowAnimated);
  const subtitleColorLightRaw =
    typeof data.coverSubtitleColor === "string" ? data.coverSubtitleColor.trim() : "";
  const subtitleColorDarkRaw =
    typeof data.coverSubtitleColorDark === "string" ? data.coverSubtitleColorDark.trim() : "";
  const subtitleColorRaw = pickCoverModeValue(subtitleColorLightRaw, subtitleColorDarkRaw);
  const subtitleColor =
    subtitleColorRaw && isValidColorValue(subtitleColorRaw) ? subtitleColorRaw : "#ffffff";
  const descriptionColorLightRaw =
    typeof data.coverDescriptionColor === "string" ? data.coverDescriptionColor.trim() : "";
  const descriptionColorDarkRaw =
    typeof data.coverDescriptionColorDark === "string" ? data.coverDescriptionColorDark.trim() : "";
  const descriptionColorRaw = pickCoverModeValue(descriptionColorLightRaw, descriptionColorDarkRaw);
  const descriptionColor =
    descriptionColorRaw && isValidColorValue(descriptionColorRaw)
      ? descriptionColorRaw
      : "#ffffff";
  const headingDesktopSize = style.headingSize ?? theme.headingSize;
  const subheadingDesktopSize = style.subheadingSize ?? theme.subheadingSize;
  const textDesktopSize = style.textSize ?? theme.textSize;
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
  const effectiveHeadingMobileSize = forceMobileLayout
    ? Math.max(24, Math.min(38, headingMobileSize))
    : headingMobileSize;
  const effectiveSubheadingMobileSize = forceMobileLayout
    ? Math.max(16, Math.min(22, subheadingMobileSize))
    : subheadingMobileSize;
  const effectiveTextMobileSize = forceMobileLayout
    ? Math.max(13, Math.min(17, textMobileSize))
    : textMobileSize;
  const v1SubheadingMobileSize = forceMobileLayout
    ? Math.max(15, Math.min(20, effectiveSubheadingMobileSize))
    : effectiveSubheadingMobileSize;
  const v1TextMobileSize = forceMobileLayout
    ? Math.max(13, Math.min(16, effectiveTextMobileSize))
    : effectiveTextMobileSize;
  const effectiveCoverHeightCss = forceMobileLayout ? "min(680px, 100svh)" : coverHeightCss;
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
  const sliderArrowOutlineColor =
    theme.mode === "dark"
      ? sliderArrowOutlineColorDark || sliderArrowOutlineColorLight
      : sliderArrowOutlineColorLight || sliderArrowOutlineColorDark;
  const sliderArrowShowOutline =
    sliderArrowOutlineColor !== "transparent" ||
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
  const rawSlides = Array.isArray(data.coverSlides)
    ? (data.coverSlides as Array<Record<string, unknown>>)
    : [];
  const coverSlides: CoverSlideItem[] = rawSlides
    .map((slide, idx) => {
      const slideTitle = typeof slide.title === "string" ? slide.title.trim() : "";
      const slideDescription = typeof slide.description === "string" ? slide.description.trim() : "";
      const slideButtonText =
        typeof slide.buttonText === "string" ? slide.buttonText.trim() : "";
      const slideButtonPageRaw =
        typeof slide.buttonPage === "string" ? slide.buttonPage.trim() : "";
      const slideButtonHref =
        typeof slide.buttonHref === "string" ? slide.buttonHref.trim() : "";
      const slideImage = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : "";
      const localizedTitle = slideTitle;
      const localizedDescription = slideDescription;
      const localizedButtonText = slideButtonText === "Read more" ? "Подробнее" : slideButtonText;
      const resolvedPageHref = resolveCoverSlideTargetHref(
        slideButtonPageRaw,
        account,
        locations,
        services,
        specialists
      );
      return {
        id:
          typeof slide.id === "string" && slide.id.trim()
            ? slide.id.trim()
            : `slide-${idx + 1}`,
        title: localizedTitle || title,
        description: localizedDescription || description || subtitle,
        buttonText: localizedButtonText || buttonText || "Подробнее",
        buttonHref:
          resolvedPageHref ||
          slideButtonHref ||
          (account.publicSlug ? buildBookingLink({ publicSlug: account.publicSlug }) : "#"),
        imageUrl: slideImage || null,
      };
    })
    .filter((slide) => Boolean(slide.imageUrl || slide.title || slide.description || slide.buttonText));
  const normalizedCoverSlides =
    coverSlides.length > 0
      ? coverSlides
      : [
          {
            id: "slide-fallback",
            title: title || "Онлайн-запись",
            description: description || subtitle,
            buttonText: buttonText || "Подробнее",
            buttonHref: account.publicSlug ? buildBookingLink({ publicSlug: account.publicSlug }) : "#",
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
  const contentMaxWidth = forceMobileLayout ? "100%" : gridWidthPercent;
  const contentMarginLeft = forceMobileLayout ? 0 : gridLeftPercent;
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

  if (block.variant === "v2") {
    return (
      <CoverVariantV2Hero
        slides={normalizedCoverSlides}
        style={style}
        theme={theme}
        contentAlign={contentAlign}
        contentVerticalAlign={contentVerticalAlign}
        contentMaxWidth={contentMaxWidth}
        contentMarginLeft={contentMarginLeft}
        coverBackgroundPosition={coverBackgroundPosition}
        coverHeightCss={effectiveCoverHeightCss}
        filterOverlay={filterOverlay}
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
        subtitleColor={subtitleColor}
        descriptionColor={descriptionColor}
        headingDesktopSize={headingDesktopSize}
        textDesktopSize={textDesktopSize}
        headingMobileSize={effectiveHeadingMobileSize}
        textMobileSize={effectiveTextMobileSize}
        forceMobileLayout={forceMobileLayout}
      />
    );
  }

  if (block.variant === "v3") {
    const textHorizontalJustify =
      forceMobileLayout
        ? "center"
        : contentAlign === "center"
          ? "center"
          : contentAlign === "right"
            ? "flex-end"
            : "flex-start";
    const textVerticalAlignItems =
      forceMobileLayout
        ? "flex-start"
        : contentVerticalAlign === "top"
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
        className="relative overflow-hidden"
        style={{
          height: forceMobileLayout ? "auto" : coverHeightCss,
          minHeight: forceMobileLayout ? 0 : coverHeightCss,
          containerType: "inline-size",
          backgroundColor: sectionBackground.backgroundColor,
          backgroundImage: sectionBackground.backgroundImage,
        }}
      >
        <div
          className={
            forceMobileLayout
              ? "mx-auto flex w-full flex-col"
              : `mx-auto flex w-full flex-col ${
                  coverFlipHorizontal ? "md:flex-row-reverse" : "md:flex-row"
                }`
          }
          style={{
            height: forceMobileLayout ? "auto" : coverHeightCss,
            minHeight: forceMobileLayout ? 0 : coverHeightCss,
            width: "100%",
          }}
        >
          <div
            className={forceMobileLayout ? "w-full" : "w-full md:w-1/2"}
            style={{
              height: forceMobileLayout ? "300px" : coverHeightCss,
              minHeight: forceMobileLayout ? "300px" : coverHeightCss,
              padding: forceMobileLayout ? Math.min(coverImageInsetPx, 16) : coverImageInsetPx,
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
                style={{ backgroundImage: filterOverlay }}
              />
            </div>
          </div>

          <div
            className={forceMobileLayout ? "w-full" : "w-full md:w-1/2"}
            style={{
              display: "flex",
              justifyContent: textHorizontalJustify,
              alignItems: textVerticalAlignItems,
              height: forceMobileLayout ? "auto" : coverHeightCss,
              minHeight: forceMobileLayout ? 0 : coverHeightCss,
              padding: forceMobileLayout ? "28px 20px 34px" : "56px 64px 56px 56px",
              backgroundColor: textColumnBackground.backgroundColor,
              backgroundImage: textColumnBackground.backgroundImage,
              boxSizing: "border-box",
            }}
          >
            <div style={{ width: "min(100%, 640px)" }}>
              <h2
                className={`leading-[1.08] tracking-[-0.01em] ${resolveAnimClass(animHeading)}`}
                style={{
                  ...headingStyle(style, theme),
                  textAlign: contentAlign,
                  fontSize: `clamp(${effectiveHeadingMobileSize}px, ${forceMobileLayout ? "8cqw" : "9cqw"}, ${Math.max(
                    effectiveHeadingMobileSize,
                    forceMobileLayout ? effectiveHeadingMobileSize : headingDesktopSize
                  )}px)`,
                  ...(resolveAnimStyle(animHeading, 0) ?? {}),
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  className={`mt-6 leading-[1.25] ${resolveAnimClass(animSubtitle)}`}
                  style={{
                    ...subheadingStyle(style, theme),
                    color: subtitleColor,
                textAlign: contentAlign,
                fontSize: `clamp(${v1SubheadingMobileSize}px, ${forceMobileLayout ? "4.6cqw" : "5.8cqw"}, ${Math.max(
                  v1SubheadingMobileSize,
                  forceMobileLayout ? effectiveSubheadingMobileSize : subheadingDesktopSize
                )}px)`,
                    ...(resolveAnimStyle(animSubtitle, 120) ?? {}),
                  }}
                >
                  {subtitle}
                </p>
              )}
              {description && (
                <p
                  className={`mt-5 max-w-[720px] leading-[1.45] ${resolveAnimClass(animDescription)}`}
                  style={{
                    ...textStyle(style, theme),
                    color: descriptionColor,
                    textAlign: contentAlign,
                    marginLeft:
                      contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                    marginRight: contentAlign === "center" ? "auto" : 0,
                    fontSize: `clamp(${effectiveTextMobileSize}px, ${forceMobileLayout ? "4.4cqw" : "4.2cqw"}, ${Math.max(
                      effectiveTextMobileSize,
                      forceMobileLayout ? effectiveTextMobileSize : textDesktopSize
                    )}px)`,
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
                {showButton && account.publicSlug && (
                  <a
                    href={buildBookingLink({ publicSlug: account.publicSlug })}
                    className={`bp-cover-primary-hover inline-flex items-center whitespace-nowrap font-semibold ${resolveAnimClass(animButton)}`}
                    style={{
                      ...buttonStyle(style, theme),
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
                      paddingInline: forceMobileLayout ? "20px" : "clamp(24px, 3.2cqw, 40px)",
                      paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                      fontSize: "clamp(14px, 2cqw, 16px)",
                      transition: "background-color 180ms ease",
                      ...(resolveAnimStyle(animButton, 320) ?? {}),
                    }}
                  >
                    {buttonText}
                  </a>
                )}
                {showSecondaryButton && secondaryButtonHref && (
                  <a
                    href={secondaryButtonHref}
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
                          : buttonStyle(style, theme).color,
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
                      paddingInline: forceMobileLayout ? "20px" : "clamp(24px, 3.2cqw, 40px)",
                      paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                      fontSize: "clamp(14px, 2cqw, 16px)",
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
  const coverMotionScale =
    scrollEffect === "parallax"
      ? 1 + Math.min(0.12, Math.abs(parallaxOffset) / 1200)
      : 1;

  return (
      <section
      className={
        forceMobileLayout
          ? "relative overflow-hidden px-4 py-14"
          : "relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      }
      style={{
        ...(showMotionLayer
          ? { backgroundColor: "transparent", backgroundImage: "none" }
          : backgroundStyle),
        height: effectiveCoverHeightCss,
        minHeight: effectiveCoverHeightCss,
        containerType: "inline-size",
        boxSizing: "border-box",
      }}
    >
      {showMotionLayer && (
        <div
          className="pointer-events-none absolute -top-[180px] -bottom-[180px] left-0 right-0"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: coverBackgroundPosition,
            transform: `translate3d(0, ${parallaxOffset.toFixed(1)}px, 0) scale(${coverMotionScale.toFixed(3)})`,
            transformOrigin: "center",
            willChange: "transform",
          }}
        />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: filterOverlay }} />
      <div className="relative z-[1] mx-auto flex w-full items-center" style={{ height: "100%", minHeight: "100%" }}>
        <div
          className="bp-cover-content w-full"
          style={{
            maxWidth: contentMaxWidth,
            marginLeft: contentMarginLeft,
            marginRight: 0,
          }}
        >
          <h2
            className={`text-white leading-[1.08] tracking-[-0.01em] ${resolveAnimClass(animHeading)}`}
            style={{
              ...headingStyle(style, theme),
              textAlign: contentAlign,
              fontSize: `clamp(${effectiveHeadingMobileSize}px, ${forceMobileLayout ? "8cqw" : "9cqw"}, ${Math.max(
                effectiveHeadingMobileSize,
                forceMobileLayout ? effectiveHeadingMobileSize : headingDesktopSize
              )}px)`,
              ...(resolveAnimStyle(animHeading, 0) ?? {}),
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={`mt-6 text-white/90 leading-[1.25] ${resolveAnimClass(animSubtitle)}`}
              style={{
                ...subheadingStyle(style, theme),
                textAlign: contentAlign,
                color: subtitleColor,
                fontSize: `clamp(${effectiveSubheadingMobileSize}px, ${forceMobileLayout ? "5cqw" : "5.8cqw"}, ${Math.max(
                  effectiveSubheadingMobileSize,
                  forceMobileLayout ? effectiveSubheadingMobileSize : subheadingDesktopSize
                )}px)`,
                ...(resolveAnimStyle(animSubtitle, 120) ?? {}),
              }}
            >
              {subtitle}
            </p>
          )}
          {description && (
            <p
              className={`mt-5 max-w-[720px] text-white/80 leading-[1.45] ${resolveAnimClass(animDescription)}`}
              style={{
                ...textStyle(style, theme),
                textAlign: contentAlign,
                marginLeft:
                  contentAlign === "center" || contentAlign === "right" ? "auto" : 0,
                marginRight: contentAlign === "center" ? "auto" : 0,
                color: descriptionColor,
                fontSize: `clamp(${v1TextMobileSize}px, ${forceMobileLayout ? "4cqw" : "4.2cqw"}, ${Math.max(
                  v1TextMobileSize,
                  forceMobileLayout ? effectiveTextMobileSize : textDesktopSize
                )}px)`,
                ...(resolveAnimStyle(animDescription, subtitle ? 220 : 120) ?? {}),
              }}
            >
              {description}
            </p>
          )}
          <div
            className="mt-7 flex flex-wrap items-center gap-3"
            style={{
              flexWrap: "wrap",
              justifyContent:
                contentAlign === "center"
                  ? "center"
                  : contentAlign === "right"
                    ? "flex-end"
                    : "flex-start",
            }}
          >
            {showButton && account.publicSlug && (
                <a
                  href={buildBookingLink({ publicSlug: account.publicSlug })}
                  className={`bp-cover-primary-hover inline-flex items-center whitespace-nowrap font-semibold ${resolveAnimClass(animButton)}`}
                  style={{
                    ...buttonStyle(style, theme),
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
                    minHeight: forceMobileLayout ? 44 : "clamp(46px, 6cqw, 54px)",
                    paddingInline: forceMobileLayout ? "18px" : "clamp(24px, 3.2cqw, 40px)",
                    paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                    fontSize: "clamp(14px, 2cqw, 16px)",
                    transition: "background-color 180ms ease",
                    ...(resolveAnimStyle(animButton, 320) ?? {}),
                  }}
                >
                  {buttonText}
                </a>
              )}
            {showSecondaryButton && secondaryButtonHref && (
                <a
                  href={secondaryButtonHref}
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
                    minHeight: forceMobileLayout ? 44 : "clamp(46px, 6cqw, 54px)",
                    paddingInline: forceMobileLayout ? "18px" : "clamp(24px, 3.2cqw, 40px)",
                    paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                    fontSize: "clamp(14px, 2cqw, 16px)",
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
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={arrowColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      )}
    </section>
  );
}

export function normalizeExternalHref(value: string): string {
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

function resolveSitePageHref(pageKey: SitePageKey, account: AccountInfo): string {
  const basePath = account.publicSlug ? `/${account.publicSlug}` : "#";
  if (pageKey === "home") return basePath;
  if (pageKey === "booking") return `${basePath}/booking`;
  if (pageKey === "client") return `/c?account=${account.slug}`;
  return `${basePath}/${pageKey === "promos" ? "promos" : pageKey}`;
}

function resolveCoverSlideTargetHref(
  target: string,
  account: AccountInfo,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[]
): string {
  const normalizedTarget = target.trim();
  if (!normalizedTarget) return "";
  if (PAGE_KEYS.includes(normalizedTarget as SitePageKey)) {
    return resolveSitePageHref(normalizedTarget as SitePageKey, account);
  }
  if (!account.publicSlug) return "";
  const basePath = `/${account.publicSlug}`;

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
}

export function resolveSocialHrefByKey(accountProfile: AccountProfile, key: string): string | null {
  const rawValue =
    key === "website"
      ? accountProfile.websiteUrl
      : key === "instagram"
        ? accountProfile.instagramUrl
        : key === "whatsapp"
          ? accountProfile.whatsappUrl
          : key === "telegram"
            ? accountProfile.telegramUrl
            : key === "max"
              ? accountProfile.maxUrl
              : key === "vk"
                ? accountProfile.vkUrl
                : key === "viber"
                  ? accountProfile.viberUrl
                  : key === "pinterest"
                    ? accountProfile.pinterestUrl
                    : key === "facebook"
                      ? accountProfile.facebookUrl
                      : key === "tiktok"
                        ? accountProfile.tiktokUrl
                        : key === "youtube"
                          ? accountProfile.youtubeUrl
                          : key === "twitter"
                            ? accountProfile.twitterUrl
                            : key === "dzen"
                              ? accountProfile.dzenUrl
                              : key === "ok"
                                ? accountProfile.okUrl
                                : undefined;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!trimmed) return null;
  return normalizeExternalHref(trimmed);
}

export function resolvePrimarySocialHref(
  accountProfile: AccountProfile,
  preferredSource: string = "auto"
): string | null {
  if (preferredSource && preferredSource !== "auto") {
    return resolveSocialHrefByKey(accountProfile, preferredSource);
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
    const href = resolveSocialHrefByKey(accountProfile, key);
    if (href) return href;
  }
  return null;
}

export function resolveCoverImage(
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

export function renderMenuBlock(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  promos: PromoItem[],
  theme: SiteTheme,
  style: BlockStyle,
  onThemeToggle: () => void,
  previewViewportWidth?: number
) {
  const data = block.data as Record<string, unknown>;
  const menuItems = Array.isArray(data.menuItems)
    ? (data.menuItems as SitePageKey[]).filter((item) => item in PAGE_LABELS)
    : PAGE_KEYS;
  const showLogo = data.showLogo !== false;
  const showCompanyName = data.showCompanyName !== false;
  const showButton = Boolean(data.showButton);
  const showThemeToggle = Boolean(data.showThemeToggle);
  const ctaMode = (data.ctaMode as string) || "booking";
  const phoneValue =
    (data.phoneOverride as string) || accountProfile.phone || "";
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
  const showSearch = Boolean(data.showSearch);
  const showAccount = Boolean(data.showAccount);
  const accountLink = account.slug ? `/c/login?account=${account.slug}` : "/c/login";
  const position = data.position === "sticky" ? "sticky" : "static";
  const showSocials = Boolean(data.showSocials);
  const socialIconSizeRaw = Number(data.socialIconSize);
  const socialIconSize =
    Number.isFinite(socialIconSizeRaw) && socialIconSizeRaw >= 24 && socialIconSizeRaw <= 72
      ? Math.round(socialIconSizeRaw)
      : 40;
  const socialGlyphSize = Math.max(14, Math.round(socialIconSize * 0.55));
  const socialsMode = (data.socialsMode as string) || "auto";
  const socialsCustom = (data.socialsCustom as Record<string, string>) ?? {};
  const accountTitleRaw =
    typeof data.accountTitle === "string" ? data.accountTitle.trim() : "";
  const accountTitle = accountTitleRaw || account.name;
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
  const menuBlockBgRaw =
    theme.mode === "dark" ? style.blockBgDark.trim() : style.blockBgLight.trim();
  const menuBlockBgExplicitTransparent =
    menuBlockBgRaw.toLowerCase() === "transparent";
  const menuBlockBgResolved =
    theme.mode === "dark" ? style.blockBgDarkResolved : style.blockBgLightResolved;
  const menuSectionBgResolved =
    theme.mode === "dark" ? style.sectionBgDarkResolved : style.sectionBgLightResolved;
  const menuFallbackBg =
    menuBlockBgExplicitTransparent
      ? "transparent"
      : menuBlockBgResolved && menuBlockBgResolved !== "transparent"
      ? menuBlockBgResolved
      : menuSectionBgResolved && menuSectionBgResolved !== "transparent"
        ? menuSectionBgResolved
        : theme.mode === "dark"
          ? "#111827"
          : "#ffffff";
  const menuBarBackground = resolveMenuBlockBackgroundVisual(data, menuFallbackBg, theme.mode);
  const menuGradient = menuBarBackground.backgroundImage;
  const menuTopBg = menuBarBackground.backgroundColor;
  const menuTextAlign = (style.textAlignHeading ?? style.textAlign ?? "left") as
    | "left"
    | "center"
    | "right";
  const alignClass =
    menuTextAlign === "center"
      ? "justify-center text-center"
      : menuTextAlign === "right"
        ? "justify-end text-right"
        : "justify-start text-left";
  const stackAlignClass =
    menuTextAlign === "center"
      ? "items-center text-center"
      : menuTextAlign === "right"
        ? "items-end text-right"
        : "items-start text-left";
  const basePath = account.publicSlug ? `/${account.publicSlug}` : "#";
  const forceMobileLayout =
    typeof previewViewportWidth === "number" &&
    Number.isFinite(previewViewportWidth) &&
    previewViewportWidth < 960;
  const logoImageNode =
    showLogo && branding.logoUrl ? (
      <UnoptimizedImage
        src={branding.logoUrl}
        alt=""
        className="block"
        style={{ height: logoImageHeight, width: "auto" }}
      />
    ) : null;
  const companyNameNode = showCompanyName ? (
    <span
      className="font-semibold leading-none text-[color:var(--bp-muted)]"
      style={{ ...textStyle(style, theme), lineHeight: 1.1 }}
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
            ? `/c?account=${account.slug}`
            : `${basePath}/${key === "promos" ? "promos" : key}`;
    return (
      <a
        key={key}
        href={href}
        className="font-medium whitespace-nowrap"
        style={{
          ...headingStyle(style, theme),
          color: "var(--block-text, var(--bp-ink))",
        }}
      >
        {PAGE_LABELS[key]}
      </a>
    );
  });
  const overlayLinkItems = menuItems.map((key) => {
    const href =
      key === "home"
        ? basePath
        : key === "booking"
          ? `${basePath}/booking`
          : key === "client"
            ? `/c?account=${account.slug}`
            : `${basePath}/${key === "promos" ? "promos" : key}`;
    return (
      <a
        key={`${key}-overlay`}
        href={href}
        className="w-full max-w-full break-words text-3xl font-medium leading-tight md:text-5xl"
        style={{
          ...headingStyle(style, theme),
          textAlign: menuTextAlign,
          maxWidth: "100%",
          overflowWrap: "anywhere",
          ...(forceMobileLayout
            ? { fontSize: "28px", lineHeight: 1.18 }
            : block.variant === "v2"
            ? { fontSize: "calc(var(--block-heading-size) + 12px)", lineHeight: 1.25 }
            : {}),
        }}
      >
        {PAGE_LABELS[key]}
      </a>
    );
  });

  const accountIcon = (
      <a
        href={accountLink}
        className="inline-flex h-14 w-14 items-center justify-center rounded-none border border-transparent bg-transparent text-sm text-[color:var(--bp-ink)]"
        title="Личный кабинет"
        aria-label="Личный кабинет"
      >
      <IconUser />
    </a>
  );
    const themeToggleNode = showThemeToggle ? (
      <button
        type="button"
        onClick={onThemeToggle}
        className="inline-flex h-14 w-14 items-center justify-center rounded-none border border-transparent bg-transparent text-sm text-[color:var(--bp-ink)]"
        aria-label="Переключить тему"
        title="Переключить тему"
      >
      {theme.mode === "dark" ? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M12.741 20.917a9.389 9.389 0 0 1-1.395-.105a9.141 9.141 0 0 1-1.465-17.7a1.177 1.177 0 0 1 1.21.281a1.273 1.273 0 0 1 .325 1.293a8.112 8.112 0 0 0-.353 2.68a8.266 8.266 0 0 0 4.366 6.857a7.628 7.628 0 0 0 3.711.993a1.242 1.242 0 0 1 .994 1.963a9.148 9.148 0 0 1-7.393 3.738ZM10.261 4.05a.211.211 0 0 0-.065.011a8.137 8.137 0 1 0 9.131 12.526a.224.224 0 0 0 .013-.235a.232.232 0 0 0-.206-.136a8.619 8.619 0 0 1-4.188-1.116a9.274 9.274 0 0 1-4.883-7.7a9.123 9.123 0 0 1 .4-3.008a.286.286 0 0 0-.069-.285a.184.184 0 0 0-.133-.057Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </g>
        </svg>
      )}
    </button>
  ) : null;

  const socialsAuto: Record<string, string | undefined> = {
    website: accountProfile.websiteUrl,
    instagram: accountProfile.instagramUrl,
    whatsapp: accountProfile.whatsappUrl,
    telegram: accountProfile.telegramUrl,
    max: accountProfile.maxUrl,
    vk: accountProfile.vkUrl,
    viber: accountProfile.viberUrl,
    pinterest: accountProfile.pinterestUrl,
    facebook: accountProfile.facebookUrl,
    tiktok: accountProfile.tiktokUrl,
    youtube: accountProfile.youtubeUrl,
    twitter: accountProfile.twitterUrl,
    dzen: accountProfile.dzenUrl,
    ok: accountProfile.okUrl,
  };

  const socialEntries = Object.keys(SOCIAL_LABELS).map((key) => {
    const url =
      socialsMode === "custom" ? socialsCustom[key] : socialsAuto[key];
    return url ? { key, url } : null;
  }).filter(Boolean) as Array<{ key: string; url: string }>;

  const socialsNode =
    showSocials && socialEntries.length ? (
      <div className="flex items-center gap-2">
        {socialEntries.map((item) => (
          <a
            key={item.key}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-14 w-14 items-center justify-center rounded-none border border-transparent bg-transparent"
            style={{ width: socialIconSize, height: socialIconSize }}
            title={SOCIAL_LABELS[item.key]}
          >
            <UnoptimizedImage
              src={SOCIAL_ICONS[item.key]}
              alt=""
              className="h-7 w-7"
              style={{ width: socialGlyphSize, height: socialGlyphSize }}
            />
          </a>
        ))}
      </div>
    ) : null;
  const ctaTypographyStyle: CSSProperties = {
    fontFamily: style.fontSubheading || style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightSubheading ?? style.fontWeightBody ?? undefined,
    fontSize: "var(--block-subheading-size)",
    lineHeight: 1.15,
  };
  const ctaNode =
    showButton && account.publicSlug && (ctaMode === "booking" || phoneValue) ? (
      <a
        href={
          ctaMode === "phone" && phoneValue
            ? `tel:${phoneValue}`
            : buildBookingLink({ publicSlug: account.publicSlug })
        }
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={{
          ...buttonStyle(style, theme),
          ...ctaTypographyStyle,
          borderRadius: `${menuButtonRadius}px`,
          borderStyle: "solid",
          borderWidth: menuButtonBorderColorByMode === "transparent" ? 0 : 1,
          borderColor: menuButtonBorderColorByMode,
        }}
      >
        {ctaMode === "phone" && phoneValue ? phoneValue : buttonText}
      </a>
    ) : null;

  const searchNode =
    showSearch && account.publicSlug ? (
      <MenuSearch
        publicSlug={account.publicSlug}
        locations={locations}
        services={services}
        specialists={specialists}
        promos={promos}
      />
    ) : null;
  const menuSubBlockBgResolved =
    theme.mode === "dark" ? style.subBlockBgDarkResolved : style.subBlockBgLightResolved;
  const subBlockBg =
    menuSubBlockBgResolved && menuSubBlockBgResolved !== "transparent"
      ? menuSubBlockBgResolved
      : menuTopBg;
  const subBlockBorder =
    (style.borderColor || theme.borderColor || "").trim() || "transparent";

  return (
    <MenuPreview
      variant={block.variant}
      alignClass={alignClass}
      logoNode={logoNode}
      navNode={
        <div
          className={
            block.variant === "v1"
              ? "flex items-center gap-4 whitespace-nowrap"
              : "flex flex-wrap items-center gap-4"
          }
        >
          {linkItems}
        </div>
      }
      drawerNavNode={
        <div className={`flex flex-col gap-2 ${stackAlignClass}`}>
          {menuItems.map((key) => {
            const href =
              key === "home"
                ? basePath
                : key === "booking"
                  ? `${basePath}/booking`
                  : key === "client"
                    ? `/c?account=${account.slug}`
                    : `${basePath}/${key === "promos" ? "promos" : key}`;
            return (
              <a
                key={`${key}-drawer`}
                href={href}
                className={`max-w-full break-words font-medium leading-tight text-[color:var(--block-text,var(--bp-ink))] ${
                  block.variant === "v3" ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
                }`}
                style={{
                  ...headingStyle(style, theme),
                  maxWidth: "100%",
                  overflowWrap: "anywhere",
                  ...(forceMobileLayout
                    ? { fontSize: block.variant === "v3" ? "28px" : "24px", lineHeight: 1.18 }
                    : block.variant === "v3"
                    ? { fontSize: "calc(var(--block-heading-size) + 16px)", lineHeight: 1.25 }
                    : {}),
                }}
              >
                {PAGE_LABELS[key]}
              </a>
            );
          })}
        </div>
      }
      overlayNavNode={
        <div className={`flex w-full flex-col gap-6 ${stackAlignClass}`}>
          {overlayLinkItems}
        </div>
      }
      searchNode={searchNode}
      socialsNode={socialsNode}
      accountNode={showAccount ? accountIcon : null}
      themeToggleNode={themeToggleNode}
      ctaNode={ctaNode}
      position={position}
      menuHeight={menuHeight}
      menuButtonSize={menuButtonSize}
      blockBg={menuTopBg}
      menuGradient={menuGradient}
      subBlockBg={subBlockBg}
      subBlockBorder={subBlockBorder}
      forceMobileLayout={forceMobileLayout}
    />
  );
}

export function MenuPreview({
  variant,
  alignClass,
  logoNode,
  navNode,
  drawerNavNode,
  overlayNavNode,
  searchNode,
  socialsNode,
  accountNode,
  themeToggleNode,
  ctaNode,
  position,
  menuHeight,
  menuButtonSize,
  blockBg,
  menuGradient,
  subBlockBg,
  subBlockBorder,
  forceMobileLayout = false,
}: {
  variant: "v1" | "v2" | "v3" | "v4" | "v5";
  alignClass: string;
  logoNode: React.ReactNode | null;
  navNode: React.ReactNode;
  drawerNavNode: React.ReactNode;
  overlayNavNode: React.ReactNode;
  searchNode: React.ReactNode | null;
  socialsNode: React.ReactNode | null;
  accountNode: React.ReactNode | null;
  themeToggleNode: React.ReactNode | null;
  ctaNode: React.ReactNode | null;
  position: "static" | "sticky";
  menuHeight: number;
  menuButtonSize: number;
  blockBg: string;
  menuGradient: string;
  subBlockBg: string;
  subBlockBorder: string;
  forceMobileLayout?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavNode = drawerNavNode || overlayNavNode || navNode;
  const subBlockStyle: React.CSSProperties = {
    backgroundColor: subBlockBg,
    borderColor: subBlockBorder,
    borderWidth: subBlockBorder === "transparent" ? 0 : 1,
  };

  const actions = (
    <div className="flex flex-wrap items-center gap-4">
      {searchNode}
      {socialsNode}
      {accountNode}
      {themeToggleNode}
      {ctaNode}
    </div>
  );
  let desktopLayout: React.ReactNode = (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-4">{logoNode}</div>
      <div className={`flex flex-1 flex-wrap items-center gap-5 ${alignClass}`}>
        {navNode}
      </div>
      {actions}
    </div>
  );

  if (variant === "v1") {
    desktopLayout = (
      <div className="flex h-full items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">{logoNode}</div>
        <div className={`flex min-w-0 flex-1 ${alignClass}`}>
          <div className="min-w-0">{navNode}</div>
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

  if (variant === "v2") {
    const topBarStyle: React.CSSProperties = {
      backgroundColor: mobileOpen ? subBlockBg : blockBg,
      backgroundImage: mobileOpen ? "none" : menuGradient,
      borderColor: subBlockBorder,
      borderWidth: subBlockBorder === "transparent" ? 0 : 1,
    };
    return (
      <div
        className="relative w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 120, zIndex: 1, minHeight: mobileOpen ? "82vh" : undefined }
            : { minHeight: mobileOpen ? "82vh" : undefined }
        }
      >
        <div
          className={`relative flex items-center py-0 pl-8 pr-24 ${mobileOpen ? "z-[161]" : "z-[1]"}`}
          style={{ ...topBarStyle, minHeight: menuHeight }}
        >
          <div className="flex min-w-0 items-center gap-3">{logoNode}</div>
          {mobileOpen && searchNode ? (
            <div
              className={
                forceMobileLayout
                  ? "hidden"
                  : "absolute right-24 top-1/2 hidden -translate-y-1/2 md:flex"
              }
            >
              {searchNode}
            </div>
          ) : null}
          <button
            type="button"
            className="absolute right-8 top-1/2 z-[11] inline-flex -translate-y-1/2 items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
            style={{ width: menuButtonSize, height: menuButtonSize }}
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            title={mobileOpen ? "Закрыть меню" : "Открыть меню"}
          >
            <span
              className={`absolute left-1/2 block h-[2px] w-5 -translate-x-1/2 bg-current transition-all duration-300 ease-out ${
                mobileOpen
                  ? "top-1/2 -translate-y-1/2 rotate-45"
                  : "top-[calc(50%-6px)] rotate-0"
              }`}
            />
            <span
              className={`absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out ${
                mobileOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-1/2 block h-[2px] w-5 -translate-x-1/2 bg-current transition-all duration-300 ease-out ${
                mobileOpen
                  ? "top-1/2 -translate-y-1/2 -rotate-45"
                  : "top-[calc(50%+6px)] rotate-0"
              }`}
            />
          </button>
        </div>
        {mobileOpen && (
          <div
            className="absolute inset-0 z-[160] flex min-w-0 flex-col overflow-hidden rounded-[inherit] px-6 py-6 pt-24 md:px-10 md:py-8 md:pt-28"
            style={{ ...subBlockStyle, borderWidth: 0 }}
          >
            <div className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden py-6">
              {forceMobileLayout ? mobileNavNode : overlayNavNode}
            </div>
            <div className={forceMobileLayout ? "w-full" : "w-full md:hidden"}>
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
            <div
              className={
                forceMobileLayout
                  ? "hidden"
                  : "hidden flex-wrap items-center justify-center gap-3 md:flex"
              }
            >
              {socialsNode}
              {accountNode}
              {themeToggleNode}
              {ctaNode}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === "v3") {
    const topBarStyle: React.CSSProperties = {
      backgroundColor: blockBg,
      backgroundImage: menuGradient,
      borderColor: subBlockBorder,
      borderWidth: subBlockBorder === "transparent" ? 0 : 1,
      minHeight: menuHeight,
    };
    return (
      <div
        className="relative w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 120, zIndex: 1, minHeight: mobileOpen ? "82vh" : undefined }
            : { minHeight: mobileOpen ? "82vh" : undefined }
        }
      >
        <div className="relative flex items-center px-4 md:px-8" style={topBarStyle}>
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            title={mobileOpen ? "Закрыть меню" : "Открыть меню"}
          >
            <span
              className={`absolute left-1/2 block h-[2px] w-5 -translate-x-1/2 bg-current transition-all duration-300 ease-out ${
                mobileOpen
                  ? "top-1/2 -translate-y-1/2 rotate-45"
                  : "top-[calc(50%-6px)] rotate-0"
              }`}
            />
            <span
              className={`absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out ${
                mobileOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-1/2 block h-[2px] w-5 -translate-x-1/2 bg-current transition-all duration-300 ease-out ${
                mobileOpen
                  ? "top-1/2 -translate-y-1/2 -rotate-45"
                  : "top-[calc(50%+6px)] rotate-0"
              }`}
            />
          </button>
          {logoNode ? (
            <div className="pointer-events-none absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center">
              {logoNode}
            </div>
          ) : null}
          <div
            className={
              forceMobileLayout
                ? "hidden"
                : "ml-auto hidden items-center gap-2 md:flex [&_a]:!rounded-none [&_a]:!border-0 [&_a]:!bg-transparent"
            }
          >
            {socialsNode}
          </div>
        </div>
        {mobileOpen && (
          <div className="absolute inset-0 z-[160]">
            <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" />
            <aside
              className={`relative z-10 flex h-full w-full flex-col border-r pb-5 pt-0 text-[color:var(--block-text,var(--bp-ink))] ${
                forceMobileLayout ? "" : "sm:w-[min(360px,78vw)]"
              }`}
              style={{
                backgroundColor: "var(--block-sub-bg, var(--block-bg, var(--site-panel)))",
                borderColor: "var(--block-border, var(--site-border))",
              }}
            >
              <div className="mb-8 flex items-center justify-between gap-3 px-4 md:px-8" style={{ minHeight: menuHeight }}>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="relative inline-flex items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--block-text,var(--bp-ink))]"
                  style={{ width: menuButtonSize, height: menuButtonSize }}
                  aria-label="Закрыть меню"
                  title="Закрыть меню"
                >
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 opacity-0 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
                </button>
                <div className="min-w-0 flex flex-1 justify-end">{searchNode}</div>
              </div>
              <div className="min-w-0 overflow-hidden px-6">
                {mobileNavNode}
              </div>
              <div className="mt-auto space-y-4 px-6 pt-6">
                {ctaNode && <div className="flex justify-center">{ctaNode}</div>}
                {socialsNode && (
                  <div className={forceMobileLayout ? "flex justify-center" : "flex justify-center md:hidden"}>
                    {socialsNode}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {accountNode}
                  {themeToggleNode}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    );
  }

  if (variant === "v1") {
    const topBarStyle: React.CSSProperties = {
      height: menuHeight,
      backgroundColor: blockBg,
      backgroundImage: menuGradient,
      borderColor: subBlockBorder,
      borderWidth: subBlockBorder === "transparent" ? 0 : 1,
    };
    return (
      <div
        className="w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 120, zIndex: 1, minHeight: mobileOpen ? "82vh" : undefined }
            : { minHeight: mobileOpen ? "82vh" : undefined }
        }
      >
        <div
          className={forceMobileLayout ? "hidden" : "hidden px-4 2xl:block 2xl:px-8"}
          style={{
            ...topBarStyle,
            height: menuHeight,
          }}
        >
          {desktopLayout}
        </div>
        <div className={forceMobileLayout ? "" : "2xl:hidden"}>
          <div className="flex items-center justify-between gap-3 px-4" style={topBarStyle}>
            {logoNode}
            <button
              type="button"
              className="relative inline-flex items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
              style={{ width: menuButtonSize, height: menuButtonSize }}
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Закрыть меню" : "Меню"}
            >
              <span
                className={`absolute left-1/2 block h-[2px] w-5 -translate-x-1/2 bg-current transition-all duration-300 ease-out ${
                  mobileOpen
                    ? "top-1/2 -translate-y-1/2 rotate-45"
                    : "top-[calc(50%-6px)] rotate-0"
                }`}
              />
              <span
                className={`absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out ${
                  mobileOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-1/2 block h-[2px] w-5 -translate-x-1/2 bg-current transition-all duration-300 ease-out ${
                  mobileOpen
                    ? "top-1/2 -translate-y-1/2 -rotate-45"
                    : "top-[calc(50%+6px)] rotate-0"
                }`}
              />
            </button>
          </div>
          {mobileOpen && (
            <div
              className="absolute inset-0 z-[160] flex flex-col overflow-hidden pb-6 pt-0"
              style={{ ...subBlockStyle, borderWidth: 0 }}
            >
              <div className="mb-4 flex items-center justify-between gap-3 px-4" style={{ height: menuHeight }}>
                {logoNode}
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="relative inline-flex items-center justify-center overflow-visible rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
                  style={{ width: menuButtonSize, height: menuButtonSize }}
                  aria-label="Закрыть меню"
                  title="Закрыть меню"
                >
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 opacity-0 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
                </button>
              </div>
              {searchNode && <div className="mb-6 flex justify-center">{searchNode}</div>}
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="min-w-0 overflow-hidden">{mobileNavNode}</div>
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
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={
        position === "sticky"
          ? { position: "sticky", top: 120, zIndex: 1 }
          : undefined
      }
    >
      <div className={forceMobileLayout ? "hidden" : "hidden md:block"}>{desktopLayout}</div>
      <div className={forceMobileLayout ? "" : "md:hidden"}>
        <div className="flex items-center justify-between gap-3">
          {logoNode}
          <div className="flex items-center gap-2">
            {accountNode}
            {ctaNode}
            <button
              type="button"
              className="inline-flex h-14 w-14 items-center justify-center rounded-none border border-transparent bg-transparent text-[color:var(--bp-ink)]"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Меню"
            >
              <IconMenu />
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div
            className="mt-4 min-w-0 space-y-3 overflow-hidden rounded-none border p-4"
            style={subBlockStyle}
          >
            {searchNode}
            <div className="min-w-0 overflow-hidden">{mobileNavNode}</div>
            {socialsNode}
            {ctaNode}
          </div>
        )}
      </div>
    </div>
  );
}

export function renderAbout(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  theme: SiteTheme,
  style: BlockStyle
) {
  const data = block.data as Record<string, unknown>;
  const profileText = accountProfile.description || "";
  const showContacts = Boolean(data.showContacts);
  return (
    <div>
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "О нас"}
      </h3>
      <p className="mt-3 text-[color:var(--bp-muted)]" style={textStyle(style, theme)}>
        {(data.text as string) || profileText || "Заполните описание в профиле аккаунта или прямо здесь."}
      </p>
      {showContacts && (
        <div className="mt-4 text-xs text-[color:var(--bp-muted)]">
          Контакты будут подтягиваться из профиля аккаунта.
        </div>
      )}
      <div className="mt-3 text-xs text-[color:var(--bp-muted)]">Аккаунт: {account.name}</div>
    </div>
  );
}

function ClientCabinetTabsPreview({
  cabinetButtonRadius,
  cabinetButtonBg,
  cabinetButtonText,
  cabinetSecondaryButtonBg,
  cabinetSecondaryButtonText,
  cabinetButtonTextSize,
  cabinetCardStyle,
  cabinetTextColor,
  cabinetMutedColor,
  cabinetTextSize,
  previewOrganizationName,
  previewLocation,
  text,
}: {
  cabinetButtonRadius: number;
  cabinetButtonBg: string;
  cabinetButtonText: string;
  cabinetSecondaryButtonBg: string;
  cabinetSecondaryButtonText: string;
  cabinetButtonTextSize: number;
  cabinetCardStyle: CSSProperties;
  cabinetTextColor: string;
  cabinetMutedColor: string;
  cabinetTextSize: number;
  previewOrganizationName: string;
  previewLocation: string;
  text: (key: string, fallback: string) => string;
}) {
  const tabs = ["Обзор", "Записи", "Лояльность", "Оплаты", "Документы", "Отзывы", "Профиль", "Поддержка"];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const previewCard = (title: string, body: string) => (
    <div className="border p-5" style={cabinetCardStyle}>
      <div className="font-semibold" style={{ color: cabinetTextColor }}>{title}</div>
      <div className="mt-3" style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>{body}</div>
    </div>
  );

  const content =
    activeTab === "Обзор" ? (
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="border p-5" style={cabinetCardStyle}>
            <div className="font-semibold" style={{ color: cabinetTextColor }}>{text("appointmentTitle", "Следующая запись")}</div>
            <div className="mt-3" style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>{text("appointmentEmptyText", "Пока нет ближайших записей.")}</div>
          </div>
          <div className="border p-5" style={cabinetCardStyle}>
            <div className="font-semibold" style={{ color: cabinetTextColor }}>{text("smartHintTitle", "Умные подсказки")}</div>
            <div className="mt-3" style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>
              {text("smartHintText", "Вы недавно были у нас. Хотите повторить услугу позже?")}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="border p-5" style={cabinetCardStyle}>
            <div className="font-semibold" style={{ color: cabinetTextColor }}>{text("loyaltyTitle", "Лояльность")}</div>
            <div className="mt-3 text-3xl font-semibold" style={{ color: cabinetTextColor }}>0 ₽</div>
            <div className="mt-2" style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>
              {text("loyaltyStatusText", "Статус: Базовый")}
            </div>
          </div>
          <div className="border p-5" style={cabinetCardStyle}>
            <div className="font-semibold" style={{ color: cabinetTextColor }}>{text("contactsTitle", "Контакты")}</div>
            <div className="mt-3" style={{ color: cabinetTextColor, fontSize: cabinetTextSize }}>+78121230000</div>
            <div className="mt-1" style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>{previewLocation}</div>
          </div>
          <div className="border p-5" style={cabinetCardStyle}>
            <div className="font-semibold" style={{ color: cabinetTextColor }}>{text("organizationsTitle", "Каталог организаций")}</div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div style={{ color: cabinetTextColor, fontSize: cabinetTextSize }}>{previewOrganizationName}</div>
              <div className="border px-3 py-2 font-semibold" style={{ borderRadius: cabinetButtonRadius, borderColor: "var(--bp-stroke)", color: cabinetSecondaryButtonText, backgroundColor: cabinetSecondaryButtonBg, fontSize: cabinetButtonTextSize }}>
                Записаться
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : activeTab === "Записи" ? (
      previewCard("Записи", "Пока нет ближайших записей. Здесь клиент увидит будущие и прошлые визиты.")
    ) : activeTab === "Лояльность" ? (
      previewCard(text("loyaltyTitle", "Лояльность"), "0 ₽ · Статус: Базовый")
    ) : activeTab === "Оплаты" ? (
      previewCard("Оплаты", "Платежей пока нет. Здесь появятся оплаты и возвраты клиента.")
    ) : activeTab === "Документы" ? (
      previewCard("Документы", "Здесь будут согласия и принятые клиентом документы.")
    ) : activeTab === "Отзывы" ? (
      previewCard("Отзывы", "Здесь клиент сможет оставить отзыв после завершённой записи.")
    ) : activeTab === "Профиль" ? (
      previewCard("Профиль", "Имя, телефон и email клиента подтягиваются из его аккаунта.")
    ) : (
      previewCard("Поддержка", "Контакты организации и быстрые действия для связи.")
    );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {tabs.map((label) => {
          const isActive = activeTab === label;
          return (
            <button
              key={label}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setActiveTab(label);
              }}
              className="border px-4 py-2 font-semibold"
              style={{
                borderRadius: cabinetButtonRadius,
                borderColor: "var(--bp-stroke)",
                backgroundColor: isActive ? cabinetButtonBg : cabinetSecondaryButtonBg,
                color: isActive ? cabinetButtonText : cabinetSecondaryButtonText,
                fontSize: cabinetButtonTextSize,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {content}
    </>
  );
}

export function renderClient(
  block: SiteBlock,
  account: AccountInfo,
  theme: SiteTheme,
  style: BlockStyle
) {
  const data = block.data as Record<string, unknown>;
  const view =
    block.type === "clientCabinet"
      ? "cabinet"
      : block.type === "clientLogin"
        ? "login"
        : data.clientView === "cabinet"
          ? "cabinet"
          : "login";
  const text = (key: string, fallback: string) =>
    typeof data[key] === "string" ? (data[key] as string) : fallback;
  const rawStyle = (block.data.style as Record<string, unknown>) ?? {};
  const readColor = (key: string, fallback: string) => {
    const value = rawStyle[key];
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  };
  const readNumber = (key: string, fallback: number) => {
    const value = Number(rawStyle[key]);
    return Number.isFinite(value) ? Math.max(0, Math.min(64, Math.round(value))) : fallback;
  };
  const readUnboundedNumber = (key: string, fallback: number) => {
    const value = Number(rawStyle[key]);
    return Number.isFinite(value) ? Math.round(value) : fallback;
  };
  const resolveBg = (prefix: string, lightFallback: string, darkFallback = lightFallback) => {
    const suffix = theme.mode === "dark" ? "Dark" : "Light";
    const legacyKey = theme.mode === "dark" ? `${prefix}Dark` : prefix;
    const fallback = theme.mode === "dark" ? darkFallback : lightFallback;
    const modeRaw = rawStyle[`${prefix}Mode${suffix}`];
    const mode = modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
    const from = readColor(`${prefix}From${suffix}`, readColor(legacyKey, fallback));
    const to = readColor(`${prefix}To${suffix}`, from);
    const angle = readUnboundedNumber(`${prefix}Angle${suffix}`, 135);
    const stopA = Math.max(0, Math.min(100, readUnboundedNumber(`${prefix}StopA${suffix}`, 0)));
    const stopB = Math.max(0, Math.min(100, readUnboundedNumber(`${prefix}StopB${suffix}`, 100)));
    if (mode === "linear") {
      return { backgroundColor: from, backgroundImage: `linear-gradient(${angle}deg, ${from} ${stopA}%, ${to} ${stopB}%)` };
    }
    if (mode === "radial") {
      return { backgroundColor: from, backgroundImage: `radial-gradient(circle, ${from} ${stopA}%, ${to} ${stopB}%)` };
    }
    return { backgroundColor: from, backgroundImage: "none" };
  };
  const readThemedColor = (key: string, lightFallback: string, darkFallback = lightFallback) =>
    theme.mode === "dark"
      ? readColor(`${key}Dark`, darkFallback)
      : readColor(key, lightFallback);
  const authPageVisual = resolveBg("authPageBg", "#f3f4f6", "#0f1012");
  const authBlockVisual = resolveBg("authBlockBg", "#ffffff", "#181b22");
  const authSideVisual = resolveBg("authSideBg", "#1f2937", "#111827");
  const authRightVisual = authBlockVisual;
  const authBlockHeight = readNumber("authBlockHeight", 700);
  const authRadius = readNumber("authRadius", 0);
  const authButtonRadius = readNumber("authButtonRadius", 0);
  const authFieldRadius = readNumber("authFieldRadius", 0);
  const authHintRadius = readNumber("authHintRadius", 0);
  const authSocialButtonRadius = readNumber("authSocialButtonRadius", authButtonRadius);
  const authTitleSize = readNumber("authTitleSize", 32);
  const authTextSize = readNumber("authTextSize", 14);
  const authFormTitleSize = readNumber("authFormTitleSize", 24);
  const authFormTextSize = readNumber("authFormTextSize", 14);
  const authButtonTextSize = readNumber("authButtonTextSize", 14);
  const authSocialButtonTextSize = readNumber("authSocialButtonTextSize", 14);
  const authSideTextColor = readThemedColor("authSideTextColor", "#ffffff", "#f8fafc");
  const authSideMutedColor = readThemedColor("authSideMutedColor", "rgba(255,255,255,0.8)", "#aeb4bf");
  const authHintBorderColor = readThemedColor("authHintBorderColor", "rgba(255,255,255,0.2)", "#343a46");
  const authRightTextColor = readThemedColor("authRightTextColor", "#111827", "#f8fafc");
  const authRightMutedColor = readThemedColor("authRightMutedColor", "#6b7280", "#aeb4bf");
  const authButtonBg = readThemedColor("authButtonColor", style.buttonColor || theme.buttonColor, "#f8fafc");
  const authButtonText = readThemedColor("authButtonTextColor", style.buttonTextColor || theme.buttonTextColor, "#111827");
  const authButtonBorder = readThemedColor("authButtonBorderColor", "transparent", "transparent");
  const authButtonHoverBg = readThemedColor("authButtonHoverBgColor", authButtonBg, authButtonBg);
  const authFieldBg = readThemedColor("authFieldBgColor", "#f3f4f6", "#20242d");
  const authFieldBorder = readThemedColor("authFieldBorderColor", "#d9dee7", "#343a46");
  const authSocialButtonBg = readThemedColor("authSocialButtonColor", "#ffffff", "#20242d");
  const authSocialButtonText = readThemedColor("authSocialButtonTextColor", "#111827", "#f8fafc");
  const authSocialButtonBorder = readThemedColor("authSocialButtonBorderColor", "#e5e7eb", "#343a46");
  const authSocialButtonHoverBg = readThemedColor("authSocialButtonHoverBgColor", authSocialButtonBg, authSocialButtonBg);
  const cabinetPageVisual = resolveBg("cabinetPageBg", "#eef2f7", "#0f1012");
  const cabinetBlockVisual = resolveBg("cabinetBlockBg", "#ffffff", "#181b22");
  const cabinetRadius = readNumber("cabinetRadius", 0);
  const cabinetButtonRadius = readNumber("cabinetButtonRadius", 16);
  const cabinetTitleSize = readNumber("cabinetTitleSize", 32);
  const cabinetTextSize = readNumber("cabinetTextSize", 14);
  const cabinetButtonTextSize = readNumber("cabinetButtonTextSize", 14);
  const cabinetTextColor = readThemedColor("cabinetTextColor", "#111827", "#f8fafc");
  const cabinetMutedColor = readThemedColor("cabinetMutedColor", "#6b7280", "#aeb4bf");
  const cabinetButtonBg = readThemedColor("cabinetButtonColor", style.buttonColor || theme.buttonColor, "#f8fafc");
  const cabinetButtonText = readThemedColor("cabinetButtonTextColor", style.buttonTextColor || theme.buttonTextColor, "#111827");
  const cabinetSecondaryButtonBg = readThemedColor("cabinetSecondaryButtonColor", "#ffffff", "#20242d");
  const cabinetSecondaryButtonText = readThemedColor("cabinetSecondaryButtonTextColor", "#111827", "#f8fafc");
  const bookingHref = account.publicSlug ? `/${account.publicSlug}/booking` : "#";
  const previewOrganizationName = "Название организации";
  const previewOrganizationCount = "1 организация";
  const previewLocation = "Город";
  const inputRadius = Math.max(0, authFieldRadius);
  const contentColumns = clampBlockColumns(
    style.blockWidthColumns ?? (view === "cabinet" ? 8 : 6),
    block.type
  );
  const contentGrid = centeredGridRange(contentColumns);
  const contentGridStart = clampGridColumn(style.gridStartColumn ?? contentGrid.start);
  const contentGridEnd = Math.max(
    contentGridStart,
    clampGridColumn(style.gridEndColumn ?? contentGrid.end)
  );
  const contentWidthPercent = `${((contentGridEnd - contentGridStart + 1) / MAX_BLOCK_COLUMNS) * 100}%`;
  const contentLeftPercent = `${((contentGridStart - 1) / MAX_BLOCK_COLUMNS) * 100}%`;
  const clientContentStyle: CSSProperties = {
    width: contentWidthPercent,
    maxWidth: "100%",
    marginLeft: contentLeftPercent,
    marginRight: 0,
  };
  const cabinetCardStyle = {
    borderRadius: cabinetRadius,
    borderColor: "var(--bp-stroke)",
    backgroundColor: cabinetBlockVisual.backgroundColor,
    backgroundImage: cabinetBlockVisual.backgroundImage,
  };

  const loginPreview = (
    <div className="p-8" style={{ ...authPageVisual, borderRadius: 0 }}>
      <div
        className="grid overflow-hidden border border-[color:var(--bp-stroke)] shadow-[var(--bp-shadow)] md:grid-cols-[1.05fr_1fr]"
        style={{
          ...clientContentStyle,
          minHeight: authBlockHeight,
          borderRadius: authRadius,
          backgroundColor: "transparent",
          backgroundImage: "none",
        }}
      >
        <div className="flex flex-col justify-between gap-6 p-8" style={{ ...authSideVisual, color: authSideTextColor }}>
          <div>
            <div className="text-xs uppercase tracking-[0.3em]" style={{ color: authSideMutedColor }}>Клиентский доступ</div>
            <div className="mt-3 font-semibold" style={{ fontSize: authTitleSize }}>{text("authTitle", "Личный кабинет клиента")}</div>
            <p className="mt-3" style={{ color: authSideMutedColor, fontSize: authTextSize }}>
              {text("authText", "Войдите, чтобы увидеть свои записи, бонусы и данные по этой организации.")}
            </p>
          </div>
          <div className="space-y-3" style={{ color: authSideMutedColor, fontSize: authTextSize }}>
            <div className="border px-4 py-3" style={{ borderRadius: authHintRadius, borderColor: authHintBorderColor }}>
              {text("authHint1", "Умные подсказки по следующему визиту")}
            </div>
            <div className="border px-4 py-3" style={{ borderRadius: authHintRadius, borderColor: authHintBorderColor }}>
              {text("authHint2", "История записей и оплат по организациям")}
            </div>
          </div>
        </div>
        <div className="p-8" style={{ ...authRightVisual, color: authRightTextColor, fontSize: authFormTextSize }}>
          <div className="text-xs uppercase tracking-[0.2em]" style={{ color: authRightMutedColor }}>Личный кабинет</div>
          <div className="mt-2 font-semibold" style={{ fontSize: authFormTitleSize }}>{text("loginTitle", "Вход")}</div>
          <div className="mt-8 space-y-2">
            {["Telegram", "VK ID", "Яндекс ID", "MAX ID"].map((label) => (
              <button
                key={label}
                type="button"
                className="w-full border px-4 py-3 text-center font-semibold transition hover:bg-[color:var(--site-client-auth-social-button-hover)]"
                style={{
                  borderRadius: authSocialButtonRadius,
                  borderColor: authSocialButtonBorder,
                  backgroundColor: authSocialButtonBg,
                  color: authSocialButtonText,
                  fontSize: authSocialButtonTextSize,
                  ["--site-client-auth-social-button-hover" as string]: authSocialButtonHoverBg,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em]" style={{ color: authRightMutedColor }}>
            <div className="h-px flex-1" style={{ backgroundColor: authFieldBorder }} />
            или
            <div className="h-px flex-1" style={{ backgroundColor: authFieldBorder }} />
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <div className="font-medium" style={{ fontSize: authFormTextSize }}>Эл. почта</div>
              <div className="mt-2 h-12 border" style={{ borderRadius: inputRadius, backgroundColor: authFieldBg, borderColor: authFieldBorder }} />
            </div>
            <div>
              <div className="font-medium" style={{ fontSize: authFormTextSize }}>Пароль</div>
              <div className="mt-2 h-12 border" style={{ borderRadius: inputRadius, backgroundColor: authFieldBg, borderColor: authFieldBorder }} />
            </div>
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center border font-semibold transition hover:bg-[color:var(--site-client-auth-button-hover)]"
              style={{
                borderRadius: authButtonRadius,
                borderColor: authButtonBorder,
                backgroundColor: authButtonBg,
                color: authButtonText,
                fontSize: authButtonTextSize,
                ["--site-client-auth-button-hover" as string]: authButtonHoverBg,
              }}
            >
              {text("loginButtonText", "Войти")}
            </button>
            <div className="text-center underline" style={{ color: authRightMutedColor, fontSize: authFormTextSize }}>
              Создать аккаунт
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const cabinetPreview = (
    <div style={{ ...cabinetPageVisual, borderRadius: 0 }}>
      <div className="flex flex-col gap-6" style={{ ...clientContentStyle, color: cabinetTextColor }}>
        <div className="border p-8 shadow-[var(--bp-shadow)]" style={cabinetCardStyle}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-[0.35em] text-[color:var(--bp-muted)]">{previewOrganizationName}</div>
              <div className="font-semibold" style={{ color: cabinetTextColor, fontSize: cabinetTitleSize }}>{text("cabinetTitle", "Личный кабинет")}</div>
              <p style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>{text("cabinetEmail", "client@example.com")}</p>
              <div className="flex flex-wrap items-center gap-2 pt-2" style={{ fontSize: 12, color: cabinetMutedColor }}>
                <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">{previewOrganizationName}</span>
                <span className="rounded-full border border-[color:var(--bp-stroke)] px-3 py-1">{previewOrganizationCount}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={bookingHref} className="inline-flex items-center justify-center px-4 py-2 font-semibold" style={{ borderRadius: cabinetButtonRadius, backgroundColor: cabinetButtonBg, color: cabinetButtonText, fontSize: cabinetButtonTextSize }}>
                Записаться
              </a>
              <button type="button" className="border border-[color:var(--bp-stroke)] px-4 py-2" style={{ borderRadius: cabinetButtonRadius, backgroundColor: cabinetSecondaryButtonBg, color: cabinetSecondaryButtonText, fontSize: cabinetButtonTextSize }}>
                Выйти
              </button>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.35em]" style={{ color: cabinetMutedColor }}>
            {text("cabinetSectionLabel", "Клиентский кабинет")}
          </div>
          <div className="font-semibold" style={{ color: cabinetTextColor, fontSize: Math.max(20, cabinetTitleSize - 8) }}>
            {text("cabinetEmail", "client@example.com")}
          </div>
          <div style={{ color: cabinetMutedColor, fontSize: cabinetTextSize }}>{previewOrganizationName}</div>
        </div>
        <ClientCabinetTabsPreview
          cabinetButtonRadius={cabinetButtonRadius}
          cabinetButtonBg={cabinetButtonBg}
          cabinetButtonText={cabinetButtonText}
          cabinetSecondaryButtonBg={cabinetSecondaryButtonBg}
          cabinetSecondaryButtonText={cabinetSecondaryButtonText}
          cabinetButtonTextSize={cabinetButtonTextSize}
          cabinetCardStyle={cabinetCardStyle}
          cabinetTextColor={cabinetTextColor}
          cabinetMutedColor={cabinetMutedColor}
          cabinetTextSize={cabinetTextSize}
          previewOrganizationName={previewOrganizationName}
          previewLocation={previewLocation}
          text={text}
        />
      </div>
    </div>
  );

  return <>{view === "cabinet" ? cabinetPreview : loginPreview}</>;
}

export function renderLegal(
  block: SiteBlock,
  theme: SiteTheme,
  style: BlockStyle,
  legalDocuments: LegalDocumentItem[] = [],
  platformLegalDocuments: LegalDocumentItem[] = [],
  currentEntity: CurrentEntity = null
) {
  const data = block.data as Record<string, unknown>;
  const title = (data.title as string) || "Документы";
  const subtitle = (data.subtitle as string) || "Правовые документы и согласия";
  const rawOverrides =
    data.documentOverrides && typeof data.documentOverrides === "object"
      ? (data.documentOverrides as Record<string, Record<string, unknown>>)
      : {};
  const applyOverride = (doc: LegalDocumentItem) => {
    const override = rawOverrides[String(doc.versionId)] ?? {};
    return {
      ...doc,
      title: typeof override.title === "string" && override.title.trim() ? override.title : doc.title,
      description:
        typeof override.description === "string" ? override.description : doc.description,
      content: typeof override.content === "string" ? override.content : doc.content,
      pageBg: typeof override.pageBg === "string" && override.pageBg.trim() ? override.pageBg : "",
      textColor: typeof override.textColor === "string" && override.textColor.trim() ? override.textColor : "",
    };
  };
  const docs = [...legalDocuments, ...platformLegalDocuments].map(applyOverride);
  const activeDoc =
    currentEntity?.type === "legalDocument"
      ? docs.find((doc) => doc.versionId === currentEntity.id) ?? null
      : null;

  if (activeDoc) {
    return (
      <div
        className="px-6 py-8"
        style={{
          backgroundColor: activeDoc.pageBg || "var(--bp-surface)",
          color: activeDoc.textColor || "var(--bp-ink)",
        }}
      >
        <div className="mx-auto w-full max-w-[1120px]">
          <h3 className="font-semibold" style={headingStyle(style, theme)}>
            {activeDoc.title}
          </h3>
          {activeDoc.description ? (
            <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
              {activeDoc.description}
            </p>
          ) : null}
          <div className="mt-7 whitespace-pre-wrap text-sm leading-7">
            {activeDoc.content || "Текст документа пока пуст."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold" style={headingStyle(style, theme)}>
        {title}
      </h3>
      <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
        {subtitle}
      </p>
      <div className="mt-5 grid gap-3">
        {docs.map((doc) => (
          <div
            key={`${doc.id}:${doc.versionId}`}
            className="border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4"
            style={{ borderRadius: style.cardRadius ?? style.radius ?? 16 }}
          >
            <div className="text-sm font-semibold">{doc.title}</div>
            {doc.description ? (
              <div className="mt-1 text-sm text-[color:var(--bp-muted)]">{doc.description}</div>
            ) : null}
            <div className="mt-2 text-xs text-[color:var(--bp-muted)]">Версия {doc.version}</div>
          </div>
        ))}
        {docs.length === 0 ? (
          <div
            className="border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]"
            style={{ borderRadius: style.cardRadius ?? style.radius ?? 16 }}
          >
            Документы пока не опубликованы.
          </div>
        ) : null}
      </div>
    </div>
  );
}
export function renderLocations(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  locations: LocationItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity,
  previewViewportWidth?: number
) {
  void accountProfile;
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = currentEntity?.type === "location" ? currentEntity.id : null;
  const items =
    useCurrent && currentId
      ? locations.filter((item) => item.id === currentId)
      : useCurrent
        ? locations.slice(0, 1)
        : resolveEntities(mode, ids, locations);
  const readDataColor = (key: string) =>
    typeof data[key] === "string" && String(data[key]).trim() ? String(data[key]).trim() : "";
  const readOptionalDataColor = (key: string) =>
    typeof data[key] === "string" && String(data[key]).trim() && String(data[key]).trim() !== "transparent"
      ? String(data[key]).trim()
      : "";
  const readDataNumber = (key: string, fallback: number) =>
    Number.isFinite(Number(data[key])) ? Number(data[key]) : fallback;
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
  const readDataWeightFallback = (key: string, legacyKey: string, fallback?: number) => {
    if (data[key] !== "" && data[key] !== null && data[key] !== undefined) {
      const value = Number(data[key]);
      return Number.isFinite(value) ? Math.max(100, Math.min(900, Math.round(value))) : fallback;
    }
    return readDataWeight(legacyKey, fallback);
  };
  const buttonTextStyle = (prefix: "locationPrimaryButton" | "locationDetailsButton", sizeFallback: number, weightFallback?: number): CSSProperties => ({
    fontSize: `${readDataNumberValue(`${prefix}Size`, sizeFallback, 8, 48)}px`,
    fontFamily: readDataFont(`${prefix}Font`, "Manrope"),
    fontWeight: readDataWeight(`${prefix}Weight`, weightFallback),
  });
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
  const mobileCardsPerRow = Number(data.mobileCardsPerRow) === 1 ? 1 : 2;
  const listView = data.listView === "list" ? "list" : "tile";
  const cardStyle = data.cardStyle === "filled" || data.cardStyle === "boxed" ? "filled" : "plain";
  const imageAspectRatio =
    typeof data.imageAspectRatio === "string" && data.imageAspectRatio.trim()
      ? data.imageAspectRatio.trim()
      : "1 / 1";
  const imageRadius = Number(data.imageRadius);
  const cardGapX = Number(data.cardGapX);
  const cardGapY = Number(data.cardGapY);
  const cardPaddingX = Number(data.cardPaddingX);
  const cardPaddingY = Number(data.cardPaddingY);
  const maxVisibleItems = Number(data.maxVisibleItems);
  const cardBackgroundSource = {
    ...data,
    locationCardBackgroundFromLight:
      readDataColor("locationCardBackgroundFromLight") ||
      readDataColor("catalogCardBackgroundFromLight") ||
      readDataColor("specialistCardBackgroundFromLight") ||
      style.subBlockBgLightResolved ||
      style.subBlockBg ||
      "#fafafa",
    locationCardBackgroundFromDark:
      readDataColor("locationCardBackgroundFromDark") ||
      readDataColor("catalogCardBackgroundFromDark") ||
      readDataColor("specialistCardBackgroundFromDark") ||
      style.subBlockBgDarkResolved ||
      "#24282e",
    locationCardBackgroundModeLight:
      data.locationCardBackgroundModeLight ?? data.catalogCardBackgroundModeLight ?? data.specialistCardBackgroundModeLight,
    locationCardBackgroundToLight:
      data.locationCardBackgroundToLight ?? data.catalogCardBackgroundToLight ?? data.specialistCardBackgroundToLight,
    locationCardBackgroundAngleLight:
      data.locationCardBackgroundAngleLight ?? data.catalogCardBackgroundAngleLight ?? data.specialistCardBackgroundAngleLight,
    locationCardBackgroundStopALight:
      data.locationCardBackgroundStopALight ?? data.catalogCardBackgroundStopALight ?? data.specialistCardBackgroundStopALight,
    locationCardBackgroundStopBLight:
      data.locationCardBackgroundStopBLight ?? data.catalogCardBackgroundStopBLight ?? data.specialistCardBackgroundStopBLight,
    locationCardBackgroundModeDark:
      data.locationCardBackgroundModeDark ?? data.catalogCardBackgroundModeDark ?? data.specialistCardBackgroundModeDark,
    locationCardBackgroundToDark:
      data.locationCardBackgroundToDark ?? data.catalogCardBackgroundToDark ?? data.specialistCardBackgroundToDark,
    locationCardBackgroundAngleDark:
      data.locationCardBackgroundAngleDark ?? data.catalogCardBackgroundAngleDark ?? data.specialistCardBackgroundAngleDark,
    locationCardBackgroundStopADark:
      data.locationCardBackgroundStopADark ?? data.catalogCardBackgroundStopADark ?? data.specialistCardBackgroundStopADark,
    locationCardBackgroundStopBDark:
      data.locationCardBackgroundStopBDark ?? data.catalogCardBackgroundStopBDark ?? data.specialistCardBackgroundStopBDark,
  };
  const cardBackgroundLight = resolveLocationCardBackgroundVisual(
    cardBackgroundSource,
    "var(--block-sub-bg,var(--bp-paper))",
    "light"
  );
  const cardBackgroundDark = resolveLocationCardBackgroundVisual(
    cardBackgroundSource,
    cardBackgroundLight.backgroundColor,
    "dark"
  );
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
      key === "locationCardTitle"
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
  const hasMultipleLocations = catalogItems.length > 1;
  const locationsHeadingStyle = {
    ...headingStyle(style, theme),
    textAlign: style.textAlignHeading ?? "center",
    color: "var(--services-heading-color,var(--site-text,var(--block-text,var(--bp-ink))))",
  };
  const locationsSubheadingStyle = {
    ...subheadingStyle(style, theme),
    textAlign: style.textAlignSubheading ?? "left",
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
      <LocationsCatalog
        variant={block.variant === "v2" ? "v2" : "v1"}
        listView={listView}
        title={typeof data.title === "string" ? data.title : "Филиалы"}
        subtitle={subtitle}
        items={catalogItems}
        publicSlug={account.publicSlug}
        locations={locations.map((location) => ({ id: location.id, name: location.name }))}
        cardsPerRow={cardsPerRow}
        mobileCardsPerRow={mobileCardsPerRow}
        showCategoryTabs={false}
        categoryAllLabel="Все филиалы"
        showSearch={hasMultipleLocations && data.showSearch !== false}
        searchPlaceholder={
          typeof data.searchPlaceholder === "string" && data.searchPlaceholder.trim()
            ? data.searchPlaceholder.trim()
            : "Поиск филиала"
        }
        showSort={hasMultipleLocations && data.showSort !== false}
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
        imageAspectRatio={imageAspectRatio}
        imageRadius={Number.isFinite(imageRadius) ? imageRadius : 10}
        imageFit={(data.locationCardImageFit ?? data.specialistCardImageFit) === "contain" ? "contain" : "cover"}
        imageZoomOnHover={data.imageZoomOnHover === true}
        imageZoomOnClick={
          data.locationCardImageZoomOnClick === true ||
          data.modalImageZoomOnClick === true ||
          data.specialistCardImageZoomOnClick === true
        }
        modalMediaColumns={readDataNumber("locationModalMediaColumns", readDataNumber("specialistModalMediaColumns", 6))}
        modalInfoColumns={readDataNumber("locationModalInfoColumns", readDataNumber("specialistModalInfoColumns", 6))}
        alignButtonsBottom={data.alignButtonsBottom !== false}
        cardBackgroundColorLight={cardBackgroundLight.backgroundColor}
        cardBackgroundImageLight={cardBackgroundLight.backgroundImage}
        cardBackgroundColorDark={cardBackgroundDark.backgroundColor}
        cardBackgroundImageDark={cardBackgroundDark.backgroundImage}
        cardLiquidGlass={(data.locationCardLiquidGlass ?? data.specialistCardLiquidGlass) === true}
        cardBackgroundStartOpacityLight={readDataNumber("locationCardBackgroundStartOpacityLight", readDataNumber("specialistCardBackgroundStartOpacityLight", 0))}
        cardBackgroundEndOpacityLight={readDataNumber("locationCardBackgroundEndOpacityLight", readDataNumber("specialistCardBackgroundEndOpacityLight", 10))}
        cardBackgroundStartOpacityDark={readDataNumber("locationCardBackgroundStartOpacityDark", readDataNumber("specialistCardBackgroundStartOpacityDark", readDataNumber("locationCardBackgroundStartOpacityLight", readDataNumber("specialistCardBackgroundStartOpacityLight", 0))))}
        cardBackgroundEndOpacityDark={readDataNumber("locationCardBackgroundEndOpacityDark", readDataNumber("specialistCardBackgroundEndOpacityDark", readDataNumber("locationCardBackgroundEndOpacityLight", readDataNumber("specialistCardBackgroundEndOpacityLight", 10))))}
        cardTitleTextStyle={cardTextStyle("locationCardTitle", "#111827", "#F8FAFC", 18, 600, "catalogCardTitle")}
        cardDescriptionTextStyle={cardTextStyle("locationCardText", "#6B7280", "#CBD5E1", 14, undefined, "catalogCardText")}
        cardClickEnabled={(data.locationCardClickEnabled ?? data.modalImageClickEnabled) !== false}
        cardStyle={cardStyle}
        cardGapX={Number.isFinite(cardGapX) ? cardGapX : 20}
        cardGapY={Number.isFinite(cardGapY) ? cardGapY : 40}
        cardPaddingX={Number.isFinite(cardPaddingX) ? cardPaddingX : 30}
        cardPaddingY={Number.isFinite(cardPaddingY) ? cardPaddingY : 30}
        maxVisibleItems={Number.isFinite(maxVisibleItems) ? maxVisibleItems : 8}
        usePagination={data.usePagination === true}
        headingStyle={locationsHeadingStyle}
        subheadingStyle={locationsSubheadingStyle}
        buttonStyle={{
          ...buttonStyle(style, theme),
          borderRadius: style.buttonRadius ?? 0,
          ...buttonTextStyle("locationPrimaryButton", 14, 600),
        }}
        detailsButtonStyle={buttonTextStyle("locationDetailsButton", 14)}
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
        ratingTextWeight={
          data.ratingTextWeight === "" || data.ratingTextWeight == null
            ? undefined
            : String(data.ratingTextWeight)
        }
        previewViewportWidth={previewViewportWidth}
        emptyText="Нет филиалов для отображения."
      />
    </div>
  );
}

export function renderServices(
  block: SiteBlock,
  account: AccountInfo,
  locations: LocationItem[],
  services: ServiceItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity,
  previewViewportWidth?: number
) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = currentEntity?.type === "service" ? currentEntity.id : null;
  const items =
    useCurrent && currentId
      ? services.filter((item) => item.id === currentId)
      : useCurrent
        ? services.slice(0, 1)
        : resolveEntities(mode, ids, services);
  const showButton = Boolean(data.showButton);
  const buttonAlignment =
    data.buttonAlignment === "left" || data.buttonAlignment === "right" ? data.buttonAlignment : "center";
  const showDetailsButton = data.showDetailsButton !== false;
  const buttonText = typeof data.buttonText === "string" ? data.buttonText.trim() : "Записаться";
  const detailsButtonText =
    showDetailsButton
      ? typeof data.detailsButtonText === "string"
        ? data.detailsButtonText.trim()
        : "Подробнее"
      : "";
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
  const serviceCardImageFit = data.serviceCardImageFit === "contain" ? "contain" : "cover";
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
  ): CSSProperties => {
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
  const serviceButtonTextStyle = (prefix: "servicePrimaryButton" | "serviceDetailsButton", sizeFallback: number, weightFallback?: number): CSSProperties => ({
    fontSize: `${readDataNumberValue(`${prefix}Size`, sizeFallback, 8, 48)}px`,
    fontFamily: readDataFont(`${prefix}Font`, "Manrope"),
    fontWeight: readDataWeight(`${prefix}Weight`, weightFallback),
  });
  const servicesButtonStyle = {
    ...buttonStyle(style, theme),
    borderRadius: style.buttonRadius ?? 0,
    ...serviceButtonTextStyle("servicePrimaryButton", 14, 600),
  };
  const listView = data.listView === "list" ? "list" : "tile";
  const maxVisibleItems = Number(data.maxVisibleItems);
  const usePagination = data.usePagination === true;
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
  const currentLocationId = currentEntity?.type === "location" ? currentEntity.id : null;
  const currentSpecialistId = currentEntity?.type === "specialist" ? currentEntity.id : null;
  const effectiveSpecialistId = currentSpecialistId ?? specialistId;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const servicesHeadingStyle = {
    ...headingStyle(style, theme),
    textAlign: style.textAlignHeading ?? "center",
    color: "var(--services-heading-color,var(--site-text,var(--block-text,var(--bp-ink))))",
  };
  const servicesSubheadingStyle = {
    ...subheadingStyle(style, theme),
    textAlign: style.textAlignSubheading ?? "left",
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
        listView={listView}
        title={typeof data.title === "string" ? data.title : "Услуги"}
        subtitle={subtitle}
        items={items}
        publicSlug={account.publicSlug}
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
        serviceCardImageFit={serviceCardImageFit}
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
        maxVisibleItems={Number.isFinite(maxVisibleItems) ? maxVisibleItems : 8}
        usePagination={usePagination}
        headingStyle={servicesHeadingStyle}
        subheadingStyle={servicesSubheadingStyle}
        buttonStyle={servicesButtonStyle}
        detailsButtonStyle={serviceButtonTextStyle("serviceDetailsButton", 14)}
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
        ratingTextWeight={
          data.ratingTextWeight === "" || data.ratingTextWeight == null
            ? undefined
            : String(data.ratingTextWeight)
        }
        previewViewportWidth={previewViewportWidth}
      />
    </div>
  );
}

export function renderSpecialists(
  block: SiteBlock,
  account: AccountInfo,
  locations: LocationItem[],
  specialists: SpecialistItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity,
  previewViewportWidth?: number
) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = currentEntity?.type === "specialist" ? currentEntity.id : null;
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
  const readDataNumber = (key: string, fallback: number) =>
    Number.isFinite(Number(data[key])) ? Number(data[key]) : fallback;
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
  const currentLocationId = currentEntity?.type === "location" ? currentEntity.id : null;
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
    ...headingStyle(style, theme),
    textAlign: style.textAlignHeading ?? "center",
    color: "var(--services-heading-color,var(--site-text,var(--block-text,var(--bp-ink))))",
  };
  const specialistsSubheadingStyle = {
    ...subheadingStyle(style, theme),
    textAlign: style.textAlignSubheading ?? "left",
    color: "var(--services-description-color,var(--site-muted,var(--block-muted,var(--bp-muted))))",
  };
  const specialistButtonTextStyle = (prefix: "specialistPrimaryButton" | "specialistDetailsButton", sizeFallback: number, weightFallback?: number): CSSProperties => ({
    fontSize: `${readDataNumberValue(`${prefix}Size`, sizeFallback, 8, 48)}px`,
    fontFamily: readDataFont(`${prefix}Font`, "Manrope"),
    fontWeight: readDataWeight(`${prefix}Weight`, weightFallback),
  });
  const specialistsButtonStyle = {
    ...buttonStyle(style, theme),
    borderRadius: style.buttonRadius ?? 0,
    ...specialistButtonTextStyle("specialistPrimaryButton", 14, 600),
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
        publicSlug={account.publicSlug}
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
        cardBackgroundStartOpacityLight={readDataNumber("specialistCardBackgroundStartOpacityLight", 0)}
        cardBackgroundEndOpacityLight={readDataNumber("specialistCardBackgroundEndOpacityLight", 10)}
        cardBackgroundStartOpacityDark={readDataNumber(
          "specialistCardBackgroundStartOpacityDark",
          readDataNumber("specialistCardBackgroundStartOpacityLight", 0)
        )}
        cardBackgroundEndOpacityDark={readDataNumber(
          "specialistCardBackgroundEndOpacityDark",
          readDataNumber("specialistCardBackgroundEndOpacityLight", 10)
        )}
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
        detailsButtonStyle={specialistButtonTextStyle("specialistDetailsButton", 14)}
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
        ratingTextWeight={
          data.ratingTextWeight === "" || data.ratingTextWeight == null
            ? undefined
            : String(data.ratingTextWeight)
        }
        previewViewportWidth={previewViewportWidth}
      />
    </div>
  );
}

export function renderPromos(
  block: SiteBlock,
  promos: PromoItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity,
  previewViewportWidth?: number
) {
  const data = block.data as Record<string, unknown>;
  const mode = (data.mode as string) ?? "all";
  const ids = Array.isArray(data.ids) ? (data.ids as number[]) : [];
  const useCurrent = Boolean(data.useCurrent);
  const currentId = currentEntity?.type === "promo" ? currentEntity.id : null;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const items =
    useCurrent && currentId
      ? promos.filter((item) => item.id === currentId)
      : useCurrent
        ? promos.slice(0, 1)
        : resolveEntities(mode, ids, promos);

  return (
    <div>
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "Промо и скидки"}
      </h3>
      {subtitle && (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      )}
      <div className={`mt-4 grid gap-4 ${resolvePreviewGridClassName(previewViewportWidth, "md:grid-cols-2", 2)}`}>
        {items.map((promo) => (
          <div
            key={promo.id}
            className="rounded-2xl border bg-[color:var(--bp-paper)] p-4 text-sm"
            style={{ borderColor: theme.borderColor, textAlign: style.textAlign }}
          >
            <div className="text-base font-semibold">{promo.name}</div>
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} ?`}
              {promo.startsAt || promo.endsAt ? " · " : ""}
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

export function renderWorks(
  block: SiteBlock,
  workPhotos: WorkPhotos,
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity
) {
  const data = block.data as Record<string, unknown>;
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
  const resolvedBorderColor = (style.borderColor || theme.borderColor || "").trim() || "transparent";
  const imageBorderColor = resolvedBorderColor === "transparent" ? "transparent" : resolvedBorderColor;
  const imageBorderWidth = resolvedBorderColor === "transparent" ? 0 : 1;
  const resolvedShadowSize = style.shadowSize ?? theme.shadowSize ?? 0;
  const resolvedShadowColor = style.shadowColor || theme.shadowColor || "rgba(17, 24, 39, 0.12)";
  const imageShadow =
    resolvedShadowSize > 0
      ? `0 ${resolvedShadowSize}px ${resolvedShadowSize * 2}px ${resolvedShadowColor}`
      : "none";
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
    currentEntity?.type === "service" && source === "services"
      ? currentEntity.id
      : currentEntity?.type === "specialist" && source === "specialists"
        ? currentEntity.id
        : currentEntity?.type === "location" && source === "locations"
          ? currentEntity.id
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
  const containBackgroundColor = style.blockBg || theme.panelColor;

  if (isFullscreenVariant) {
    return (
      <div className="relative">
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
                {title && <h3 className="font-semibold" style={{ ...headingStyle(style, theme), color: "white" }}>{title}</h3>}
                {subtitle && (
                  <p
                    className={`${title ? "mt-2" : ""}`}
                    style={{ ...subheadingStyle(style, theme), color: "rgba(255,255,255,0.9)" }}
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
    <div>
      {title && (
        <h3 className="font-semibold" style={headingStyle(style, theme)}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p className={`${title ? "mt-2" : ""} text-[color:var(--bp-muted)]`} style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
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
  );
}

export function renderReviews(
  block: SiteBlock,
  accountSlug: string,
  accountName: string,
  reviews: ReviewItem[],
  theme: SiteTheme,
  style: BlockStyle,
  previewViewportWidth?: number
) {
  const data = block.data as Record<string, unknown>;
  const isMobilePreview = typeof previewViewportWidth === "number" && previewViewportWidth < 768;
  const limit = Math.max(1, Math.min(24, Number(data.limit) || 6));
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  const visibleReviews = reviews.slice(0, limit);
  const hasMoreReviews = reviews.length > limit;
  const ratingCount = reviews.length;
  const ratingAvg = ratingCount > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / ratingCount : 0;
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
  const entityLinkStyle: CSSProperties = {
    color: mutedColor,
    cursor: "pointer",
  };
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
  const cardStyle = { backgroundColor: "var(--review-card-bg)", borderColor: "var(--review-card-border)", borderRadius: cardRadius, color: textColor };
  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => review.rating === rating).length,
  }));
  const renderStars = (rating: number) => (
    <span className="whitespace-nowrap leading-none" style={{ color: starColor }} aria-label={`Оценка ${rating} из 5`}>
      {"★".repeat(rating)}
      <span style={{ color: "#d9dee8" }}>{"★".repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );

  return (
    <div className="site-review-theme" style={reviewThemeStyle}>
      <h3 className="font-semibold" style={headingStyle(style, theme)}>
        {(data.title as string) || "Отзывы"}
      </h3>
      {subtitle ? (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      ) : null}
      <div className={`bp-review-scroll mt-5 grid max-h-[900px] items-start gap-5 overflow-y-auto pr-2 ${isMobilePreview ? "" : "lg:grid-cols-[360px_minmax(0,1fr)]"}`}>
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
            accountName={accountName}
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
          {visibleReviews.length > 0 ? visibleReviews.map((review) => (
            <article key={review.id} className="border p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]" style={cardStyle}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{review.clientName}</div>
                  <div className="mt-1 text-xs" style={{ color: mutedColor }}>
                    {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(review.createdAt))}
                  </div>
                </div>
                {renderStars(review.rating)}
              </div>
              {review.servicesLabel ? <div className="mt-5 text-xs uppercase tracking-wide transition hover:opacity-75" style={entityLinkStyle}>{review.servicesLabel}</div> : null}
              {review.specialistName ? <div className="mt-1 text-sm transition hover:opacity-75" style={entityLinkStyle}>{review.specialistName}</div> : null}
              {review.locationName ? <div className="mt-1 text-xs transition hover:opacity-75" style={entityLinkStyle}>{review.locationName}</div> : null}
              <p className="mt-5 leading-6">{review.comment}</p>
              {review.photoUrls?.length ? (
                <ReviewPhotoGallery urls={review.photoUrls} cardRadius={cardRadius} borderColor="var(--review-card-border)" />
              ) : null}
              {review.replyText || review.replyPhotoUrls?.length ? (
                <div className="mt-5 border-l-2 border-slate-200 pl-4 text-sm" style={{ color: mutedColor }}>
                  <div className="font-semibold" style={{ color: textColor }}>Ответ</div>
                  {review.replyText ? <div className="mt-1">{review.replyText}</div> : null}
                  {review.replyPhotoUrls?.length ? (
                    <ReviewPhotoGallery
                      urls={review.replyPhotoUrls}
                      cardRadius={cardRadius}
                      borderColor="var(--review-card-border)"
                      gridClassName="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4"
                    />
                  ) : null}
                </div>
              ) : null}
            </article>
          )) : (
            <div className="border p-5 text-sm shadow-[0_10px_28px_rgba(15,23,42,0.06)]" style={{ ...cardStyle, color: mutedColor }}>
              Отзывы будут отображаться здесь после их появления.
            </div>
          )}
          {hasMoreReviews ? (
            <button type="button" className="mt-4 inline-flex items-center justify-center px-5 py-3 text-sm font-semibold" style={{ borderRadius: buttonRadius, backgroundColor: buttonBg, color: buttonText }}>
              Показать еще
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}



const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
type SeoHeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";

function resolveSeoHeadingTag(value: unknown, fallback: SeoHeadingTag): SeoHeadingTag {
  return value === "h1" ||
    value === "h2" ||
    value === "h3" ||
    value === "h4" ||
    value === "h5" ||
    value === "h6" ||
    value === "div"
    ? value
    : fallback;
}

function simpleGridClass(previewViewportWidth: number | undefined, desktopCols: 2 | 3) {
  return resolvePreviewGridClassName(previewViewportWidth, `md:grid-cols-${desktopCols}`, desktopCols);
}

export function renderHeadingBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const eyebrow = asString(data.eyebrow).trim();
  const title = asString(data.title, "Заголовок").trim();
  const subtitle = asString(data.subtitle).trim();
  const TitleTag = resolveSeoHeadingTag(data.seoTitleTag, "h2");
  const SubtitleTag = resolveSeoHeadingTag(data.seoSubtitleTag, "div");
  return (
    <div className="mx-auto max-w-4xl text-center">
      {eyebrow && <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--bp-muted)]">{eyebrow}</div>}
      <TitleTag className="font-semibold" style={headingStyle(style, theme)}>{title}</TitleTag>
      {subtitle && <SubtitleTag className="mt-3 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>{subtitle}</SubtitleTag>}
    </div>
  );
}

export function renderTextBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const title = asString(data.title).trim();
  const text = asString(data.text).trim();
  const columns = Number(data.columns) === 2 ? 2 : 1;
  return (
    <div>
      {title && <h3 className="font-semibold" style={headingStyle(style, theme)}>{title}</h3>}
      {text && (
        <div
          className={`${title ? "mt-4" : ""} whitespace-pre-line text-[color:var(--bp-muted)] ${columns === 2 ? "md:columns-2 md:gap-10" : ""}`}
          style={textStyle(style, theme)}
        >
          {text}
        </div>
      )}
    </div>
  );
}

export function renderImageBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const imageUrl = asString(data.imageUrl).trim();
  const title = asString(data.title).trim();
  const subtitle = asString(data.subtitle).trim();
  const imageFit = data.imageFit === "contain" ? "contain" : "cover";
  const aspectRatio = asString(data.imageAspectRatio, "16 / 9");
  return (
    <div>
      {title && <h3 className="font-semibold" style={headingStyle(style, theme)}>{title}</h3>}
      {subtitle && <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>{subtitle}</p>}
      <div className={`${title || subtitle ? "mt-5" : ""} overflow-hidden border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]`} style={{ borderRadius: style.radius ?? theme.radius, aspectRatio }}>
        {imageUrl ? (
          <UnoptimizedImage src={imageUrl} alt={asString(data.alt, title)} className="h-full w-full" style={{ objectFit: imageFit }} />
        ) : (
          <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-[color:var(--bp-muted)]">Добавьте изображение</div>
        )}
      </div>
    </div>
  );
}

export function renderManualGalleryBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const images = asArray<{ url?: string; alt?: string }>(data.images).filter((item) => asString(item.url).trim());
  const title = asString(data.title, "Галерея").trim();
  const subtitle = asString(data.subtitle).trim();
  const aspectRatio = asString(data.imageAspectRatio, "1 / 1");
  return (
    <div>
      {title && <h3 className="font-semibold" style={headingStyle(style, theme)}>{title}</h3>}
      {subtitle && <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>{subtitle}</p>}
      <div className={`mt-5 grid gap-4 ${simpleGridClass(previewViewportWidth, 3)}`}>
        {(images.length ? images : [{}, {}, {}]).map((image, index) => (
          <div key={index} className="overflow-hidden border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]" style={{ borderRadius: style.cardRadius ?? style.radius ?? theme.radius, aspectRatio }}>
            {image.url ? <UnoptimizedImage src={image.url} alt={image.alt ?? ""} className="h-full w-full object-cover" /> : <div className="flex h-full min-h-[160px] items-center justify-center text-sm text-[color:var(--bp-muted)]">Фото</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function renderFormBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const fields = asArray<string>(data.fields);
  const title = asString(data.title, "Оставить заявку");
  const subtitle = asString(data.subtitle);
  const labelByField: Record<string, string> = { name: "Имя", phone: "Телефон", email: "Email", comment: "Комментарий" };
  return (
    <div className="mx-auto max-w-2xl">
      <h3 className="font-semibold" style={headingStyle(style, theme)}>{title}</h3>
      {subtitle && <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>{subtitle}</p>}
      <form className="mt-5 space-y-3">
        {(fields.length ? fields : ["name", "phone", "comment"]).map((field) => (
          field === "comment" ? (
            <textarea key={field} rows={4} placeholder={labelByField[field] ?? field} className="w-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm outline-none" style={{ borderRadius: style.buttonRadius ?? theme.buttonRadius }} />
          ) : (
            <input key={field} placeholder={labelByField[field] ?? field} className="w-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm outline-none" style={{ borderRadius: style.buttonRadius ?? theme.buttonRadius }} />
          )
        ))}
        <button type="button" className="px-5 py-3 text-sm font-semibold" style={{ backgroundColor: style.buttonColor || theme.buttonColor, color: style.buttonTextColor || theme.buttonTextColor, borderRadius: style.buttonRadius ?? theme.buttonRadius }}>
          {asString(data.buttonText, "Отправить")}
        </button>
      </form>
    </div>
  );
}

export function renderButtonBlock(block: SiteBlock, account: AccountInfo, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const align = data.align === "left" || data.align === "right" ? data.align : "center";
  const page = asString(data.page);
  const href =
    asString(data.href).trim() ||
    (page === "booking"
      ? buildBookingLink({ publicSlug: account.publicSlug || account.slug })
      : "#");
  return (
    <div className={align === "left" ? "text-left" : align === "right" ? "text-right" : "text-center"}>
      <a href={href} className="inline-flex px-6 py-3 text-sm font-semibold" style={{ backgroundColor: style.buttonColor || theme.buttonColor, color: style.buttonTextColor || theme.buttonTextColor, borderRadius: style.buttonRadius ?? theme.buttonRadius }}>
        {asString(data.text, "Записаться")}
      </a>
    </div>
  );
}

export function renderAdvantagesBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const items = asArray<{ title?: string; text?: string }>(data.items);
  return (
    <div>
      <h3 className="font-semibold" style={headingStyle(style, theme)}>{asString(data.title, "Преимущества")}</h3>
      {asString(data.subtitle) && <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>{asString(data.subtitle)}</p>}
      <div className={`mt-5 grid gap-4 ${simpleGridClass(previewViewportWidth, 3)}`}>
        {items.map((item, index) => (
          <div key={index} className="border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5" style={{ borderRadius: style.cardRadius ?? style.radius ?? theme.radius }}>
            <div className="text-sm font-semibold text-[color:var(--bp-ink)]">{item.title}</div>
            {item.text && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{item.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function renderProjectBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const imageUrl = asString(data.imageUrl).trim();
  const isNarrow = typeof previewViewportWidth === "number" && previewViewportWidth < 760;
  return (
    <div className={`grid gap-6 ${isNarrow ? "grid-cols-1" : "md:grid-cols-2"} items-center`}>
      <div>
        <h3 className="font-semibold" style={headingStyle(style, theme)}>{asString(data.title, "О проекте")}</h3>
        <p className="mt-4 whitespace-pre-line text-[color:var(--bp-muted)]" style={textStyle(style, theme)}>{asString(data.text)}</p>
      </div>
      <div className="overflow-hidden bg-[color:var(--bp-paper)]" style={{ borderRadius: style.radius ?? theme.radius, aspectRatio: "4 / 3" }}>
        {imageUrl ? <UnoptimizedImage src={imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-[color:var(--bp-muted)]">Изображение проекта</div>}
      </div>
    </div>
  );
}

export function renderFooterBlock(block: SiteBlock, account: AccountInfo, accountProfile: AccountProfile, locations: LocationItem[], theme: SiteTheme, style: BlockStyle, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const location = locations[0];
  const socialUrls: Record<string, string | undefined> = {
    website: accountProfile.websiteUrl,
    instagram: accountProfile.instagramUrl,
    whatsapp: accountProfile.whatsappUrl,
    telegram: accountProfile.telegramUrl,
    max: accountProfile.maxUrl,
    vk: accountProfile.vkUrl,
    viber: accountProfile.viberUrl,
    pinterest: accountProfile.pinterestUrl,
    facebook: accountProfile.facebookUrl,
    tiktok: accountProfile.tiktokUrl,
    youtube: accountProfile.youtubeUrl,
    twitter: accountProfile.twitterUrl,
    dzen: accountProfile.dzenUrl,
    ok: accountProfile.okUrl,
  };
  return (
    <footer className={`grid gap-5 ${simpleGridClass(previewViewportWidth, 3)}`}>
      <div>
        <h3 className="font-semibold" style={headingStyle(style, theme)}>{asString(data.title, account.name)}</h3>
        {asString(data.subtitle) && <p className="mt-2 text-[color:var(--bp-muted)]">{asString(data.subtitle)}</p>}
      </div>
      <div className="space-y-2 text-sm text-[color:var(--bp-muted)]">
        {data.showPhone !== false && accountProfile.phone && <div>{accountProfile.phone}</div>}
        {data.showEmail !== false && accountProfile.email && <div>{accountProfile.email}</div>}
        {data.showAddress !== false && (accountProfile.address || location?.address) && <div>{accountProfile.address || location?.address}</div>}
      </div>
      {data.showSocials !== false && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(SOCIAL_LABELS).map(([key, label]) => {
            const url = socialUrls[key];
            return url ? <a key={key} href={String(url)} className="border border-[color:var(--bp-stroke)] px-3 py-2 text-xs text-[color:var(--bp-ink)]" style={{ borderRadius: style.buttonRadius ?? theme.buttonRadius }}>{label}</a> : null;
          })}
        </div>
      )}
    </footer>
  );
}

export function renderTeamBlock(block: SiteBlock, account: AccountInfo, locations: LocationItem[], specialists: SpecialistItem[], theme: SiteTheme, style: BlockStyle, currentEntity: CurrentEntity, previewViewportWidth?: number) {
  return renderSpecialists(
    { ...block, type: "specialists", data: { ...block.data, showSearch: false, showSort: false, showCategoryTabs: false } },
    account,
    locations,
    specialists,
    theme,
    style,
    currentEntity,
    previewViewportWidth
  );
}

export function renderNewsBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const items = asArray<{ title?: string; text?: string; date?: string }>(data.items);
  return (
    <div>
      <h3 className="font-semibold" style={headingStyle(style, theme)}>{asString(data.title, "Новости")}</h3>
      {asString(data.subtitle) && <p className="mt-2 text-[color:var(--bp-muted)]">{asString(data.subtitle)}</p>}
      <div className={`mt-5 grid gap-4 ${simpleGridClass(previewViewportWidth, 3)}`}>
        {items.map((item, index) => (
          <article key={index} className="border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5" style={{ borderRadius: style.cardRadius ?? style.radius ?? theme.radius }}>
            {item.date && <div className="mb-2 text-xs text-[color:var(--bp-muted)]">{item.date}</div>}
            <h4 className="font-semibold text-[color:var(--bp-ink)]">{item.title}</h4>
            {item.text && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{item.text}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

export function renderWidgetBlock(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const embedCode = asString(data.embedCode).trim();
  return (
    <div className="border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-5 text-sm text-[color:var(--bp-muted)]" style={{ borderRadius: style.radius ?? theme.radius }}>
      <div className="font-semibold text-[color:var(--bp-ink)]">{asString(data.title, "Виджет")}</div>
      <div className="mt-2">{embedCode ? "Код виджета сохранен. Публичное выполнение внешнего кода будет подключено отдельной безопасной настройкой." : asString(data.fallbackText, "Здесь будет внешний виджет.")}</div>
    </div>
  );
}

export function renderLocationProfileBlock(block: SiteBlock, account: AccountInfo, accountProfile: AccountProfile, locations: LocationItem[], services: ServiceItem[], specialists: SpecialistItem[], theme: SiteTheme, style: BlockStyle, currentEntity: CurrentEntity, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const id = Number(data.locationId) || (currentEntity?.type === "location" ? currentEntity.id : null);
  const location = locations.find((item) => item.id === id) ?? locations[0];
  if (!location) return renderContacts(block, account, accountProfile, locations, theme, style, previewViewportWidth);
  const scopedServices = services.filter((service) => service.locationIds.includes(location.id));
  const scopedSpecialists = specialists.filter((specialist) => specialist.locationIds.includes(location.id));
  return (
    <div className="space-y-8">
      {renderLocations({ ...block, type: "locations", data: { ...block.data, mode: "selected", ids: [location.id], showSearch: false } }, account, accountProfile, [location], theme, style, currentEntity, previewViewportWidth)}
      {data.showServices !== false && renderServices({ ...block, type: "services", data: { title: "Услуги локации", mode: "all", showSearch: false, showSort: false, showCategoryTabs: false } }, account, [location], scopedServices, theme, style, currentEntity, previewViewportWidth)}
      {data.showSpecialists !== false && renderSpecialists({ ...block, type: "specialists", data: { title: "Специалисты локации", mode: "all", showSearch: false, showSort: false, showCategoryTabs: false } }, account, [location], scopedSpecialists, theme, style, currentEntity, previewViewportWidth)}
    </div>
  );
}

export function renderServiceProfileBlock(block: SiteBlock, account: AccountInfo, locations: LocationItem[], services: ServiceItem[], specialists: SpecialistItem[], theme: SiteTheme, style: BlockStyle, currentEntity: CurrentEntity, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const id = Number(data.serviceId) || (currentEntity?.type === "service" ? currentEntity.id : null);
  const service = services.find((item) => item.id === id) ?? services[0];
  if (!service) return renderTextBlock({ ...block, data: { title: "Услуга не выбрана", text: "Выберите услугу в настройках блока." } }, theme, style);
  const scopedSpecialists = specialists.filter((item) => service.specialistIds?.includes(item.id));
  return (
    <div className="space-y-8">
      {renderServices({ ...block, type: "services", data: { ...block.data, mode: "selected", ids: [service.id], showSearch: false, showSort: false, showCategoryTabs: false } }, account, locations, [service], theme, style, currentEntity, previewViewportWidth)}
      {data.showSpecialists !== false && renderSpecialists({ ...block, type: "specialists", data: { title: "Кто выполняет услугу", mode: "all", showSearch: false, showSort: false, showCategoryTabs: false } }, account, locations, scopedSpecialists, theme, style, currentEntity, previewViewportWidth)}
    </div>
  );
}

export function renderSpecialistProfileBlock(block: SiteBlock, account: AccountInfo, locations: LocationItem[], services: ServiceItem[], specialists: SpecialistItem[], theme: SiteTheme, style: BlockStyle, currentEntity: CurrentEntity, previewViewportWidth?: number) {
  const data = block.data as Record<string, unknown>;
  const id = Number(data.specialistId) || (currentEntity?.type === "specialist" ? currentEntity.id : null);
  const specialist = specialists.find((item) => item.id === id) ?? specialists[0];
  if (!specialist) return renderTextBlock({ ...block, data: { title: "Специалист не выбран", text: "Выберите специалиста в настройках блока." } }, theme, style);
  const scopedServices = services.filter((item) => item.specialistIds?.includes(specialist.id));
  return (
    <div className="space-y-8">
      {renderSpecialists({ ...block, type: "specialists", data: { ...block.data, mode: "selected", ids: [specialist.id], showSearch: false, showSort: false, showCategoryTabs: false } }, account, locations, [specialist], theme, style, currentEntity, previewViewportWidth)}
      {data.showServices !== false && renderServices({ ...block, type: "services", data: { title: "Услуги специалиста", mode: "all", showSearch: false, showSort: false, showCategoryTabs: false } }, account, locations, scopedServices, theme, style, currentEntity, previewViewportWidth)}
    </div>
  );
}

export function buildAishaWidgetConfig(
  block: SiteBlock,
  style: BlockStyle,
  theme: SiteTheme
): SiteAishaWidgetConfig {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const rawStyle = ((block.data as Record<string, unknown>)?.style ?? {}) as Record<string, unknown>;
  const readRawStyleColor = (key: string) => {
    const value = rawStyle[key];
    return typeof value === "string" ? value.trim() : "";
  };
  const toNumberInRange = (value: unknown, min: number, max: number, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  };
  const isDark = theme.mode === "dark";
  const pickMode = (light: string, dark: string) => (isDark ? dark || light : light || dark);
  const gradientEnabledLight = Boolean(style.gradientEnabledLight);
  const gradientEnabledDark = Boolean(style.gradientEnabledDark);
  const gradientDirectionLight =
    style.gradientDirectionLight === "horizontal" ? "horizontal" : "vertical";
  const gradientDirectionDark =
    style.gradientDirectionDark === "horizontal" ? "horizontal" : "vertical";
  const panelGradientFromLight = style.gradientFromLightResolved || null;
  const panelGradientToLight = style.gradientToLightResolved || null;
  const panelGradientFromDark = style.gradientFromDarkResolved || panelGradientFromLight;
  const panelGradientToDark = style.gradientToDarkResolved || panelGradientToLight;
  const rawBorderBase = readRawStyleColor("borderColor");
  const rawBorderLight = readRawStyleColor("borderColorLight");
  const rawBorderDark = readRawStyleColor("borderColorDark");
  const hasBorderLight = (rawBorderLight || rawBorderBase).length > 0;
  const hasBorderDark = (rawBorderDark || rawBorderBase).length > 0;
  const borderColorLightValue = hasBorderLight ? (style.borderColorLightResolved || style.borderColor || null) : null;
  const borderColorDarkValue = hasBorderDark ? (style.borderColorDarkResolved || style.borderColorLightResolved || style.borderColor || null) : null;
  const borderColorActive = isDark ? borderColorDarkValue : borderColorLightValue;

  return {
    enabled: data.enabled !== false,
    assistantName:
      typeof data.assistantName === "string" && data.assistantName.trim()
        ? data.assistantName.trim()
        : "Ассистент",
    headerTitle:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : "AI-ассистент записи",
    label:
      typeof data.label === "string" && data.label.trim()
        ? data.label.trim()
        : "AI-ассистент",
    offsetBottomPx: toNumberInRange(data.offsetBottomPx, 8, 64, 16),
    offsetRightPx: toNumberInRange(data.offsetRightPx, 8, 160, 16),
    panelWidthPx: 400,
    panelHeightVh: 74,
    radiusPx: style.radius ?? theme.radius ?? 16,
    buttonRadiusPx: style.buttonRadius ?? theme.buttonRadius ?? 0,
    buttonColor:
      pickMode(style.buttonColorLightResolved, style.buttonColorDarkResolved) || style.buttonColor || null,
    buttonTextColor:
      pickMode(style.buttonTextColorLightResolved, style.buttonTextColorDarkResolved) ||
      style.buttonTextColor ||
      null,
    panelColor: pickMode(style.blockBgLightResolved, style.blockBgDarkResolved) || style.blockBg || null,
    textColor: pickMode(style.textColorLightResolved, style.textColorDarkResolved) || style.textColor || null,
    borderColor: borderColorActive,
    buttonColorLight: style.buttonColorLightResolved || null,
    buttonColorDark: style.buttonColorDarkResolved || null,
    buttonTextColorLight: style.buttonTextColorLightResolved || null,
    buttonTextColorDark: style.buttonTextColorDarkResolved || null,
    panelColorLight: style.blockBgLightResolved || null,
    panelColorDark: style.blockBgDarkResolved || null,
    textColorLight: style.textColorLightResolved || null,
    textColorDark: style.textColorDarkResolved || null,
    borderColorLight: borderColorLightValue,
    borderColorDark: borderColorDarkValue,
    assistantBubbleColorLight:
      style.assistantBubbleColorLightResolved || style.subBlockBgLightResolved || null,
    assistantBubbleColorDark:
      style.assistantBubbleColorDarkResolved || style.subBlockBgDarkResolved || null,
    assistantTextColorLight:
      style.assistantTextColorLightResolved || style.textColorLightResolved || null,
    assistantTextColorDark:
      style.assistantTextColorDarkResolved || style.textColorDarkResolved || null,
    clientBubbleColorLight:
      style.clientBubbleColorLightResolved || style.buttonColorLightResolved || null,
    clientBubbleColorDark:
      style.clientBubbleColorDarkResolved || style.buttonColorDarkResolved || null,
    clientTextColorLight:
      style.clientTextColorLightResolved || style.buttonTextColorLightResolved || null,
    clientTextColorDark:
      style.clientTextColorDarkResolved || style.buttonTextColorDarkResolved || null,
    headerBgColorLight: style.headerBgColorLightResolved || null,
    headerBgColorDark: style.headerBgColorDarkResolved || null,
    headerTextColorLight: style.headerTextColorLightResolved || null,
    headerTextColorDark: style.headerTextColorDarkResolved || null,
    quickReplyButtonColorLight:
      style.quickReplyButtonColorLightResolved || style.buttonColorLightResolved || null,
    quickReplyButtonColorDark:
      style.quickReplyButtonColorDarkResolved || style.buttonColorDarkResolved || null,
    quickReplyTextColorLight:
      style.quickReplyTextColorLightResolved || style.buttonTextColorLightResolved || null,
    quickReplyTextColorDark:
      style.quickReplyTextColorDarkResolved || style.buttonTextColorDarkResolved || null,
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
    assistantBubbleColor:
      pickMode(style.assistantBubbleColorLightResolved, style.assistantBubbleColorDarkResolved) ||
      pickMode(style.subBlockBgLightResolved, style.subBlockBgDarkResolved) ||
      style.assistantBubbleColor ||
      style.subBlockBg ||
      null,
    assistantTextColor:
      pickMode(style.assistantTextColorLightResolved, style.assistantTextColorDarkResolved) ||
      pickMode(style.textColorLightResolved, style.textColorDarkResolved) ||
      style.assistantTextColor ||
      style.textColor ||
      null,
    clientBubbleColor:
      pickMode(style.clientBubbleColorLightResolved, style.clientBubbleColorDarkResolved) ||
      pickMode(style.buttonColorLightResolved, style.buttonColorDarkResolved) ||
      style.clientBubbleColor ||
      style.buttonColor ||
      null,
    clientTextColor:
      pickMode(style.clientTextColorLightResolved, style.clientTextColorDarkResolved) ||
      pickMode(style.buttonTextColorLightResolved, style.buttonTextColorDarkResolved) ||
      style.clientTextColor ||
      style.buttonTextColor ||
      null,
    headerBgColor:
      pickMode(style.headerBgColorLightResolved, style.headerBgColorDarkResolved) ||
      style.headerBgColor ||
      null,
    headerTextColor:
      pickMode(style.headerTextColorLightResolved, style.headerTextColorDarkResolved) ||
      style.headerTextColor ||
      null,
    quickReplyButtonColor:
      pickMode(style.quickReplyButtonColorLightResolved, style.quickReplyButtonColorDarkResolved) ||
      pickMode(style.buttonColorLightResolved, style.buttonColorDarkResolved) ||
      style.quickReplyButtonColor ||
      style.buttonColor ||
      null,
    quickReplyTextColor:
      pickMode(style.quickReplyTextColorLightResolved, style.quickReplyTextColorDarkResolved) ||
      pickMode(style.buttonTextColorLightResolved, style.buttonTextColorDarkResolved) ||
      style.quickReplyTextColor ||
      style.buttonTextColor ||
      null,
    messageRadiusPx: style.messageRadius ?? 16,
    panelShadowColor: style.shadowColor || theme.shadowColor || null,
    panelShadowSize: style.shadowSize ?? theme.shadowSize ?? null,
  };
}

export function renderAisha(
  block: SiteBlock,
  account: AccountInfo,
  theme: SiteTheme,
  style: BlockStyle,
  previewViewportWidth?: number
) {
  const data = block.data as Record<string, unknown>;
  const enabled = data.enabled !== false;
  const widgetConfig = buildAishaWidgetConfig(block, style, theme);

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-[color:var(--block-border,var(--site-border))] p-4 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
        {"Блок AI-ассистента выключен. Включите его в настройках сайта."}
      </div>
    );
  }

  const isMobilePreview =
    typeof previewViewportWidth === "number" &&
    Number.isFinite(previewViewportWidth) &&
    previewViewportWidth <= 480;
  const inlinePreviewMinHeight = isMobilePreview
    ? previewViewportWidth && previewViewportWidth > 400
      ? "520px"
      : "640px"
    : "calc(74vh + 24px)";

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: inlinePreviewMinHeight }}>
      <PublicAiChatWidget
        accountSlug={account.slug}
        widgetConfig={widgetConfig}
        mode="inline"
        defaultOpen
        className="inset-0"
        themeMode={theme.mode}
        previewViewportWidth={previewViewportWidth}
        disablePageScrollOnMessages
      />
    </div>
  );
}

export function renderContacts(
  block: SiteBlock,
  account: AccountInfo,
  accountProfile: AccountProfile,
  locations: LocationItem[],
  theme: SiteTheme,
  style: BlockStyle,
  previewViewportWidth?: number
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

  const contactsGridClassName =
    typeof previewViewportWidth === "number" && Number.isFinite(previewViewportWidth)
      ? previewViewportWidth >= 960
        ? "grid-cols-[1.2fr_1fr]"
        : "grid-cols-1"
      : "md:grid-cols-[1.2fr_1fr]";

  return (
    <div className={`grid gap-4 ${contactsGridClassName}`}>
      <div>
        <h3
          className="font-semibold"
          style={headingStyle(style, theme)}
        >
          {(data.title as string) || "Контакты"}
        </h3>
        {subtitle && (
          <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
            {subtitle}
          </p>
        )}
        <div className="mt-4 space-y-2 text-[color:var(--bp-muted)]" style={textStyle(style, theme)}>
          <div>Аккаунт: {account.name}</div>
          {accountProfile.phone && <div>Телефон: {accountProfile.phone}</div>}
          {accountProfile.email && <div>Email: {accountProfile.email}</div>}
          {(accountProfile.address || location?.address) && (
            <div>Адрес: {accountProfile.address || location?.address}</div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-xs text-[color:var(--bp-muted)]">
        Здесь можно будет подключить карту.
      </div>
    </div>
  );
}
