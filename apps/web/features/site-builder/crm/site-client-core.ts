import type { CSSProperties } from "react";
import {
  type BlockType,
  type SiteBlock,
  type SiteDraft,
  type SitePageKey,
  makeBlockId,
} from "@/lib/site-builder";
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
export type CurrentEntity =
  | { type: "location" | "service" | "specialist" | "promo"; id: number }
  | null;
export type EntityPageKey = Exclude<SitePageKey, "home" | "booking" | "client">;

export type PublicPageData = {
  id: number;
  status: string;
  draftJson: SiteDraft;
  publishedVersionId: number | null;
};

export type SiteClientProps = {
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

export const cloneDraftSnapshot = (value: SiteDraft): SiteDraft =>
  JSON.parse(JSON.stringify(value)) as SiteDraft;

export const COVER_LINE_STEP_PX = 30;
export const COVER_LINE_OPTIONS = Array.from({ length: 15 }, (_, index) => index * 0.5);
export const PANEL_ANIMATION_MS = 220;
export const COVER_BACKGROUND_POSITION_OPTIONS = [
  { value: "center top", label: "^ Центр Верх" },
  { value: "center center", label: "Центр" },
  { value: "center bottom", label: "v Центр Низ" },
] as const;
export const COVER_BACKGROUND_POSITION_VALUES = new Set<string>(
  COVER_BACKGROUND_POSITION_OPTIONS.map((option) => option.value)
);

export const formatCoverLineLabel = (lineValue: number) => {
  if (lineValue === 0) return "0";
  const px = Math.round(lineValue * COVER_LINE_STEP_PX);
  return `${lineValue} line (${px}px)`;
};

export const variantsLabel: Record<"v1" | "v2" | "v3" | "v4" | "v5", string> = {
  v1: "Вариант 1",
  v2: "Вариант 2",
  v3: "Вариант 3",
  v4: "Вариант 4",
  v5: "Вариант 5",
};

export const PAGE_LABELS: Record<SitePageKey, string> = {
  home: "Главная",
  booking: "Онлайн-запись",
  client: "Личный кабинет",
  locations: "Локации",
  services: "Услуги",
  specialists: "Специалисты",
  promos: "Промо/скидки",
};

export const PAGE_KEYS: SitePageKey[] = [
  "home",
  "booking",
  "client",
  "locations",
  "services",
  "specialists",
  "promos",
];
export const isSystemBlockType = (type: unknown): type is "booking" => type === "booking";
export const QUICK_BLOCK_TYPES: BlockType[] = ["cover"];

export const MOBILE_VIEWPORTS = {
  mobile360: { label: "Мобильный 360px", width: 360 },
  mobileLandscape480: { label: "Мобильный гориз. 480px", width: 480 },
  tablet640: { label: "Планшет 640px", width: 640 },
  tabletLandscape960: { label: "Планшет гориз. 960px", width: 960 },
} as const;
export type MobileViewportKey = keyof typeof MOBILE_VIEWPORTS;

export type EditorSection = { id: string; label: string };
export type CoverBackgroundMode = "solid" | "linear" | "radial";

export const CONTENT_SECTIONS_BY_BLOCK: Partial<Record<BlockType, EditorSection[]>> = {
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
  loader: [{ id: "main", label: "Контент блока" }],
  booking: [{ id: "main", label: "Контент блока" }],
  aisha: [{ id: "main", label: "Контент блока" }],
};

export type CssVars = CSSProperties & Record<`--${string}`, string | number>;

export const SETTINGS_SECTIONS_BY_BLOCK: Partial<Record<BlockType, EditorSection[]>> = {
  menu: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "button", label: "Кнопка" },
  ],
  cover: [
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
  booking: [
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

export const SOCIAL_ICONS: Record<string, string> = {
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

export const SOCIAL_LABELS: Record<string, string> = {
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

export const THEME_FONTS = [
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

export const FONT_WEIGHTS = [
  { label: "300 (Light)", value: 300 },
  { label: "400 (Regular)", value: 400 },
  { label: "500 (Medium)", value: 500 },
  { label: "600 (SemiBold)", value: 600 },
  { label: "700 (Bold)", value: 700 },
  { label: "800 (ExtraBold)", value: 800 },
] as const;

export const DEFAULT_BLOCK_WIDTH = 1000;
export const MIN_BLOCK_WIDTH = 800;
export const MAX_BLOCK_WIDTH = 2400;
export const BLOCK_WIDTH_STEP = 100;
export const LEGACY_WIDTH_REFERENCE = 2400;
export const DEFAULT_BLOCK_COLUMNS = 6;
export const MIN_BLOCK_COLUMNS = 1;
export const MAX_BLOCK_COLUMNS = 12;
export const GRID_MIN_COLUMN = 1;
export const GRID_MAX_COLUMN = 12;
export const BOOKING_MIN_BLOCK_COLUMNS = 10;
export const BOOKING_MAX_BLOCK_COLUMNS = 15;
export const BOOKING_MIN_PRESET = 1;
export const BOOKING_MAX_PRESET = 6;

export function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function hexToRgbaString(hex: string, alpha: number) {
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

export function parseBackdropColor(value: unknown) {
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

export function clampBlockColumns(columns: number, blockType: BlockType | string): number {
  if (blockType === "booking") {
    return Math.min(
      BOOKING_MAX_BLOCK_COLUMNS,
      Math.max(BOOKING_MIN_BLOCK_COLUMNS, Math.round(columns))
    );
  }
  return Math.min(MAX_BLOCK_COLUMNS, Math.max(MIN_BLOCK_COLUMNS, Math.round(columns)));
}

export function bookingPresetFromColumns(columns: number): number {
  return Math.min(
    BOOKING_MAX_PRESET,
    Math.max(BOOKING_MIN_PRESET, Math.round(columns) - (BOOKING_MIN_BLOCK_COLUMNS - 1))
  );
}

export function bookingColumnsFromPreset(preset: number): number {
  return clampBlockColumns(BOOKING_MIN_BLOCK_COLUMNS + Math.round(preset) - 1, "booking");
}

export function clampGridColumn(value: number): number {
  return Math.min(GRID_MAX_COLUMN, Math.max(GRID_MIN_COLUMN, Math.round(value)));
}

export function centeredGridRange(columns: number): { start: number; end: number } {
  const span = Math.min(GRID_MAX_COLUMN, Math.max(1, Math.round(columns)));
  const start = Math.max(1, Math.floor((GRID_MAX_COLUMN - span) / 2) + 1);
  const end = Math.min(GRID_MAX_COLUMN, start + span - 1);
  return { start, end };
}

export function bookingContentColumns(columns: number): number {
  return clampBlockColumns(columns, "booking") - 4;
}

export function bookingCardsPerRow(columns: number): number {
  const preset = bookingPresetFromColumns(columns);
  if (preset <= 2) return 2;
  if (preset <= 4) return 3;
  return 4;
}

export const defaultBlockStyle = {
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

export const defaultBlockData: Record<string, Record<string, unknown>> = {
  cover: {
    title: "",
    subtitle: "Онлайн-запись и лучшие специалисты рядом",
    description: "Выберите услугу, специалиста и удобное время.",
    buttonText: "Записаться",
    showButton: true,
    secondaryButtonText: "Наши соцсети",
    showSecondaryButton: false,
    secondaryButtonSource: "auto",
    secondaryButtonHref: "",
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
    coverSlides: [
      {
        id: "slide-1",
        title: "Красота без компромиссов",
        description: "Запишитесь на любимую услугу в удобное время и доверяйте себя профессионалам.",
        buttonText: "Подробнее",
        buttonPage: "",
        buttonHref: "",
        imageUrl: "",
      },
      {
        id: "slide-2",
        title: "Услуги для вашего образа",
        description: "Стрижки, окрашивание, уход и макияж в одном салоне с персональным подходом.",
        buttonText: "Подробнее",
        buttonPage: "",
        buttonHref: "",
        imageUrl: "",
      },
      {
        id: "slide-3",
        title: "Сильная команда мастеров",
        description: "Выберите специалиста по рейтингу, портфолио и свободному времени.",
        buttonText: "Подробнее",
        buttonPage: "",
        buttonHref: "",
        imageUrl: "",
      },
    ],
    coverSliderInfinite: true,
    coverSliderShowArrows: true,
    coverSliderShowDots: true,
    coverSliderAutoplayMs: 0,
    coverSliderArrowSize: "sm",
    coverSliderArrowThickness: 3,
    coverSliderArrowColor: "#222222",
    coverSliderArrowBgColor: "#ffffff",
    coverSliderArrowHoverColor: "",
    coverSliderArrowHoverBgColor: "",
    coverSliderArrowOutlineColor: "transparent",
    coverSliderArrowOutlineThickness: 1,
    coverSliderDotSize: 10,
    coverSliderDotColor: "#000000",
    coverSliderDotActiveColor: "#ffffff",
    coverSliderDotBorderWidth: 2,
    coverSliderDotBorderColor: "#ffffff",
    align: "left",
    coverContentVerticalAlign: "center",
    coverImageInsetPx: 0,
    coverImageRadiusPx: 0,
    coverFlipHorizontal: false,
    imageSource: { type: "none" },
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
      buttonColorLight: "#000000",
      buttonColorDark: "#000000",
      buttonTextColorLight: "#ffffff",
      buttonTextColorDark: "#ffffff",
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

export function createBlock(type: BlockType): SiteBlock {
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

