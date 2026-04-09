"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BLOCK_LABELS,
  BLOCK_VARIANTS,
  type BlockType,
  type SiteAishaWidgetConfig,
  type SiteBlock,
  type SiteDraft,
  type SiteLoaderConfig,
  type SitePages,
  type SiteTheme,
  makeBlockId,
  normalizeDraft,
  resolveSiteLoaderConfig,
  type SitePageKey,
} from "@/lib/site-builder";
import { buildBookingLink } from "@/lib/booking-links";
import MenuSearch from "@/components/menu-search";
import BookingClient from "@/app/booking/booking-client";
import SiteLoader from "@/components/site-loader";
import GallerySlider from "@/components/gallery-slider";
import PublicAiChatWidget from "@/components/public-ai-chat-widget";

type CurrentEntity =
  | { type: "location" | "service" | "specialist" | "promo"; id: number }
  | null;
type EntityPageKey = Exclude<SitePageKey, "home" | "booking" | "client">;

type PublicPageData = {
  id: number;
  status: string;
  draftJson: SiteDraft;
  publishedVersionId: number | null;
};

type AccountInfo = {
  id: number;
  name: string;
  slug: string;
  publicSlug: string | null;
  timeZone: string;
};

type LocationItem = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  geo: { lat: number; lng: number } | null;
  coverUrl: string | null;
};

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  baseDurationMin: number;
  basePrice: number;
  coverUrl: string | null;
  locationIds: number[];
};

type SpecialistItem = {
  id: number;
  name: string;
  level: string | null;
  locationIds: number[];
  coverUrl: string | null;
};

type PromoItem = {
  id: number;
  name: string;
  type: "PERCENT" | "FIXED" | "BUNDLE";
  value: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  codes: string[];
};

type WorkPhotos = {
  locations: Array<{ entityId: string; url: string }>;
  services: Array<{ entityId: string; url: string }>;
  specialists: Array<{ entityId: string; url: string }>;
};

type AccountProfile = {
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  telegramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  dzenUrl?: string;
  okUrl?: string;
  maxUrl?: string;
  vkUrl?: string;
  viberUrl?: string;
  pinterestUrl?: string;
};

type Branding = {
  logoUrl: string | null;
  coverUrl: string | null;
};

type SiteClientProps = {
  initialActivePage?: SitePageKey;
  initialPublicPage: PublicPageData;
  account: AccountInfo;
  accountProfile: AccountProfile;
  branding: Branding;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  workPhotos: WorkPhotos;
};

const cloneDraftSnapshot = (value: SiteDraft): SiteDraft =>
  JSON.parse(JSON.stringify(value)) as SiteDraft;

const COVER_LINE_STEP_PX = 30;
const COVER_LINE_OPTIONS = Array.from({ length: 15 }, (_, index) => index * 0.5);
const PANEL_ANIMATION_MS = 220;
const COVER_BACKGROUND_POSITION_OPTIONS = [
  { value: "center top", label: "↑ Центр Верх" },
  { value: "center center", label: "Центр" },
  { value: "center bottom", label: "↓ Центр Низ" },
] as const;
const COVER_BACKGROUND_POSITION_VALUES = new Set<string>(
  COVER_BACKGROUND_POSITION_OPTIONS.map((option) => option.value)
);

const formatCoverLineLabel = (lineValue: number) => {
  if (lineValue === 0) return "0";
  const px = Math.round(lineValue * COVER_LINE_STEP_PX);
  return `${lineValue} line (${px}px)`;
};

const variantsLabel: Record<"v1" | "v2" | "v3" | "v4" | "v5", string> = {
  v1: "Вариант 1",
  v2: "Вариант 2",
  v3: "Вариант 3",
  v4: "Вариант 4",
  v5: "Вариант 5",
};

const PAGE_LABELS: Record<SitePageKey, string> = {
  home: "Главная",
  booking: "Онлайн-запись",
  client: "Личный кабинет",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
};

const PAGE_KEYS = Object.keys(PAGE_LABELS) as SitePageKey[];
const isSystemBlockType = (type: unknown): type is "client" | "booking" =>
  type === "client" || type === "booking";
const QUICK_BLOCK_TYPES: BlockType[] = [
  "cover",
  "about",
  "locations",
  "services",
  "specialists",
  "works",
  "promos",
  "contacts",
];

const MOBILE_VIEWPORTS = {
  mobile360: { label: "Мобильный 360px", width: 360 },
  mobileLandscape480: { label: "Мобильный гориз. 480px", width: 480 },
  tablet640: { label: "Планшет 640px", width: 640 },
  tabletLandscape960: { label: "Планшет гориз. 960px", width: 960 },
} as const;
type MobileViewportKey = keyof typeof MOBILE_VIEWPORTS;

type EditorSection = { id: string; label: string };
type CoverBackgroundMode = "solid" | "linear" | "radial";

const CONTENT_SECTIONS_BY_BLOCK: Partial<Record<BlockType, EditorSection[]>> = {
  menu: [
    { id: "brand", label: "Логотип и название" },
    { id: "structure", label: "Структура меню" },
    { id: "actions", label: "Кнопка и действие" },
    { id: "extras", label: "Поиск, аккаунт, соцсети" },
  ],
  cover: [
    { id: "text", label: "Тексты" },
    { id: "actions", label: "Кнопка" },
    { id: "media", label: "Изображение" },
  ],
};

type CssVars = CSSProperties & Record<`--${string}`, string | number>;

const SETTINGS_SECTIONS_BY_BLOCK: Partial<Record<BlockType, EditorSection[]>> = {
  menu: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
  ],
  cover: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  about: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  loader: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "effects", label: "Эффекты" },
  ],
  locations: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  services: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  specialists: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  promos: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  works: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  reviews: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  contacts: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
  ],
  aisha: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "effects", label: "Эффекты" },
  ],
};

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

const THEME_FONTS = [
  {
    label: "Manrope",
    heading: "var(--font-manrope), sans-serif",
    body: "var(--font-manrope), sans-serif",
  },
  {
    label: "Montserrat",
    heading: "var(--font-montserrat), sans-serif",
    body: "var(--font-montserrat), sans-serif",
  },
  { label: "Arial", heading: "Arial, sans-serif", body: "Arial, sans-serif" },
  { label: "Georgia", heading: "Georgia, serif", body: "Georgia, serif" },
  { label: "Times New Roman", heading: "\"Times New Roman\", serif", body: "\"Times New Roman\", serif" },
];

const FONT_WEIGHTS = [
  { label: "300 (Light)", value: 300 },
  { label: "400 (Regular)", value: 400 },
  { label: "500 (Medium)", value: 500 },
  { label: "600 (SemiBold)", value: 600 },
  { label: "700 (Bold)", value: 700 },
  { label: "800 (ExtraBold)", value: 800 },
] as const;

const DEFAULT_BLOCK_WIDTH = 1000;
const MIN_BLOCK_WIDTH = 800;
const MAX_BLOCK_WIDTH = 2400;
const BLOCK_WIDTH_STEP = 100;
const LEGACY_WIDTH_REFERENCE = 2400;
const DEFAULT_BLOCK_COLUMNS = 6;
const MIN_BLOCK_COLUMNS = 1;
const MAX_BLOCK_COLUMNS = 12;
const GRID_MIN_COLUMN = 1;
const GRID_MAX_COLUMN = 12;
const BOOKING_MIN_BLOCK_COLUMNS = 10;
const BOOKING_MAX_BLOCK_COLUMNS = 15;
const BOOKING_MIN_PRESET = 1;
const BOOKING_MAX_PRESET = 6;

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function hexToRgbaString(hex: string, alpha: number) {
  const normalized = hex.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(17,24,39,${clamp01(alpha)})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

function parseBackdropColor(value: unknown) {
  const fallback = { hex: "#111827", alpha: 0.16 };
  if (typeof value !== "string" || !value.trim()) return fallback;
  const raw = value.trim();
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(raw);
  if (hex) return { hex: raw, alpha: fallback.alpha };
  const rgba = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([01]?(?:\.\d+)?))?\s*\)$/i.exec(
    raw
  );
  if (!rgba) return fallback;
  const r = Math.min(255, Math.max(0, Number(rgba[1])));
  const g = Math.min(255, Math.max(0, Number(rgba[2])));
  const b = Math.min(255, Math.max(0, Number(rgba[3])));
  const a = rgba[4] === undefined ? fallback.alpha : clamp01(Number(rgba[4]));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: a };
}

function clampBlockColumns(columns: number, blockType: BlockType | string): number {
  if (blockType === "booking") {
    return Math.min(
      BOOKING_MAX_BLOCK_COLUMNS,
      Math.max(BOOKING_MIN_BLOCK_COLUMNS, Math.round(columns))
    );
  }
  return Math.min(MAX_BLOCK_COLUMNS, Math.max(MIN_BLOCK_COLUMNS, Math.round(columns)));
}

function bookingPresetFromColumns(columns: number): number {
  return Math.min(
    BOOKING_MAX_PRESET,
    Math.max(BOOKING_MIN_PRESET, Math.round(columns) - (BOOKING_MIN_BLOCK_COLUMNS - 1))
  );
}

function bookingColumnsFromPreset(preset: number): number {
  return clampBlockColumns(BOOKING_MIN_BLOCK_COLUMNS + Math.round(preset) - 1, "booking");
}

function clampGridColumn(value: number): number {
  return Math.min(GRID_MAX_COLUMN, Math.max(GRID_MIN_COLUMN, Math.round(value)));
}

function centeredGridRange(columns: number): { start: number; end: number } {
  const span = Math.min(GRID_MAX_COLUMN, Math.max(1, Math.round(columns)));
  const start = Math.max(1, Math.floor((GRID_MAX_COLUMN - span) / 2) + 1);
  const end = Math.min(GRID_MAX_COLUMN, start + span - 1);
  return { start, end };
}

function bookingContentColumns(columns: number): number {
  return clampBlockColumns(columns, "booking") - 4;
}

function bookingCardsPerRow(columns: number): number {
  const preset = bookingPresetFromColumns(columns);
  if (preset <= 2) return 2;
  if (preset <= 4) return 3;
  return 4;
}

const defaultBlockStyle = {
  marginTop: 0,
  marginBottom: 0,
  blockWidth: DEFAULT_BLOCK_WIDTH,
  blockWidthColumns: DEFAULT_BLOCK_COLUMNS,
  gridStartColumn: centeredGridRange(DEFAULT_BLOCK_COLUMNS).start,
  gridEndColumn: centeredGridRange(DEFAULT_BLOCK_COLUMNS).end,
  useCustomWidth: true,
  radius: null,
  buttonRadius: null,
  sectionBgLight: "",
  sectionBgDark: "",
  sectionBg: "",
  blockBgLight: "",
  blockBgDark: "",
  blockBg: "",
  borderColorLight: "",
  borderColorDark: "",
  borderColor: "",
  buttonColorLight: "",
  buttonColorDark: "",
  buttonColor: "",
  buttonTextColorLight: "",
  buttonTextColorDark: "",
  buttonTextColor: "",
  textColorLight: "",
  textColorDark: "",
  textColor: "",
  mutedColorLight: "",
  mutedColorDark: "",
  mutedColor: "",
  assistantBubbleColorLight: "",
  assistantBubbleColorDark: "",
  assistantBubbleColor: "",
  assistantTextColorLight: "",
  assistantTextColorDark: "",
  assistantTextColor: "",
  clientBubbleColorLight: "",
  clientBubbleColorDark: "",
  clientBubbleColor: "",
  clientTextColorLight: "",
  clientTextColorDark: "",
  clientTextColor: "",
  headerBgColorLight: "",
  headerBgColorDark: "",
  headerBgColor: "",
  headerTextColorLight: "",
  headerTextColorDark: "",
  headerTextColor: "",
  quickReplyButtonColorLight: "",
  quickReplyButtonColorDark: "",
  quickReplyButtonColor: "",
  quickReplyTextColorLight: "",
  quickReplyTextColorDark: "",
  quickReplyTextColor: "",
  messageRadius: null,
  shadowColor: "",
  shadowSize: null,
  gradientEnabled: false,
  gradientDirection: "vertical",
  gradientFrom: "",
  gradientTo: "",
  gradientFromLight: "",
  gradientToLight: "",
  gradientFromDark: "",
  gradientToDark: "",
  textAlign: "left",
  textAlignHeading: "left",
  textAlignSubheading: "left",
  fontHeading: "var(--font-manrope), sans-serif",
  fontSubheading: "var(--font-manrope), sans-serif",
  fontBody: "var(--font-manrope), sans-serif",
  fontWeightHeading: null,
  fontWeightSubheading: null,
  fontWeightBody: null,
  headingSize: null,
  subheadingSize: null,
  textSize: null,
};

const defaultBlockData: Record<string, Record<string, unknown>> = {
  cover: {
    title: "",
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
    coverFilterEndColor: "#0f0f0f",
    coverFilterEndOpacity: 60,
    coverSubtitleColor: "#ffffff",
    coverDescriptionColor: "#ffffff",
    coverHeight: 100,
    align: "left",
    imageSource: { type: "account" },
    style: {
      ...defaultBlockStyle,
      useCustomWidth: true,
      blockWidth: Math.round((7 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
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
  menu: {
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
    accountTitle: "",
    menuHeight: 64,
    showSocials: false,
    socialIconSize: 40,
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
    align: "center",
    style: {
      ...defaultBlockStyle,
      blockWidth: LEGACY_WIDTH_REFERENCE,
      blockWidthColumns: MAX_BLOCK_COLUMNS,
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
      blockBgDark: "rgba(22, 24, 29, 0.9)",
      subBlockBgLight: "#ffffff",
      subBlockBgDark: "rgba(26, 28, 34, 0.92)",
      borderColorLight: "#e5e7eb",
      borderColorDark: "rgba(255, 255, 255, 0.08)",
      textColorLight: "#111827",
      textColorDark: "#f2f3f5",
      mutedColorLight: "#4b5563",
      mutedColorDark: "#a1a5ad",
      buttonColorLight: "#111827",
      buttonColorDark: "#d3d6db",
      buttonTextColorLight: "#ffffff",
      buttonTextColorDark: "#0f1012",
      shadowColor: "rgba(17, 24, 39, 0.12)",
      shadowSize: 0,
      gradientEnabledLight: false,
      gradientEnabledDark: true,
      gradientDirectionLight: "vertical",
      gradientDirectionDark: "vertical",
      gradientFromLight: "#ffffff",
      gradientToLight: "#ffffff",
      gradientFromDark: "#0c0e12",
      gradientToDark: "#111318",
    },
  },
  booking: {
    style: {
      ...defaultBlockStyle,
      blockWidth: LEGACY_WIDTH_REFERENCE,
      blockWidthColumns: MAX_BLOCK_COLUMNS,
      headingSize: 18,
      subheadingSize: 16,
      textSize: 14,
    },
  },
  loader: {
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
      ...defaultBlockStyle,
      useCustomWidth: false,
      blockWidth: null,
      blockWidthColumns: null,
    },
  },
  about: {
    title: "О нас",
    text: "",
    showContacts: true,
    style: defaultBlockStyle,
  },
  client: {
    title: "Личный кабинет",
    subtitle: "Ваши данные и история записей",
    salonsTitle: "Ваши салоны",
    emptyText: "Пока нет салонов, где вы записывались.",
    style: defaultBlockStyle,
  },
  locations: {
    title: "Локации",
    subtitle: "Выберите удобное место",
    mode: "all",
    ids: [],
    showAddress: true,
    showPhone: true,
    showContacts: false,
    showButton: true,
    buttonText: "Записаться",
    style: defaultBlockStyle,
  },
  services: {
    title: "Услуги",
    subtitle: "Популярные услуги",
    mode: "all",
    ids: [],
    cardsPerRow: 3,
    showPrice: true,
    showDuration: true,
    showButton: true,
    buttonText: "Записаться",
    locationId: null,
    specialistId: null,
    style: defaultBlockStyle,
  },
  specialists: {
    title: "Специалисты",
    subtitle: "Команда профессионалов",
    mode: "all",
    ids: [],
    locationId: null,
    showButton: true,
    buttonText: "Записаться",
    style: defaultBlockStyle,
  },
  works: {
    title: "",
    subtitle: "",
    source: "locations",
    mode: "all",
    ids: [],
    useCurrent: false,
    galleryHeight: 550,
    imageRadius: 0,
    imageFit: "cover",
    maxSlides: 12,
    style: {
      ...defaultBlockStyle,
      radius: 0,
      sectionBgLight: "#ffffff",
      sectionBg: "#ffffff",
      blockBgLight: "transparent",
      blockBg: "transparent",
      borderColorLight: "transparent",
      borderColor: "transparent",
      shadowSize: 0,
    },
  },
  reviews: {
    title: "Отзывы",
    subtitle: "Что говорят клиенты",
    limit: 6,
    style: defaultBlockStyle,
  },
  contacts: {
    title: "Контакты",
    subtitle: "Связаться с нами",
    locationId: null,
    showMap: false,
    style: defaultBlockStyle,
  },
  promos: {
    title: "Промо и скидки",
    subtitle: "Актуальные предложения и промокоды",
    mode: "all",
    ids: [],
    useCurrent: false,
    showButton: false,
    buttonText: "Записаться",
    style: defaultBlockStyle,
  },
  aisha: {
    title: "AI-ассистент записи",
    assistantName: "Ассистент",
    enabled: true,
    label: "AI Ассистент",
    offsetBottomPx: 16,
    offsetRightPx: 16,
    panelWidthPx: 400,
    panelHeightVh: 74,
    style: {
      ...defaultBlockStyle,
      blockBgLight: "#ffffff",
      blockBgDark: "#111827",
      blockBg: "#ffffff",
      textColorLight: "#111827",
      textColorDark: "#f3f4f6",
      textColor: "#111827",
      mutedColorLight: "#6b7280",
      mutedColorDark: "#9ca3af",
      mutedColor: "#6b7280",
      borderColorLight: "#e5e7eb",
      borderColorDark: "#374151",
      borderColor: "#e5e7eb",
      buttonColorLight: "#111827",
      buttonColorDark: "#111827",
      buttonColor: "#111827",
      buttonTextColorLight: "#ffffff",
      buttonTextColorDark: "#ffffff",
      buttonTextColor: "#ffffff",
      assistantBubbleColorLight: "#f3f4f6",
      assistantBubbleColorDark: "#0f172a",
      assistantTextColorLight: "#111827",
      assistantTextColorDark: "#f3f4f6",
      clientBubbleColorLight: "#111827",
      clientBubbleColorDark: "#111827",
      clientTextColorLight: "#ffffff",
      clientTextColorDark: "#ffffff",
      headerBgColorLight: "#ffffff",
      headerBgColorDark: "#0f172a",
      headerTextColorLight: "#111827",
      headerTextColorDark: "#f3f4f6",
      quickReplyButtonColorLight: "#111827",
      quickReplyButtonColorDark: "#111827",
      quickReplyTextColorLight: "#ffffff",
      quickReplyTextColorDark: "#ffffff",
      radius: 16,
      buttonRadius: 0,
      messageRadius: 16,
      shadowColor: "rgba(17,24,39,0.16)",
      shadowSize: 16,
      gradientEnabledLight: false,
      gradientEnabledDark: false,
      gradientDirectionLight: "vertical",
      gradientDirectionDark: "vertical",
      gradientFromLight: "#ffffff",
      gradientToLight: "#ffffff",
      gradientFromDark: "#111827",
      gradientToDark: "#111827",
    },
  },
};

function createBlock(type: BlockType): SiteBlock {
  const base = defaultBlockData[type] ?? {};
  return {
    id: makeBlockId(),
    type,
    variant: "v1",
    data: {
      ...base,
      style: {
        ...defaultBlockStyle,
        ...(typeof base.style === "object" && base.style ? base.style : {}),
      },
    },
  };
}

export default function SiteClient({
  initialActivePage = "home",
  initialPublicPage,
  account,
  accountProfile,
  branding,
  locations,
  services,
  specialists,
  promos,
  workPhotos,
}: SiteClientProps) {
  const [publicPage, setPublicPage] = useState(initialPublicPage);
  const [draft, setDraft] = useState<SiteDraft>(() =>
    normalizeDraft(initialPublicPage.draftJson, account.name)
  );
  const draftRef = useRef<SiteDraft>(draft);
  const historyRef = useRef<{ past: SiteDraft[]; future: SiteDraft[] }>({
    past: [],
    future: [],
  });
  const historyMetaRef = useRef<{ lastGroupKey: string | null; lastRecordedAt: number }>({
    lastGroupKey: null,
    lastRecordedAt: 0,
  });
  const [activePage, setActivePage] = useState<SitePageKey>(initialActivePage);
  const [currentEntity, setCurrentEntity] = useState<CurrentEntity>(null);

  const ensurePages = (value: SiteDraft): SitePages =>
    value.pages ?? {
      home: value.blocks,
      booking: [],
      client: [],
      locations: [],
      services: [],
      specialists: [],
      promos: [],
    };

  const ensureEntityPages = (
    value: SiteDraft
  ): Record<EntityPageKey, Record<string, SiteBlock[]>> =>
    ({
      locations: value.entityPages?.locations ?? {},
      services: value.entityPages?.services ?? {},
      specialists: value.entityPages?.specialists ?? {},
      promos: value.entityPages?.promos ?? {},
    }) as Record<EntityPageKey, Record<string, SiteBlock[]>>;

  const resolveEntityPageKey = (entity: CurrentEntity): EntityPageKey | null => {
    if (!entity) return null;
    if (entity.type === "location") return "locations";
    if (entity.type === "service") return "services";
    if (entity.type === "specialist") return "specialists";
    if (entity.type === "promo") return "promos";
    return null;
  };

  const homeBlocks = draft.pages?.home ?? draft.blocks;
  const entityPageKey = resolveEntityPageKey(currentEntity);
  const entityId = currentEntity ? String(currentEntity.id) : null;
  const entityBlocks =
    entityPageKey && entityId ? draft.entityPages?.[entityPageKey]?.[entityId] : null;
  const activePageKey: SitePageKey = entityPageKey ?? activePage;
  const isSystemPage =
    !entityPageKey && (activePageKey === "client" || activePageKey === "booking");
  const pageBlocks: SiteBlock[] = entityPageKey
    ? entityBlocks ?? []
    : draft.pages?.[activePageKey] ?? draft.blocks;
  const homeMenuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  const shouldShareMenu =
    homeMenuBlock && (homeMenuBlock.data as { showOnAllPages?: boolean }).showOnAllPages !== false;
  const sharedMenuBlock = activePage === "home" || !shouldShareMenu ? null : homeMenuBlock;
  const displayBlocks: SiteBlock[] = sharedMenuBlock
    ? [sharedMenuBlock, ...pageBlocks.filter((block) => block.id !== sharedMenuBlock.id)]
    : pageBlocks;
  const loaderConfig = resolveSiteLoaderConfig(draft);
  const firstDisplayBlockIsMenu = displayBlocks[0]?.type === "menu";
  const [selectedId, setSelectedId] = useState<string | null>(
    displayBlocks[0]?.id ?? null
  );
  const [leftPanel, setLeftPanel] = useState<"library" | null>(null);
  const [pagesMenuOpen, setPagesMenuOpen] = useState(false);
  const [pagesSearch, setPagesSearch] = useState("");
  const pagesMenuRef = useRef<HTMLDivElement | null>(null);
  const [libraryBlock, setLibraryBlock] = useState<BlockType | null>(null);
  const [rightPanel, setRightPanel] = useState<"content" | "settings" | null>(
    null
  );
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const rightPanelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [mobileViewport, setMobileViewport] = useState<MobileViewportKey>("mobile360");
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePanelSectionId, setActivePanelSectionId] = useState<string | null>(null);
  const [coverDrawerKey, setCoverDrawerKey] = useState<"typography" | "button" | "animation" | null>(null);
  const [coverWidthModalOpen, setCoverWidthModalOpen] = useState(false);
  const coverWidthButtonRef = useRef<HTMLButtonElement | null>(null);
  const coverWidthPopoverRef = useRef<HTMLDivElement | null>(null);
  const [showPanelExitConfirm, setShowPanelExitConfirm] = useState(false);
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
  const [panelBaselineKey, setPanelBaselineKey] = useState<string | null>(null);
  const [panelBaselineSignature, setPanelBaselineSignature] = useState<string | null>(null);
  const [panelBaselineBlock, setPanelBaselineBlock] = useState<SiteBlock | null>(null);
  const [activeSpacingSlot, setActiveSpacingSlot] = useState<number | null>(null);
  const [activeSpacingTarget, setActiveSpacingTarget] = useState<"prev" | "next" | null>(
    null
  );
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [spacingAnchorBlockId, setSpacingAnchorBlockId] = useState<string | null>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  const setDraftTracked = (
    updater: (prev: SiteDraft) => SiteDraft,
    options?: { recordHistory?: boolean; groupKey?: string }
  ) => {
    const recordHistory = options?.recordHistory !== false;
    const groupKey = options?.groupKey ?? null;
    setDraft((prev) => {
      const next = updater(prev);
      if (!recordHistory || Object.is(next, prev)) {
        draftRef.current = next;
        return next;
      }
      const now = Date.now();
      const shouldCoalesce =
        Boolean(groupKey) &&
        historyMetaRef.current.lastGroupKey === groupKey &&
        now - historyMetaRef.current.lastRecordedAt < 700;
      if (!shouldCoalesce) {
        historyRef.current.past.push(cloneDraftSnapshot(prev));
      }
      if (historyRef.current.past.length > 100) {
        historyRef.current.past.shift();
      }
      historyRef.current.future = [];
      historyMetaRef.current = { lastGroupKey: groupKey, lastRecordedAt: now };
      draftRef.current = next;
      return next;
    });
  };

  const undoDraft = () => {
    const prevSnapshot = historyRef.current.past.pop();
    if (!prevSnapshot) return;
    setDraft((current) => {
      historyRef.current.future.push(cloneDraftSnapshot(current));
      const next = cloneDraftSnapshot(prevSnapshot);
      draftRef.current = next;
      return next;
    });
    historyMetaRef.current = { lastGroupKey: null, lastRecordedAt: 0 };
    setShowPanelExitConfirm(false);
  };

  const redoDraft = () => {
    const nextSnapshot = historyRef.current.future.pop();
    if (!nextSnapshot) return;
    setDraft((current) => {
      historyRef.current.past.push(cloneDraftSnapshot(current));
      const next = cloneDraftSnapshot(nextSnapshot);
      draftRef.current = next;
      return next;
    });
    historyMetaRef.current = { lastGroupKey: null, lastRecordedAt: 0 };
    setShowPanelExitConfirm(false);
  };

  useEffect(() => {
    if (!displayBlocks.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !displayBlocks.some((block) => block.id === selectedId)) {
      setSelectedId(displayBlocks[0]?.id ?? null);
    }
  }, [displayBlocks, selectedId]);
  useEffect(() => {
    if (!pendingDeleteBlockId) return;
    if (!displayBlocks.some((block) => block.id === pendingDeleteBlockId)) {
      setPendingDeleteBlockId(null);
    }
  }, [displayBlocks, pendingDeleteBlockId]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const selectedBlock = displayBlocks.find((block) => block.id === selectedId) ?? null;
  const pendingDeleteBlock = pendingDeleteBlockId
    ? displayBlocks.find((block) => block.id === pendingDeleteBlockId) ?? null
    : null;
  const activeBlockId = spacingAnchorBlockId ?? selectedId;
  const activeTheme: SiteTheme = draft.theme;

  const getSlotSpacing = (slotIndex: number) => {
    const prevBlock = displayBlocks[slotIndex - 1] ?? null;
    const nextBlock = displayBlocks[slotIndex] ?? null;
    const prevBottom = prevBlock ? normalizeBlockStyle(prevBlock, activeTheme).marginBottom : 0;
    const nextTop = nextBlock ? normalizeBlockStyle(nextBlock, activeTheme).marginTop : 0;
    return Math.max(0, prevBottom + nextTop);
  };
  const getSlotActiveOffset = (
    slotIndex: number,
    target: "prev" | "next" | null = null
  ) => {
    const prevBlock = displayBlocks[slotIndex - 1] ?? null;
    const nextBlock = displayBlocks[slotIndex] ?? null;
    if (target === "next" && nextBlock) {
      return normalizeBlockStyle(nextBlock, activeTheme).marginTop;
    }
    if (target === "prev" && prevBlock) {
      return normalizeBlockStyle(prevBlock, activeTheme).marginBottom;
    }
    if (nextBlock && activeBlockId && nextBlock.id === activeBlockId) {
      return normalizeBlockStyle(nextBlock, activeTheme).marginTop;
    }
    if (prevBlock && activeBlockId && prevBlock.id === activeBlockId) {
      return normalizeBlockStyle(prevBlock, activeTheme).marginBottom;
    }
    if (prevBlock) return normalizeBlockStyle(prevBlock, activeTheme).marginBottom;
    if (nextBlock) return normalizeBlockStyle(nextBlock, activeTheme).marginTop;
    return 0;
  };
  const hasCustomSlotSpacing = (slotIndex: number) => getSlotSpacing(slotIndex) > 0;
  const registerSlotRef = (slotIndex: number, el: HTMLDivElement | null) => {
    if (el) {
      slotRefs.current[slotIndex] = el;
      return;
    }
    delete slotRefs.current[slotIndex];
  };
  const getSlotLineY = (slotIndex: number, fallback: number) => {
    const el = slotRefs.current[slotIndex];
    if (!el) return fallback;
    const rect = el.getBoundingClientRect();
    return rect.top + rect.height / 2;
  };
  const updateHoveredBlockFromLine = (clientY: number) => {
    if (activeSpacingSlot !== null || displayBlocks.length === 0) return;
    let nextHoveredId: string | null = null;
    for (let i = 0; i < displayBlocks.length; i += 1) {
      const topBoundary = getSlotLineY(i, Number.NEGATIVE_INFINITY);
      const bottomBoundary = getSlotLineY(i + 1, Number.POSITIVE_INFINITY);
      if (clientY >= topBoundary && clientY < bottomBoundary) {
        nextHoveredId = displayBlocks[i]?.id ?? null;
        break;
      }
    }
    if (!nextHoveredId) {
      nextHoveredId = displayBlocks[displayBlocks.length - 1]?.id ?? null;
    }
    if (nextHoveredId && nextHoveredId !== hoveredBlockId) {
      setHoveredBlockId(nextHoveredId);
      setSpacingAnchorBlockId(nextHoveredId);
    }
  };

  const currentPanelSections = useMemo<EditorSection[]>(() => {
    if (!rightPanel) return [];
    if (!selectedBlock) return [];
    if (rightPanel === "content") {
      return (
        CONTENT_SECTIONS_BY_BLOCK[selectedBlock.type] ?? [{ id: "main", label: "Контент блока" }]
      );
    }
    return (
      SETTINGS_SECTIONS_BY_BLOCK[selectedBlock.type] ?? [
        { id: "layout", label: "Основные настройки" },
        { id: "colors", label: "Цвета" },
        { id: "typography", label: "Типографика" },
        { id: "effects", label: "Эффекты" },
      ]
    );
  }, [rightPanel, selectedBlock]);

  const panelTargetKey = rightPanel
    ? `${rightPanel}:${
        selectedBlock?.id ?? "none"
      }`
    : null;
  const currentPanelSignature = useMemo(() => {
    if (!rightPanel) return null;
    if (!selectedBlock) return null;
    return JSON.stringify(selectedBlock);
  }, [rightPanel, selectedBlock]);
  const panelHasUnsavedChanges = Boolean(
    rightPanel &&
      currentPanelSignature &&
      panelBaselineSignature !== null &&
      currentPanelSignature !== panelBaselineSignature
  );

  useEffect(() => {
    if (!currentPanelSections.length) {
      setActivePanelSectionId(null);
      return;
    }
    if (!activePanelSectionId) {
      return;
    }
    if (!currentPanelSections.some((section) => section.id === activePanelSectionId)) {
      setActivePanelSectionId(null);
    }
  }, [currentPanelSections, activePanelSectionId]);

  useEffect(() => {
    if (!rightPanel) {
      setPanelBaselineKey(null);
      setPanelBaselineSignature(null);
      setPanelBaselineBlock(null);
      setShowPanelExitConfirm(false);
      return;
    }
    if (!panelTargetKey || !currentPanelSignature) return;
    if (panelBaselineKey !== panelTargetKey) {
      setPanelBaselineKey(panelTargetKey);
      setPanelBaselineSignature(currentPanelSignature);
      setPanelBaselineBlock(
        selectedBlock
          ? (JSON.parse(JSON.stringify(selectedBlock)) as SiteBlock)
          : null
      );
      setActivePanelSectionId(null);
      setCoverDrawerKey(null);
      setCoverWidthModalOpen(false);
      setShowPanelExitConfirm(false);
    }
  }, [rightPanel, panelTargetKey, currentPanelSignature, panelBaselineKey, selectedBlock]);

  useEffect(() => {
    if (!coverWidthModalOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (coverWidthPopoverRef.current?.contains(target)) return;
      if (coverWidthButtonRef.current?.contains(target)) return;
      setCoverWidthModalOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [coverWidthModalOpen]);

  useEffect(() => {
    if (!rightPanel) return;
    if (rightPanelCloseTimerRef.current) {
      clearTimeout(rightPanelCloseTimerRef.current);
      rightPanelCloseTimerRef.current = null;
    }
    setIsRightPanelVisible(false);
    const raf = window.requestAnimationFrame(() => setIsRightPanelVisible(true));
    return () => window.cancelAnimationFrame(raf);
  }, [rightPanel]);

  useEffect(() => {
    return () => {
      if (rightPanelCloseTimerRef.current) {
        clearTimeout(rightPanelCloseTimerRef.current);
      }
    };
  }, []);

  const closeRightPanel = useCallback(() => {
    if (!rightPanel) return;
    setIsRightPanelVisible(false);
    if (rightPanelCloseTimerRef.current) {
      clearTimeout(rightPanelCloseTimerRef.current);
    }
    rightPanelCloseTimerRef.current = setTimeout(() => {
      setRightPanel(null);
      rightPanelCloseTimerRef.current = null;
    }, PANEL_ANIMATION_MS);
  }, [rightPanel]);

  const savePanelDraft = async (closeAfterSave: boolean) => {
    const ok = await savePublic(false);
    if (closeAfterSave && ok) {
      closeRightPanel();
      setShowPanelExitConfirm(false);
      return;
    }
    if (ok && currentPanelSignature) {
      setPanelBaselineSignature(currentPanelSignature);
    }
  };
  const requestClosePanel = () => {
    if (!rightPanel) return;
    if (!panelHasUnsavedChanges) {
      closeRightPanel();
      return;
    }
    setShowPanelExitConfirm(true);
  };
  const closePanelWithoutSave = () => {
    if (panelBaselineBlock) {
      updateBlock(
        panelBaselineBlock.id,
        () => JSON.parse(JSON.stringify(panelBaselineBlock)) as SiteBlock,
        { recordHistory: false }
      );
    }
    setShowPanelExitConfirm(false);
    closeRightPanel();
  };


  const updateBlock = (
    id: string,
    updater: (block: SiteBlock) => SiteBlock,
    options?: { recordHistory?: boolean }
  ) => {
    setDraftTracked((prev) => {
      const pages = { ...ensurePages(prev) };
      const entityPages = { ...ensureEntityPages(prev) };
      const entityPageKey = resolveEntityPageKey(currentEntity);
      const pageKey: SitePageKey = entityPageKey ?? activePage;
      const entityId = currentEntity ? String(currentEntity.id) : null;
      const prevHome = pages.home ?? prev.blocks;
      const prevPage =
        entityId && entityPageKey && entityPages[entityPageKey]?.[entityId]
          ? entityPages[entityPageKey][entityId]
          : pages[pageKey] ?? prev.blocks;

      const updateList = (blocks: SiteBlock[]) =>
        blocks.map((block) => (block.id === id ? updater(block) : block));

      const nextHome = prevHome.some((block) => block.id === id)
        ? updateList(prevHome)
        : prevHome;
      const nextPage = prevPage.some((block) => block.id === id)
        ? updateList(prevPage)
        : prevPage;

      pages.home = nextHome;
      if (entityId && entityPageKey) {
        const nextEntityForKey = { ...(entityPages[entityPageKey] ?? {}) };
        nextEntityForKey[entityId] = nextPage;
        entityPages[entityPageKey] = nextEntityForKey;
      } else {
        pages[pageKey] = pageKey === "home" ? nextHome : nextPage;
      }

      return { ...prev, pages, entityPages, blocks: pages.home ?? prev.blocks };
    }, { ...options, groupKey: `block:${id}` });
  };

  const applyThemePatch = (prevTheme: SiteTheme, patch: Partial<SiteTheme>): SiteTheme => {
    const nextMode = patch.mode ?? prevTheme.mode ?? "light";
    const lightPalette = { ...prevTheme.lightPalette };
    const darkPalette = { ...prevTheme.darkPalette };
    if (patch.lightPalette) {
      Object.assign(lightPalette, patch.lightPalette);
    }
    if (patch.darkPalette) {
      Object.assign(darkPalette, patch.darkPalette);
    }

    const palettePatch: Partial<SiteTheme> = { ...patch };
    delete (palettePatch as { mode?: string }).mode;
    delete (palettePatch as { lightPalette?: SiteTheme }).lightPalette;
    delete (palettePatch as { darkPalette?: SiteTheme }).darkPalette;

    const targetPalette = nextMode === "dark" ? darkPalette : lightPalette;
    Object.assign(targetPalette, palettePatch);

    // Keep these layout metrics in dark the same as light
    darkPalette.radius = lightPalette.radius;
    darkPalette.buttonRadius = lightPalette.buttonRadius;
    darkPalette.blockSpacing = lightPalette.blockSpacing;

    const activePalette = nextMode === "dark" ? darkPalette : lightPalette;
    return {
      ...prevTheme,
      ...activePalette,
      mode: nextMode,
      lightPalette,
      darkPalette,
    };
  };

  const setThemeMode = (mode: "light" | "dark") => {
    setDraftTracked((prev) => ({
      ...prev,
      theme: applyThemePatch(prev.theme, { mode }),
    }), { groupKey: "theme-mode" });
  };

  const updateBlocks = (nextBlocks: SiteBlock[], options?: { recordHistory?: boolean }) => {
    const groupKey = `blocks:${entityPageKey ?? activePage}:${entityId ?? "root"}`;
    setDraftTracked((prev) => {
      const pages = { ...ensurePages(prev) };
      const entityPages = { ...ensureEntityPages(prev) };
      const entityPageKey = resolveEntityPageKey(currentEntity);
      const pageKey: SitePageKey = entityPageKey ?? activePage;
      const entityId = currentEntity ? String(currentEntity.id) : null;

      if (entityId && entityPageKey) {
        const nextEntityForKey = { ...(entityPages[entityPageKey] ?? {}) };
        nextEntityForKey[entityId] = nextBlocks;
        entityPages[entityPageKey] = nextEntityForKey;
      } else {
        pages[pageKey] = nextBlocks;
      }

      if (pageKey === "home") {
        pages.home = nextBlocks;
      }
      const home = pages.home ?? prev.blocks;
      return { ...prev, pages, entityPages, blocks: home };
    }, { ...options, groupKey });
  };

  const insertBlock = (
    type: BlockType,
    index?: number,
    variant?: "v1" | "v2" | "v3" | "v4" | "v5"
  ) => {
    const block = createBlock(type);
    const targetVariant = variant ?? block.variant;
    if (type === "menu") {
      const currentStyle =
        typeof (block.data as Record<string, unknown>).style === "object" &&
        (block.data as Record<string, unknown>).style
          ? { ...((block.data as Record<string, unknown>).style as Record<string, unknown>) }
          : { ...defaultBlockStyle };
      block.data = {
        ...block.data,
        accountTitle: account.name,
        showCompanyName: true,
        menuHeight: targetVariant === "v1" ? 64 : 56,
        socialIconSize: 40,
        style:
          targetVariant === "v1" || targetVariant === "v2"
            ? { ...currentStyle, radius: 0 }
            : currentStyle,
      };
    }
    if (variant) block.variant = variant;

    if (type === "menu" && activePage !== "home") {
      const existingMenu = homeBlocks.find((item) => item.type === "menu");
      if (!existingMenu) {
        const nextHome = [block, ...homeBlocks];
        setDraftTracked((prev) => ({
          ...prev,
          pages: { ...ensurePages(prev), home: nextHome },
          blocks: nextHome,
        }));
        setSelectedId(block.id);
      } else {
        setSelectedId(existingMenu.id);
      }
      setInsertIndex(null);
      return;
    }

    const next = [...pageBlocks];
    const offset = sharedMenuBlock ? 1 : 0;
    const rawIndex =
      typeof index === "number" && index >= 0 ? index : next.length + offset;
    const targetIndex = Math.max(0, Math.min(rawIndex - offset, next.length));
    next.splice(targetIndex, 0, block);
    updateBlocks(next);
    setSelectedId(block.id);
    setInsertIndex(null);
  };

  const removeBlock = (id: string) => {
    if (sharedMenuBlock && sharedMenuBlock.id === id && activePage !== "home") {
      return;
    }
    if (
      !entityPageKey &&
      (activePage === "client" || activePage === "booking") &&
      pageBlocks.some(
        (block) => block.id === id && isSystemBlockType(block.type)
      )
    ) {
      return;
    }
    updateBlocks(pageBlocks.filter((block) => block.id !== id));
    if (selectedId === id) {
      const next = displayBlocks.find((block) => block.id !== id);
      setSelectedId(next?.id ?? null);
    }
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    if (sharedMenuBlock && sharedMenuBlock.id === id && activePage !== "home") {
      return;
    }
    if (
      !entityPageKey &&
      (activePage === "client" || activePage === "booking") &&
      pageBlocks.some(
        (block) => block.id === id && isSystemBlockType(block.type)
      )
    ) {
      return;
    }
    const idx = pageBlocks.findIndex((block) => block.id === id);
    if (idx < 0) return;
    const next = [...pageBlocks];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updateBlocks(next);
  };

  const confirmRemoveBlock = () => {
    if (!pendingDeleteBlockId) return;
    removeBlock(pendingDeleteBlockId);
    setPendingDeleteBlockId(null);
  };

  const clampBlockOffset = (value: number) =>
    Math.max(0, Math.min(240, Math.round(value)));

  const adjustSpacingAt = (
    slotIndex: number,
    deltaY: number,
    target: "prev" | "next" | null = null
  ) => {
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const prevBlock = displayBlocks[slotIndex - 1] ?? null;
    const nextBlock = displayBlocks[slotIndex] ?? null;
    if (slotIndex === 0 && nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(
            normalizeBlockStyle(block, activeTheme).marginTop + deltaY
          ),
        })
      );
      return;
    }

    if (target === "next" && nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(
            normalizeBlockStyle(block, activeTheme).marginTop + deltaY
          ),
        })
      );
      return;
    }

    if (target === "prev" && prevBlock) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(
            normalizeBlockStyle(block, activeTheme).marginBottom + deltaY
          ),
        })
      );
      return;
    }

    if (nextBlock && activeBlockId && nextBlock.id === activeBlockId) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, activeTheme).marginTop + deltaY),
        })
      );
      return;
    }

    if (prevBlock && activeBlockId && prevBlock.id === activeBlockId) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(
            normalizeBlockStyle(block, activeTheme).marginBottom + deltaY
          ),
        })
      );
      return;
    }

    if (prevBlock) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(
            normalizeBlockStyle(block, activeTheme).marginBottom + deltaY
          ),
        })
      );
      return;
    }

    if (nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, activeTheme).marginTop + deltaY),
        })
      );
    }
  };

  const savePublic = async (publish: boolean): Promise<boolean> => {
    setSaving("public");
    setMessage(null);
    const currentDraft = draftRef.current;
    const payloadDraft = {
      ...currentDraft,
      blocks: currentDraft.pages?.home ?? currentDraft.blocks,
    };
    try {
      const response = await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftJson: payloadDraft, publish }),
      });
      if (response.ok) {
        const data = await response.json();
        setPublicPage(data.data);
        setMessage(publish ? "Страница опубликована." : "Черновик сохранен.");
        return true;
      } else {
        setMessage("Не удалось сохранить страницу.");
        return false;
      }
    } catch {
      setMessage("Не удалось сохранить страницу.");
      return false;
    } finally {
      setSaving(null);
    }
  };
  const saveDraftSilently = async () => {
    const currentDraft = draftRef.current;
    const payloadDraft = {
      ...currentDraft,
      blocks: currentDraft.pages?.home ?? currentDraft.blocks,
    };
    try {
      const response = await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftJson: payloadDraft, publish: false }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setPublicPage(data.data);
    } catch {
      // silent background save
    }
  };

  const publicUrl = account.publicSlug ? `/${account.publicSlug}` : null;
  const hasPageBlocks = (key: SitePageKey) => (draft.pages?.[key]?.length ?? 0) > 0;
  const availablePageKeys = useMemo<SitePageKey[]>(() => {
    return PAGE_KEYS.filter((key) => {
      if (key === "home") return true;
      if (key === "locations") return locations.length > 0 || hasPageBlocks(key);
      if (key === "services") return services.length > 0 || hasPageBlocks(key);
      if (key === "specialists") return specialists.length > 0 || hasPageBlocks(key);
      if (key === "promos") return promos.length > 0 || hasPageBlocks(key);
      return hasPageBlocks(key);
    });
  }, [draft.pages, locations.length, services.length, specialists.length, promos.length]);
  const projectTitle = account.name?.trim() || account.publicSlug || account.slug || "Мой сайт";
  const currentEntityLabel = useMemo(() => {
    if (!currentEntity) return null;
    if (currentEntity.type === "location") {
      return locations.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    if (currentEntity.type === "service") {
      return services.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    if (currentEntity.type === "specialist") {
      return specialists.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    if (currentEntity.type === "promo") {
      return promos.find((item) => item.id === currentEntity.id)?.name ?? null;
    }
    return null;
  }, [currentEntity, locations, services, specialists, promos]);
  const currentPageTitle = currentEntityLabel
    ? currentEntityLabel
    : availablePageKeys.includes(activePageKey)
      ? PAGE_LABELS[activePageKey]
      : PAGE_LABELS[availablePageKeys[0] ?? "home"];
  const pagesSearchValue = pagesSearch.trim().toLowerCase();
  const matchSearch = (value: string) =>
    pagesSearchValue.length === 0 || value.toLowerCase().includes(pagesSearchValue);
  const filteredPageKeys = useMemo(
    () => availablePageKeys.filter((key) => matchSearch(PAGE_LABELS[key])),
    [availablePageKeys, pagesSearchValue]
  );
  const filteredLocationItems = useMemo(
    () => locations.filter((item) => matchSearch(item.name)),
    [locations, pagesSearchValue]
  );
  const filteredServiceItems = useMemo(
    () => services.filter((item) => matchSearch(item.name)),
    [services, pagesSearchValue]
  );
  const filteredSpecialistItems = useMemo(
    () => specialists.filter((item) => matchSearch(item.name)),
    [specialists, pagesSearchValue]
  );
  const filteredPromoItems = useMemo(
    () => promos.filter((item) => matchSearch(item.name)),
    [promos, pagesSearchValue]
  );
  const hasFilteredPagesMenuItems =
    filteredPageKeys.length > 0 ||
    filteredLocationItems.length > 0 ||
    filteredServiceItems.length > 0 ||
    filteredSpecialistItems.length > 0 ||
    filteredPromoItems.length > 0;

  useEffect(() => {
    if (!pagesMenuOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (!pagesMenuRef.current) return;
      if (!pagesMenuRef.current.contains(event.target as Node)) {
        setPagesMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPagesMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [pagesMenuOpen]);

  const globalBorderColor = activeTheme.borderColor?.trim() || "transparent";
  const themeStyle: Record<string, string> = {
    "--bp-accent": activeTheme.accentColor,
    "--bp-surface": activeTheme.surfaceColor,
    "--bp-paper": activeTheme.panelColor,
    "--bp-panel": activeTheme.panelColor,
    "--bp-ink": activeTheme.textColor,
    "--bp-muted": activeTheme.mutedColor,
    "--bp-stroke": globalBorderColor,
    "--site-accent": activeTheme.accentColor,
    "--site-surface": activeTheme.surfaceColor,
    "--site-panel": activeTheme.panelColor,
    "--site-text": activeTheme.textColor,
    "--site-muted": activeTheme.mutedColor,
    "--site-font-heading": activeTheme.fontHeading,
    "--site-font-body": activeTheme.fontBody,
    "--site-border": globalBorderColor,
    "--site-button": activeTheme.buttonColor,
    "--site-button-text": activeTheme.buttonTextColor,
    "--site-shadow-color": activeTheme.shadowColor,
    "--site-shadow-size": `${activeTheme.shadowSize}px`,
    "--site-radius": `${activeTheme.radius}px`,
    "--site-button-radius": `${activeTheme.buttonRadius}px`,
    "--site-gap": `${activeTheme.blockSpacing}px`,
    "--site-h1": `${activeTheme.headingSize}px`,
    "--site-h2": `${activeTheme.subheadingSize}px`,
    "--site-text-size": `${activeTheme.textSize}px`,
  };
  const previewCanvasWidth =
    previewMode === "mobile" ? MOBILE_VIEWPORTS[mobileViewport].width : undefined;
  const handleThemeToggle = () =>
    setThemeMode(activeTheme.mode === "dark" ? "light" : "dark");
  const panelTheme =
    activeTheme.mode === "dark"
      ? {
          surface: "#14161a",
          panel: "rgba(22, 24, 29, 0.9)",
          border: "rgba(255, 255, 255, 0.08)",
          text: "#f2f3f5",
          muted: "#a1a5ad",
          accent: "#d3d6db",
          save: "#0f1012",
          saveClose: "#1a1c22",
        }
      : {
          surface: "#ffffff",
          panel: "#ffffff",
          border: "#d9dde5",
          text: "#111827",
          muted: "#6b7280",
          accent: "#2563eb",
          save: "#000000",
          saveClose: "#ff5a5f",
        };

  const isCoverSettingsPanel = rightPanel === "settings" && selectedBlock?.type === "cover";
  const coverStyle = isCoverSettingsPanel && selectedBlock
    ? normalizeBlockStyle(selectedBlock, activeTheme)
    : null;
  const coverResolvedColumns = coverStyle
    ? clampBlockColumns(coverStyle.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, "cover")
    : DEFAULT_BLOCK_COLUMNS;
  const coverGridFallback = centeredGridRange(coverResolvedColumns);
  const coverGridStart = coverStyle?.gridStartColumn ?? coverGridFallback.start;
  const coverGridEnd = coverStyle?.gridEndColumn ?? coverGridFallback.end;
  const coverGridSpan = Math.max(1, coverGridEnd - coverGridStart + 1);
  const coverMarginTopLines = coverStyle ? Math.max(0, Math.min(7, Math.round((coverStyle.marginTop / COVER_LINE_STEP_PX) * 2) / 2)) : 0;
  const coverMarginBottomLines = coverStyle ? Math.max(0, Math.min(7, Math.round((coverStyle.marginBottom / COVER_LINE_STEP_PX) * 2) / 2)) : 0;
  const coverData =
    isCoverSettingsPanel && selectedBlock
      ? (selectedBlock.data as Record<string, unknown>)
      : null;
  const coverBackgroundMode: CoverBackgroundMode =
    coverData?.coverBackgroundMode === "linear" || coverData?.coverBackgroundMode === "radial"
      ? (coverData.coverBackgroundMode as CoverBackgroundMode)
      : "solid";
  const coverScrollEffect =
    coverData?.coverScrollEffect === "fixed" || coverData?.coverScrollEffect === "parallax"
      ? (coverData.coverScrollEffect as "fixed" | "parallax")
      : "none";
  const coverScrollHeightRaw =
    typeof coverData?.coverScrollHeight === "string" ? coverData.coverScrollHeight.trim() : "";
  const coverScrollHeight = /^(?:\d+(?:\.\d+)?)(?:px|vh)$/i.test(coverScrollHeightRaw)
    ? coverScrollHeightRaw
    : "700px";
  const coverScrollHeightPx = (() => {
    const pxMatch = coverScrollHeight.match(/^(\d+(?:\.\d+)?)px$/i);
    if (pxMatch) {
      return Math.max(0, Math.round(Number(pxMatch[1])));
    }
    return 700;
  })();
  const coverFilterStartColorRaw =
    typeof coverData?.coverFilterStartColor === "string"
      ? coverData.coverFilterStartColor.trim()
      : "";
  const coverFilterStartColor =
    coverFilterStartColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverFilterStartColorRaw)
        ? coverFilterStartColorRaw
        : "#000000";
  const coverFilterEndColorRaw =
    typeof coverData?.coverFilterEndColor === "string"
      ? coverData.coverFilterEndColor.trim()
      : "";
  const coverFilterEndColor =
    coverFilterEndColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverFilterEndColorRaw)
        ? coverFilterEndColorRaw
        : "#0f0f0f";
  const coverFilterStartOpacity = Number.isFinite(Number(coverData?.coverFilterStartOpacity))
    ? Math.max(0, Math.min(100, Number(coverData?.coverFilterStartOpacity)))
    : 10;
  const coverFilterEndOpacity = Number.isFinite(Number(coverData?.coverFilterEndOpacity))
    ? Math.max(0, Math.min(100, Number(coverData?.coverFilterEndOpacity)))
    : 60;
  const coverArrow =
    coverData?.coverArrow === "down" ? "down" : "none";
  const coverArrowColorRaw =
    typeof coverData?.coverArrowColor === "string"
      ? coverData.coverArrowColor.trim()
      : "";
  const coverArrowColor =
    coverArrowColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(coverArrowColorRaw)
        ? coverArrowColorRaw
        : "#ffffff";
  const coverArrowAnimated = Boolean(coverData?.coverArrowAnimated);
  const coverBackgroundPositionRaw =
    typeof coverData?.coverBackgroundPosition === "string"
      ? coverData.coverBackgroundPosition.trim().toLowerCase()
      : "";
  const coverBackgroundPosition = COVER_BACKGROUND_POSITION_VALUES.has(coverBackgroundPositionRaw)
    ? coverBackgroundPositionRaw
    : "center center";
  const coverBackgroundTo = String(coverData?.coverBackgroundTo ?? "");
  const coverBackgroundAngle = Number.isFinite(Number(coverData?.coverBackgroundAngle))
    ? Math.max(0, Math.min(360, Number(coverData?.coverBackgroundAngle)))
    : 135;
  const coverBackgroundStopA = Number.isFinite(Number(coverData?.coverBackgroundStopA))
    ? Math.max(0, Math.min(100, Number(coverData?.coverBackgroundStopA)))
    : 0;
  const coverBackgroundStopB = Number.isFinite(Number(coverData?.coverBackgroundStopB))
    ? Math.max(0, Math.min(100, Number(coverData?.coverBackgroundStopB)))
    : 100;
  const coverShowSecondaryButton = Boolean(coverData?.showSecondaryButton);
  const coverPrimaryButtonBorderColorRaw =
    typeof coverData?.coverPrimaryButtonBorderColor === "string"
      ? coverData.coverPrimaryButtonBorderColor.trim()
      : "";
  const coverPrimaryButtonBorderColor =
    coverPrimaryButtonBorderColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverPrimaryButtonBorderColorRaw && isValidColorValue(coverPrimaryButtonBorderColorRaw)
        ? coverPrimaryButtonBorderColorRaw
        : "transparent";
  const coverSecondaryButtonColorRaw =
    typeof coverData?.coverSecondaryButtonColor === "string"
      ? coverData.coverSecondaryButtonColor.trim()
      : "";
  const coverSecondaryButtonColor =
    coverSecondaryButtonColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonColorRaw && isValidColorValue(coverSecondaryButtonColorRaw)
        ? coverSecondaryButtonColorRaw
        : "transparent";
  const coverSecondaryButtonTextColorRaw =
    typeof coverData?.coverSecondaryButtonTextColor === "string"
      ? coverData.coverSecondaryButtonTextColor.trim()
      : "";
  const coverSecondaryButtonTextColor =
    coverSecondaryButtonTextColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonTextColorRaw && isValidColorValue(coverSecondaryButtonTextColorRaw)
        ? coverSecondaryButtonTextColorRaw
        : "#ffffff";
  const coverSecondaryButtonBorderColorRaw =
    typeof coverData?.coverSecondaryButtonBorderColor === "string"
      ? coverData.coverSecondaryButtonBorderColor.trim()
      : "";
  const coverSecondaryButtonBorderColor =
    coverSecondaryButtonBorderColorRaw.toLowerCase() === "transparent"
      ? "transparent"
      : coverSecondaryButtonBorderColorRaw && isValidColorValue(coverSecondaryButtonBorderColorRaw)
        ? coverSecondaryButtonBorderColorRaw
        : "rgba(255,255,255,0.45)";
  const coverSecondaryButtonRadius = Number.isFinite(Number(coverData?.coverSecondaryButtonRadius))
    ? Math.max(0, Math.min(80, Math.round(Number(coverData?.coverSecondaryButtonRadius))))
    : (coverStyle?.buttonRadius ?? activeTheme.buttonRadius);

  const updateSelectedCoverStyle = (patch: Partial<BlockStyle>) => {
    if (!isCoverSettingsPanel || !selectedBlock) return;
    updateBlock(selectedBlock.id, (block) => updateBlockStyle(block, patch));
  };
  const updateSelectedCoverData = (patch: Record<string, unknown>) => {
    if (!isCoverSettingsPanel || !selectedBlock) return;
    updateBlock(selectedBlock.id, (block) => ({ ...block, data: { ...block.data, ...patch } }));
  };
  const applySelectedCoverGridRange = (nextStart: number, nextEnd: number) => {
    const safeStart = clampGridColumn(nextStart);
    const safeEnd = Math.max(safeStart, clampGridColumn(nextEnd));
    const nextColumns = Math.max(1, safeEnd - safeStart + 1);
    const nextWidth = Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
    updateSelectedCoverStyle({
      useCustomWidth: true,
      blockWidth: nextWidth,
      blockWidthColumns: nextColumns,
      gridStartColumn: safeStart,
      gridEndColumn: safeEnd,
    });
  };
  const floatingPanelsTop = rightPanel ? 0 : 56;
  const renderCoverFlatTextInput = (
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
      </div>
    </label>
  );
  const renderCoverFlatNumberInput = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void
  ) => (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            onChange(
              Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : min
            );
          }}
          className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, borderRadius: 0, backgroundColor: "transparent", boxShadow: "none" }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
      </div>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm shadow-[var(--bp-shadow)]"
        >
          {message}
        </div>
      )}

      <div className="relative">
        <div className="h-8.5" />
        <div
          className={`fixed top-0 left-0 right-0 z-[230] border border-x-0 border-[color:var(--bp-stroke)] bg-[#fcfcfd] px-4 py-2 sm:px-6 lg:px-8 transition-all duration-[220ms] ease-out ${
            isRightPanelVisible ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
          }`}
        >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--bp-muted)]">
            <Link
              href="/crm/site/project"
              className="text-xs uppercase tracking-[0.16em] text-[color:var(--bp-ink)] hover:text-[color:var(--bp-accent)]"
              title="Открыть проект"
            >
              {projectTitle}
            </Link>
            <span>/</span>
            <div ref={pagesMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setPagesMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-ink)] hover:text-[color:var(--bp-accent)]"
                title="Открыть список страниц"
              >
                {currentPageTitle}
                <span className="text-sm leading-none">{pagesMenuOpen ? "▴" : "▾"}</span>
              </button>
              {pagesMenuOpen && (
                <div className="absolute left-0 top-full z-[300] w-[360px] rounded-xl border border-[color:var(--bp-stroke)] bg-white p-3 text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]">
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={pagesSearch}
                      onChange={(event) => setPagesSearch(event.target.value)}
                      placeholder="Поиск страницы"
                      className="h-10 w-full rounded-md border border-[color:var(--bp-stroke)] bg-white px-3 pr-9 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--ring)]"
                    />
                    {pagesSearch.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPagesSearch("")}
                        className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
                        aria-label="Очистить поиск"
                        title="Очистить"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                    {filteredPageKeys.map((pageKey) => (
                      <button
                        key={pageKey}
                        type="button"
                        onClick={() => {
                          setActivePage(pageKey);
                          setCurrentEntity(null);
                          setPagesMenuOpen(false);
                          setPagesSearch("");
                        }}
                        className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                          pageKey === activePage
                            ? "bg-[#f3f4f6] font-semibold"
                            : "hover:bg-[#f8fafc]"
                        }`}
                      >
                        {PAGE_LABELS[pageKey]}
                      </button>
                    ))}
                    {filteredLocationItems.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
                          Локации
                        </div>
                        <div className="space-y-1">
                          {filteredLocationItems.map((item) => (
                            <button
                              key={`location-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("locations");
                                setCurrentEntity({ type: "location", id: item.id });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "location" && currentEntity.id === item.id
                                  ? "bg-[#f3f4f6] font-semibold"
                                  : "hover:bg-[#f8fafc]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {filteredServiceItems.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
                          Услуги
                        </div>
                        <div className="space-y-1">
                          {filteredServiceItems.map((item) => (
                            <button
                              key={`service-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("services");
                                setCurrentEntity({ type: "service", id: item.id });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "service" && currentEntity.id === item.id
                                  ? "bg-[#f3f4f6] font-semibold"
                                  : "hover:bg-[#f8fafc]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {filteredSpecialistItems.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
                          Специалисты
                        </div>
                        <div className="space-y-1">
                          {filteredSpecialistItems.map((item) => (
                            <button
                              key={`specialist-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("specialists");
                                setCurrentEntity({ type: "specialist", id: item.id });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "specialist" && currentEntity.id === item.id
                                  ? "bg-[#f3f4f6] font-semibold"
                                  : "hover:bg-[#f8fafc]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {filteredPromoItems.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-[color:var(--bp-muted)]">
                          Промо
                        </div>
                        <div className="space-y-1">
                          {filteredPromoItems.map((item) => (
                            <button
                              key={`promo-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("promos");
                                setCurrentEntity({ type: "promo", id: item.id });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "promo" && currentEntity.id === item.id
                                  ? "bg-[#f3f4f6] font-semibold"
                                  : "hover:bg-[#f8fafc]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!hasFilteredPagesMenuItems && (
                      <div className="rounded-md px-3 py-2 text-sm text-[color:var(--bp-muted)]">
                        Ничего не найдено
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/crm/site/project";
              }}
              className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm"
            >
              Вернуться в CRM
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode("desktop")}
              className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                previewMode === "desktop"
                  ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
              }`}
              aria-label="Десктоп"
              title="Десктоп"
            >
              ПК
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("mobile")}
              className={`flex h-10 w-10 items-center justify-center rounded-full border ${
                previewMode === "mobile"
                  ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
              }`}
              aria-label="Мобильный"
              title="Мобильный"
            >
              М
            </button>
            {previewMode === "mobile" && (
              <select
                value={mobileViewport}
                onChange={(event) =>
                  setMobileViewport(event.target.value as MobileViewportKey)
                }
                className="h-10 rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 text-sm"
                title="Размер мобильного предпросмотра"
              >
                {(Object.keys(MOBILE_VIEWPORTS) as MobileViewportKey[]).map((key) => (
                  <option key={key} value={key}>
                    {MOBILE_VIEWPORTS[key].label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={undoDraft}
              disabled={!canUndo}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Отменить действие"
              title="Отменить"
            >
              <svg viewBox="0 0 1024 1024" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" />
                <path d="m237.248 512l265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={redoDraft}
              disabled={!canRedo}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Повторить действие"
              title="Повторить"
            >
              <svg viewBox="0 0 1024 1024" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M754.752 480H160a32 32 0 1 0 0 64h594.752L521.344 777.344a32 32 0 0 0 45.312 45.312l288-288a32 32 0 0 0 0-45.312l-288-288a32 32 0 1 0-45.312 45.312L754.752 480z" />
              </svg>
            </button>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-5 py-2 text-sm"
              >
                Открыть сайт
              </a>
            )}
            <button
              type="button"
              onClick={() => savePublic(true)}
              className="rounded-full bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white"
              disabled={saving === "public"}
            >
              Опубликовать
            </button>
          </div>
        </div>
        </div>
      </div>

      <div
        className="relative"
        style={{
          backgroundColor: "#ffffff",
          backgroundImage: "none",
        }}
      >
        <main
          className="w-full"
          data-site-theme={activeTheme.mode}
          style={{
            ...themeStyle,
            backgroundColor: "#ffffff",
            backgroundImage: "none",
            color: activeTheme.textColor,
            fontFamily: activeTheme.fontBody,
          }}
        >
          <div
            className="mx-auto flex w-full flex-col"
            onMouseMove={(event) => updateHoveredBlockFromLine(event.clientY)}
            onMouseLeave={() => {
              if (activeSpacingSlot !== null) return;
              setHoveredBlockId(null);
            }}
            style={{
              paddingTop: 0,
              paddingBottom: 0,
              paddingLeft: 0,
              paddingRight: 0,
              maxWidth: previewCanvasWidth,
            }}
          >
            <InsertSlot
              index={0}
              slotRef={(el) => registerSlotRef(0, el)}
              spacing={getSlotSpacing(0)}
              activeOffset={getSlotActiveOffset(0, activeSpacingTarget)}
              hideAddButton={Boolean(rightPanel)}
              persistent={hasCustomSlotSpacing(0)}
              active={activeSpacingSlot === 0}
              showValue={activeSpacingSlot === 0}
              onDragStateChange={(dragging, target) => {
                if (dragging) {
                  setSpacingAnchorBlockId(hoveredBlockId ?? selectedId);
                  setActiveSpacingTarget(target ?? null);
                }
                setActiveSpacingSlot(dragging ? 0 : null);
                if (!dragging) {
                  setActiveSpacingTarget(null);
                  void saveDraftSilently();
                }
              }}
              onAdjustSpacing={(delta, target) => adjustSpacingAt(0, delta, target)}
              onInsert={() => {
                setInsertIndex(0);
                setLeftPanel("library");
                setLibraryBlock(null);
              }}
            />
            {displayBlocks.map((block: SiteBlock, index: number) => {
              const isSharedMenu = Boolean(
                sharedMenuBlock && activePage !== "home" && block.id === sharedMenuBlock.id
              );
              const isBlockActive = block.id === (hoveredBlockId ?? selectedId);
              const controlsDark = activeTheme.mode === "dark";
              const leftBtnClass = controlsDark
                ? "h-8 rounded-sm border border-[#374151] bg-[#111827] px-3 text-xs font-medium text-[#e5e7eb] shadow-sm hover:bg-[#1f2937]"
                : "h-8 rounded-sm border border-[#d1d5db] bg-white px-3 text-xs font-medium text-[#111827] shadow-sm hover:bg-[#f3f4f6]";
              const iconBtnClass = controlsDark
                ? "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#374151] bg-[#111827] text-xs font-medium text-[#e5e7eb] shadow-sm hover:bg-[#1f2937]"
                : "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#d1d5db] bg-white text-xs font-medium text-[#111827] shadow-sm hover:bg-[#f3f4f6]";
              const removeBtnClass = controlsDark
                ? "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#7f1d1d] bg-[#111827] text-xs font-semibold text-[#fca5a5] shadow-sm hover:bg-[#1f2937]"
                : "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#fda4af] bg-white text-xs font-semibold text-[#dc2626] shadow-sm hover:bg-[#f3f4f6]";
              const menuTopOffset = 0;
              return (
              <div
                key={block.id}
                className="relative flow-root"
                style={
                  block.type === "menu"
                    ? menuTopOffset > 0
                      ? { marginTop: menuTopOffset }
                      : undefined
                    : isSystemPage && index > 0
                      ? { marginTop: menuTopOffset }
                      : menuTopOffset > 0
                        ? { marginTop: menuTopOffset }
                        : undefined
                }
              >
                {isBlockActive && (
                  <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between">
                    <div className="pointer-events-auto flex items-center gap-1">
                      {block.type !== "booking" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(block.id);
                            setRightPanel("content");
                          }}
                          className={leftBtnClass}
                        >
                          Контент
                        </button>
                      )}
                      <button
                        type="button"
                          onClick={() => {
                            setSelectedId(block.id);
                            setRightPanel("settings");
                          }}
                        className={leftBtnClass}
                      >
                        Настройки
                      </button>
                    </div>
                    {!(
                      isSharedMenu ||
                      (isSystemPage && isSystemBlockType(block.type))
                    ) && (
                      <div className="pointer-events-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveBlock(block.id, "up")}
                          className={iconBtnClass}
                          aria-label="Переместить вверх"
                          title="Вверх"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(block.id, "down")}
                          className={iconBtnClass}
                          aria-label="Переместить вниз"
                          title="Вниз"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteBlockId(block.id)}
                          className={removeBtnClass}
                          aria-label="Удалить блок"
                          title="Удалить"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <BlockPreview
                  block={block}
                  account={account}
                  accountProfile={accountProfile}
                  branding={branding}
                  locations={locations}
                  services={services}
                  specialists={specialists}
                  promos={promos}
                  workPhotos={workPhotos}
                  theme={activeTheme}
                  loaderConfig={loaderConfig}
                  currentEntity={currentEntity}
                  previewMode={previewMode}
                  onThemeToggle={handleThemeToggle}
                  onSelect={() => {
                    setSelectedId(block.id);
                    setSpacingAnchorBlockId(block.id);
                    setHoveredBlockId(block.id);
                  }}
                  isSelected={block.id === selectedId}
                />
                <InsertSlot
                  index={index + 1}
                  slotRef={(el) => registerSlotRef(index + 1, el)}
                  spacing={getSlotSpacing(index + 1)}
                  activeOffset={getSlotActiveOffset(index + 1, activeSpacingTarget)}
                  hideAddButton={Boolean(rightPanel)}
                  persistent={hasCustomSlotSpacing(index + 1)}
                  active={activeSpacingSlot === index + 1}
                  showValue={activeSpacingSlot === index + 1}
                  onDragStateChange={(dragging, target) =>
                    {
                      if (dragging) {
                        setSpacingAnchorBlockId(hoveredBlockId ?? selectedId);
                        setActiveSpacingTarget(target ?? null);
                      }
                      setActiveSpacingSlot(dragging ? index + 1 : null);
                      if (!dragging) {
                        setActiveSpacingTarget(null);
                        void saveDraftSilently();
                      }
                    }
                  }
                  onAdjustSpacing={(delta, target) =>
                    adjustSpacingAt(index + 1, delta, target)
                  }
                  onInsert={() => {
                    setInsertIndex(index + 1);
                    setLeftPanel("library");
                    setLibraryBlock(null);
                  }}
                />
              </div>
            );
            })}
            {displayBlocks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-10 text-center text-sm text-[color:var(--bp-muted)]">
                Добавьте блок, чтобы начать собирать страницу.
              </div>
            )}
            <div
              className={`mt-0 border-t px-4 py-6 ${
                activeTheme.mode === "dark"
                  ? "border-[#1f2937] bg-[#111111]"
                  : "border-[color:var(--bp-stroke)] bg-white"
              }`}
            >
              <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInsertIndex(displayBlocks.length);
                    setLeftPanel("library");
                    setLibraryBlock(null);
                  }}
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    activeTheme.mode === "dark"
                      ? "bg-white text-[#111111]"
                      : "bg-black text-white"
                  }`}
                >
                  Библиотека блоков
                </button>
                {QUICK_BLOCK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => insertBlock(type, displayBlocks.length)}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      activeTheme.mode === "dark"
                        ? "border-[#3f3f46] bg-transparent text-[#e4e4e7]"
                        : "border-[color:var(--bp-stroke)] bg-white text-[color:var(--bp-ink)]"
                    }`}
                  >
                    {BLOCK_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        {leftPanel === "library" && (
          <aside
            className="fixed z-[140] w-[320px] overflow-y-auto border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ left: 0, top: floatingPanelsTop, bottom: 0 }}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="text-sm font-semibold">Библиотека блоков</div>
              <button
                type="button"
                onClick={() => {
                  setLeftPanel(null);
                  setLibraryBlock(null);
                }}
                className="text-xs text-[color:var(--bp-muted)]"
              >
                Закрыть
              </button>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-2">
                {(Object.keys(BLOCK_LABELS) as BlockType[])
                  .filter((type) => !isSystemBlockType(type))
                  .map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLibraryBlock(type)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                      libraryBlock === type
                        ? "border-[color:var(--bp-accent)] bg-white"
                        : "border-[color:var(--bp-stroke)] bg-white"
                    }`}
                  >
                    <span>{BLOCK_LABELS[type]}</span>
                    <span className="text-xs text-[color:var(--bp-muted)]">
                      Варианты
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {leftPanel === "library" && libraryBlock && (
          <aside
            className="fixed z-[140] w-[320px] overflow-y-auto border border-[color:var(--bp-stroke)] bg-white shadow-[var(--bp-shadow)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ left: 320, top: floatingPanelsTop, bottom: 0 }}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="text-sm font-semibold">
                {BLOCK_LABELS[libraryBlock]}
              </div>
              <button
                type="button"
                onClick={() => setLibraryBlock(null)}
                className="text-xs text-[color:var(--bp-muted)]"
              >
                Назад
              </button>
            </div>
            <div className="p-4 space-y-3">
              {BLOCK_VARIANTS[libraryBlock].map((variant) => (
                <button
                  key={variant}
                  type="button"
                  onClick={() => {
                    insertBlock(libraryBlock, insertIndex ?? displayBlocks.length, variant);
                    setLeftPanel(null);
                    setLibraryBlock(null);
                  }}
                  className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-white p-4 text-left"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                    {BLOCK_LABELS[libraryBlock]}
                  </div>
                  <div className="mt-2 text-sm font-semibold">{variantsLabel[variant]}</div>
                  <div className="mt-2 text-xs text-[color:var(--bp-muted)]">
                    Выберите вариант дизайна
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {rightPanel && (
          <button
            type="button"
            aria-label="Закрыть панель"
            className={`fixed inset-0 z-[219] cursor-default bg-transparent transition-opacity duration-[220ms] ease-out ${
              isRightPanelVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{ top: floatingPanelsTop }}
            onClick={requestClosePanel}
          />
        )}

        {rightPanel && (
          <>
            <aside
              className={`fixed z-[220] overflow-y-auto border shadow-[var(--bp-shadow)] transition-all duration-[220ms] ease-out [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                isRightPanelVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
              } ${
                activeTheme.mode === "dark"
                  ? "[&_input]:border-[#2b2b2b] [&_input]:bg-[#121212] [&_input]:text-[#f3f4f6] [&_select]:border-[#2b2b2b] [&_select]:bg-[#121212] [&_select]:text-[#f3f4f6] [&_textarea]:border-[#2b2b2b] [&_textarea]:bg-[#121212] [&_textarea]:text-[#f3f4f6] [&_option]:bg-[#121212] [&_option]:text-[#f3f4f6]"
                  : ""
              }`}
              onClick={() => {
                if (activePanelSectionId !== null || coverDrawerKey !== null) {
                  setActivePanelSectionId(null);
                  setCoverDrawerKey(null);
                }
              }}
              style={{
                top: floatingPanelsTop,
                bottom: 0,
                left: 0,
                width: rightPanel === "content" ? "min(820px, 56vw)" : "360px",
                borderColor: panelTheme.border,
                backgroundColor: panelTheme.surface,
                color: panelTheme.text,
                accentColor: panelTheme.accent,
                colorScheme: activeTheme.mode,
                "--bp-paper": panelTheme.panel,
                "--bp-surface": panelTheme.surface,
                "--bp-stroke": panelTheme.border,
                "--bp-ink": panelTheme.text,
                "--bp-muted": panelTheme.muted,
                "--bp-accent": panelTheme.accent,
                "--bp-save-close": panelTheme.saveClose,
                "--input-bg": activeTheme.mode === "dark" ? "#121212" : "#ffffff",
                "--text": panelTheme.text,
                "--border": panelTheme.border,
                "--muted": panelTheme.muted,
              } as CssVars}
            >
              <div
                className="sticky top-0 z-20 border-b"
                style={{ borderColor: panelTheme.border, backgroundColor: panelTheme.surface }}
              >
                <div className="grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => savePanelDraft(false)}
                    disabled={saving === "public"}
                    className="h-12 px-3 text-xs font-medium whitespace-nowrap text-white disabled:opacity-60"
                    style={{ backgroundColor: panelTheme.save }}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => savePanelDraft(true)}
                    disabled={saving === "public"}
                    className="h-12 px-3 text-xs font-medium whitespace-nowrap text-white disabled:opacity-60"
                    style={{ backgroundColor: panelTheme.saveClose }}
                  >
                    Сохранить и закрыть
                  </button>
                </div>
                <div
                  className="border-t px-4 py-3"
                  style={{ borderColor: panelTheme.border }}
                >
                  <div className="text-sm font-semibold" style={{ color: panelTheme.text }}>
                    {rightPanel === "settings"
                        ? selectedBlock
                          ? `Настройки · ${BLOCK_LABELS[selectedBlock.type]}`
                          : "Настройки блока"
                        : selectedBlock
                          ? `Контент · ${BLOCK_LABELS[selectedBlock.type]}`
                          : "Контент блока"}
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-3 pb-12">
                {rightPanel === "content" && selectedBlock ? (
                  <div className="px-1 pb-8 pt-1">
                    <BlockEditor
                      block={selectedBlock}
                      accountName={account.name}
                      branding={branding}
                      accountProfile={accountProfile}
                      locations={locations}
                      services={services}
                      specialists={specialists}
                      promos={promos}
                      activeSectionId="main"
                      onChange={(next) => updateBlock(selectedBlock.id, () => next)}
                    />
                  </div>
                ) : isCoverSettingsPanel ? (
                  <>
                    <div className="p-0" style={{ backgroundColor: panelTheme.panel }}>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">Ширина блока</div>
                      <div className="relative">
                        <button
                          type="button"
                          ref={coverWidthButtonRef}
                          onClick={() => setCoverWidthModalOpen((prev) => !prev)}
                          className="mt-2 flex w-full items-center justify-between border-b pb-2 text-left text-sm"
                          style={{ borderColor: panelTheme.border }}
                        >
                          <span>{coverGridSpan} колонок</span>
                          <span className="text-sm leading-none">{coverWidthModalOpen ? "▴" : "▾"}</span>
                        </button>
                        {coverWidthModalOpen && (
                          <div
                            ref={coverWidthPopoverRef}
                            className="absolute inset-x-0 top-[calc(100%+8px)] z-[160] rounded-none border px-3 py-4 shadow-2xl"
                            style={{ backgroundColor: panelTheme.panel, borderColor: panelTheme.border }}
                          >
                            <CoverGridWidthControl
                              start={coverGridStart}
                              end={coverGridEnd}
                              onChange={applySelectedCoverGridRange}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="mb-4 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                      Выравнивание
                      <div className="relative mt-2">
                        <select
                          value={coverStyle?.textAlign ?? "left"}
                          onChange={(event) =>
                            updateSelectedCoverStyle({ textAlign: event.target.value as BlockStyle["textAlign"] })
                          }
                          className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                          style={{
                            borderTop: "0",
                            borderLeft: "0",
                            borderRight: "0",
                            borderRadius: "0",
                            boxShadow: "none",
                            backgroundColor: "transparent",
                            WebkitAppearance: "none",
                            MozAppearance: "none",
                            appearance: "none",
                          }}
                        >
                          <option value="left">По левому краю</option>
                          <option value="center">По центру</option>
                          <option value="right">По правому краю</option>
                        </select>
                        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                          ▾
                        </span>
                      </div>
                    </label>

                    <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                      Эффект при скролле
                      <div className="relative mt-2">
                        <select
                          value={coverScrollEffect}
                          onChange={(event) =>
                            updateSelectedCoverData({
                              coverScrollEffect: event.target.value as "none" | "fixed" | "parallax",
                            })
                          }
                          className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                          style={{
                            borderTop: "0",
                            borderLeft: "0",
                            borderRight: "0",
                            borderRadius: "0",
                            boxShadow: "none",
                            backgroundColor: "transparent",
                            WebkitAppearance: "none",
                            MozAppearance: "none",
                            appearance: "none",
                          }}
                        >
                          <option value="none">Без эффекта</option>
                          <option value="fixed">С фиксацией</option>
                          <option value="parallax">Параллакс</option>
                        </select>
                        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                          ▾
                        </span>
                      </div>
                    </label>

                    <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                      Высота
                      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={coverScrollHeightPx}
                          onChange={(event) => {
                            const nextValue = Math.max(
                              0,
                              Number.isFinite(Number(event.target.value))
                                ? Math.round(Number(event.target.value))
                                : 0
                            );
                            updateSelectedCoverData({ coverScrollHeight: `${nextValue}px` });
                          }}
                          className="w-full appearance-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                          style={{ border: 0, boxShadow: "none", WebkitAppearance: "none", MozAppearance: "none" }}
                        />
                        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
                      </div>
                    </label>

                    <div className="mb-3 grid grid-cols-2 gap-4">
                      <TildaInlineColorField
                        compact
                        label="Цвет фильтра в начале"
                        value={coverFilterStartColor}
                        onChange={(value) => updateSelectedCoverData({ coverFilterStartColor: value })}
                        onClear={() => updateSelectedCoverData({ coverFilterStartColor: "transparent" })}
                        placeholder="#000000"
                      />
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                        <div className="min-h-[32px] leading-4">Непрозрачность</div>
                        <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                          <select
                            value={String(Math.round(coverFilterStartOpacity))}
                            onChange={(event) =>
                              updateSelectedCoverData({
                                coverFilterStartOpacity: Number(event.target.value),
                              })
                            }
                            className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                            style={{
                              borderTop: 0,
                              borderLeft: 0,
                              borderRight: 0,
                              borderBottom: 0,
                              borderRadius: 0,
                              boxShadow: "none",
                              backgroundColor: "transparent",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              appearance: "none",
                            }}
                          >
                            {Array.from({ length: 11 }, (_, i) => i * 10).map((value) => (
                              <option key={`start-opacity-${value}`} value={value}>
                                {value}%
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                            ▾
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-4">
                      <TildaInlineColorField
                        compact
                        label="Цвет фильтра в конце"
                        value={coverFilterEndColor}
                        onChange={(value) => updateSelectedCoverData({ coverFilterEndColor: value })}
                        onClear={() => updateSelectedCoverData({ coverFilterEndColor: "transparent" })}
                        placeholder="#0f0f0f"
                      />
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                        <div className="min-h-[32px] leading-4">Непрозрачность</div>
                        <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                          <select
                            value={String(Math.round(coverFilterEndOpacity))}
                            onChange={(event) =>
                              updateSelectedCoverData({
                                coverFilterEndOpacity: Number(event.target.value),
                              })
                            }
                            className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                            style={{
                              borderTop: 0,
                              borderLeft: 0,
                              borderRight: 0,
                              borderBottom: 0,
                              borderRadius: 0,
                              boxShadow: "none",
                              backgroundColor: "transparent",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              appearance: "none",
                            }}
                          >
                            {Array.from({ length: 11 }, (_, i) => i * 10).map((value) => (
                              <option key={`end-opacity-${value}`} value={value}>
                                {value}%
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                            ▾
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-4">
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                        <div className="min-h-[32px] leading-4">Стрелка</div>
                        <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
                          <select
                            value={coverArrow}
                            onChange={(event) =>
                              updateSelectedCoverData({
                                coverArrow: event.target.value as "none" | "down",
                              })
                            }
                            className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                            style={{
                              borderTop: 0,
                              borderLeft: 0,
                              borderRight: 0,
                              borderBottom: 0,
                              borderRadius: 0,
                              boxShadow: "none",
                              backgroundColor: "transparent",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              appearance: "none",
                            }}
                          >
                            <option value="none">Нет</option>
                            <option value="down">Вниз</option>
                          </select>
                          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                            ▾
                          </span>
                        </div>
                      </label>
                      <TildaInlineColorField
                        compact
                        label="Цвет стрелки"
                        value={coverArrowColor}
                        onChange={(value) => updateSelectedCoverData({ coverArrowColor: value })}
                        onClear={() => updateSelectedCoverData({ coverArrowColor: "transparent" })}
                        placeholder="#ffffff"
                      />
                    </div>

                    <label className="mb-3 mt-2 flex items-center gap-2 text-sm font-normal normal-case tracking-normal text-[color:var(--bp-ink)]">
                      <input
                        type="checkbox"
                        checked={coverArrowAnimated}
                        onChange={(event) =>
                          updateSelectedCoverData({ coverArrowAnimated: event.target.checked })
                        }
                      />
                      Анимировать стрелку
                    </label>

                    {[
                      { id: "typography", label: "Типографика" },
                      { id: "button", label: "Кнопка" },
                      { id: "animation", label: "Анимация" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCoverDrawerKey((prev) =>
                            prev === item.id
                              ? null
                              : (item.id as "typography" | "button" | "animation")
                          );
                        }}
                        className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
                        style={{
                          borderColor: coverDrawerKey === item.id ? "#f29a75" : panelTheme.border,
                          backgroundColor: panelTheme.panel,
                          color: coverDrawerKey === item.id ? panelTheme.text : panelTheme.muted,
                        }}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs">{coverDrawerKey === item.id ? "‹" : "›"}</span>
                      </button>
                    ))}

                    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                      Позиционирование изображения
                      <div className="relative mt-2">
                        <select
                          value={coverBackgroundPosition}
                          onChange={(event) =>
                            updateSelectedCoverData({
                              coverBackgroundPosition: event.target.value,
                            })
                          }
                          className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent py-1 pr-6 text-sm font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                          style={{
                            borderTop: "0",
                            borderLeft: "0",
                            borderRight: "0",
                            borderRadius: "0",
                            boxShadow: "none",
                            backgroundColor: "transparent",
                            WebkitAppearance: "none",
                            MozAppearance: "none",
                            appearance: "none",
                          }}
                        >
                          {COVER_BACKGROUND_POSITION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                          ▾
                        </span>
                      </div>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                        Отступ сверху
                        <div className="relative mt-2">
                          <select
                            value={String(coverMarginTopLines)}
                            onChange={(event) =>
                              updateSelectedCoverStyle({
                                marginTop: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                              })
                            }
                            className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                            style={{
                              borderTop: "0",
                              borderLeft: "0",
                              borderRight: "0",
                              borderRadius: "0",
                              boxShadow: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              appearance: "none",
                            }}
                          >
                            {COVER_LINE_OPTIONS.map((lineValue) => (
                              <option key={`top-${lineValue}`} value={lineValue}>
                                {formatCoverLineLabel(lineValue)}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                            ▾
                          </span>
                        </div>
                      </label>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                        Отступ снизу
                        <div className="relative mt-2">
                          <select
                            value={String(coverMarginBottomLines)}
                            onChange={(event) =>
                              updateSelectedCoverStyle({
                                marginBottom: Math.round(Number(event.target.value) * COVER_LINE_STEP_PX),
                              })
                            }
                            className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                            style={{
                              borderTop: "0",
                              borderLeft: "0",
                              borderRight: "0",
                              borderRadius: "0",
                              boxShadow: "none",
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                              appearance: "none",
                            }}
                          >
                            {COVER_LINE_OPTIONS.map((lineValue) => (
                              <option key={`bottom-${lineValue}`} value={lineValue}>
                                {formatCoverLineLabel(lineValue)}
                              </option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                            ▾
                          </span>
                        </div>
                      </label>
                    </div>
                    <TildaBackgroundColorField
                      label="Цвет фона для всего блока"
                      value={String(coverStyle?.sectionBgLight ?? coverStyle?.sectionBg ?? "")}
                      mode={coverBackgroundMode}
                      secondValue={coverBackgroundTo}
                      angle={coverBackgroundAngle}
                      radialStopA={coverBackgroundStopA}
                      radialStopB={coverBackgroundStopB}
                      placeholder="#ffffff"
                      onModeChange={(mode) => updateSelectedCoverData({ coverBackgroundMode: mode })}
                      onSecondChange={(value) =>
                        updateSelectedCoverData({ coverBackgroundTo: value })
                      }
                      onAngleChange={(value) =>
                        updateSelectedCoverData({ coverBackgroundAngle: value })
                      }
                      onRadialStopAChange={(value) =>
                        updateSelectedCoverData({ coverBackgroundStopA: value })
                      }
                      onRadialStopBChange={(value) =>
                        updateSelectedCoverData({ coverBackgroundStopB: value })
                      }
                      onChange={(value) => {
                        updateSelectedCoverStyle({
                          sectionBgLight: value,
                          sectionBgDark: value,
                          sectionBg: value,
                          blockBgLight: value,
                          blockBgDark: value,
                          blockBg: value,
                        });
                        updateSelectedCoverData({ coverBackgroundFrom: value });
                      }}
                    />
                  </>
                ) : selectedBlock?.type === "menu" ? (
                  <div className="space-y-6" onClick={(event) => event.stopPropagation()}>
                    {(() => {
                      const data = (selectedBlock.data as Record<string, unknown>) ?? {};
                      const style = normalizeBlockStyle(selectedBlock, activeTheme);
                      const menuHeightRaw = Number(data.menuHeight);
                      const menuHeightMin = selectedBlock.variant === "v1" ? 40 : 30;
                      const menuHeight =
                        Number.isFinite(menuHeightRaw) &&
                        menuHeightRaw >= menuHeightMin &&
                        menuHeightRaw <= 96
                          ? Math.round(menuHeightRaw)
                          : selectedBlock.variant === "v1"
                            ? 64
                            : 56;

                      const applyMenuHeight = (value: number) => {
                        updateBlock(selectedBlock.id, (prev) => ({
                          ...prev,
                          data: {
                            ...(prev.data as Record<string, unknown>),
                            menuHeight: value,
                          },
                        }));
                      };

                      const menuMarginTopLines = Math.max(
                        0,
                        Math.min(7, Math.round((style.marginTop / COVER_LINE_STEP_PX) * 2) / 2)
                      );
                      const menuMarginBottomLines = Math.max(
                        0,
                        Math.min(7, Math.round((style.marginBottom / COVER_LINE_STEP_PX) * 2) / 2)
                      );

                      return (
                        <>
                          <div className="space-y-6">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                                Высота меню
                              </div>
                              <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
                                {menuHeight}px
                              </div>
                              <div className="mt-3">
                                <SliderTrack
                                  label="Высота меню"
                                  value={menuHeight}
                                  min={menuHeightMin}
                                  max={96}
                                  onChange={applyMenuHeight}
                                  accentColor={panelTheme.saveClose}
                                  railColor={panelTheme.border}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                                  Радиус блока
                                </div>
                                <div className="mt-2 text-sm">0px</div>
                              </div>
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                                  Радиус кнопки
                                </div>
                                <div className="mt-2 text-sm">0px</div>
                              </div>
                            </div>

                            <div className="text-sm text-[color:var(--bp-muted)]">
                              Ширина блока: 12/12 (фиксировано для меню)
                            </div>
                          </div>

                          <div className="space-y-3">
                            {currentPanelSections
                              .filter((section) => section.id === "colors" || section.id === "typography")
                              .map((section) => (
                                <button
                                  key={section.id}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActivePanelSectionId((prev) =>
                                      prev === section.id ? null : section.id
                                    );
                                  }}
                                  className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
                                  style={{
                                    borderColor:
                                      activePanelSectionId === section.id
                                        ? panelTheme.accent
                                        : panelTheme.border,
                                    backgroundColor: panelTheme.panel,
                                    color:
                                      activePanelSectionId === section.id
                                        ? panelTheme.text
                                        : panelTheme.muted,
                                  }}
                                >
                                  <span>{section.label}</span>
                                  <span className="text-xs">›</span>
                                </button>
                              ))}
                          </div>

                          <div className="space-y-3 pt-1">
                            <div className="text-sm text-[color:var(--bp-muted)]">
                              Ширина блока: 12/12 (фиксировано для меню)
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                                Отступ сверху
                                <div className="relative mt-2">
                                  <select
                                    value={String(menuMarginTopLines)}
                                    onChange={(event) =>
                                      updateBlock(selectedBlock.id, (prev) =>
                                        updateBlockStyle(prev, {
                                          marginTop: Math.round(
                                            Number(event.target.value) * COVER_LINE_STEP_PX
                                          ),
                                        })
                                      )
                                    }
                                    className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                                    style={{
                                      borderTop: "0",
                                      borderLeft: "0",
                                      borderRight: "0",
                                      borderRadius: "0",
                                      boxShadow: "none",
                                      WebkitAppearance: "none",
                                      MozAppearance: "none",
                                      appearance: "none",
                                    }}
                                  >
                                    {COVER_LINE_OPTIONS.map((lineValue) => (
                                      <option key={`menu-top-main-${lineValue}`} value={lineValue}>
                                        {formatCoverLineLabel(lineValue)}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                                    ▾
                                  </span>
                                </div>
                              </label>
                              <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                                Отступ снизу
                                <div className="relative mt-2">
                                  <select
                                    value={String(menuMarginBottomLines)}
                                    onChange={(event) =>
                                      updateBlock(selectedBlock.id, (prev) =>
                                        updateBlockStyle(prev, {
                                          marginBottom: Math.round(
                                            Number(event.target.value) * COVER_LINE_STEP_PX
                                          ),
                                        })
                                      )
                                    }
                                    className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                                    style={{
                                      borderTop: "0",
                                      borderLeft: "0",
                                      borderRight: "0",
                                      borderRadius: "0",
                                      boxShadow: "none",
                                      WebkitAppearance: "none",
                                      MozAppearance: "none",
                                      appearance: "none",
                                    }}
                                  >
                                    {COVER_LINE_OPTIONS.map((lineValue) => (
                                      <option
                                        key={`menu-bottom-main-${lineValue}`}
                                        value={lineValue}
                                      >
                                        {formatCoverLineLabel(lineValue)}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                                    ▾
                                  </span>
                                </div>
                              </label>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  currentPanelSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActivePanelSectionId((prev) =>
                          prev === section.id ? null : section.id
                        );
                      }}
                      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition"
                      style={{
                        borderColor:
                          activePanelSectionId === section.id
                            ? panelTheme.accent
                            : panelTheme.border,
                        backgroundColor: panelTheme.panel,
                        color:
                          activePanelSectionId === section.id
                            ? panelTheme.text
                            : panelTheme.muted,
                      }}
                    >
                      <span>{section.label}</span>
                      <span className="text-xs">›</span>
                    </button>
                  ))
                )}
              </div>
            </aside>

            {(rightPanel === "settings" &&
              ((!isCoverSettingsPanel && activePanelSectionId && selectedBlock) ||
                (isCoverSettingsPanel && coverDrawerKey && selectedBlock))) && (
              <aside
                className={`fixed z-[221] w-[440px] max-w-[calc(100vw-372px)] overflow-y-auto border-l border-r shadow-[var(--bp-shadow)] transition-all duration-[220ms] ease-out [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                  isRightPanelVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
                } ${
                  activeTheme.mode === "dark"
                    ? "[&_input]:border-[#2b2b2b] [&_input]:bg-[#121212] [&_input]:text-[#f3f4f6] [&_select]:border-[#2b2b2b] [&_select]:bg-[#121212] [&_select]:text-[#f3f4f6] [&_textarea]:border-[#2b2b2b] [&_textarea]:bg-[#121212] [&_textarea]:text-[#f3f4f6] [&_option]:bg-[#121212] [&_option]:text-[#f3f4f6]"
                    : ""
                }`}
                style={{
                  top: floatingPanelsTop,
                  bottom: 0,
                  left: 360,
                  borderColor: panelTheme.border,
                  backgroundColor: panelTheme.panel,
                  color: panelTheme.text,
                  accentColor: panelTheme.accent,
                  colorScheme: activeTheme.mode,
                }}
              >
                <div
                  className="sticky top-0 z-20 flex h-12 items-center justify-between border-b px-4"
                  style={{ borderColor: panelTheme.border, backgroundColor: panelTheme.surface }}
                >
                  <div className="w-8" />
                  <div className="text-sm font-semibold">
                    {isCoverSettingsPanel
                      ? (coverDrawerKey === "typography"
                          ? "Типографика"
                          : coverDrawerKey === "button"
                            ? "Кнопка"
                            : "Анимация")
                      : currentPanelSections.find((section) => section.id === activePanelSectionId)?.label}
                  </div>
                  <div className="w-8" />
                </div>
                <div
                  className={`h-full p-4 ${
                    rightPanel === "settings" && isCoverSettingsPanel && coverDrawerKey === "typography"
                      ? "pb-20"
                      : ""
                  }`}
                  style={{
                    backgroundColor: panelTheme.panel,
                    color: panelTheme.text,
                  }}
                >
                  {rightPanel === "settings" && !isCoverSettingsPanel && (
                    <BlockStyleEditor
                      block={selectedBlock}
                      theme={activeTheme}
                      activeSectionId={activePanelSectionId ?? ""}
                      onChange={(next) => updateBlock(selectedBlock.id, () => next)}
                    />
                  )}
                  {rightPanel === "settings" && isCoverSettingsPanel && coverDrawerKey === "typography" && (
                    <BlockStyleEditor
                      block={selectedBlock}
                      theme={activeTheme}
                      activeSectionId="typography"
                      onChange={(next) => updateBlock(selectedBlock.id, () => next)}
                    />
                  )}
                  {rightPanel === "settings" && isCoverSettingsPanel && coverDrawerKey === "button" && (
                    <div className="space-y-4 pb-10">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                        Первая кнопка
                      </div>
                      {renderCoverFlatTextInput(
                        "Текст кнопки",
                        String((selectedBlock.data as Record<string, unknown>).buttonText ?? "Записаться"),
                        (value) => updateSelectedCoverData({ buttonText: value })
                      )}
                      <TildaInlineColorField
                        compact
                        label="Цвет кнопки"
                        value={coverStyle?.buttonColorLight || coverStyle?.buttonColor || activeTheme.buttonColor}
                        onChange={(value) => updateSelectedCoverStyle({ buttonColor: value, buttonColorLight: value })}
                        onClear={() => updateSelectedCoverStyle({ buttonColor: "", buttonColorLight: "" })}
                        placeholder="#111827"
                      />
                      <TildaInlineColorField
                        compact
                        label="Текст кнопки"
                        value={coverStyle?.buttonTextColorLight || coverStyle?.buttonTextColor || activeTheme.buttonTextColor}
                        onChange={(value) => updateSelectedCoverStyle({ buttonTextColor: value, buttonTextColorLight: value })}
                        onClear={() => updateSelectedCoverStyle({ buttonTextColor: "", buttonTextColorLight: "" })}
                        placeholder="#ffffff"
                      />
                      <TildaInlineColorField
                        compact
                        label="Контур кнопки"
                        value={coverPrimaryButtonBorderColor}
                        onChange={(value) => updateSelectedCoverData({ coverPrimaryButtonBorderColor: value })}
                        onClear={() => updateSelectedCoverData({ coverPrimaryButtonBorderColor: "transparent" })}
                        placeholder="#ffffff"
                      />
                      {renderCoverFlatNumberInput(
                        "Скругление",
                        coverStyle?.buttonRadius ?? activeTheme.buttonRadius,
                        0,
                        80,
                        (value) => updateSelectedCoverStyle({ buttonRadius: value })
                      )}
                      {coverShowSecondaryButton && (
                        <>
                          <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                            Вторая кнопка
                          </div>
                          {renderCoverFlatTextInput(
                            "Текст второй кнопки",
                            String((selectedBlock.data as Record<string, unknown>).secondaryButtonText ?? "Наши соцсети"),
                            (value) => updateSelectedCoverData({ secondaryButtonText: value })
                          )}
                          <TildaInlineColorField
                            compact
                            label="Цвет второй кнопки"
                            value={coverSecondaryButtonColor}
                            onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonColor: value })}
                            onClear={() => updateSelectedCoverData({ coverSecondaryButtonColor: "transparent" })}
                            placeholder="#ffffff"
                          />
                          <TildaInlineColorField
                            compact
                            label="Текст второй кнопки"
                            value={coverSecondaryButtonTextColor}
                            onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonTextColor: value })}
                            onClear={() => updateSelectedCoverData({ coverSecondaryButtonTextColor: "transparent" })}
                            placeholder="#ffffff"
                          />
                          <TildaInlineColorField
                            compact
                            label="Контур второй кнопки"
                            value={coverSecondaryButtonBorderColor}
                            onChange={(value) => updateSelectedCoverData({ coverSecondaryButtonBorderColor: value })}
                            onClear={() => updateSelectedCoverData({ coverSecondaryButtonBorderColor: "transparent" })}
                            placeholder="#ffffff"
                          />
                          {renderCoverFlatNumberInput(
                            "Скругление второй кнопки",
                            coverSecondaryButtonRadius,
                            0,
                            80,
                            (value) => updateSelectedCoverData({ coverSecondaryButtonRadius: value })
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {rightPanel === "settings" && isCoverSettingsPanel && coverDrawerKey === "animation" && (
                    <div className="space-y-4">
                      <div className="text-xs text-[color:var(--bp-muted)]">Работает на опубликованных страницах или в режиме предпросмотра.</div>
                      <label className="text-sm">
                        Анимация: заголовок
                        <select
                          value={String((selectedBlock.data as Record<string, unknown>).animHeading ?? "none")}
                          onChange={(event) => updateSelectedCoverData({ animHeading: event.target.value })}
                          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                        >
                          <option value="none">Нет</option>
                          <option value="fade-up">Прозрачность (снизу)</option>
                          <option value="fade-down">Прозрачность (сверху)</option>
                          <option value="fade-left">Прозрачность (слева)</option>
                          <option value="fade-right">Прозрачность (справа)</option>
                          <option value="zoom-in">Прозрачность (увеличение)</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Анимация: описание
                        <select
                          value={String((selectedBlock.data as Record<string, unknown>).animDescription ?? "none")}
                          onChange={(event) => updateSelectedCoverData({ animDescription: event.target.value })}
                          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                        >
                          <option value="none">Нет</option>
                          <option value="fade-up">Прозрачность (снизу)</option>
                          <option value="fade-down">Прозрачность (сверху)</option>
                          <option value="fade-left">Прозрачность (слева)</option>
                          <option value="fade-right">Прозрачность (справа)</option>
                          <option value="zoom-in">Прозрачность (увеличение)</option>
                        </select>
                      </label>
                      <label className="text-sm">
                        Анимация: кнопка
                        <select
                          value={String((selectedBlock.data as Record<string, unknown>).animButton ?? "none")}
                          onChange={(event) => updateSelectedCoverData({ animButton: event.target.value })}
                          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                        >
                          <option value="none">Нет</option>
                          <option value="fade-up">Прозрачность (снизу)</option>
                          <option value="fade-down">Прозрачность (сверху)</option>
                          <option value="fade-left">Прозрачность (слева)</option>
                          <option value="fade-right">Прозрачность (справа)</option>
                          <option value="zoom-in">Прозрачность (увеличение)</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </>
        )}

        {showPanelExitConfirm && rightPanel && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/30 p-4">
            <div
              className="w-full max-w-[520px] rounded-xl border p-6 shadow-2xl"
              style={{
                backgroundColor: panelTheme.panel,
                borderColor: panelTheme.border,
                color: panelTheme.text,
              }}
            >
              <h3 className="text-xl font-semibold">Панель не сохранена</h3>
              <p className="mt-3 text-sm" style={{ color: panelTheme.muted }}>
                В текущей панели есть изменения. Закрыть её сейчас без сохранения?
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPanelExitConfirm(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{
                    borderColor: panelTheme.border,
                    backgroundColor: panelTheme.panel,
                    color: panelTheme.text,
                  }}
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={closePanelWithoutSave}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: panelTheme.saveClose }}
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingDeleteBlockId && (
          <div className="fixed inset-0 z-[261] flex items-center justify-center bg-black/30 p-4">
            <div
              className="w-full max-w-[520px] rounded-xl border p-6 shadow-2xl"
              style={{
                backgroundColor: panelTheme.panel,
                borderColor: panelTheme.border,
                color: panelTheme.text,
              }}
            >
              <h3 className="text-xl font-semibold">
                {pendingDeleteBlock
                  ? `Вы уверены, что хотите удалить блок «${BLOCK_LABELS[pendingDeleteBlock.type]}»?`
                  : "Вы уверены, что хотите удалить блок?"}
              </h3>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingDeleteBlockId(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{
                    borderColor: panelTheme.border,
                    backgroundColor: panelTheme.panel,
                    color: panelTheme.text,
                  }}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveBlock}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: "#dc2626" }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          aria-label="Помощь"
          title="Помощь"
          className="fixed right-6 bottom-6 z-[141] inline-flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-[#ff8f73] text-3xl leading-none text-white shadow-[var(--bp-shadow)] transition hover:brightness-95"
        >
          ?
        </button>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  placeholder,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) {
    const EMPTY_COLOR_LABEL = "Цвет не выбран";
    const normalized = value?.trim() ?? "";
    const isTransparent = normalized.toLowerCase() === "transparent";
    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
    const placeholderValue = typeof placeholder === "string" ? placeholder : "";
    const placeholderHex =
      typeof placeholderValue === "string" &&
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(placeholderValue)
        ? placeholderValue
        : "";
    const displayValue = isTransparent
      ? EMPTY_COLOR_LABEL
      : normalized === ""
        ? placeholderValue || "#ffffff"
        : normalized;
    const colorValue = isHex
      ? normalized
      : isTransparent
        ? "#ffffff"
        : placeholderHex || "#ffffff";
  return (
    <label className="text-sm">
      {label}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2">
        <input
          type="color"
          value={colorValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-6 rounded"
        />
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const lowered = next.trim().toLowerCase();
            if (lowered === "transparent" || lowered === EMPTY_COLOR_LABEL.toLowerCase()) {
              onChange("transparent");
              return;
            }
            if (next.trim() === "") {
              onChange("transparent");
              return;
            }
            onChange(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-[color:var(--bp-ink)] outline-none selection:bg-[color:var(--bp-accent)] selection:text-[color:var(--bp-paper)]"
        />
      </div>
    </label>
  );
}

function TildaInlineColorField({
  label,
  value,
  onChange,
  onClear,
  placeholder = "#ffffff",
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const EMPTY_COLOR_LABEL = "Цвет не выбран";
  const normalized = value?.trim() ?? "";
  const isTransparent = normalized.toLowerCase() === "transparent";
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
  const displayValue = isTransparent ? EMPTY_COLOR_LABEL : normalized || placeholder;
  const colorValue = isHex ? normalized : placeholder;
  const transparencyPattern = {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)",
    backgroundPosition: "0 0, 4px 4px",
    backgroundSize: "8px 8px",
  } as const;
  return (
    <label className={`${compact ? "" : "mb-3 "}block`}>
      <div className="min-h-[32px] text-[11px] font-semibold uppercase tracking-[0.15em] leading-4 text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]">
          <div
            className="absolute inset-[2px] rounded-full"
            style={isTransparent ? transparencyPattern : { backgroundColor: colorValue }}
          />
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const lowered = next.trim().toLowerCase();
            if (lowered === "transparent" || lowered === EMPTY_COLOR_LABEL.toLowerCase()) {
              onChange("transparent");
              return;
            }
            if (next.trim() === "") {
              onChange("transparent");
              return;
            }
            onChange(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full appearance-none rounded-none border-0 bg-transparent p-0 text-sm text-[color:var(--bp-muted)] font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
            aria-label="Сбросить цвет"
            title="Сбросить цвет"
          >
            ×
          </button>
        )}
      </div>
    </label>
  );
}

function TildaBackgroundColorField({
  label,
  value,
  mode = "solid",
  secondValue = "",
  angle = 135,
  radialStopA = 0,
  radialStopB = 100,
  onModeChange,
  onSecondChange,
  onAngleChange,
  onRadialStopAChange,
  onRadialStopBChange,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  mode?: CoverBackgroundMode;
  secondValue?: string;
  angle?: number;
  radialStopA?: number;
  radialStopB?: number;
  onModeChange?: (value: CoverBackgroundMode) => void;
  onSecondChange?: (value: string) => void;
  onAngleChange?: (value: number) => void;
  onRadialStopAChange?: (value: number) => void;
  onRadialStopBChange?: (value: number) => void;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const EMPTY_COLOR_LABEL = "Цвет не выбран";
  const normalized = value?.trim() ?? "";
  const isTransparent = normalized.toLowerCase() === "transparent";
  const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized);
  const placeholderValue = typeof placeholder === "string" ? placeholder : "";
  const placeholderHex =
    typeof placeholderValue === "string" &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(placeholderValue)
      ? placeholderValue
      : "";
  const displayValue = isTransparent
    ? EMPTY_COLOR_LABEL
    : normalized === ""
      ? placeholderValue || "#ffffff"
      : normalized;
  const colorValue = isHex
    ? normalized
    : isTransparent
      ? "#ffffff"
      : placeholderHex || "#ffffff";
  const normalizedSecond = secondValue?.trim() ?? "";
  const secondIsHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedSecond);
  const secondColorValue = secondIsHex ? normalizedSecond : colorValue;
  const secondIsTransparent = normalizedSecond.toLowerCase() === "transparent";
  const transparencyPattern = {
    backgroundColor: "#ffffff",
    backgroundImage:
      "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb)",
    backgroundPosition: "0 0, 4px 4px",
    backgroundSize: "8px 8px",
  } as const;
  const radialStopAPct = Math.max(0, Math.min(100, Math.round(radialStopA)));
  const radialStopBPct = Math.max(0, Math.min(100, Math.round(radialStopB)));
  const leftPct = Math.min(radialStopAPct, radialStopBPct);
  const rightPct = Math.max(radialStopAPct, radialStopBPct);
  const leftColor = radialStopAPct <= radialStopBPct ? colorValue : secondColorValue;
  const rightColor = radialStopAPct <= radialStopBPct ? secondColorValue : colorValue;
  const radialTrackRef = useRef<HTMLDivElement | null>(null);
  const radialDragRef = useRef<"stopA" | "stopB" | null>(null);
  const [activeRadialThumb, setActiveRadialThumb] = useState<"stopA" | "stopB" | null>(null);

  const clampPct = (value: number) => Math.max(0, Math.min(100, value));
  const resolvePercentFromClientX = (clientX: number) => {
    const rect = radialTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return clampPct(((clientX - rect.left) / rect.width) * 100);
  };
  const applyRadialPercent = (target: "stopA" | "stopB", percent: number) => {
    const nextPercent = clampPct(percent);
    if (target === "stopA") {
      onRadialStopAChange?.(Math.round(nextPercent));
      return;
    }
    onRadialStopBChange?.(Math.round(nextPercent));
  };
  const startRadialDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    forcedTarget?: "stopA" | "stopB"
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const startPercent = resolvePercentFromClientX(event.clientX);
    const target =
      forcedTarget ??
      (Math.abs(startPercent - radialStopAPct) <= Math.abs(startPercent - radialStopBPct)
        ? "stopA"
        : "stopB");
    radialDragRef.current = target;
    setActiveRadialThumb(target);
    applyRadialPercent(target, startPercent);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }
    const handleMove = (nextEvent: PointerEvent) => {
      const dragTarget = radialDragRef.current;
      if (!dragTarget) return;
      const nextPercent = resolvePercentFromClientX(nextEvent.clientX);
      applyRadialPercent(dragTarget, nextPercent);
    };
    const handleUp = () => {
      radialDragRef.current = null;
      setActiveRadialThumb(null);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={mode}
          onChange={(event) => onModeChange?.(event.target.value as CoverBackgroundMode)}
          className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-sm normal-case tracking-normal shadow-none outline-none focus:ring-0"
          style={{
            borderTop: "0",
            borderLeft: "0",
            borderRight: "0",
            borderRadius: "0",
            boxShadow: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        >
          <option value="solid">Сплошной цвет</option>
          <option value="linear">Линейный градиент</option>
          <option value="radial">Радиальный градиент</option>
        </select>
        <span className="pointer-events-none text-sm leading-none text-[color:var(--bp-muted)]">▾</span>
      </div>
      <div className="mt-2 flex items-center gap-2 bg-[color:var(--bp-paper)]">
        <div
          className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]"
          style={isTransparent ? transparencyPattern : { backgroundColor: "var(--bp-paper)" }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: isTransparent ? "transparent" : colorValue }}
          />
          <input
            type="color"
            value={colorValue}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <input
          type="text"
          value={displayValue}
          onChange={(event) => {
            const next = event.target.value;
            const lowered = next.trim().toLowerCase();
            if (lowered === "transparent" || lowered === EMPTY_COLOR_LABEL.toLowerCase()) {
              onChange("transparent");
              return;
            }
            if (next.trim() === "") {
              onChange("transparent");
              return;
            }
            onChange(next);
          }}
          onFocus={(event) => event.currentTarget.select()}
          placeholder={placeholder}
          className="w-full appearance-none border-0 bg-[color:var(--bp-paper)] px-0 py-1 text-sm text-[color:var(--bp-muted)] shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{ border: 0, boxShadow: "none" }}
        />
        <button
          type="button"
          onClick={() => onChange("transparent")}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
          aria-label="Сбросить цвет"
          title="Сбросить цвет"
        >
          ×
        </button>
      </div>
      {mode !== "solid" && (
        <div className="mt-2 flex items-center gap-2 bg-[color:var(--bp-paper)]">
          <div
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[color:var(--bp-stroke)]"
            style={secondIsTransparent ? transparencyPattern : { backgroundColor: "var(--bp-paper)" }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundColor: secondIsTransparent ? "transparent" : secondColorValue }}
            />
            <input
              type="color"
              value={secondColorValue}
              onChange={(event) => onSecondChange?.(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
          <input
            type="text"
            value={normalizedSecond || secondColorValue}
            onChange={(event) => onSecondChange?.(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder={placeholder}
            className="w-full appearance-none border-0 bg-[color:var(--bp-paper)] px-0 py-1 text-sm text-[color:var(--bp-muted)] shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
            style={{ border: 0, boxShadow: "none" }}
          />
          <button
            type="button"
            onClick={() => onSecondChange?.(colorValue)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-base leading-none text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
            aria-label="Сбросить второй цвет"
            title="Сбросить второй цвет"
          >
            ×
          </button>
        </div>
      )}
      {mode === "linear" && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-[color:var(--bp-muted)]">Угол {Math.round(angle)}</div>
          <div className="relative h-5">
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
            <div
              className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, (Math.round(angle) / 360) * 100))}%`,
                backgroundColor: "#ff5a5f",
              }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
              style={{
                left: `${Math.max(0, Math.min(100, (Math.round(angle) / 360) * 100))}%`,
                backgroundColor: "#ff5a5f",
              }}
            />
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.round(angle)}
              onChange={(event) => onAngleChange?.(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </div>
      )}
      {mode === "radial" && (
        <div className="mt-2">
          <div className="mb-1 text-xs text-[color:var(--bp-muted)]">
            Цвет 1: {radialStopAPct}% · Цвет 2: {radialStopBPct}%
          </div>
          <div
            ref={radialTrackRef}
            className="relative h-6 cursor-pointer touch-none"
            onPointerDown={(event) => startRadialDrag(event)}
          >
            <div
              className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
              style={{
                background: `linear-gradient(to right, ${leftColor} 0%, ${leftColor} ${leftPct}%, ${rightColor} ${rightPct}%, ${rightColor} 100%)`,
              }}
            />
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white shadow-sm ${
                activeRadialThumb === "stopA" ? "border-[#2563eb]" : "border-white"
              }`}
              style={{ left: `${radialStopAPct}%`, backgroundColor: colorValue }}
              onPointerDown={(event) => startRadialDrag(event, "stopA")}
            />
            <div
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white shadow-sm ${
                activeRadialThumb === "stopB" ? "border-[#2563eb]" : "border-white"
              }`}
              style={{ left: `${radialStopBPct}%`, backgroundColor: secondColorValue }}
              onPointerDown={(event) => startRadialDrag(event, "stopB")}
            />
          </div>
        </div>
      )}
      <div className="mt-1 border-b border-[color:var(--bp-stroke)]" />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2 text-sm"
      />
    </label>
  );
}

function CoverGridWidthControl({
  start,
  end,
  onChange,
  compact = false,
}: {
  start: number;
  end: number;
  onChange: (nextStart: number, nextEnd: number) => void;
  compact?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const span = Math.max(1, end - start + 1);

  const columnFromClientX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return start;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const column = Math.round(ratio * (GRID_MAX_COLUMN - GRID_MIN_COLUMN)) + GRID_MIN_COLUMN;
    return clampGridColumn(column);
  }, [start]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event: PointerEvent) => {
      const nextColumn = columnFromClientX(event.clientX);
      if (dragging === "start") {
        onChange(Math.min(nextColumn, end), end);
        return;
      }
      onChange(start, Math.max(nextColumn, start));
    };
    const handleUp = () => setDragging(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [columnFromClientX, dragging, onChange, start, end]);

  const startCenterPercent = ((start - 0.5) / MAX_BLOCK_COLUMNS) * 100;
  const endCenterPercent = ((end - 0.5) / MAX_BLOCK_COLUMNS) * 100;

  return (
    <div className={`${compact ? "" : "rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3"}`}>
      {!compact ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
            Ширина блока
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>{span} колонок</span>
            <select
              value={String(span)}
              onChange={(event) => {
                const nextSpan = Math.max(1, Math.min(12, Number(event.target.value)));
                const centered = centeredGridRange(nextSpan);
                onChange(centered.start, centered.end);
              }}
              className="rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-2 py-1 text-sm"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : null}

      <div
        ref={trackRef}
        className={`relative ${compact ? "mt-0" : "mt-3"}`}
      >
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 12 }, (_, index) => {
            const col = index + 1;
            const selected = col >= start && col <= end;
            return (
              <div
                key={col}
                className={`${compact ? "h-14" : "h-12"} rounded-sm ${
                  selected ? "bg-[#ff5a5f]" : "bg-[#c6cbd3]"
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Левая граница"
          className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ca3af] bg-white shadow"
          style={{ left: `${startCenterPercent}%` }}
          onPointerDown={(event) => {
            event.preventDefault();
            setDragging("start");
          }}
        />
        <button
          type="button"
          aria-label="Правая граница"
          className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9ca3af] bg-white shadow"
          style={{ left: `${endCenterPercent}%` }}
          onPointerDown={(event) => {
            event.preventDefault();
            setDragging("end");
          }}
        />
      </div>
    </div>
  );
}

function BlockEditor({
  block,
  accountName,
  branding,
  accountProfile,
  locations,
  services,
  specialists,
  promos,
  activeSectionId,
  onChange,
}: {
  block: SiteBlock;
  accountName: string;
  branding: Branding;
  accountProfile: AccountProfile;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  promos: PromoItem[];
  activeSectionId: string;
  onChange: (next: SiteBlock) => void;
}) {
  type SocialKey =
    | "website"
    | "instagram"
    | "whatsapp"
    | "telegram"
    | "max"
    | "vk"
    | "viber"
    | "pinterest"
    | "facebook"
    | "tiktok"
    | "youtube"
    | "twitter"
    | "dzen"
    | "ok";

  const updateData = (patch: Record<string, unknown>) => {
    onChange({ ...block, data: { ...block.data, ...patch } });
  };
  const inSection = (...ids: string[]) =>
    ids.length === 0 || ids.includes(activeSectionId) || activeSectionId === "main";

  const variantOptions = BLOCK_VARIANTS[block.type];
  const resolveSocialHrefByKey = (key: SocialKey): string | null => {
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
                                : accountProfile.okUrl;
    const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!trimmed) return null;
    return trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  };
  const availableSecondarySources = (Object.keys(SOCIAL_LABELS) as SocialKey[]).filter(
    (key) => Boolean(resolveSocialHrefByKey(key))
  );
  const secondaryButtonSource = (block.data.secondaryButtonSource as string) ?? "auto";
  const selectedSecondarySourceMissing =
    secondaryButtonSource !== "auto" &&
    !(availableSecondarySources as string[]).includes(secondaryButtonSource);

  return (
    <div className="space-y-6 [&_input:not([type='checkbox']):not([type='range'])]:!rounded-none [&_input:not([type='checkbox']):not([type='range'])]:!border-0 [&_input:not([type='checkbox']):not([type='range'])]:!border-b [&_input:not([type='checkbox']):not([type='range'])]:!border-[color:var(--bp-stroke)] [&_input:not([type='checkbox']):not([type='range'])]:!bg-transparent [&_input:not([type='checkbox']):not([type='range'])]:!px-0 [&_input:not([type='checkbox']):not([type='range'])]:!py-1 [&_input:not([type='checkbox']):not([type='range'])]:!shadow-none [&_input:not([type='checkbox']):not([type='range'])]:!outline-none [&_input:not([type='checkbox']):not([type='range'])]:focus:!ring-0 [&_input:not([type='checkbox']):not([type='range'])]:focus:!outline-none [&_input:not([type='checkbox']):not([type='range'])]:focus-visible:!outline-none [&_textarea]:!rounded-none [&_textarea]:!border-0 [&_textarea]:!border-b [&_textarea]:!border-[color:var(--bp-stroke)] [&_textarea]:!bg-transparent [&_textarea]:!px-0 [&_textarea]:!py-1 [&_textarea]:!shadow-none [&_textarea]:!outline-none [&_textarea]:focus:!ring-0 [&_textarea]:focus:!outline-none [&_textarea]:focus-visible:!outline-none [&_select]:!rounded-none [&_select]:!border-0 [&_select]:!border-b [&_select]:!border-[color:var(--bp-stroke)] [&_select]:!bg-transparent [&_select]:!px-0 [&_select]:!py-1 [&_select]:!shadow-none [&_select]:!outline-none [&_select]:focus:!ring-0 [&_select]:focus:!outline-none [&_select]:focus-visible:!outline-none">
      {(variantOptions.length > 1 && block.type !== "loader" && inSection("main", "structure")) && (
        <label className="block">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
            Вариант
          </div>
          <select
            value={block.variant}
            onChange={(event) =>
              onChange({
                ...block,
                variant: event.target.value as "v1" | "v2" | "v3" | "v4" | "v5",
              })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            {variantOptions.map((variant) => (
              <option key={variant} value={variant}>
                {variantsLabel[variant]}
              </option>
            ))}
          </select>
        </label>
      )}

      {block.type === "menu" && (
        <>
          {inSection("brand") && (
            <>
              <div className="space-y-2">
                <div>
                  <FlatCheckbox
                    checked={block.data.showLogo !== false}
                    onChange={(checked) => updateData({ showLogo: checked })}
                    label="Показывать логотип"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={block.data.showCompanyName !== false}
                    onChange={(checked) => updateData({ showCompanyName: checked })}
                    label="Показывать название компании"
                  />
                </div>
              </div>
              <FieldText
                label="Название компании"
                value={(block.data.accountTitle as string) ?? accountName}
                onChange={(value) => updateData({ accountTitle: value })}
              />
            </>
          )}
          {inSection("structure") && (
            <>
              <div>
                <FlatCheckbox
                  checked={block.data.showOnAllPages !== false}
                  onChange={(checked) => updateData({ showOnAllPages: checked })}
                  label="Показывать на всех страницах"
                />
              </div>
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Позиция меню
                </div>
                <select
                  value={(block.data.position as string) ?? "static"}
                  onChange={(event) => updateData({ position: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="static">Статика</option>
                  <option value="sticky">Фиксация при скролле</option>
                </select>
              </label>
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Пункты меню
                </div>
                {PAGE_KEYS.map((key) => {
                  const items = Array.isArray(block.data.menuItems)
                    ? (block.data.menuItems as SitePageKey[])
                    : [];
                  const checked = items.includes(key);
                  return (
                    <div key={key}>
                      <FlatCheckbox
                        checked={checked}
                        onChange={(nextChecked) => {
                          const next = nextChecked
                            ? [...items, key]
                            : items.filter((item) => item !== key);
                          updateData({ menuItems: next });
                        }}
                        label={PAGE_LABELS[key]}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {inSection("actions") && (
            <>
              <div>
                <FlatCheckbox
                  checked={Boolean(block.data.showButton)}
                  onChange={(checked) => updateData({ showButton: checked })}
                  label="Показывать кнопку записи"
                />
              </div>
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Действие кнопки
                </div>
                <select
                  value={(block.data.ctaMode as string) ?? "booking"}
                  onChange={(event) => updateData({ ctaMode: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="booking">Запись</option>
                  <option value="phone">Телефон</option>
                </select>
              </label>
              <FieldText
                label="Телефон для кнопки"
                value={(block.data.phoneOverride as string) ?? ""}
                onChange={(value) => updateData({ phoneOverride: value })}
              />
              <FieldText
                label="Текст кнопки"
                value={(block.data.buttonText as string) ?? "Записаться"}
                onChange={(value) => updateData({ buttonText: value })}
              />
            </>
          )}
          {inSection("extras") && (
            <>
              <div className="space-y-2">
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showSearch)}
                    onChange={(checked) => updateData({ showSearch: checked })}
                    label="Показывать поиск"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showAccount)}
                    onChange={(checked) => updateData({ showAccount: checked })}
                    label="Иконка входа"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showThemeToggle)}
                    onChange={(checked) => updateData({ showThemeToggle: checked })}
                    label="Переключатель темы"
                  />
                </div>
                <div>
                  <FlatCheckbox
                    checked={Boolean(block.data.showSocials)}
                    onChange={(checked) => updateData({ showSocials: checked })}
                    label="Показывать соцсети"
                  />
                </div>
              </div>
              <label className="block">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Соцсети
                </div>
                <select
                  value={(block.data.socialsMode as string) ?? "auto"}
                  onChange={(event) => updateData({ socialsMode: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="auto">Из профиля аккаунта</option>
                  <option value="custom">Ввести вручную</option>
                </select>
              </label>
              {Boolean(block.data.showSocials) && (
                <label className="block">
                  {(() => {
                    const socialIconSize = Number.isFinite(
                      Number((block.data as Record<string, unknown>).socialIconSize)
                    )
                      ? Number((block.data as Record<string, unknown>).socialIconSize)
                      : 40;
                    const min = 24;
                    const max = 72;
                    const pct =
                      ((Math.max(min, Math.min(max, Math.round(socialIconSize))) - min) /
                        (max - min)) *
                      100;
                    return (
                      <>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                          Размер иконок соцсетей
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                          {Math.max(min, Math.min(max, Math.round(socialIconSize)))}px
                        </div>
                        <div className="relative mt-2 h-5">
                          <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
                          <div
                            className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, pct))}%`,
                              backgroundColor: "#ff5a5f",
                            }}
                          />
                          <div
                            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                            style={{
                              left: `${Math.max(0, Math.min(100, pct))}%`,
                              backgroundColor: "#ff5a5f",
                            }}
                          />
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={1}
                            value={Math.max(min, Math.min(max, Math.round(socialIconSize)))}
                            onChange={(event) =>
                              updateData({ socialIconSize: Number(event.target.value) })
                            }
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </>
                    );
                  })()}
                </label>
              )}
            </>
          )}
          {inSection("extras") && block.data.socialsMode === "custom" && (
            <div className="space-y-3">
              {(Object.keys(SOCIAL_LABELS) as SocialKey[]).map((key) => {
                const socials = (block.data.socialsCustom as Record<string, string>) ?? {};
                return (
                  <FieldText
                    key={key}
                    label={SOCIAL_LABELS[key]}
                    value={socials[key] ?? ""}
                    onChange={(value) =>
                      updateData({
                        socialsCustom: {
                          ...socials,
                          [key]: value,
                        },
                      })
                    }
                  />
                );
              })}
            </div>
          )}

        </>
      )}

      {block.type === "cover" && (
        <>
          {inSection("text", "main") && (
            <>
              <FieldText
                label="Заголовок"
                value={(block.data.title as string) ?? ""}
                onChange={(value) => updateData({ title: value })}
              />
              <FieldText
                label="Подзаголовок"
                value={(block.data.subtitle as string) ?? ""}
                onChange={(value) => updateData({ subtitle: value })}
              />
              <FieldTextarea
                label="Описание"
                value={(block.data.description as string) ?? ""}
                onChange={(value) => updateData({ description: value })}
              />
            </>
          )}
          {inSection("actions", "main") && (
            <>
              <div className="grid grid-cols-[auto,1fr] items-end gap-4">
                <FlatCheckbox
                  checked={Boolean(block.data.showButton)}
                  onChange={(checked) => updateData({ showButton: checked })}
                  label="Показывать кнопку записи"
                />
                <FieldText
                  label="Текст кнопки"
                  value={(block.data.buttonText as string) ?? ""}
                  onChange={(value) => updateData({ buttonText: value })}
                />
              </div>
              <FlatCheckbox
                checked={Boolean(block.data.showSecondaryButton)}
                onChange={(checked) => updateData({ showSecondaryButton: checked })}
                label="Показывать вторую кнопку (соцсети)"
              />
              {Boolean(block.data.showSecondaryButton) && (
                <>
                  <FieldText
                    label="Текст второй кнопки"
                    value={(block.data.secondaryButtonText as string) ?? "Наши соцсети"}
                    onChange={(value) => updateData({ secondaryButtonText: value })}
                  />
                  <label className="block">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                      Ссылка второй кнопки
                    </div>
                    <select
                      value={secondaryButtonSource}
                      onChange={(event) =>
                        updateData({ secondaryButtonSource: event.target.value })
                      }
                      className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                    >
                      <option value="auto">Авто (первая доступная)</option>
                      {selectedSecondarySourceMissing && (
                        <option value={secondaryButtonSource}>
                          {secondaryButtonSource} (не заполнено в профиле)
                        </option>
                      )}
                      {availableSecondarySources.map((key) => (
                        <option key={key} value={key}>
                          {SOCIAL_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {availableSecondarySources.length === 0 && (
                    <div className="text-xs text-[color:var(--bp-muted)]">
                      В профиле аккаунта нет заполненных ссылок для второй кнопки.
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {inSection("media", "main") && (
            <CoverImageEditor
              data={block.data}
              branding={branding}
              onChange={updateData}
            />
          )}
        </>
      )}

      {block.type === "about" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldTextarea
            label="Текст"
            value={(block.data.text as string) ?? ""}
            onChange={(value) => updateData({ text: value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showContacts)}
              onChange={(event) => updateData({ showContacts: event.target.checked })}
            />
            Показывать контакты из профиля
          </label>
        </>
      )}

      {block.type === "loader" && (
        <>
          {(() => {
            const parsed = parseBackdropColor(block.data.backdropColor);
            const backdropHex =
              typeof block.data.backdropHex === "string" && block.data.backdropHex
                ? (block.data.backdropHex as string)
                : parsed.hex;
            const backdropOpacity =
              Number.isFinite(Number(block.data.backdropOpacity))
                ? clamp01(Number(block.data.backdropOpacity))
                : parsed.alpha;
            const updateBackdrop = (hex: string, alpha: number) =>
              updateData({
                backdropHex: hex,
                backdropOpacity: alpha,
                backdropColor: hexToRgbaString(hex, alpha),
              });

            return (
              <>
          <label className="text-sm">
            Вид лоадера
            <select
              value={block.variant}
              onChange={(event) =>
                onChange({
                  ...block,
                  variant: event.target.value as "v1" | "v2" | "v3" | "v4" | "v5",
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="v1">Вращающийся круг</option>
              <option value="v2">Точки (волна)</option>
              <option value="v3">Пульсирующий круг</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.enabled !== false}
              onChange={(event) => updateData({ enabled: event.target.checked })}
            />
            Включить лоадер
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showPageOverlay !== false}
              onChange={(event) => updateData({ showPageOverlay: event.target.checked })}
            />
            Показывать на сайте
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showBookingInline !== false}
              onChange={(event) => updateData({ showBookingInline: event.target.checked })}
            />
            Показывать в онлайн-записи
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.backdropEnabled)}
              onChange={(event) => updateData({ backdropEnabled: event.target.checked })}
            />
            Затемнять фон под лоадером
          </label>
          <ColorField
            label="Цвет затемнения"
            value={backdropHex}
            placeholder="#111827"
            onChange={(value) => updateBackdrop(value, backdropOpacity)}
          />
          <label className="text-sm">
            Прозрачность затемнения: {Math.round(backdropOpacity * 100)}%
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(backdropOpacity * 100)}
              onChange={(event) =>
                updateBackdrop(backdropHex, Number(event.target.value) / 100)
              }
              className="mt-2 w-full"
            />
          </label>
          <ColorField
            label="Цвет лоадера"
            value={(block.data.color as string) ?? "#111827"}
            placeholder="#111827"
            onChange={(value) => updateData({ color: value })}
          />
          <label className="text-sm">
            Размер: {Number(block.data.size ?? 36)} px
            <input
              type="range"
              min={16}
              max={120}
              step={2}
              value={Number(block.data.size ?? 36)}
              onChange={(event) => updateData({ size: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm">
            Скорость анимации: {Number(block.data.speedMs ?? 900)} мс
            <input
              type="range"
              min={300}
              max={4000}
              step={50}
              value={Number(block.data.speedMs ?? 900)}
              onChange={(event) => updateData({ speedMs: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.fixedDurationEnabled)}
              onChange={(event) => updateData({ fixedDurationEnabled: event.target.checked })}
            />
            Фиксированное время показа лоадера
          </label>
          <label className="text-sm">
            Время показа: {Number(block.data.fixedDurationSec ?? 1)} сек
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              disabled={!Boolean(block.data.fixedDurationEnabled)}
              value={Number(block.data.fixedDurationSec ?? 1)}
              onChange={(event) =>
                updateData({ fixedDurationSec: Number(event.target.value) })
              }
              className="mt-2 w-full disabled:opacity-40"
            />
          </label>
          <label className="text-sm">
            Толщина: {Number(block.data.thickness ?? 3)} px
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={Number(block.data.thickness ?? 3)}
              onChange={(event) => updateData({ thickness: Number(event.target.value) })}
              className="mt-2 w-full"
            />
          </label>
              </>
            );
          })()}
        </>
      )}

      {block.type === "locations" && (
        <>
          <EntityListEditor
            block={block}
            items={locations.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showAddress !== false}
              onChange={(event) => updateData({ showAddress: event.target.checked })}
            />
            Показывать адрес
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.showPhone !== false}
              onChange={(event) => updateData({ showPhone: event.target.checked })}
            />
            Показывать телефон
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showContacts)}
              onChange={(event) => updateData({ showContacts: event.target.checked })}
            />
            Показывать соцсети аккаунта
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

        </>
      )}

      {block.type === "services" && (
        <>
          <EntityListEditor
            block={block}
            items={services.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="text-sm">
            Карточек в ряд
            <select
              value={String(block.data.cardsPerRow ?? 3)}
              onChange={(event) =>
                updateData({
                  cardsPerRow: Number(event.target.value),
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
          <label className="text-sm">
            Фильтр по локации
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Фильтр по специалисту
            <select
              value={String(block.data.specialistId ?? "")}
              onChange={(event) =>
                updateData({
                  specialistId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {specialists.map((specialist) => (
                <option key={specialist.id} value={specialist.id}>
                  {specialist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showPrice)}
              onChange={(event) => updateData({ showPrice: event.target.checked })}
            />
            Показывать цену
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showDuration)}
              onChange={(event) =>
                updateData({ showDuration: event.target.checked })
              }
            />
            Показывать длительность
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

        </>
      )}

      {block.type === "specialists" && (
        <>
          <EntityListEditor
            block={block}
            items={specialists.map((item) => ({ id: item.id, label: item.name }))}
            onChange={updateData}
          />
          <label className="text-sm">
            Локация для записи
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.showButton)}
              onChange={(event) => updateData({ showButton: event.target.checked })}
            />
            Показывать кнопку записи
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.buttonText as string) ?? ""}
            onChange={(value) => updateData({ buttonText: value })}
          />

        </>
      )}

      {block.type === "promos" && (
        <EntityListEditor
          block={block}
          items={promos.map((item) => ({ id: item.id, label: item.name }))}
          onChange={updateData}
        />
      )}
      {block.type === "works" && (
        <>
          <FieldText
            label="Заголовок блока"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Источник работ
            <select
              value={(block.data.source as string) ?? "locations"}
              onChange={(event) => updateData({ source: event.target.value })}
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="locations">Локации</option>
              <option value="specialists">Специалисты</option>
              <option value="services">Услуги</option>
            </select>
          </label>
          <label className="text-sm">
            Количество слайдов
            <input
              type="number"
              min={1}
              max={30}
              value={Number(block.data.maxSlides ?? 12)}
              onChange={(event) =>
                updateData({
                  maxSlides: event.target.value ? Number(event.target.value) : 12,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            />
          </label>
          <EntityListEditor
            block={block}
            showTitleFields={false}
            showUseCurrent={true}
            items={
              (block.data.source as string) === "services"
                ? services.map((item) => ({ id: item.id, label: item.name }))
                : (block.data.source as string) === "specialists"
                  ? specialists.map((item) => ({ id: item.id, label: item.name }))
                  : locations.map((item) => ({ id: item.id, label: item.name }))
            }
            onChange={updateData}
          />
        </>
      )}

      {block.type === "reviews" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Количество отзывов
            <input
              type="number"
              min={1}
              max={24}
              value={Number(block.data.limit ?? 6)}
              onChange={(event) =>
                updateData({
                  limit: event.target.value ? Number(event.target.value) : 6,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            />
          </label>
        </>
      )}

      {block.type === "contacts" && (
        <>
          <FieldText
            label="Заголовок"
            value={(block.data.title as string) ?? ""}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Подзаголовок"
            value={(block.data.subtitle as string) ?? ""}
            onChange={(value) => updateData({ subtitle: value })}
          />
          <label className="text-sm">
            Локация для контактов
            <select
              value={String(block.data.locationId ?? "")}
              onChange={(event) =>
                updateData({
                  locationId: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="">Не выбрано</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

            {block.type === "aisha" && (
        <>
          <FieldText
            label="Заголовок виджета"
            value={(block.data.title as string) ?? "AI-ассистент записи"}
            onChange={(value) => updateData({ title: value })}
          />
          <FieldText
            label="Имя ассистента"
            value={(block.data.assistantName as string) ?? "Ассистент"}
            onChange={(value) => updateData({ assistantName: value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.data.enabled !== false}
              onChange={(event) => updateData({ enabled: event.target.checked })}
            />
            {"Показывать AI-ассистента на сайте"}
          </label>
          <FieldText
            label="Текст кнопки"
            value={(block.data.label as string) ?? "AI-ассистент"}
            onChange={(value) => updateData({ label: value })}
          />
        </>
      )}

      {block.type !== "menu" &&
        block.type !== "cover" &&
        block.type !== "about" &&
        block.type !== "loader" &&
        !isSystemBlockType(block.type) &&
        block.type !== "works" &&
        block.type !== "reviews" &&
        block.type !== "contacts" &&
        block.type !== "aisha" && (
          <>
            <FieldText
              label="Заголовок"
              value={(block.data.title as string) ?? ""}
              onChange={(value) => updateData({ title: value })}
            />
            <FieldText
              label="Подзаголовок"
              value={(block.data.subtitle as string) ?? ""}
              onChange={(value) => updateData({ subtitle: value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(block.data.showButton)}
                onChange={(event) =>
                  updateData({ showButton: event.target.checked })
                }
              />
              Показывать кнопку записи
            </label>
            <FieldText
              label="Текст кнопки"
              value={(block.data.buttonText as string) ?? "Записаться"}
              onChange={(value) => updateData({ buttonText: value })}
            />
          </>
        )}
    </div>
  );
}

function BlockStyleEditor({
  block,
  theme,
  activeSectionId,
  onChange,
}: {
  block: SiteBlock;
  theme: SiteTheme;
  activeSectionId: string;
  onChange: (next: SiteBlock) => void;
}) {
  const style = normalizeBlockStyle(block, theme);
  const resolvedBlockColumns = clampBlockColumns(
    style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS,
    block.type
  );
  const bookingPreset = bookingPresetFromColumns(resolvedBlockColumns);
  const rawStyle = (block.data.style as Record<string, unknown>) ?? {};
  const readRaw = (key: string) =>
    typeof rawStyle[key] === "string" ? (rawStyle[key] as string) : "";
  const toDisplay = (value: string) => value;
  const toStore = (value: string) =>
    value.trim() === "" || value.trim().toLowerCase() === "transparent"
      ? "transparent"
      : value.trim();
  const toStoreMenuLightBg = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "transparent") {
      return "transparent";
    }
    return trimmed;
  };
  const toStoreMenuDarkBg = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "transparent") {
      return "transparent";
    }
    return trimmed;
  };
  const lightSectionBg = readRaw("sectionBgLight") || readRaw("sectionBg");
  const darkSectionBg = readRaw("sectionBgDark");
  const lightBlockBg = readRaw("blockBgLight") || readRaw("blockBg");
  const darkBlockBg = readRaw("blockBgDark");
  const lightSubBlockBg = readRaw("subBlockBgLight") || readRaw("subBlockBg");
  const darkSubBlockBg = readRaw("subBlockBgDark");
  const lightBorderColor = readRaw("borderColorLight") || readRaw("borderColor");
  const darkBorderColor = readRaw("borderColorDark");
  const lightButtonColor = readRaw("buttonColorLight") || readRaw("buttonColor");
  const darkButtonColor = readRaw("buttonColorDark");
  const lightButtonTextColor =
    readRaw("buttonTextColorLight") || readRaw("buttonTextColor");
  const darkButtonTextColor = readRaw("buttonTextColorDark");
  const lightTextColor = readRaw("textColorLight") || readRaw("textColor");
  const darkTextColor = readRaw("textColorDark");
  const lightMutedColor = readRaw("mutedColorLight") || readRaw("mutedColor");
  const darkMutedColor = readRaw("mutedColorDark");
  const lightAssistantBubbleColor =
    readRaw("assistantBubbleColorLight") || readRaw("assistantBubbleColor");
  const darkAssistantBubbleColor = readRaw("assistantBubbleColorDark");
  const lightAssistantTextColor =
    readRaw("assistantTextColorLight") || readRaw("assistantTextColor");
  const darkAssistantTextColor = readRaw("assistantTextColorDark");
  const lightClientBubbleColor =
    readRaw("clientBubbleColorLight") || readRaw("clientBubbleColor");
  const darkClientBubbleColor = readRaw("clientBubbleColorDark");
  const lightClientTextColor =
    readRaw("clientTextColorLight") || readRaw("clientTextColor");
  const darkClientTextColor = readRaw("clientTextColorDark");
  const lightHeaderBgColor = readRaw("headerBgColorLight") || readRaw("headerBgColor");
  const darkHeaderBgColor = readRaw("headerBgColorDark");
  const lightHeaderTextColor =
    readRaw("headerTextColorLight") || readRaw("headerTextColor");
  const darkHeaderTextColor = readRaw("headerTextColorDark");
  const lightQuickReplyButtonColor =
    readRaw("quickReplyButtonColorLight") || readRaw("quickReplyButtonColor");
  const darkQuickReplyButtonColor = readRaw("quickReplyButtonColorDark");
  const lightQuickReplyTextColor =
    readRaw("quickReplyTextColorLight") || readRaw("quickReplyTextColor");
  const darkQuickReplyTextColor = readRaw("quickReplyTextColorDark");
  const update = (patch: Partial<BlockStyle>) => {
    onChange(updateBlockStyle(block, patch));
  };
  const updateCoverData = (patch: Record<string, unknown>) => {
    onChange({
      ...block,
      data: {
        ...(block.data as Record<string, unknown>),
        ...patch,
      },
    });
  };
  const applyGridRange = (nextStart: number, nextEnd: number) => {
    const safeStart = clampGridColumn(nextStart);
    const safeEnd = Math.max(safeStart, clampGridColumn(nextEnd));
    const nextColumns = Math.max(1, safeEnd - safeStart + 1);
    const nextWidth = Math.round((nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE);
    update({
      useCustomWidth: true,
      blockWidth: nextWidth,
      blockWidthColumns: nextColumns,
      gridStartColumn: safeStart,
      gridEndColumn: safeEnd,
    });
  };
  const inSection = (...ids: string[]) =>
    ids.length === 0 || ids.includes(activeSectionId);
  const coverData = (block.data as Record<string, unknown>) ?? {};
  const resolveCoverTextColorInput = (raw: unknown, fallback: string) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return fallback;
    if (isValidColorValue(value)) return value;
    return fallback;
  };
  const coverSubtitleColorInput = resolveCoverTextColorInput(
    coverData.coverSubtitleColor,
    "#ffffff"
  );
  const coverDescriptionColorInput = resolveCoverTextColorInput(
    coverData.coverDescriptionColor,
    "#ffffff"
  );
  const renderFlatSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>
  ) => (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="relative mt-2 border-b border-[color:var(--bp-stroke)] pb-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-full appearance-none rounded-none border-0 bg-transparent py-0 pr-6 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{
            borderTop: 0,
            borderLeft: 0,
            borderRight: 0,
            borderBottom: 0,
            borderRadius: 0,
            boxShadow: "none",
            backgroundColor: "transparent",
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
        >
          {options.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
          ▾
        </span>
      </div>
    </label>
  );
  const renderFlatNumber = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void
  ) => (
    <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
      <div className="min-h-[32px] leading-4">{label}</div>
      <div className="mt-2 flex items-center gap-2 border-b border-[color:var(--bp-stroke)] bg-transparent pb-1">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full rounded-none border-0 bg-transparent px-0 py-1 text-base font-normal normal-case tracking-normal shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
          style={{
            border: 0,
            borderRadius: 0,
            backgroundColor: "transparent",
            boxShadow: "none",
            appearance: "auto",
          }}
        />
        <span className="text-sm font-normal normal-case tracking-normal text-[color:var(--bp-muted)]">px</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-4">
      {inSection("layout") && block.type === "menu" && (
        <>
          {(() => {
            const minMenuHeight = block.variant === "v1" ? 40 : 30;
            const currentMenuHeight = Number.isFinite(
              Number((block.data as Record<string, unknown>).menuHeight)
            )
              ? Number((block.data as Record<string, unknown>).menuHeight)
              : block.variant === "v1"
                ? 64
                : 56;
            const menuHeight = Math.max(
              minMenuHeight,
              Math.min(96, Math.round(currentMenuHeight))
            );
            const pct =
              ((menuHeight - minMenuHeight) / (96 - minMenuHeight)) * 100;
            return (
              <div className="mt-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Высота меню
                </div>
                <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                  {menuHeight}px
                </div>
                <div className="relative mt-2 h-5">
                  <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-[color:var(--bp-stroke)]" />
                  <div
                    className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, pct))}%`,
                      backgroundColor: "#ff5a5f",
                    }}
                  />
                  <div
                    className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-sm"
                    style={{
                      left: `${Math.max(0, Math.min(100, pct))}%`,
                      backgroundColor: "#ff5a5f",
                    }}
                  />
                  <input
                    type="range"
                    min={minMenuHeight}
                    max={96}
                    step={1}
                    value={menuHeight}
                    onChange={(event) =>
                      onChange({
                        ...block,
                        data: {
                          ...block.data,
                          menuHeight: Number(event.target.value),
                        },
                      })
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              <div className="min-h-[32px] leading-4">Радиус блока</div>
              <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1 text-sm text-[color:var(--bp-ink)]">
                0px
              </div>
            </div>
            <div className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
              <div className="min-h-[32px] leading-4">Радиус кнопки</div>
              <div className="mt-2 border-b border-[color:var(--bp-stroke)] pb-1 text-sm text-[color:var(--bp-ink)]">
                0px
              </div>
            </div>
          </div>

          <div className="text-sm text-[color:var(--bp-muted)]">
            Ширина блока: 12/12 (фиксировано для меню)
          </div>

          {(() => {
            const menuMarginTopLines = Math.max(
              0,
              Math.min(
                7,
                Math.round((style.marginTop / COVER_LINE_STEP_PX) * 2) / 2
              )
            );
            const menuMarginBottomLines = Math.max(
              0,
              Math.min(
                7,
                Math.round((style.marginBottom / COVER_LINE_STEP_PX) * 2) / 2
              )
            );
            return (
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Отступ сверху
                  <div className="relative mt-2">
                    <select
                      value={String(menuMarginTopLines)}
                      onChange={(event) =>
                        update({
                          marginTop: Math.round(
                            Number(event.target.value) * COVER_LINE_STEP_PX
                          ),
                        })
                      }
                      className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                      style={{
                        borderTop: "0",
                        borderLeft: "0",
                        borderRight: "0",
                        borderRadius: "0",
                        boxShadow: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        appearance: "none",
                      }}
                    >
                      {COVER_LINE_OPTIONS.map((lineValue) => (
                        <option key={`menu-top-${lineValue}`} value={lineValue}>
                          {formatCoverLineLabel(lineValue)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                      ▾
                    </span>
                  </div>
                </label>
                <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-muted)]">
                  Отступ снизу
                  <div className="relative mt-2">
                    <select
                      value={String(menuMarginBottomLines)}
                      onChange={(event) =>
                        update({
                          marginBottom: Math.round(
                            Number(event.target.value) * COVER_LINE_STEP_PX
                          ),
                        })
                      }
                      className="w-full appearance-none rounded-none border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-1 pr-5 text-base font-normal normal-case tracking-normal shadow-none outline-none focus:ring-0"
                      style={{
                        borderTop: "0",
                        borderLeft: "0",
                        borderRight: "0",
                        borderRadius: "0",
                        boxShadow: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        appearance: "none",
                      }}
                    >
                      {COVER_LINE_OPTIONS.map((lineValue) => (
                        <option key={`menu-bottom-${lineValue}`} value={lineValue}>
                          {formatCoverLineLabel(lineValue)}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm leading-none text-[color:var(--bp-muted)]">
                      ▾
                    </span>
                  </div>
                </label>
              </div>
            );
          })()}
        </>
      )}
      {inSection("layout") && block.type !== "aisha" && block.type !== "menu" && (
        <label className="text-sm">
          Отступ сверху: {style.marginTop}px
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={style.marginTop}
            onChange={(event) => update({ marginTop: Number(event.target.value) })}
            className="mt-2 w-full"
          />
        </label>
      )}
      {inSection("layout") && block.type !== "aisha" && block.type !== "menu" && (
        <label className="text-sm">
          Отступ снизу: {style.marginBottom}px
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={style.marginBottom}
            onChange={(event) => update({ marginBottom: Number(event.target.value) })}
            className="mt-2 w-full"
          />
        </label>
      )}
      {inSection("layout") && block.type === "booking" && (
      <label className="text-sm">
        {`Ширина контейнера: ${bookingPreset}`}
        <input
          type="range"
          min={BOOKING_MIN_PRESET}
          max={BOOKING_MAX_PRESET}
          step={1}
          value={bookingPreset}
          onChange={(event) => {
            const nextColumns = bookingColumnsFromPreset(Number(event.target.value));
            const nextWidth = Math.round(
              (nextColumns / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE
            );
            update({
              useCustomWidth: true,
              blockWidth: nextWidth,
              blockWidthColumns: nextColumns,
            });
          }}
          className="mt-2 w-full"
        />
      </label>
      )}
      {inSection("layout") && block.type === "cover" && (
      <CoverGridWidthControl
        start={style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start}
        end={style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end}
        onChange={applyGridRange}
      />
      )}
      {inSection("layout") && block.type !== "menu" && block.type !== "booking" && block.type !== "aisha" && block.type !== "cover" && (
      <>
        <div className="text-sm">
          Ширина блока: {Math.max(1, (style.gridEndColumn ?? 12) - (style.gridStartColumn ?? 1) + 1)}/12
        </div>
        <label className="text-sm">
          Левая граница сетки: {style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start}
          <input
            type="range"
            min={GRID_MIN_COLUMN}
            max={style.gridEndColumn ?? GRID_MAX_COLUMN}
            step={1}
            value={style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start}
            onChange={(event) => {
              const nextStart = clampGridColumn(Number(event.target.value));
              const currentEnd = style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end;
              const nextEnd = Math.max(nextStart, currentEnd);
              applyGridRange(nextStart, nextEnd);
            }}
            className="mt-2 w-full"
          />
        </label>
        <label className="text-sm">
          Правая граница сетки: {style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end}
          <input
            type="range"
            min={style.gridStartColumn ?? GRID_MIN_COLUMN}
            max={GRID_MAX_COLUMN}
            step={1}
            value={style.gridEndColumn ?? centeredGridRange(resolvedBlockColumns).end}
            onChange={(event) => {
              const currentStart = style.gridStartColumn ?? centeredGridRange(resolvedBlockColumns).start;
              const nextEnd = clampGridColumn(Number(event.target.value));
              const safeEnd = Math.max(currentStart, nextEnd);
              applyGridRange(currentStart, safeEnd);
            }}
            className="mt-2 w-full"
          />
          {block.type === "works" && block.variant === "v2" && (
            <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
              В варианте 2 сетка регулирует ширину и смещение текста поверх галереи.
            </div>
          )}
        </label>
      </>
      )}
      {block.type === "cover" && inSection("layout") && (
        <label className="text-sm">
          Высота изображения: {Number(block.data.coverHeight ?? 100)}vh
          <input
            type="range"
            min={60}
            max={140}
            step={1}
            value={Number(block.data.coverHeight ?? 100)}
            onChange={(event) =>
              onChange({
                ...block,
                data: {
                  ...block.data,
                  coverHeight: Number(event.target.value),
                },
              })
            }
            className="mt-2 w-full"
          />
        </label>
      )}
      {inSection("layout") && block.type !== "works" && block.type !== "cover" && block.type !== "aisha" && block.type !== "menu" && (
      <label className="text-sm">
        Радиус блока: {style.radius ?? theme.radius}px
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={style.radius ?? theme.radius}
          onChange={(event) => update({ radius: Number(event.target.value) })}
          className="mt-2 w-full"
        />
      </label>
      )}
      {inSection("layout") && block.type !== "aisha" && block.type !== "menu" && (
      <label className="text-sm">
        Радиус кнопки: {style.buttonRadius ?? theme.buttonRadius}px
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={style.buttonRadius ?? theme.buttonRadius}
          onChange={(event) =>
            update({ buttonRadius: Number(event.target.value) })
          }
          className="mt-2 w-full"
        />
      </label>
      )}
      {inSection("layout") && block.type === "aisha" && (
      <>
        <label className="text-sm">
          {"Отступ снизу:"} {Number(block.data.offsetBottomPx ?? 16)}px
          <input type="range" min={8} max={64} step={1} value={Number(block.data.offsetBottomPx ?? 16)} onChange={(event) => onChange({ ...block, data: { ...block.data, offsetBottomPx: Number(event.target.value) } })} className="mt-2 w-full" />
        </label>
        <label className="text-sm">
          {"Отступ справа:"} {Number(block.data.offsetRightPx ?? 16)}px
          <input type="range" min={8} max={160} step={1} value={Number(block.data.offsetRightPx ?? 16)} onChange={(event) => onChange({ ...block, data: { ...block.data, offsetRightPx: Number(event.target.value) } })} className="mt-2 w-full" />
        </label>
      </>
      )}
      {/* menu layout is rendered выше в одном блоке */}
      {block.type === "works" && inSection("layout") && (
        <>
          <label className="text-sm">
            Высота галереи: {Number(block.data.galleryHeight ?? 550)}px
            <input
              type="range"
              min={220}
              max={900}
              step={10}
              value={Number(block.data.galleryHeight ?? 550)}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    galleryHeight: Number(event.target.value),
                  },
                })
              }
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm">
            Радиус скругления изображений: {Number(block.data.imageRadius ?? 0)}px
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={Number(block.data.imageRadius ?? 0)}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    imageRadius: Number(event.target.value),
                  },
                })
              }
              className="mt-2 w-full"
            />
          </label>
          <label className="text-sm">
            Масштабирование изображения
            <select
              value={String(block.data.imageFit ?? "cover")}
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    imageFit: event.target.value === "contain" ? "contain" : "cover",
                  },
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="cover">Заполнять область</option>
              <option value="contain">Вписывать в область</option>
            </select>
          </label>
          <label className="text-sm">
            Стиль стрелок
            <select
              value={
                block.data.arrowVariant === "angle" || block.data.arrowVariant === "triangle"
                  ? String(block.data.arrowVariant)
                  : "chevron"
              }
              onChange={(event) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    arrowVariant:
                      event.target.value === "angle" || event.target.value === "triangle"
                        ? event.target.value
                        : "chevron",
                  },
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="chevron">Классические</option>
              <option value="angle">Угловые</option>
              <option value="triangle">Треугольные</option>
            </select>
          </label>
        </>
      )}
      {inSection("colors") && (
        <div className="space-y-4">
          {block.type === "menu" && (
            <>
              {(() => {
                const data = block.data as Record<string, unknown>;
                const modeRaw =
                  typeof data.menuBlockBackgroundMode === "string"
                    ? data.menuBlockBackgroundMode
                    : "";
                const mode: CoverBackgroundMode =
                  modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
                return (
                  <TildaBackgroundColorField
                    label="Цвет блока"
                    value={String(lightBlockBg || "")}
                    mode={mode}
                    secondValue={String(data.menuBlockBackgroundTo ?? "")}
                    angle={Number(data.menuBlockBackgroundAngle ?? 135)}
                    radialStopA={Number(data.menuBlockBackgroundStopA ?? 0)}
                    radialStopB={Number(data.menuBlockBackgroundStopB ?? 100)}
                    placeholder={theme.panelColor}
                    onModeChange={(nextMode) =>
                      updateCoverData({ menuBlockBackgroundMode: nextMode })
                    }
                    onSecondChange={(value) =>
                      updateCoverData({ menuBlockBackgroundTo: value })
                    }
                    onAngleChange={(value) =>
                      updateCoverData({ menuBlockBackgroundAngle: value })
                    }
                    onRadialStopAChange={(value) =>
                      updateCoverData({ menuBlockBackgroundStopA: value })
                    }
                    onRadialStopBChange={(value) =>
                      updateCoverData({ menuBlockBackgroundStopB: value })
                    }
                    onChange={(value) => {
                      update({
                        blockBgLight: toStoreMenuLightBg(value),
                        blockBgDark: toStoreMenuDarkBg(value),
                        blockBg: toStoreMenuLightBg(value),
                        gradientEnabled: false,
                        gradientEnabledLight: false,
                        gradientEnabledDark: false,
                      });
                      updateCoverData({ menuBlockBackgroundFrom: value });
                    }}
                  />
                );
              })()}

              {(() => {
                const data = block.data as Record<string, unknown>;
                const modeRaw =
                  typeof data.menuSectionBackgroundMode === "string"
                    ? data.menuSectionBackgroundMode
                    : "";
                const mode: CoverBackgroundMode =
                  modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
                return (
                  <TildaBackgroundColorField
                    label="Цвет фона для всего блока"
                    value={String(lightSectionBg || "")}
                    mode={mode}
                    secondValue={String(data.menuSectionBackgroundTo ?? "")}
                    angle={Number(data.menuSectionBackgroundAngle ?? 135)}
                    radialStopA={Number(data.menuSectionBackgroundStopA ?? 0)}
                    radialStopB={Number(data.menuSectionBackgroundStopB ?? 100)}
                    placeholder="#ffffff"
                    onModeChange={(nextMode) =>
                      updateCoverData({ menuSectionBackgroundMode: nextMode })
                    }
                    onSecondChange={(value) =>
                      updateCoverData({ menuSectionBackgroundTo: value })
                    }
                    onAngleChange={(value) =>
                      updateCoverData({ menuSectionBackgroundAngle: value })
                    }
                    onRadialStopAChange={(value) =>
                      updateCoverData({ menuSectionBackgroundStopA: value })
                    }
                    onRadialStopBChange={(value) =>
                      updateCoverData({ menuSectionBackgroundStopB: value })
                    }
                    onChange={(value) => {
                      update({
                        sectionBgLight: toStore(value),
                        sectionBgDark: toStore(value),
                        sectionBg: toStore(value),
                      });
                      updateCoverData({ menuSectionBackgroundFrom: value });
                    }}
                  />
                );
              })()}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            {block.type !== "menu" && (
              <ColorField
                label={block.type === "booking" ? "Фон страницы" : "Фон блока"}
                value={toDisplay(block.type === "aisha" ? lightBlockBg : lightSectionBg)}
                placeholder={theme.panelColor}
                onChange={(value) =>
                  update(
                    block.type === "aisha"
                      ? {
                          blockBgLight: toStore(value),
                          blockBg: toStore(value),
                        }
                      : block.type === "works"
                        ? {
                            sectionBgLight: toStore(value),
                            sectionBg: toStore(value),
                            blockBgLight: toStore(value),
                            blockBg: toStore(value),
                          }
                        : block.type === "booking"
                          ? {
                              sectionBgLight: toStore(value),
                              sectionBg: toStore(value),
                            }
                          : {
                              sectionBgLight: toStore(value),
                              sectionBg: toStore(value),
                            }
                  )
                }
              />
            )}
        {block.type === "booking" && (
          <ColorField
            label="Фон блока"
            value={toDisplay(lightBlockBg)}
            placeholder={theme.panelColor}
            onChange={(value) =>
              update({
                blockBgLight: toStore(value),
                blockBg: toStore(value),
              })
            }
          />
        )}
        {(block.type === "booking" || block.type === "menu") && (
          <ColorField
            label="Цвет подблока"
            value={toDisplay(lightSubBlockBg)}
            placeholder={theme.panelColor}
            onChange={(value) =>
              update({
                subBlockBgLight: toStore(value),
                subBlockBg: toStore(value),
              })
            }
          />
        )}
        <ColorField
          label="Цвет обводки"
          value={toDisplay(lightBorderColor)}
          placeholder={theme.borderColor}
          onChange={(value) =>
            update({
              borderColorLight: toStore(value),
              borderColor: toStore(value),
            })
          }
        />
        <ColorField
          label="Цвет кнопки"
          value={toDisplay(lightButtonColor)}
          placeholder={theme.buttonColor}
          onChange={(value) =>
            update({
              buttonColorLight: toStore(value),
              buttonColor: toStore(value),
            })
          }
        />
        <ColorField
          label="Текст кнопки"
          value={toDisplay(lightButtonTextColor)}
          placeholder={theme.buttonTextColor}
          onChange={(value) =>
            update({
              buttonTextColorLight: toStore(value),
              buttonTextColor: toStore(value),
            })
          }
        />
        <ColorField
          label="Текст"
          value={toDisplay(lightTextColor)}
          placeholder={theme.textColor}
          onChange={(value) =>
            update({ textColorLight: toStore(value), textColor: toStore(value) })
          }
        />
        <ColorField
          label="Вторичный текст"
          value={toDisplay(lightMutedColor)}
          placeholder={theme.mutedColor}
          onChange={(value) =>
            update({
              mutedColorLight: toStore(value),
              mutedColor: toStore(value),
            })
          }
        />
        {block.type === "aisha" && (
          <>
            <ColorField label="Цвет ответа ассистента" value={toDisplay(lightAssistantBubbleColor)} placeholder={theme.panelColor} onChange={(value) => update({ assistantBubbleColorLight: toStore(value) })} />
            <ColorField label="Текст ассистента" value={toDisplay(lightAssistantTextColor)} placeholder={theme.textColor} onChange={(value) => update({ assistantTextColorLight: toStore(value) })} />
            <ColorField label="Цвет сообщения клиента" value={toDisplay(lightClientBubbleColor)} placeholder={theme.buttonColor} onChange={(value) => update({ clientBubbleColorLight: toStore(value) })} />
            <ColorField label="Текст клиента" value={toDisplay(lightClientTextColor)} placeholder={theme.buttonTextColor} onChange={(value) => update({ clientTextColorLight: toStore(value) })} />
            <ColorField label="Цвет плашки" value={toDisplay(lightHeaderBgColor)} placeholder={theme.panelColor} onChange={(value) => update({ headerBgColorLight: toStore(value) })} />
            <ColorField label="Цвет текста плашки" value={toDisplay(lightHeaderTextColor)} placeholder={theme.textColor} onChange={(value) => update({ headerTextColorLight: toStore(value) })} />
            <ColorField label="Цвет кнопок вариантов" value={toDisplay(lightQuickReplyButtonColor)} placeholder={theme.buttonColor} onChange={(value) => update({ quickReplyButtonColorLight: toStore(value) })} />
            <ColorField label="Текст кнопок вариантов" value={toDisplay(lightQuickReplyTextColor)} placeholder={theme.buttonTextColor} onChange={(value) => update({ quickReplyTextColorLight: toStore(value) })} />
          </>
        )}
        {block.type === "works" && (
          <>
            <ColorField
              label="Цвет стрелок"
              value={String(block.data.arrowColorLight ?? block.data.arrowColor ?? "")}
              placeholder={theme.textColor}
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    arrowColorLight: value,
                    arrowColor: value,
                  },
                })
              }
            />
            <ColorField
              label="Фон стрелок"
              value={String(block.data.arrowBgColorLight ?? block.data.arrowBgColor ?? "")}
              placeholder="#ffffffd1"
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    arrowBgColorLight: value,
                    arrowBgColor: value,
                  },
                })
              }
            />
            <ColorField
              label="Активная точка"
              value={String(block.data.dotActiveColorLight ?? block.data.dotActiveColor ?? "")}
              placeholder={theme.textColor}
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    dotActiveColorLight: value,
                    dotActiveColor: value,
                  },
                })
              }
            />
            <ColorField
              label="Неактивная точка"
              value={String(block.data.dotInactiveColorLight ?? block.data.dotInactiveColor ?? "")}
              placeholder={theme.mutedColor}
              onChange={(value) =>
                onChange({
                  ...block,
                  data: {
                    ...block.data,
                    dotInactiveColorLight: value,
                    dotInactiveColor: value,
                  },
                })
              }
            />
          </>
        )}
        <ColorField
          label="Тень"
          value={style.shadowColor || theme.shadowColor}
          onChange={(value) => update({ shadowColor: value })}
        />
        <NumberField
          label="Размер тени"
          value={style.shadowSize ?? theme.shadowSize}
          min={0}
          max={40}
          onChange={(value) => update({ shadowSize: value })}
        />
          </div>
        </div>
      )}
      {inSection("colors") && (
      <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Темная тема
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {block.type !== "menu" && (
              <ColorField
                label={block.type === "booking" ? "Фон страницы" : "Фон блока"}
                value={toDisplay(block.type === "aisha" ? darkBlockBg : darkSectionBg)}
                placeholder={theme.darkPalette.panelColor}
                onChange={(value) =>
                  update(
                    block.type === "aisha"
                      ? { blockBgDark: toStore(value) }
                      : block.type === "works"
                      ? { sectionBgDark: toStore(value), blockBgDark: toStore(value) }
                      : block.type === "booking"
                      ? { sectionBgDark: toStore(value) }
                      : { sectionBgDark: toStore(value) }
                  )
                }
              />
          )}
            {block.type === "booking" && (
              <ColorField
                label="Фон блока"
                value={toDisplay(darkBlockBg)}
                placeholder={theme.darkPalette.panelColor}
                onChange={(value) => update({ blockBgDark: toStore(value) })}
              />
            )}
            {(block.type === "booking" || block.type === "menu") && (
              <ColorField
                label="Цвет подблока"
                value={toDisplay(darkSubBlockBg)}
                placeholder={theme.darkPalette.panelColor}
                onChange={(value) => update({ subBlockBgDark: toStore(value) })}
              />
            )}
            <ColorField
              label="Цвет обводки"
              value={toDisplay(darkBorderColor)}
              placeholder={theme.darkPalette.borderColor}
              onChange={(value) => update({ borderColorDark: toStore(value) })}
            />
            <ColorField
              label="Цвет кнопки"
              value={toDisplay(darkButtonColor)}
              placeholder={theme.darkPalette.buttonColor}
              onChange={(value) => update({ buttonColorDark: toStore(value) })}
            />
            <ColorField
              label="Текст кнопки"
              value={toDisplay(darkButtonTextColor)}
              placeholder={theme.darkPalette.buttonTextColor}
              onChange={(value) => update({ buttonTextColorDark: toStore(value) })}
            />
            <ColorField
              label="Текст"
              value={toDisplay(darkTextColor)}
              placeholder={theme.darkPalette.textColor}
              onChange={(value) => update({ textColorDark: toStore(value) })}
            />
            <ColorField
              label="Вторичный текст"
              value={toDisplay(darkMutedColor)}
              placeholder={theme.darkPalette.mutedColor}
              onChange={(value) => update({ mutedColorDark: toStore(value) })}
            />
            <ColorField
              label="Тень"
              value={style.shadowColor || theme.shadowColor}
              onChange={(value) => update({ shadowColor: value })}
            />
            <NumberField
              label="Размер тени"
              value={style.shadowSize ?? theme.shadowSize}
              min={0}
              max={40}
              onChange={(value) => update({ shadowSize: value })}
            />
            {block.type === "aisha" && (
              <>
                <ColorField label="Цвет ответа ассистента" value={toDisplay(darkAssistantBubbleColor)} placeholder={theme.darkPalette.panelColor} onChange={(value) => update({ assistantBubbleColorDark: toStore(value) })} />
                <ColorField label="Текст ассистента" value={toDisplay(darkAssistantTextColor)} placeholder={theme.darkPalette.textColor} onChange={(value) => update({ assistantTextColorDark: toStore(value) })} />
                <ColorField label="Цвет сообщения клиента" value={toDisplay(darkClientBubbleColor)} placeholder={theme.darkPalette.buttonColor} onChange={(value) => update({ clientBubbleColorDark: toStore(value) })} />
                <ColorField label="Текст клиента" value={toDisplay(darkClientTextColor)} placeholder={theme.darkPalette.buttonTextColor} onChange={(value) => update({ clientTextColorDark: toStore(value) })} />
                <ColorField label="Цвет плашки" value={toDisplay(darkHeaderBgColor)} placeholder={theme.darkPalette.panelColor} onChange={(value) => update({ headerBgColorDark: toStore(value) })} />
                <ColorField label="Цвет текста плашки" value={toDisplay(darkHeaderTextColor)} placeholder={theme.darkPalette.textColor} onChange={(value) => update({ headerTextColorDark: toStore(value) })} />
                <ColorField label="Цвет кнопок вариантов" value={toDisplay(darkQuickReplyButtonColor)} placeholder={theme.darkPalette.buttonColor} onChange={(value) => update({ quickReplyButtonColorDark: toStore(value) })} />
                <ColorField label="Текст кнопок вариантов" value={toDisplay(darkQuickReplyTextColor)} placeholder={theme.darkPalette.buttonTextColor} onChange={(value) => update({ quickReplyTextColorDark: toStore(value) })} />
              </>
            )}
            {block.type === "works" && (
              <>
                <ColorField
                  label="Цвет стрелок"
                  value={String(block.data.arrowColorDark ?? "")}
                  placeholder={theme.darkPalette.textColor}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        arrowColorDark: value,
                      },
                    })
                  }
                />
                <ColorField
                  label="Фон стрелок"
                  value={String(block.data.arrowBgColorDark ?? "")}
                  placeholder="#ffffffd1"
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        arrowBgColorDark: value,
                      },
                    })
                  }
                />
                <ColorField
                  label="Активная точка"
                  value={String(block.data.dotActiveColorDark ?? "")}
                  placeholder={theme.darkPalette.textColor}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        dotActiveColorDark: value,
                      },
                    })
                  }
                />
                <ColorField
                  label="Неактивная точка"
                  value={String(block.data.dotInactiveColorDark ?? "")}
                  placeholder={theme.darkPalette.mutedColor}
                  onChange={(value) =>
                    onChange({
                      ...block,
                      data: {
                        ...block.data,
                        dotInactiveColorDark: value,
                      },
                    })
                  }
                />
              </>
            )}
        </div>
      </div>
      )}
      {inSection("effects") && (
        <>
          <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Градиент: светлая тема
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  typeof style.gradientEnabledLight === "boolean"
                    ? style.gradientEnabledLight
                    : Boolean(style.gradientEnabled)
                }
                onChange={(event) =>
                  update({
                    gradientEnabledLight: event.target.checked,
                    ...(block.type === "aisha" ? {} : { gradientEnabled: event.target.checked }),
                  })
                }
              />
              Включить градиент
            </label>
            {(typeof style.gradientEnabledLight === "boolean"
              ? style.gradientEnabledLight
              : Boolean(style.gradientEnabled)) && (
              <>
                <label className="mt-3 block text-sm">
                  Направление градиента
                  <select
                    value={
                      style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
                        ? style.gradientDirectionLight
                        : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
                          ? style.gradientDirection
                          : "vertical"
                    }
                    onChange={(event) =>
                      update({
                        gradientDirectionLight: event.target.value as BlockStyle["gradientDirection"],
                        ...(block.type === "aisha" ? {} : { gradientDirection: event.target.value as BlockStyle["gradientDirection"] }),
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                  >
                    <option value="vertical">Сверху вниз</option>
                    <option value="horizontal">Слева направо</option>
                  </select>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ColorField
                    label="Цвет 1"
                    value={style.gradientFromLight || style.gradientFrom || theme.lightPalette.gradientFrom}
                    onChange={(value) => update(block.type === "aisha" ? { gradientFromLight: value } : { gradientFromLight: value, gradientFrom: value })}
                  />
                  <ColorField
                    label="Цвет 2"
                    value={style.gradientToLight || style.gradientTo || theme.lightPalette.gradientTo}
                    onChange={(value) => update(block.type === "aisha" ? { gradientToLight: value } : { gradientToLight: value, gradientTo: value })}
                  />
                </div>
              </>
            )}
          </div>
          <div className="rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Градиент: темная тема
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  typeof style.gradientEnabledDark === "boolean"
                    ? style.gradientEnabledDark
                    : typeof style.gradientEnabledLight === "boolean"
                      ? style.gradientEnabledLight
                      : Boolean(style.gradientEnabled)
                }
                onChange={(event) => update({ gradientEnabledDark: event.target.checked })}
              />
              Включить градиент
            </label>
            {(typeof style.gradientEnabledDark === "boolean"
              ? style.gradientEnabledDark
              : typeof style.gradientEnabledLight === "boolean"
                ? style.gradientEnabledLight
                : Boolean(style.gradientEnabled)) && (
              <>
                <label className="mt-3 block text-sm">
                  Направление градиента
                  <select
                    value={
                      style.gradientDirectionDark === "horizontal" || style.gradientDirectionDark === "vertical"
                        ? style.gradientDirectionDark
                        : style.gradientDirection === "horizontal" || style.gradientDirection === "vertical"
                          ? style.gradientDirection
                          : style.gradientDirectionLight === "horizontal" || style.gradientDirectionLight === "vertical"
                            ? style.gradientDirectionLight
                            : "vertical"
                    }
                    onChange={(event) =>
                      update({
                        gradientDirectionDark: event.target.value as BlockStyle["gradientDirection"],
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                  >
                    <option value="vertical">Сверху вниз</option>
                    <option value="horizontal">Слева направо</option>
                  </select>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ColorField
                    label="Цвет 1"
                    value={style.gradientFromDark || style.gradientFrom || theme.darkPalette.gradientFrom}
                    onChange={(value) => update({ gradientFromDark: value })}
                  />
                  <ColorField
                    label="Цвет 2"
                    value={style.gradientToDark || style.gradientTo || theme.darkPalette.gradientTo}
                    onChange={(value) => update({ gradientToDark: value })}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
      {inSection("typography") && block.type === "cover" && (
        <>
          <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">Заголовок</div>
          <TildaInlineColorField
            label="Цвет"
            value={style.textColorLight || style.textColor || theme.textColor}
            onChange={(value) =>
              update({ textColorLight: value, textColorDark: value, textColor: value })
            }
            onClear={() =>
              update({
                textColorLight: "transparent",
                textColorDark: "transparent",
                textColor: "transparent",
              })
            }
            placeholder="#000000"
            compact
          />
          {renderFlatNumber(
            "Размер шрифта",
            style.headingSize ?? theme.headingSize,
            0,
            140,
            (value) => update({ headingSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontHeading || "",
            (value) => update({ fontHeading: value }),
            [{ value: "", label: "По умолчанию" }, ...THEME_FONTS.map((font) => ({ value: font.heading, label: font.label }))]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightHeading?.toString() || "",
            (value) => update({ fontWeightHeading: value ? Number(value) : null }),
            [{ value: "", label: "По умолчанию" }, ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label }))]
          )}

          <div className="pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">Подзаголовок</div>
          <TildaInlineColorField
            label="Цвет"
            value={coverSubtitleColorInput}
            onChange={(value) => updateCoverData({ coverSubtitleColor: value })}
            onClear={() => updateCoverData({ coverSubtitleColor: "transparent" })}
            placeholder="#ffffff"
            compact
          />
          {renderFlatNumber(
            "Размер шрифта",
            style.subheadingSize ?? theme.subheadingSize,
            0,
            100,
            (value) => update({ subheadingSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontSubheading || "",
            (value) => update({ fontSubheading: value }),
            [{ value: "", label: "По умолчанию" }, ...THEME_FONTS.map((font) => ({ value: font.body, label: font.label }))]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightSubheading?.toString() || "",
            (value) => update({ fontWeightSubheading: value ? Number(value) : null }),
            [{ value: "", label: "По умолчанию" }, ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label }))]
          )}

          <div className="pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[color:var(--bp-ink)]">Описание</div>
          <TildaInlineColorField
            label="Цвет"
            value={coverDescriptionColorInput}
            onChange={(value) => updateCoverData({ coverDescriptionColor: value })}
            onClear={() => updateCoverData({ coverDescriptionColor: "transparent" })}
            placeholder="#ffffff"
            compact
          />
          {renderFlatNumber(
            "Размер шрифта",
            style.textSize ?? theme.textSize,
            0,
            72,
            (value) => update({ textSize: value })
          )}
          {renderFlatSelect(
            "Шрифт",
            style.fontBody || "",
            (value) => update({ fontBody: value }),
            [{ value: "", label: "По умолчанию" }, ...THEME_FONTS.map((font) => ({ value: font.body, label: font.label }))]
          )}
          {renderFlatSelect(
            "Насыщенность",
            style.fontWeightBody?.toString() || "",
            (value) => update({ fontWeightBody: value ? Number(value) : null }),
            [{ value: "", label: "По умолчанию" }, ...FONT_WEIGHTS.map((weight) => ({ value: String(weight.value), label: weight.label }))]
          )}
          <div className="h-6" />
        </>
      )}
      {inSection("typography") && block.type !== "cover" && (
      <label className="text-sm">
        Шрифт заголовка
        <select
          value={style.fontHeading || ""}
          onChange={(event) => update({ fontHeading: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="">По умолчанию</option>
          {THEME_FONTS.map((font) => (
            <option key={font.label} value={font.heading}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      )}
      {inSection("typography") && block.type !== "cover" && (
      <label className="text-sm">
        Шрифт подзаголовка
        <select
          value={style.fontSubheading || ""}
          onChange={(event) => update({ fontSubheading: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="">По умолчанию</option>
          {THEME_FONTS.map((font) => (
            <option key={font.label} value={font.body}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      )}
      {inSection("typography") && block.type !== "cover" && (
      <label className="text-sm">
        Шрифт текста
        <select
          value={style.fontBody || ""}
          onChange={(event) => update({ fontBody: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="">По умолчанию</option>
          {THEME_FONTS.map((font) => (
            <option key={font.label} value={font.body}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      )}
      {inSection("typography") && block.type !== "cover" && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Жирность заголовка
          <select
            value={style.fontWeightHeading?.toString() || ""}
            onChange={(event) =>
              update({ fontWeightHeading: event.target.value ? Number(event.target.value) : null })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">По умолчанию</option>
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Жирность подзаголовка
          <select
            value={style.fontWeightSubheading?.toString() || ""}
            onChange={(event) =>
              update({ fontWeightSubheading: event.target.value ? Number(event.target.value) : null })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">По умолчанию</option>
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Жирность текста
          <select
            value={style.fontWeightBody?.toString() || ""}
            onChange={(event) =>
              update({ fontWeightBody: event.target.value ? Number(event.target.value) : null })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">По умолчанию</option>
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight.value} value={weight.value}>
                {weight.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      )}
      {inSection("typography") && block.type !== "cover" && (
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Заголовок"
          value={style.headingSize ?? theme.headingSize}
          min={0}
          max={140}
          onChange={(value) => update({ headingSize: value })}
        />
        <NumberField
          label="Подзаголовок"
          value={style.subheadingSize ?? theme.subheadingSize}
          min={0}
          max={100}
          onChange={(value) => update({ subheadingSize: value })}
        />
        <NumberField
          label="Текст"
          value={style.textSize ?? theme.textSize}
          min={0}
          max={72}
          onChange={(value) => update({ textSize: value })}
        />
      </div>
      )}
    </div>
  );
}

type BlockStyle = {
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

function normalizeBlockStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
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

function updateBlockStyle(
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

function FlatCheckbox({
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

function SliderTrack({
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

function FieldText({
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

function FieldTextarea({
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

function EntityListEditor({
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

function CoverImageEditor({
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

function resolveCoverBackgroundVisual(
  data: Record<string, unknown> | null,
  fallbackColor: string
) {
  const modeRaw = typeof data?.coverBackgroundMode === "string" ? data.coverBackgroundMode : "";
  const mode: CoverBackgroundMode =
    modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
  const fromRaw = typeof data?.coverBackgroundFrom === "string" ? data.coverBackgroundFrom.trim() : "";
  const toRaw = typeof data?.coverBackgroundTo === "string" ? data.coverBackgroundTo.trim() : "";
  const angleRaw = Number(data?.coverBackgroundAngle);
  const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 135;
  const stopARaw = Number(data?.coverBackgroundStopA);
  const stopA = Number.isFinite(stopARaw) ? Math.max(0, Math.min(100, stopARaw)) : 0;
  const stopBRaw = Number(data?.coverBackgroundStopB);
  const stopB = Number.isFinite(stopBRaw) ? Math.max(0, Math.min(100, stopBRaw)) : 100;
  const from = fromRaw || fallbackColor || "#ffffff";
  const to = toRaw || from;
  if (mode === "linear") {
    return {
      backgroundColor: from,
      backgroundImage: `linear-gradient(${Math.round(angle)}deg, ${from}, ${to})`,
    };
  }
  if (mode === "radial") {
    const innerStop = Math.min(stopA, stopB);
    const outerStop = Math.max(stopA, stopB);
    const innerColor = stopA <= stopB ? from : to;
    const outerColor = stopA <= stopB ? to : from;
    return {
      backgroundColor: from,
      backgroundImage: `radial-gradient(circle at center, ${innerColor} 0%, ${innerColor} ${Math.round(
        innerStop
      )}%, ${outerColor} ${Math.round(outerStop)}%, ${outerColor} 100%)`,
    };
  }
  return { backgroundColor: from, backgroundImage: "none" };
}

function resolveMenuBlockBackgroundVisual(
  data: Record<string, unknown> | null,
  fallbackColor: string
) {
  const modeRaw =
    typeof data?.menuBlockBackgroundMode === "string" ? data.menuBlockBackgroundMode : "";
  const mode: CoverBackgroundMode =
    modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
  const fromRaw =
    typeof data?.menuBlockBackgroundFrom === "string" ? data.menuBlockBackgroundFrom.trim() : "";
  const toRaw =
    typeof data?.menuBlockBackgroundTo === "string" ? data.menuBlockBackgroundTo.trim() : "";
  const angleRaw = Number(data?.menuBlockBackgroundAngle);
  const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 135;
  const stopARaw = Number(data?.menuBlockBackgroundStopA);
  const stopA = Number.isFinite(stopARaw) ? Math.max(0, Math.min(100, stopARaw)) : 0;
  const stopBRaw = Number(data?.menuBlockBackgroundStopB);
  const stopB = Number.isFinite(stopBRaw) ? Math.max(0, Math.min(100, stopBRaw)) : 100;
  const from = fromRaw || fallbackColor || "#ffffff";
  const to = toRaw || from;
  if (mode === "linear") {
    return {
      backgroundColor: from,
      backgroundImage: `linear-gradient(${Math.round(angle)}deg, ${from}, ${to})`,
    };
  }
  if (mode === "radial") {
    const innerStop = Math.min(stopA, stopB);
    const outerStop = Math.max(stopA, stopB);
    const innerColor = stopA <= stopB ? from : to;
    const outerColor = stopA <= stopB ? to : from;
    return {
      backgroundColor: from,
      backgroundImage: `radial-gradient(circle at center, ${innerColor} 0%, ${innerColor} ${Math.round(
        innerStop
      )}%, ${outerColor} ${Math.round(outerStop)}%, ${outerColor} 100%)`,
    };
  }
  return { backgroundColor: from, backgroundImage: "none" };
}

function resolveMenuSectionBackgroundVisual(
  data: Record<string, unknown> | null,
  fallbackColor: string
) {
  const modeRaw =
    typeof data?.menuSectionBackgroundMode === "string" ? data.menuSectionBackgroundMode : "";
  const mode: CoverBackgroundMode =
    modeRaw === "linear" || modeRaw === "radial" ? modeRaw : "solid";
  const fromRaw =
    typeof data?.menuSectionBackgroundFrom === "string" ? data.menuSectionBackgroundFrom.trim() : "";
  const toRaw =
    typeof data?.menuSectionBackgroundTo === "string" ? data.menuSectionBackgroundTo.trim() : "";
  const angleRaw = Number(data?.menuSectionBackgroundAngle);
  const angle = Number.isFinite(angleRaw) ? Math.max(0, Math.min(360, angleRaw)) : 135;
  const stopARaw = Number(data?.menuSectionBackgroundStopA);
  const stopA = Number.isFinite(stopARaw) ? Math.max(0, Math.min(100, stopARaw)) : 0;
  const stopBRaw = Number(data?.menuSectionBackgroundStopB);
  const stopB = Number.isFinite(stopBRaw) ? Math.max(0, Math.min(100, stopBRaw)) : 100;
  const from = fromRaw || fallbackColor || "#ffffff";
  const to = toRaw || from;
  if (mode === "linear") {
    return {
      backgroundColor: from,
      backgroundImage: `linear-gradient(${Math.round(angle)}deg, ${from}, ${to})`,
    };
  }
  if (mode === "radial") {
    const innerStop = Math.min(stopA, stopB);
    const outerStop = Math.max(stopA, stopB);
    const innerColor = stopA <= stopB ? from : to;
    const outerColor = stopA <= stopB ? to : from;
    return {
      backgroundColor: from,
      backgroundImage: `radial-gradient(circle at center, ${innerColor} 0%, ${innerColor} ${Math.round(
        innerStop
      )}%, ${outerColor} ${Math.round(outerStop)}%, ${outerColor} 100%)`,
    };
  }
  return { backgroundColor: from, backgroundImage: "none" };
}

function BlockPreview({
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

function InsertSlot({
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

function renderBlock(
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

function buildBookingVars(style: BlockStyle, theme: SiteTheme) {
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

function renderBooking(
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

function renderLoaderPreview(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
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

function headingStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontHeading || theme.fontHeading,
    fontWeight: style.fontWeightHeading ?? undefined,
    fontSize: style.headingSize ?? theme.headingSize,
    textAlign: style.textAlignHeading ?? style.textAlign,
    color: style.textColor || theme.textColor,
  } as const;
}

function subheadingStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontSubheading || style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightSubheading ?? undefined,
    fontSize: style.subheadingSize ?? theme.subheadingSize,
    textAlign: style.textAlignSubheading ?? style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

function textStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontBody || theme.fontBody,
    fontWeight: style.fontWeightBody ?? undefined,
    fontSize: style.textSize ?? theme.textSize,
    textAlign: style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

function buttonStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    backgroundColor: style.buttonColor || theme.buttonColor,
    color: style.buttonTextColor || theme.buttonTextColor,
    fontWeight: style.fontWeightBody ?? undefined,
    borderRadius:
      style.buttonRadius !== null ? style.buttonRadius : theme.buttonRadius,
  } as const;
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function renderCover(
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
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
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
  const contentColumns = clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, "cover");
  const contentRange = centeredGridRange(contentColumns);
  const gridStart = clampGridColumn(style.gridStartColumn ?? contentRange.start);
  const gridEnd = Math.max(gridStart, clampGridColumn(style.gridEndColumn ?? contentRange.end));
  const gridSpan = Math.max(1, gridEnd - gridStart + 1);
  const gridWidthPercent = `${(gridSpan / MAX_BLOCK_COLUMNS) * 100}%`;
  const gridLeftPercent = `${((gridStart - 1) / MAX_BLOCK_COLUMNS) * 100}%`;
  const contentMaxWidth = forceMobileLayout ? "100%" : gridWidthPercent;
  const contentMarginLeft = forceMobileLayout ? 0 : gridLeftPercent;
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

function normalizeExternalHref(value: string): string {
  return value.startsWith("http://") || value.startsWith("https://")
    ? value
    : `https://${value}`;
}

function resolveSocialHrefByKey(accountProfile: AccountProfile, key: string): string | null {
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

function resolvePrimarySocialHref(
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

function renderMenuBlock(
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
  const ctaNode =
    showButton && account.publicSlug && (ctaMode === "booking" || phoneValue) ? (
      <a
        href={
          ctaMode === "phone" && phoneValue
            ? `tel:${phoneValue}`
            : buildBookingLink({ publicSlug: account.publicSlug })
        }
        className="inline-flex px-4 py-2 text-sm font-semibold"
        style={buttonStyle(style, theme)}
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

function MenuPreview({
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

function renderAbout(
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

function renderClient(block: SiteBlock, account: AccountInfo, theme: SiteTheme, style: BlockStyle) {
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
function renderLocations(
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

function renderServices(
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

function renderSpecialists(
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

function renderPromos(
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

function renderWorks(
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

function renderReviews(block: SiteBlock, theme: SiteTheme, style: BlockStyle) {
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

function buildAishaWidgetConfig(
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

function renderAisha(
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

function renderContacts(
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
