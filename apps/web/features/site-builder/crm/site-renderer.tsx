import * as React from "react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import PublicAiChatWidget from "@/components/public-ai-chat-widget";
import {
  resolveCoverBackgroundVisual,
  resolveMenuBlockBackgroundVisual,
  resolveMenuSectionBackgroundVisual,
} from "@/features/site-builder/shared/background-visuals";
import type {
  SiteAccountInfoWithPublicSlug as AccountInfo,
  SiteBranding as Branding,
  SiteEditorAccountProfile as AccountProfile,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
  SiteWorkPhotos as WorkPhotos,
} from "@/features/site-builder/shared/site-data";
import {
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
  gridStartColumn: number | null;
  gridEndColumn: number | null;
  useCustomWidth: boolean;
  radius: number | null;
  buttonRadius: number | null;
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

export function normalizeBlockStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
  const style = (block.data.style as Record<string, unknown>) ?? {};
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
    theme.lightPalette.panelColor,
    theme.darkPalette.panelColor
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
  const rawBlockWidth = toNumber(style.blockWidth);
  const rawBlockWidthColumns = toNumber(style.blockWidthColumns);
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
  return {
    marginTop: toNumber(style.marginTop) ?? 0,
    marginBottom: toNumber(style.marginBottom) ?? 0,
    blockWidth: useCustomWidth ? normalizedBlockWidth ?? DEFAULT_BLOCK_WIDTH : null,
    blockWidthColumns: useCustomWidth ? resolvedColumnsFromGrid : null,
    gridStartColumn: useCustomWidth ? resolvedGridStart : null,
    gridEndColumn: useCustomWidth ? resolvedGridEnd : null,
    useCustomWidth,
    radius: block.type === "menu" ? 0 : toNumber(style.radius),
    buttonRadius: block.type === "menu" ? 0 : toNumber(style.buttonRadius),
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
    buttonColorLight: readColor("buttonColorLight") || readColor("buttonColor"),
    buttonColorDark: readColor("buttonColorDark"),
    buttonColor: resolveColor("buttonColorLight", "buttonColorDark", "buttonColor"),
    buttonTextColorLight:
      readColor("buttonTextColorLight") || readColor("buttonTextColor"),
    buttonTextColorDark: readColor("buttonTextColorDark"),
    buttonTextColor: resolveColor(
      "buttonTextColorLight",
      "buttonTextColorDark",
      "buttonTextColor"
    ),
    textColorLight: readColor("textColorLight") || readColor("textColor"),
    textColorDark: readColor("textColorDark"),
    textColor: resolveColor("textColorLight", "textColorDark", "textColor"),
    mutedColorLight: readColor("mutedColorLight") || readColor("mutedColor"),
    mutedColorDark: readColor("mutedColorDark"),
    mutedColor: resolveColor("mutedColorLight", "mutedColorDark", "mutedColor"),
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
    buttonColorLightResolved: buttonPair.lightResolved,
    buttonColorDarkResolved: buttonPair.darkResolved,
    buttonTextColorLightResolved: buttonTextPair.lightResolved,
    buttonTextColorDarkResolved: buttonTextPair.darkResolved,
    textColorLightResolved: textPair.lightResolved,
    textColorDarkResolved: textPair.darkResolved,
    mutedColorLightResolved: mutedPair.lightResolved,
    mutedColorDarkResolved: mutedPair.darkResolved,
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
    textAlign:
      style.textAlign === "center" || style.textAlign === "right"
        ? style.textAlign
        : "left",
    textAlignHeading:
      style.textAlignHeading === "center" || style.textAlignHeading === "right"
        ? style.textAlignHeading
        : style.textAlign === "center" || style.textAlign === "right"
          ? style.textAlign
          : "left",
    textAlignSubheading:
      style.textAlignSubheading === "center" || style.textAlignSubheading === "right"
        ? style.textAlignSubheading
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
            ? "border-[#ff5a5f] bg-[#ff5a5f] text-white"
            : "border-[color:var(--bp-stroke)] bg-transparent text-transparent"
        }`}
      >
        ✓
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

  const setSource = (next: { type: string; id?: number | null; url?: string }) => {
    onChange({ imageSource: next });
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setCustomLoading(true);
      try {
        const response = await fetch("/api/v1/crm/account/media?type=siteCover");
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
  }, [customImages, customSelectedId, imageSource.type, imageSource.url]);

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
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="none">Без изображения</option>
          <option value="account">Профиль аккаунта</option>
          <option value="custom">Своё изображение</option>
        </select>
      </label>

      {previewUrl ? (
          <div className="space-y-2">
          <div className="flex h-28 w-full items-center justify-center overflow-hidden border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
            <img src={previewUrl} alt="Превью обложки" className="h-full w-full object-contain" />
          </div>
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
                        <img src={image.url} alt="" className="h-full w-full object-cover" />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeCustomImage(image)}
                      disabled={removingId === image.id}
                      className="absolute right-1 top-1 inline-flex h-6 items-center justify-center rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 text-[11px] text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bp-save-close,var(--bp-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bp-paper)]"
                    >
                      {removingId === image.id ? "..." : "×"}
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
  workPhotos,
  theme,
  loaderConfig,
  currentEntity,
  previewMode,
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
  workPhotos: WorkPhotos;
  theme: SiteTheme;
  loaderConfig: SiteLoaderConfig | null;
  currentEntity: CurrentEntity;
  previewMode: "desktop" | "mobile";
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
  const blockWidthColumns = isMenu
    ? MAX_BLOCK_COLUMNS
    : clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, block.type);
  const gridFallback = centeredGridRange(
    isMenu || isBooking ? MAX_BLOCK_COLUMNS : blockWidthColumns
  );
  const gridStart = isMenu || isBooking
    ? 1
    : clampGridColumn(style.gridStartColumn ?? gridFallback.start);
  const gridEnd = isMenu || isBooking
    ? MAX_BLOCK_COLUMNS
    : Math.max(gridStart, clampGridColumn(style.gridEndColumn ?? gridFallback.end));
  const gridSpan = Math.max(1, gridEnd - gridStart + 1);
  const gridWidthPercent = `${(gridSpan / MAX_BLOCK_COLUMNS) * 100}%`;
  const gridLeftPercent = `${((gridStart - 1) / MAX_BLOCK_COLUMNS) * 100}%`;
  const bookingInnerColumns = bookingContentColumns(blockWidthColumns);
  const blockOuterColumns = isBooking || isMenu ? MAX_BLOCK_COLUMNS : blockWidthColumns;
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
  const bookingContentWidth = `${(bookingInnerColumns / MAX_BLOCK_COLUMNS) * 100}%`;
  const containerClass = isBooking || isMenu || isGallery || isCover || isAisha
    ? "p-0"
    : `border ${
        isSelected ? "border-[color:var(--bp-accent)]" : "border-[color:var(--bp-stroke)]"
      } p-6 shadow-[var(--bp-shadow-soft)]`;
  const blockContent = renderBlock(
    block,
    account,
    accountProfile,
    branding,
    locations,
    services,
    specialists,
    promos,
    workPhotos,
    theme,
    loaderConfig,
    currentEntity,
    previewMode,
    onThemeToggle,
    coverScrollEffect === "parallax" ? coverParallaxOffset : 0
  );
  const coverBackground = resolveCoverBackgroundVisual(
    isCover ? (block.data as Record<string, unknown>) : null,
    sectionBg || theme.panelColor
  );
  const menuSectionBackground = resolveMenuSectionBackgroundVisual(
    isMenu ? (block.data as Record<string, unknown>) : null,
    sectionBg || theme.panelColor
  );
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
        width: isGallery || isBooking || isMenu || isCover || isAisha ? "100%" : gridWidthPercent,
        maxWidth: "100%",
        marginLeft: isGallery || isBooking || isMenu || isCover || isAisha ? "auto" : gridLeftPercent,
        marginRight: isGallery || isBooking || isMenu || isCover || isAisha ? "auto" : 0,
        marginTop: isGallery || isBooking || isMenu || isCover || isAisha ? 0 : style.marginTop,
        marginBottom: isGallery || isBooking || isMenu || isCover || isAisha ? 0 : style.marginBottom,
        paddingTop: isGallery || isBooking || isMenu || isCover || isAisha ? style.marginTop : undefined,
        paddingBottom: isGallery || isBooking || isMenu || isCover || isAisha ? style.marginBottom : undefined,
        backgroundColor: isMenu
          ? menuSectionBackground.backgroundColor
          : isAisha
          ? "transparent"
          : isCover
            ? coverBackground.backgroundColor
            : sectionBg,
        backgroundImage: isCover
          ? coverBackground.backgroundImage
          : isMenu
            ? menuSectionBackground.backgroundImage
            : "none",
      }}
    >
      <div
        style={
          isGallery && !isFullscreenGallery
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
            borderRadius: isBooking || isMenu || isCover || isAisha ? 0 : blockRadius,
            backgroundColor: isBooking || isMenu || isCover || isAisha
              ? "transparent"
              : gradientEnabled
                ? gradientFrom
                : blockBg,
            backgroundImage: isBooking || isMenu || isCover || isAisha
              ? "none"
              : gradientEnabled
                ? `linear-gradient(${gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${gradientFrom}, ${gradientTo})`
                : "none",
            color: textColor,
            fontFamily: blockFont,
            borderColor: isBooking || isMenu || isGallery || isCover || isAisha ? "transparent" : borderColor,
            borderWidth: isBooking || isMenu || isGallery || isCover || isAisha || borderColor === "transparent" ? 0 : 1,
            boxShadow:
              isBooking || isGallery || isCover || isAisha || shadowSize <= 0
                ? "none"
                : `0 ${shadowSize}px ${shadowSize * 2}px ${shadowColor}`,
            ["--bp-ink" as string]: textColor,
            ["--bp-muted" as string]: mutedColor,
            ["--bp-stroke" as string]: borderColor,
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
            ["--block-button-light" as string]: style.buttonColorLightResolved,
            ["--block-button-dark" as string]: style.buttonColorDarkResolved,
            ["--block-button-text-light" as string]: style.buttonTextColorLightResolved,
            ["--block-button-text-dark" as string]: style.buttonTextColorDarkResolved,
            ["--block-gradient-light" as string]: lightGradient,
            ["--block-gradient-dark" as string]: darkGradient,
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
  spacing,
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
      if (totalDelta !== lastAppliedDelta) {
        onAdjustSpacing(totalDelta - lastAppliedDelta, target);
        lastAppliedDelta = totalDelta;
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
  workPhotos: WorkPhotos,
  theme: SiteTheme,
  loaderConfig: SiteLoaderConfig | null,
  currentEntity: CurrentEntity,
  previewMode: "desktop" | "mobile",
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
        onThemeToggle
      );
    case "about":
      return renderAbout(block, account, accountProfile, theme, style);
    case "client":
      return renderClient(block, account, theme, style);
    case "booking":
      return renderBooking(block, account, theme, style, loaderConfig);
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
        currentEntity
      );
    case "services":
      return renderServices(block, account, services, theme, style, currentEntity);
    case "specialists":
      return renderSpecialists(block, account, specialists, theme, style, currentEntity);
    case "promos":
      return renderPromos(block, promos, theme, style, currentEntity);
    case "works":
      return renderWorks(block, workPhotos, theme, style, currentEntity);
    case "reviews":
      return renderReviews(block, theme, style);
    case "contacts":
      return renderContacts(block, account, accountProfile, locations, theme, style);
    case "aisha":
      return renderAisha(block, account, theme, style);
    default:
      return null;
  }
}

export function buildBookingVars(style: BlockStyle, theme: SiteTheme) {
  const blockWidthColumns = clampBlockColumns(
    style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
    "booking"
  );
  const blockWidthVisualColumns = bookingContentColumns(blockWidthColumns);
  const bookingCardsColumns = bookingCardsPerRow(blockWidthColumns);
  const blockWidthPercent = (blockWidthVisualColumns / MAX_BLOCK_COLUMNS) * 100;
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
  const subBlockCurrent = theme.mode === "dark" ? subBlockDark : subBlockLight;
  const bookingGradientLight = style.gradientEnabledLight
    ? `linear-gradient(${style.gradientDirectionLight === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromLightResolved}, ${style.gradientToLightResolved})`
    : "none";
  const bookingGradientDark = style.gradientEnabledDark
    ? `linear-gradient(${style.gradientDirectionDark === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFromDarkResolved}, ${style.gradientToDarkResolved})`
    : "none";
  const bookingGradient = theme.mode === "dark" ? bookingGradientDark : bookingGradientLight;
  const bookingBorderLight = style.borderColorLight.trim()
    ? style.borderColorLightResolved || "transparent"
    : "transparent";
  const bookingBorderDark = style.borderColorDark.trim()
    ? style.borderColorDarkResolved || "transparent"
    : "transparent";
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
    "--booking-gradient": bookingGradient,
    "--bp-shadow-soft": shadowSize > 0 ? `0 ${shadowSize}px ${shadowSize * 2}px ${shadowColor}` : "none",
    "--bp-radius": `${radius}px`,
    "--bp-button-radius": `${buttonRadius}px`,
    "--bp-font-heading": style.fontHeading || palette.fontHeading || theme.fontHeading,
    "--bp-font-body": style.fontBody || palette.fontBody || theme.fontBody,
    "--bp-text-size-xs": `${sizeXs}px`,
    "--bp-text-size-sm": `${textSize}px`,
    "--bp-text-size-base": `${subheadingSize}px`,
    "--bp-text-size-lg": `${headingSize}px`,
    "--bp-content-width": `${blockWidthPercent}%`,
    "--bp-cards-cols": String(bookingCardsColumns),
  } as Record<string, string>;
}

export function renderBooking(
  block: SiteBlock,
  account: AccountInfo,
  theme: SiteTheme,
  style: BlockStyle,
  loaderConfig: SiteLoaderConfig | null
) {
  const accountSlug = account.slug;
  const accountPublicSlug = account.publicSlug ?? undefined;
  const cssVars = buildBookingVars(style, theme);
  return (
    <div className="booking-root" style={cssVars}>
      <div className="booking-bleed">
        <BookingClient
          accountSlug={accountSlug}
          accountPublicSlug={accountPublicSlug}
          loaderConfig={loaderConfig}
        />
      </div>
    </div>
  );
}

export function renderLoaderPreview(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = (block.data ?? {}) as Record<string, unknown>;
  const enabled = data.enabled !== false;
  const color =
    typeof data.color === "string" && data.color.trim()
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
  const parsedBackdrop = parseBackdropColor(data.backdropColor);
  const backdropHex =
    typeof data.backdropHex === "string" && data.backdropHex.trim()
      ? data.backdropHex.trim()
      : parsedBackdrop.hex;
  const backdropOpacity =
    Number.isFinite(Number(data.backdropOpacity))
      ? clamp01(Number(data.backdropOpacity))
      : parsedBackdrop.alpha;
  const backdropColor = hexToRgbaString(backdropHex, backdropOpacity);

  const visual =
    block.variant === "v2" ? "dots" : block.variant === "v3" ? "pulse" : "spinner";

  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
      <div className="text-sm font-semibold">Лоадер сайта</div>
      <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
        {enabled ? "Активен" : "Отключен"}
      </div>
      <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
        <div
          className="relative h-24 overflow-hidden rounded-lg border border-[color:var(--bp-stroke)]"
          style={{ backgroundColor: "transparent" }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={
              backdropEnabled && backdropOpacity > 0
                ? { backgroundColor: backdropColor }
                : undefined
            }
          >
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
              <span className="text-xs text-[color:var(--bp-muted)]">Включите блок в настройках</span>
            )}
          </div>
        </div>
        <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
          Затемнение: {backdropHex} · {Math.round(backdropOpacity * 100)}%
        </div>
        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
          Время: {fixedDurationEnabled ? `${fixedDurationSec} сек` : "авто"}
        </div>
      </div>
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
    fontSize: style.headingSize ?? theme.headingSize,
    textAlign: style.textAlignHeading ?? style.textAlign,
    color: style.textColor || theme.textColor,
  } as const;
}

export function subheadingStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontSubheading || style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightSubheading ?? undefined,
    fontSize: style.subheadingSize ?? theme.subheadingSize,
    textAlign: style.textAlignSubheading ?? style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

export function textStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightBody ?? undefined,
    fontSize: style.textSize ?? theme.textSize,
    textAlign: style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
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
  arrowColor,
  arrowHoverColor,
  arrowBgColor,
  arrowHoverBgColor,
  arrowShowOutline,
  arrowOutlineColor,
  arrowOutlineThickness,
  dotSize,
  dotColor,
  dotActiveColor,
  dotBorderWidth,
  dotBorderColor,
  subtitleColor,
  descriptionColor,
  headingDesktopSize,
  subheadingDesktopSize,
  textDesktopSize,
  headingMobileSize,
  subheadingMobileSize,
  textMobileSize,
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
  arrowColor: string;
  arrowHoverColor: string;
  arrowBgColor: string;
  arrowHoverBgColor: string;
  arrowShowOutline: boolean;
  arrowOutlineColor: string;
  arrowOutlineThickness: number;
  dotSize: number;
  dotColor: string;
  dotActiveColor: string;
  dotBorderWidth: number;
  dotBorderColor: string;
  subtitleColor: string;
  descriptionColor: string;
  headingDesktopSize: number;
  subheadingDesktopSize: number;
  textDesktopSize: number;
  headingMobileSize: number;
  subheadingMobileSize: number;
  textMobileSize: number;
}) {
  const [index, setIndex] = useState(0);
  const canSlide = slides.length > 1;
  const [hoveredArrow, setHoveredArrow] = useState<"prev" | "next" | null>(null);

  useEffect(() => {
    if (slides.length === 0) {
      setIndex(0);
      return;
    }
    if (index >= slides.length) {
      setIndex(slides.length - 1);
    }
  }, [index, slides.length]);

  useEffect(() => {
    if (!canSlide || autoplayMs <= 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => {
        if (infinite) return (prev + 1) % slides.length;
        if (prev >= slides.length - 1) return prev;
        return prev + 1;
      });
    }, autoplayMs);
    return () => clearInterval(timer);
  }, [autoplayMs, canSlide, infinite, slides.length]);

  const current = slides[index] ?? slides[0];
  if (!current) return null;

  const arrowSizeMap = { sm: 40, md: 48, lg: 56, xl: 64 } as const;
  const arrowPx = arrowSizeMap[arrowSize] ?? 40;
  const canGoPrev = infinite || index > 0;
  const canGoNext = infinite || index < slides.length - 1;
  const goPrev = () => {
    if (!canGoPrev) return;
    setIndex((prev) => {
      if (infinite) return (prev - 1 + slides.length) % slides.length;
      return Math.max(0, prev - 1);
    });
  };
  const goNext = () => {
    if (!canGoNext) return;
    setIndex((prev) => {
      if (infinite) return (prev + 1) % slides.length;
      return Math.min(slides.length - 1, prev + 1);
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

  const baseArrowBg = arrowBgColor;
  const hoverArrowBg = arrowHoverBgColor || arrowBgColor;
  const baseArrowColor = arrowColor;
  const hoverArrowColor = arrowHoverColor || arrowColor;

  return (
    <section
      className="relative overflow-hidden px-4 py-14 sm:px-10 sm:py-20"
      style={{
        minHeight: coverHeightCss,
        backgroundImage: current.imageUrl ? `url(${current.imageUrl})` : "none",
        backgroundSize: "cover",
        backgroundPosition: coverBackgroundPosition,
      }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: filterOverlay }} />
      <div
        className="relative z-[1] mx-auto flex w-full"
        style={{
          minHeight: coverHeightCss,
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
                headingDesktopSize
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
                fontSize: `clamp(${textMobileSize}px, 4.2cqw, ${Math.max(
                  textMobileSize,
                  textDesktopSize
                )}px)`,
              }}
            >
              {current.description}
            </p>
          )}
          {current.buttonText && resolvedButtonHref && (
            <div
              className="mt-7 flex"
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
                style={{
                  ...buttonStyle(style, theme),
                  color: "#ffffff",
                  minHeight: "clamp(46px, 6cqw, 54px)",
                  paddingInline: "clamp(24px, 3.2cqw, 40px)",
                  paddingBlock: "clamp(10px, 1.2cqw, 12px)",
                  fontSize: `clamp(${subheadingMobileSize}px, 3.2cqw, ${Math.max(
                    subheadingMobileSize,
                    subheadingDesktopSize
                  )}px)`,
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
            className="absolute left-6 top-1/2 z-[3] inline-flex -translate-y-1/2 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              width: arrowPx,
              height: arrowPx,
              color: hoveredArrow === "prev" ? hoverArrowColor : baseArrowColor,
              backgroundColor: hoveredArrow === "prev" ? hoverArrowBg : baseArrowBg,
              borderWidth: arrowShowOutline ? arrowOutlineThickness : 0,
              borderColor: arrowShowOutline ? arrowOutlineColor : "transparent",
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
              stroke="currentColor"
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
            className="absolute right-6 top-1/2 z-[3] inline-flex -translate-y-1/2 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              width: arrowPx,
              height: arrowPx,
              color: hoveredArrow === "next" ? hoverArrowColor : baseArrowColor,
              backgroundColor: hoveredArrow === "next" ? hoverArrowBg : baseArrowBg,
              borderWidth: arrowShowOutline ? arrowOutlineThickness : 0,
              borderColor: arrowShowOutline ? arrowOutlineColor : "transparent",
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
              stroke="currentColor"
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
                backgroundColor: slideIndex === index ? dotActiveColor : dotColor,
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
  const title = (data.title as string) || account.name;
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
  const showSecondaryButton = Boolean(data.showSecondaryButton);
  const secondaryButtonText = (data.secondaryButtonText as string) || "Наши соцсети";
  const secondaryButtonSource = (data.secondaryButtonSource as string) || "auto";
  const socialHref = resolvePrimarySocialHref(accountProfile, secondaryButtonSource);
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
  const filterStartColor =
    filterStartColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(filterStartColorRaw)
        ? filterStartColorRaw
        : "#000000";
  const filterEndColorRaw =
    typeof data.coverFilterEndColor === "string" ? data.coverFilterEndColor.trim() : "";
  const filterEndColor =
    filterEndColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(filterEndColorRaw)
        ? filterEndColorRaw
        : "#0f0f0f";
  const filterStartOpacity = Number.isFinite(Number(data.coverFilterStartOpacity))
    ? Math.max(0, Math.min(100, Number(data.coverFilterStartOpacity)))
    : 10;
  const filterEndOpacity = Number.isFinite(Number(data.coverFilterEndOpacity))
    ? Math.max(0, Math.min(100, Number(data.coverFilterEndOpacity)))
    : 60;
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
  const arrowMode = data.coverArrow === "down" ? "down" : "none";
  const arrowColorRaw = typeof data.coverArrowColor === "string" ? data.coverArrowColor.trim() : "";
  const arrowColor =
    arrowColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(arrowColorRaw)
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
  const headingDesktopSize = style.headingSize ?? theme.headingSize;
  const subheadingDesktopSize = style.subheadingSize ?? theme.subheadingSize;
  const textDesktopSize = style.textSize ?? theme.textSize;
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
  const sliderArrowOutlineColor =
    sliderArrowOutlineColorRaw && isValidColorValue(sliderArrowOutlineColorRaw)
      ? sliderArrowOutlineColorRaw
      : "transparent";
  const sliderArrowOutlineThicknessRaw = Number(data.coverSliderArrowOutlineThickness);
  const sliderArrowOutlineThickness =
    Number.isFinite(sliderArrowOutlineThicknessRaw) && sliderArrowOutlineThicknessRaw > 0
      ? Math.max(1, Math.min(8, Math.round(sliderArrowOutlineThicknessRaw)))
      : 1;
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
      const slideButtonPage = PAGE_KEYS.includes(slideButtonPageRaw as SitePageKey)
        ? (slideButtonPageRaw as SitePageKey)
        : null;
      const slideButtonHref =
        typeof slide.buttonHref === "string" ? slide.buttonHref.trim() : "";
      const slideImage = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : "";
      const localizedTitle =
        slideTitle === "A TRUE NORTHERN PLAYA"
          ? "Красота без компромиссов"
          : slideTitle === "GETTING HERE AND AROUND"
            ? "Услуги для вашего образа"
            : slideTitle === "LAKELAND ROUTES"
              ? "Сильная команда мастеров"
              : slideTitle;
      const localizedDescription =
        slideDescription ===
        "Get around by train, bus, car, ferry, cruise ship, bicycle, skis, or sleigh."
          ? "Запишитесь на любимую услугу в удобное время и доверяйте себя профессионалам."
          : slideDescription === "Relax and enjoy yourself!"
            ? "Стрижки, окрашивание, уход и макияж в одном салоне с персональным подходом."
            : slideDescription === "Explore nearby locations with comfort and style."
              ? "Выберите специалиста по рейтингу, портфолио и свободному времени."
              : slideDescription;
      const localizedButtonText = slideButtonText === "Read more" ? "Подробнее" : slideButtonText;
      const resolvedPageHref = slideButtonPage ? resolveSitePageHref(slideButtonPage, account) : "";
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
            title: title || account.name,
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
        coverHeightCss={coverHeightCss}
        filterOverlay={filterOverlay}
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
        arrowShowOutline={sliderArrowOutlineColor !== "transparent"}
        arrowOutlineColor={sliderArrowOutlineColor}
        arrowOutlineThickness={sliderArrowOutlineThickness}
        dotSize={sliderDotSize}
        dotColor={sliderDotColor}
        dotActiveColor={sliderDotActiveColor}
        dotBorderWidth={sliderDotBorderWidth}
        dotBorderColor={sliderDotBorderColor}
        subtitleColor={subtitleColor}
        descriptionColor={descriptionColor}
        headingDesktopSize={headingDesktopSize}
        subheadingDesktopSize={subheadingDesktopSize}
        textDesktopSize={textDesktopSize}
        headingMobileSize={headingMobileSize}
        subheadingMobileSize={subheadingMobileSize}
        textMobileSize={textMobileSize}
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
        minHeight: coverHeightCss,
        containerType: "inline-size",
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
      <div className="relative z-[1] mx-auto flex w-full items-center" style={{ minHeight: coverHeightCss }}>
        <div
          className="bp-cover-content w-full"
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
                ...subheadingStyle(style, theme),
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
                ...textStyle(style, theme),
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
              flexWrap: forceMobileLayout ? "nowrap" : "wrap",
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
                className="inline-flex items-center whitespace-nowrap font-semibold"
                style={{
                  ...buttonStyle(style, theme),
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
              </a>
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
  onThemeToggle: () => void
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
  const menuBarBackground = resolveMenuBlockBackgroundVisual(data, menuFallbackBg);
  const legacyMenuGradientEnabled =
    theme.mode === "dark" ? style.gradientEnabledDark : style.gradientEnabledLight;
  const legacyMenuGradientDirection =
    theme.mode === "dark" ? style.gradientDirectionDark : style.gradientDirectionLight;
  const legacyMenuGradientFrom =
    theme.mode === "dark" ? style.gradientFromDarkResolved : style.gradientFromLightResolved;
  const legacyMenuGradientTo =
    theme.mode === "dark" ? style.gradientToDarkResolved : style.gradientToLightResolved;
  const legacyMenuGradient = legacyMenuGradientEnabled
    ? `linear-gradient(${legacyMenuGradientDirection === "horizontal" ? "to right" : "to bottom"}, ${legacyMenuGradientFrom}, ${legacyMenuGradientTo})`
    : "none";
  const menuGradient =
    menuBarBackground.backgroundImage !== "none"
      ? menuBarBackground.backgroundImage
      : legacyMenuGradient;
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
  const logoImageNode =
    showLogo && branding.logoUrl ? (
      <img
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
        className="w-full text-3xl font-medium md:text-5xl"
        style={{
          ...headingStyle(style, theme),
          textAlign: menuTextAlign,
          ...(block.variant === "v2"
            ? { fontSize: `${Math.max(26, Number(style.headingSize ?? 15) + 12)}px`, lineHeight: 1.25 }
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
            <img
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
    fontSize:
      style.subheadingSize !== null && style.subheadingSize !== undefined
        ? `${style.subheadingSize}px`
        : undefined,
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
          borderWidth: menuButtonBorderColor === "transparent" ? 0 : 1,
          borderColor: menuButtonBorderColor,
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
                className={`font-medium text-[color:var(--block-text,var(--bp-ink))] ${
                  block.variant === "v3" ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
                }`}
                style={{
                  ...headingStyle(style, theme),
                  ...(block.variant === "v3"
                    ? { fontSize: `${Math.max(32, Number(style.headingSize ?? 15) + 16)}px`, lineHeight: 1.25 }
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
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
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
          <div className="flex items-center gap-3">{logoNode}</div>
          {mobileOpen && searchNode ? (
            <div className="absolute right-24 top-1/2 hidden -translate-y-1/2 md:flex">
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
            className="absolute inset-0 z-[160] flex flex-col overflow-hidden rounded-[inherit] px-6 py-6 pt-24 md:px-10 md:py-8 md:pt-28"
            style={{ ...subBlockStyle, borderWidth: 0 }}
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
          <div className="ml-auto hidden items-center gap-2 md:flex [&_a]:!rounded-none [&_a]:!border-0 [&_a]:!bg-transparent">
            {socialsNode}
          </div>
        </div>
        {mobileOpen && (
          <div className="absolute inset-0 z-[160]">
            <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" />
            <aside
              className="relative z-10 flex h-full w-full flex-col border-r pb-5 pt-0 text-[color:var(--block-text,var(--bp-ink))] sm:w-[min(360px,78vw)]"
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
              <div className="space-y-3 px-6">
                {drawerNavNode}
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
          className="hidden px-4 2xl:block 2xl:px-8"
          style={{
            ...topBarStyle,
            height: menuHeight,
          }}
        >
          {desktopLayout}
        </div>
        <div className="2xl:hidden">
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
              <div className="flex flex-1 flex-col">
                <div className="flex flex-col gap-2">{navNode}</div>
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
      <div className="hidden md:block">{desktopLayout}</div>
      <div className="md:hidden">
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
            className="mt-4 space-y-3 rounded-none border p-4"
            style={subBlockStyle}
          >
            {searchNode}
            <div className="flex flex-col gap-2">{navNode}</div>
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

export function renderClient(block: SiteBlock, account: AccountInfo, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const title = (data.title as string) || "Личный кабинет";
  const subtitle = (data.subtitle as string) || "Ваши данные и история записей";
  const salonsTitle = (data.salonsTitle as string) || "Ваши салоны";
  const emptyText = (data.emptyText as string) || "Пока нет салонов, где вы записывались.";

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold" style={headingStyle(style, theme)}>
            {title}
          </h3>
          <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
            {subtitle}
          </p>
        </div>
        <button className="rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm">
          Выйти
        </button>
      </div>
      <div className="mt-5 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4">
        <div className="text-sm font-semibold">{salonsTitle}</div>
        <div className="mt-2 text-sm text-[color:var(--bp-muted)]" style={textStyle(style, theme)}>
          {emptyText}
        </div>
        <a
          href={account.publicSlug ? `/${account.publicSlug}/booking` : "#"}
          className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold"
          style={buttonStyle(style, theme)}
        >
          Записаться
        </a>
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
  currentEntity: CurrentEntity
) {
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
  const showButton = Boolean(data.showButton);
  const showPhone = data.showPhone !== false;
  const showAddress = data.showAddress !== false;
  const showContacts = Boolean(data.showContacts);
  const buttonText = (data.buttonText as string) || "Записаться";
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "Локации"}
      </h3>
      {subtitle && (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((location) => (
          <div
            key={location.id}
            className="rounded-2xl border p-4"
            style={{ borderColor: theme.borderColor, textAlign: style.textAlign }}
          >
            {location.coverUrl && (
              <img src={location.coverUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
            )}
            <div className="text-base font-semibold">{location.name}</div>
            {showAddress && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{location.address}</div>
            )}
            {showPhone && location.phone && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">Телефон: {location.phone}</div>
            )}
            {showContacts && (
              <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                {accountProfile.telegramUrl ? "Telegram " : ""}
                {accountProfile.whatsappUrl ? "WhatsApp " : ""}
                {accountProfile.maxUrl ? "MAX " : ""}
                {accountProfile.vkUrl ? "VK " : ""}
              </div>
            )}
            {showButton && account.publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug: account.publicSlug,
                  locationId: location.id,
                  scenario: "dateFirst",
                })}
                className="mt-3 inline-flex px-3 py-2 text-xs"
                style={buttonStyle(style, theme)}
              >
                {buttonText}
              </a>
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

export function renderServices(
  block: SiteBlock,
  account: AccountInfo,
  services: ServiceItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity
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
  const currentLocationId = currentEntity?.type === "location" ? currentEntity.id : null;
  const currentSpecialistId = currentEntity?.type === "specialist" ? currentEntity.id : null;
  const effectiveSpecialistId = currentSpecialistId ?? specialistId;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";

  return (
    <div>
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "Услуги"}
      </h3>
      {subtitle && (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      )}
      <div className={`mt-4 grid gap-4 ${gridClassName}`}>
        {items.map((service) => {
          const serviceHref = account.publicSlug ? `/${account.publicSlug}/services/${service.id}` : "#";
          return (
            <article key={service.id} className="relative" style={{ textAlign: style.textAlign }}>
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
                      <a href={serviceHref} className="text-lg font-semibold leading-tight hover:underline">
                        {service.name}
                      </a>
                      <a
                        href={serviceHref}
                        aria-label={`Открыть услугу ${service.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 text-xl leading-none"
                      >
                        ›
                      </a>
                    </div>
                    <div className="mt-4">
                      {service.description && <div className="text-sm text-white/90">{service.description}</div>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/90">
                        {showDuration && <span>{service.baseDurationMin} мин</span>}
                        {showPrice && <span>{service.basePrice} ?</span>}
                      </div>
                      {showButton && account.publicSlug && (
                        <a
                          href={buildBookingLink({
                            publicSlug: account.publicSlug,
                            locationId:
                              currentLocationId ??
                              locationId ??
                              (service.locationIds.length === 1 ? service.locationIds[0] : null),
                            specialistId: effectiveSpecialistId,
                            serviceId: service.id,
                            scenario: "serviceFirst",
                          })}
                          className="mt-4 inline-flex px-3 py-2 text-xs"
                          style={buttonStyle(style, theme)}
                        >
                          {buttonText}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 py-1">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={serviceHref}
                      className="text-lg font-semibold leading-tight hover:underline"
                      style={{ color: "var(--block-text, var(--bp-ink))" }}
                    >
                      {service.name}
                    </a>
                    <a
                      href={serviceHref}
                      aria-label={`Открыть услугу ${service.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-xl leading-none"
                      style={{
                        color: "var(--block-text, var(--bp-ink))",
                        borderColor: "var(--block-border, var(--site-border))",
                      }}
                    >
                      ›
                    </a>
                  </div>
                  {service.description && (
                    <div className="text-sm text-[color:var(--block-muted,var(--bp-muted))]">
                      {service.description}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-[color:var(--block-muted,var(--bp-muted))]">
                    {showDuration && <span>{service.baseDurationMin} мин</span>}
                    {showPrice && <span>{service.basePrice} ?</span>}
                  </div>
                  {showButton && account.publicSlug && (
                    <a
                      href={buildBookingLink({
                        publicSlug: account.publicSlug,
                        locationId:
                          currentLocationId ??
                          locationId ??
                          (service.locationIds.length === 1 ? service.locationIds[0] : null),
                        specialistId: effectiveSpecialistId,
                        serviceId: service.id,
                        scenario: "serviceFirst",
                      })}
                      className="inline-flex px-3 py-2 text-xs"
                      style={buttonStyle(style, theme)}
                    >
                      {buttonText}
                    </a>
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

export function renderSpecialists(
  block: SiteBlock,
  account: AccountInfo,
  specialists: SpecialistItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity
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
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const locationId = typeof data.locationId === "number" ? data.locationId : null;
  const currentLocationId = currentEntity?.type === "location" ? currentEntity.id : null;
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
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "Специалисты"}
      </h3>
      {subtitle && (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {visibleItems.map((specialist) => (
          <div
            key={specialist.id}
            className="rounded-2xl border bg-[color:var(--bp-paper)] p-4"
            style={{ borderColor: theme.borderColor, textAlign: style.textAlign }}
          >
            {specialist.coverUrl && (
              <img src={specialist.coverUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
            )}
            <div className="text-base font-semibold">{specialist.name}</div>
            {specialist.level && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{specialist.level}</div>
            )}
            {showButton && account.publicSlug && (
              <a
                href={buildBookingLink({
                  publicSlug: account.publicSlug,
                  locationId:
                    currentLocationId ??
                    locationId ??
                    (specialist.locationIds.length === 1 ? specialist.locationIds[0] : null),
                  specialistId: specialist.id,
                  scenario: "specialistFirst",
                })}
                className="mt-3 inline-flex px-3 py-2 text-xs"
                style={buttonStyle(style, theme)}
              >
                {buttonText}
              </a>
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

export function renderPromos(
  block: SiteBlock,
  promos: PromoItem[],
  theme: SiteTheme,
  style: BlockStyle,
  currentEntity: CurrentEntity
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
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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

export function renderReviews(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
  const data = block.data as Record<string, unknown>;
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
  return (
    <div>
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "Отзывы"}
      </h3>
      {subtitle && (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border bg-[color:var(--bp-paper)] p-4 text-sm text-[color:var(--bp-muted)]"
            style={{ borderColor: theme.borderColor }}
          >
            Отзывы будут отображаться здесь после их появления.
          </div>
        ))}
      </div>
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
  style: BlockStyle
) {
  const data = block.data as Record<string, unknown>;
  const enabled = data.enabled !== false;
  const widgetConfig = buildAishaWidgetConfig(block, style, theme);
  const accountSlug = account.publicSlug || account.slug;

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-[color:var(--block-border,var(--site-border))] p-4 text-sm text-[color:var(--block-muted,var(--bp-muted))]">
        {"Блок AI-ассистента выключен. Включите его в настройках сайта."}
      </div>
    );
  }

  const inlinePreviewMinHeight = "calc(74vh + 24px)";

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: inlinePreviewMinHeight }}>
      <PublicAiChatWidget
        accountSlug={accountSlug}
        widgetConfig={widgetConfig}
        mode="inline"
        defaultOpen
        className="inset-0"
        themeMode={theme.mode}
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
  style: BlockStyle
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
