import Link from "next/link";
import { buildBookingLink } from "@/lib/booking-links";
import PublicBookingClient from "@/components/public-booking-client";
import MenuSearch from "@/components/menu-search";
import SiteThemeToggle from "@/components/site-theme-toggle";
import DetailsCloseButton from "@/components/details-close-button";
import GallerySlider from "@/components/gallery-slider";
import type { CSSProperties, ReactNode } from "react";
import {
  type SiteBlock,
  type SiteLoaderConfig,
  type SiteTheme,
} from "@/lib/site-builder";
import type {
  AccountProfile,
  Branding,
  LocationItem,
  PromoItem,
  ServiceItem,
  SpecialistItem,
  WorkPhotos,
} from "./public-data";

export type CurrentEntity =
  | { type: "location" | "service" | "specialist" | "promo"; id: number }
  | null;

const PAGE_LABELS = {
  home: "Р“Р»Р°РІРЅР°СЏ",
  booking: "РћРЅР»Р°Р№РЅ-Р·Р°РїРёСЃСЊ",
  client: "Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚",
  locations: "Р›РѕРєР°С†РёРё",
  services: "РЈСЃР»СѓРіРё",
  specialists: "РЎРїРµС†РёР°Р»РёСЃС‚С‹",
  promos: "РџСЂРѕРјРѕ/СЃРєРёРґРєРё",
} as const;

type PageKey = keyof typeof PAGE_LABELS;

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
  website: "РЎР°Р№С‚",
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
  dzen: "Р”Р·РµРЅ",
  ok: "РћРґРЅРѕРєР»Р°СЃСЃРЅРёРєРё",
};

type BlockStyle = {
  marginTop?: number;
  marginBottom?: number;
  blockWidth?: number | null;
  blockWidthColumns?: number | null;
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
  const targetPx = Math.round((PUBLIC_WIDTH_REFERENCE * clampedColumns) / MAX_BLOCK_COLUMNS);
  if (!useEdgePad) {
    return `min(${targetPx}px, 100%)`;
  }
  return `min(${targetPx}px, calc(100% - (var(--site-edge-pad, 0px) * 2)))`;
}

export function normalizeStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
  const style = (block.data.style as Record<string, unknown>) ?? {};
  const numOrNull = (value?: number | string | null) => {
    const parsed =
      typeof value === "string" ? Number(value) : (value as number | null | undefined);
    return Number.isFinite(parsed) ? (parsed as number) : null;
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
    const lightResolved =
      lightRaw.toLowerCase() === "transparent" ? "transparent" : lightRaw || lightFallback;
    const darkResolved =
      darkRaw.toLowerCase() === "transparent" ? "transparent" : darkRaw || darkFallback;
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
  const useCustomWidth =
    style.useCustomWidth === true ||
    normalizedBlockWidth !== null ||
    normalizedBlockWidthColumns !== null;
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

  return {
    marginTop: Number.isFinite(style.marginTop as number)
      ? (style.marginTop as number)
      : 0,
    marginBottom: Number.isFinite(style.marginBottom as number)
      ? (style.marginBottom as number)
      : 0,
    blockWidth: useCustomWidth ? normalizedBlockWidth ?? DEFAULT_BLOCK_WIDTH : null,
    blockWidthColumns: useCustomWidth ? resolvedBlockWidthColumns : null,
    useCustomWidth,
    radius: numOrNull(style.radius as number),
    buttonRadius: numOrNull(style.buttonRadius as number),
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
    textAlign: (style.textAlign as "left" | "center" | "right") ?? "left",
    textAlignHeading:
      (style.textAlignHeading as "left" | "center" | "right") ??
      ((style.textAlign as "left" | "center" | "right") ?? "left"),
    textAlignSubheading:
      (style.textAlignSubheading as "left" | "center" | "right") ??
      ((style.textAlign as "left" | "center" | "right") ?? "left"),
    fontHeading: (style.fontHeading as string) ?? "",
    fontSubheading: (style.fontSubheading as string) ?? "",
    fontBody: (style.fontBody as string) ?? "",
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
        publicSlug,
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
  const bookingBorderLight = style.borderColorLight?.trim()
    ? style.borderColorLightResolved || "transparent"
    : "transparent";
  const bookingBorderDark = style.borderColorDark?.trim()
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
  publicSlug: string,
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
  const align = (data.align as string) === "center" ? "center" : "left";
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Р—Р°РїРёСЃР°С‚СЊСЃСЏ";
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };
  const imageUrl = resolveCoverImage(imageSource, branding, locations, services, specialists);

  return (
    <div className={`grid gap-6 ${imageUrl ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
      <div className={align === "center" ? "text-center" : "text-left"}>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          РЎР°Р№С‚ {accountName}
        </div>
        <h1
          className="mt-3 text-3xl font-semibold"
          style={{ fontFamily: "var(--site-font-heading)" }}
        >
          {title}
        </h1>
        {subtitle && <p className="mt-2 text-lg text-[color:var(--bp-muted)]">{subtitle}</p>}
        {description && <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{description}</p>}
        {showButton && publicSlug && (
          <Link
            href={buildBookingLink({ publicSlug })}
            className="mt-5 inline-flex rounded-full px-5 py-2 text-sm font-semibold"
            style={buttonStyle(style)}
          >
            {buttonText}
          </Link>
        )}
      </div>
      {imageUrl && (
        <div className="overflow-hidden rounded-3xl border border-[color:var(--bp-stroke)]">
          <img src={imageUrl} alt="" className="h-56 w-full object-cover" />
        </div>
      )}
    </div>
  );
}

  function headingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontHeading || "var(--site-font-heading)",
      fontSize: style.headingSize !== null && style.headingSize !== undefined ? `${style.headingSize}px` : "var(--site-h1)",
      textAlign: style.textAlignHeading ?? style.textAlign ?? "left",
      color: "var(--block-text, var(--bp-ink))",
    } as const;
  }

  function subheadingStyle(style: BlockStyle) {
    return {
      fontFamily: style.fontSubheading || style.fontBody || "var(--site-font-body)",
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
      fontSize: style.textSize !== null && style.textSize !== undefined ? `${style.textSize}px` : "var(--site-text-size)",
      textAlign: style.textAlign ?? "left",
      color: "var(--block-muted, var(--bp-muted))",
    } as const;
  }

  function buttonStyle(style: BlockStyle) {
    return {
      backgroundColor: "var(--block-button, var(--site-button))",
      color: "var(--block-button-text, var(--site-button-text))",
      borderRadius: style.buttonRadius !== null ? style.buttonRadius : "var(--site-button-radius)",
    } as const;
  }

export function buildBlockWrapperStyle(
  style: BlockStyle,
  theme: SiteTheme,
  blockWidth: number,
  options: { isMenuSticky: boolean; blockType?: SiteBlock["type"] }
) {
    const blockShadowSize = typeof style.shadowSize === "number" ? style.shadowSize : null;
    const blockShadowColor =
      typeof style.shadowColor === "string" && style.shadowColor
        ? style.shadowColor
        : null;
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
    const blockOuterColumns = isBookingBlock
      ? MAX_BLOCK_COLUMNS
      : Math.min(MAX_BLOCK_COLUMNS, Math.max(MIN_BLOCK_COLUMNS, Math.round(blockColumns)));
    const isMenu = options.blockType === "menu";
    const isGallery = options.blockType === "works";
    const sectionBgCurrent =
      theme.mode === "dark" ? style.sectionBgDarkResolved : style.sectionBgLightResolved;
    const contentWidth = responsiveBlockWidthCss(blockOuterColumns, true);
    const menuWidth =
      blockOuterColumns >= MAX_BLOCK_COLUMNS
        ? "100%"
        : responsiveBlockWidthCss(blockOuterColumns, true);
    return {
      className: isMenu
        ? "site-block overflow-hidden border border-[color:var(--bp-stroke)] p-0"
        : isGallery
          ? "site-block p-0"
        : "site-block border border-[color:var(--bp-stroke)] p-6",
      style: {
        position: options.isMenuSticky ? "sticky" : undefined,
        top: options.isMenuSticky ? 0 : undefined,
        zIndex: options.isMenuSticky ? 40 : undefined,
        borderRadius: radius,
        backgroundColor: isGallery ? sectionBgCurrent : "var(--block-bg)",
        backgroundImage: isGallery ? "none" : "var(--block-gradient)",
        borderColor: isGallery ? "transparent" : "var(--block-border)",
        borderWidth: isGallery ? 0 : hasVisibleBorder ? 1 : 0,
        boxShadow:
          isGallery
            ? "none"
            : blockShadowSize !== null
            ? `0 ${blockShadowSize}px ${blockShadowSize * 2}px ${blockShadowColor ?? "var(--site-shadow-color)"}`
            : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
        marginTop:
          options.blockType === "menu" || options.blockType === "works"
            ? 0
            : typeof style.marginTop === "number"
              ? style.marginTop
              : 0,
        marginBottom:
          options.blockType === "works"
            ? 0
            : typeof style.marginBottom === "number"
              ? style.marginBottom
              : 0,
        paddingTop:
          options.blockType === "works" && typeof style.marginTop === "number"
            ? style.marginTop
            : undefined,
        paddingBottom:
          options.blockType === "works" && typeof style.marginBottom === "number"
            ? style.marginBottom
            : undefined,
        width: isMenu ? menuWidth : isGallery ? "100%" : contentWidth,
        maxWidth: "100%",
        marginLeft: "auto",
        marginRight: "auto",
        boxSizing: "border-box",
        color: "var(--block-text)",
        ["--works-content-width" as string]: contentWidth,
        ["--bp-ink" as string]: "var(--block-text)",
        ["--bp-muted" as string]: "var(--block-muted)",
        ["--block-bg-light" as string]: style.blockBgLightResolved,
        ["--block-bg-dark" as string]: style.blockBgDarkResolved,
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
  const buttonText = (data.buttonText as string) || "Р—Р°РїРёСЃР°С‚СЊСЃСЏ";
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
        ? 40
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
      <span className="inline-flex items-center gap-2">
        {logoImageNode}
        {companyNameNode}
      </span>
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
        style={{ ...headingStyle(style), color: "var(--block-text, var(--bp-ink))", textAlign: align }}
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent"
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

  const ctaNode = showCta ? (
    usePhone ? (
      <a
        href={`tel:${phoneValue}`}
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={buttonStyle(style)}
      >
        {phoneValue}
      </a>
    ) : (
      <Link
        href={buildBookingLink({ publicSlug })}
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={buttonStyle(style)}
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
        aria-label="Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚"
        title="Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚"
        target="_blank"
        rel="noreferrer"
      >
        <IconUser />
      </a>
    ) : (
      <Link
        href={accountLink}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
        aria-label="Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚"
        title="Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚"
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
    <div className={`flex flex-col gap-2 ${stackAlignClass}`}>{linkItems}</div>
  );
  const overlayNavNode = (
    <div className={`flex w-full flex-col gap-6 ${stackAlignClass}`}>{overlayLinkItems}</div>
  );
  const drawerLinkItems = (
    <div className={`flex flex-col gap-2 ${stackAlignClass}`}>
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
            className="text-2xl font-medium text-[color:var(--block-text,var(--bp-ink))] md:text-3xl"
            style={headingStyle(style)}
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
            className="rounded-full border border-[color:var(--site-border)] px-3 py-1 text-xs"
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
        <details className="group menu-v2-overlay w-full">
          <summary
            className="relative z-[60] flex cursor-pointer list-none items-center border-b py-0 pl-8 pr-24
              [--menu-v2-top-bg:var(--block-bg)] group-open:[--menu-v2-top-bg:var(--block-sub-bg)]
              [--menu-v2-top-gradient:var(--block-gradient)] group-open:[--menu-v2-top-gradient:none]
              [&::-webkit-details-marker]:hidden
              group-open:fixed group-open:inset-x-0 group-open:top-0 group-open:py-0 group-open:pl-8 group-open:pr-24"
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
              className="absolute right-8 top-1/2 inline-flex -translate-y-1/2 items-center justify-center overflow-visible rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
              style={{ width: menuButtonSize, height: menuButtonSize }}
            >
              <span className="absolute left-1/2 top-[calc(50%-6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:rotate-45" />
              <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out group-open:opacity-0" />
              <span className="absolute left-1/2 top-[calc(50%+6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:-rotate-45" />
            </span>
          </summary>
          <div
            className="fixed inset-0 z-50 flex flex-col overflow-hidden border px-6 py-6 pt-24 md:px-10 md:py-8 md:pt-28"
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
        <details className="group relative menu-v3-overlay w-full">
          <summary
            className="relative flex list-none items-center px-4 md:px-8 [&::-webkit-details-marker]:hidden"
            style={{
              minHeight: menuHeight,
              backgroundColor: "var(--block-bg, var(--site-panel))",
              backgroundImage: "var(--block-gradient, none)",
              borderColor: "var(--block-border, var(--site-border))",
              borderBottomWidth: 1,
            }}
          >
            <span
              className="relative inline-flex items-center justify-center overflow-visible rounded-sm border border-transparent bg-transparent text-[color:var(--bp-ink)]"
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
            <span className="ml-auto hidden items-center gap-2 md:inline-flex [&_a]:!rounded-full [&_a]:!border-0 [&_a]:!bg-transparent">
              {socialsNode}
            </span>
          </summary>
          <div className="fixed inset-0 z-40 hidden group-open:block">
            <div className="absolute inset-0 bg-[rgba(17,24,39,0.55)]" />
            <aside
              className="relative z-10 flex h-full w-full flex-col border-r px-6 py-5 text-[color:var(--block-text,var(--bp-ink))] sm:w-[min(360px,78vw)]"
              style={{
                backgroundColor: "var(--block-sub-bg, var(--block-bg, var(--site-panel)))",
                borderColor: "var(--block-border, var(--site-border))",
              }}
            >
              <div className="mb-8 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">{searchNode}</div>
                <DetailsCloseButton
                  className="relative inline-flex h-8 w-8 items-center justify-center overflow-visible rounded-full border border-transparent bg-transparent text-[color:var(--block-text,var(--bp-ink))]"
                  title="Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ"
                  ariaLabel="Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ"
                >
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 opacity-0 bg-current" />
                  <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
                </DetailsCloseButton>
              </div>
              <div className="space-y-3">
                {drawerLinkItems}
              </div>
              <div className="mt-auto space-y-4 pt-6">
                {ctaNode && <div>{ctaNode}</div>}
                {socialsNode && <div className="md:hidden">{socialsNode}</div>}
                <div className="flex flex-wrap items-center gap-2">
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
    return (
      <div
        className="w-full"
        style={
          position === "sticky"
            ? { position: "sticky", top: 12, zIndex: 20 }
            : undefined
        }
      >
        <div className="hidden px-4 2xl:block 2xl:px-8" style={{ height: menuHeight }}>
          {desktopLayout}
        </div>
        <div className="2xl:hidden">
          <div
            className="flex items-center justify-between gap-3 px-4"
            style={{
              height: menuHeight,
              backgroundColor: "var(--block-bg, var(--site-panel))",
              backgroundImage: "var(--block-gradient, none)",
              borderColor: "var(--block-border, var(--site-border))",
              borderBottomWidth: 1,
            }}
          >
            {logoNode}
            <details className="group relative">
              <summary
                className="relative inline-flex cursor-pointer list-none items-center justify-center overflow-visible rounded-sm border border-transparent bg-transparent text-[color:var(--bp-ink)] [&::-webkit-details-marker]:hidden"
                style={{ width: menuButtonSize, height: menuButtonSize }}
              >
                <span className="absolute left-1/2 top-[calc(50%-6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:rotate-45" />
                <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 bg-current transition-opacity duration-200 ease-out group-open:opacity-0" />
                <span className="absolute left-1/2 top-[calc(50%+6px)] block h-[2px] w-5 -translate-x-1/2 rotate-0 bg-current transition-all duration-300 ease-out group-open:top-1/2 group-open:-translate-y-1/2 group-open:-rotate-45" />
              </summary>
              <div className="fixed inset-0 z-50 flex flex-col overflow-hidden border px-6 py-6" style={subBlockSurfaceStyle}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">{logoNode}</div>
                  <DetailsCloseButton
                    className="relative inline-flex h-8 w-8 items-center justify-center overflow-visible rounded-full border border-transparent bg-transparent text-[color:var(--block-text,var(--bp-ink))]"
                    title="Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ"
                    ariaLabel="Р—Р°РєСЂС‹С‚СЊ РјРµРЅСЋ"
                  >
                    <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
                    <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 opacity-0 bg-current" />
                    <span className="absolute left-1/2 top-1/2 block h-[2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-current" />
                  </DetailsCloseButton>
                </div>
                {searchNode && <div className="mb-6">{searchNode}</div>}
                <div className="flex flex-1 flex-col">
                  <div className="flex flex-col gap-2">{linkItems}</div>
                  <div className="mt-auto space-y-3 pt-4">
                    {ctaNode}
                    {socialsNode}
                    <div className="flex items-center gap-2">
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
        <div className="rounded-2xl border px-3 py-2" style={subBlockSurfaceStyle}>
          <div className="flex flex-wrap items-center gap-2">{navPills}</div>
        </div>
      </div>
    );
  }

  if (block.variant === "v5") {
    desktopLayout = (
      <div className="flex flex-col items-center gap-4 text-center">
        {logoNode}
        <div className="w-full rounded-2xl border px-4 py-3" style={subBlockSurfaceStyle}>
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
            <details className="relative">
              <summary className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]">
                <IconMenu />
              </summary>
              <div
                className="absolute right-0 mt-2 w-72 rounded-xl border p-4 shadow-lg"
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
        {(data.title as string) || "Рћ РЅР°СЃ"}
      </h2>
      {text && <p className="mt-3 text-sm text-[color:var(--bp-muted)]">{text}</p>}
      <div className="mt-3 text-xs text-[color:var(--bp-muted)]">РђРєРєР°СѓРЅС‚: {accountName}</div>
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
  const buttonText = (data.buttonText as string) || "Р—Р°РїРёСЃР°С‚СЊСЃСЏ";
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
        {(data.title as string) || "Р›РѕРєР°С†РёРё"}
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
                РўРµР»РµС„РѕРЅ: {location.phone}
              </div>
            )}
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId: location.id,
                  scenario: "serviceFirst",
                  start: "scenario",
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
            РќРµС‚ Р»РѕРєР°С†РёР№ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ.
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
  const buttonText = (data.buttonText as string) || "Р—Р°РїРёСЃР°С‚СЊСЃСЏ";
  const showPrice = data.showPrice !== false;
  const showDuration = data.showDuration !== false;
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
        {(data.title as string) || "РЈСЃР»СѓРіРё"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((service) => (
          <div key={service.id} className="rounded-2xl border border-[color:var(--bp-stroke)] p-4">
            {service.coverUrl && (
              <img
                src={service.coverUrl}
                alt=""
                className="mb-3 h-32 w-full rounded-xl object-cover"
              />
            )}
            <Link
              href={`/${publicSlug}/services/${service.id}`}
              className="text-base font-semibold"
            >
              {service.name}
            </Link>
            {service.description && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {service.description}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
              {showDuration && <span>{service.baseDurationMin} РјРёРЅ</span>}
              {showPrice && <span>{service.basePrice} в‚Ѕ</span>}
            </div>
            {showButton && publicSlug && (
              <Link
                href={buildBookingLink({
                  publicSlug,
                  locationId:
                    currentLocationId ??
                    locationId ??
                    (service.locationIds.length === 1 ? service.locationIds[0] : null),
                  specialistId: effectiveSpecialistId,
                  serviceId: service.id,
                  scenario: effectiveSpecialistId ? "specialistFirst" : "serviceFirst",
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
            РќРµС‚ СѓСЃР»СѓРі РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ.
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
  const buttonText = (data.buttonText as string) || "Р—Р°РїРёСЃР°С‚СЊСЃСЏ";
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
        {(data.title as string) || "РЎРїРµС†РёР°Р»РёСЃС‚С‹"}
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
            РќРµС‚ СЃРїРµС†РёР°Р»РёСЃС‚РѕРІ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ.
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
        {(data.title as string) || "РџСЂРѕРјРѕ Рё СЃРєРёРґРєРё"}
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
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} в‚Ѕ`}
              {promo.startsAt || promo.endsAt ? " В· " : ""}
              {promo.startsAt ? `СЃ ${promo.startsAt}` : ""}
              {promo.endsAt ? ` РїРѕ ${promo.endsAt}` : ""}
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
                РќРµР°РєС‚РёРІРЅРѕ
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            РќРµС‚ Р°РєС‚РёРІРЅС‹С… РїСЂРѕРјРѕ.
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

  return (
    <div style={{ width: "var(--works-content-width, 100%)", maxWidth: "100%", margin: "0 auto" }}>
      <div
        className="border p-6"
        style={{
          backgroundColor: "var(--block-bg)",
          backgroundImage: "var(--block-gradient)",
          borderColor: "var(--block-border)",
          borderWidth: style.borderColor === "transparent" ? 0 : 1,
          borderRadius: typeof style.radius === "number" ? style.radius : undefined,
          boxShadow:
            typeof style.shadowSize === "number"
              ? `0 ${style.shadowSize}px ${style.shadowSize * 2}px ${style.shadowColor || "var(--site-shadow-color)"}`
              : "0 var(--site-shadow-size) calc(var(--site-shadow-size) * 2) var(--site-shadow-color)",
        }}
      >
        {title && <h2 className="font-semibold" style={headingStyle(style)}>{title}</h2>}
        {subtitle && (
          <p className={`${title ? "mt-2" : ""} text-[color:var(--bp-muted)]`} style={subheadingStyle(style)}>
            {subtitle}
          </p>
        )}
        <div className="mt-5">
          <GallerySlider
            images={galleryImages}
            height={galleryHeight}
            radius={imageRadius}
            imageFit={imageFit}
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
        {(data.title as string) || "РћС‚Р·С‹РІС‹"}
      </h2>
      {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]"
          >
            РћС‚Р·С‹РІС‹ Р±СѓРґСѓС‚ РѕС‚РѕР±СЂР°Р¶Р°С‚СЊСЃСЏ Р·РґРµСЃСЊ РїРѕСЃР»Рµ РёС… РїРѕСЏРІР»РµРЅРёСЏ.
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
          {(data.title as string) || "РљРѕРЅС‚Р°РєС‚С‹"}
        </h2>
        {subtitle && <p className="mt-2 text-sm text-[color:var(--bp-muted)]">{subtitle}</p>}
        <div className="mt-4 space-y-2 text-sm text-[color:var(--bp-muted)]">
          <div>РђРєРєР°СѓРЅС‚: {accountName}</div>
          {profile.phone && <div>РўРµР»РµС„РѕРЅ: {profile.phone}</div>}
          {profile.email && <div>Email: {profile.email}</div>}
          {(profile.address || location?.address) && (
            <div>РђРґСЂРµСЃ: {profile.address || location?.address}</div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-xs text-[color:var(--bp-muted)]">
        Р—РґРµСЃСЊ РјРѕР¶РЅРѕ Р±СѓРґРµС‚ РїРѕРґРєР»СЋС‡РёС‚СЊ РєР°СЂС‚Сѓ.
      </div>
    </div>
  );
}



