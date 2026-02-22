
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCK_LABELS,
  BLOCK_VARIANTS,
  type BlockType,
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

type EditorSection = { id: string; label: string };

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

const SETTINGS_SECTIONS_BY_BLOCK: Partial<Record<BlockType, EditorSection[]>> = {
  menu: [
    { id: "layout", label: "Основные настройки" },
    { id: "colors", label: "Цвета" },
    { id: "typography", label: "Типографика" },
    { id: "effects", label: "Эффекты" },
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
  { label: "Prata", heading: "Prata, serif", body: "Manrope, sans-serif" },
  { label: "Playfair", heading: "\"Playfair Display\", serif", body: "Manrope, sans-serif" },
  { label: "Manrope", heading: "Manrope, sans-serif", body: "Manrope, sans-serif" },
  { label: "Montserrat", heading: "Montserrat, sans-serif", body: "Montserrat, sans-serif" },
  { label: "Lora", heading: "Lora, serif", body: "Manrope, sans-serif" },
  { label: "Cormorant", heading: "\"Cormorant Garamond\", serif", body: "Manrope, sans-serif" },
  { label: "Raleway", heading: "Raleway, sans-serif", body: "Raleway, sans-serif" },
  { label: "Nunito", heading: "Nunito, sans-serif", body: "Nunito, sans-serif" },
  { label: "Oswald", heading: "Oswald, sans-serif", body: "Manrope, sans-serif" },
  { label: "PT Serif", heading: "\"PT Serif\", serif", body: "PT Sans, sans-serif" },
  { label: "Inter", heading: "Inter, sans-serif", body: "Inter, sans-serif" },
  { label: "DM Sans", heading: "\"DM Sans\", sans-serif", body: "\"DM Sans\", sans-serif" },
];

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
  shadowColor: "",
  shadowSize: null,
  gradientEnabled: false,
  gradientDirection: "vertical",
  gradientFrom: "",
  gradientTo: "",
  textAlign: "left",
  fontHeading: "",
  fontBody: "",
  headingSize: null,
  subheadingSize: null,
  textSize: null,
};

const defaultBlockData: Record<string, Record<string, unknown>> = {
  cover: {
    title: "Салон красоты",
    subtitle: "Онлайн-запись и лучшие специалисты рядом",
    description: "Выберите услугу, специалиста и удобное время.",
    buttonText: "Записаться",
    showButton: true,
    align: "left",
    imageSource: { type: "account" },
    style: defaultBlockStyle,
  },
  menu: {
    title: "Меню",
    menuItems: ["home", "booking", "client", "locations", "services", "specialists", "promos"],
    showLogo: true,
    showCompanyName: true,
    showOnAllPages: true,
    showButton: true,
    showThemeToggle: false,
    ctaMode: "booking",
    phoneOverride: "",
    buttonText: "Записаться",
    showSearch: false,
    showAccount: false,
    accountTitle: "",
    menuHeight: 56,
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
    style: {
      ...defaultBlockStyle,
      blockWidth: LEGACY_WIDTH_REFERENCE,
      blockWidthColumns: MAX_BLOCK_COLUMNS,
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
    title: "Работы",
    subtitle: "Наши последние работы",
    source: "locations",
    mode: "all",
    ids: [],
    useCurrent: false,
    style: defaultBlockStyle,
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
    normalizeDraft(initialPublicPage.draftJson)
  );
  const [activePage, setActivePage] = useState<SitePageKey>("home");
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
  const [leftPanel, setLeftPanel] = useState<"pages" | "library" | null>(null);
  const [libraryBlock, setLibraryBlock] = useState<BlockType | null>(null);
  const [rightPanel, setRightPanel] = useState<"global" | "content" | "settings" | null>(
    null
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePanelSectionId, setActivePanelSectionId] = useState<string | null>(null);
  const [showPanelExitConfirm, setShowPanelExitConfirm] = useState(false);
  const [panelBaselineKey, setPanelBaselineKey] = useState<string | null>(null);
  const [panelBaselineSignature, setPanelBaselineSignature] = useState<string | null>(null);
  const [activeSpacingSlot, setActiveSpacingSlot] = useState<number | null>(null);
  const [activeSpacingTarget, setActiveSpacingTarget] = useState<"prev" | "next" | null>(
    null
  );
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [spacingAnchorBlockId, setSpacingAnchorBlockId] = useState<string | null>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!displayBlocks.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !displayBlocks.some((block) => block.id === selectedId)) {
      setSelectedId(displayBlocks[0]?.id ?? null);
    }
  }, [displayBlocks, selectedId]);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const selectedBlock = displayBlocks.find((block) => block.id === selectedId) ?? null;
  const activeBlockId = spacingAnchorBlockId ?? selectedId;
  const getSlotSpacing = (slotIndex: number) => {
    const prevBlock = displayBlocks[slotIndex - 1] ?? null;
    const nextBlock = displayBlocks[slotIndex] ?? null;
    const prevBottom = prevBlock ? normalizeBlockStyle(prevBlock, draft.theme).marginBottom : 0;
    const nextTop = nextBlock ? normalizeBlockStyle(nextBlock, draft.theme).marginTop : 0;
    return Math.max(0, prevBottom + nextTop);
  };
  const getSlotActiveOffset = (
    slotIndex: number,
    target: "prev" | "next" | null = null
  ) => {
    const prevBlock = displayBlocks[slotIndex - 1] ?? null;
    const nextBlock = displayBlocks[slotIndex] ?? null;
    if (target === "next" && nextBlock) {
      return normalizeBlockStyle(nextBlock, draft.theme).marginTop;
    }
    if (target === "prev" && prevBlock) {
      return normalizeBlockStyle(prevBlock, draft.theme).marginBottom;
    }
    if (nextBlock && activeBlockId && nextBlock.id === activeBlockId) {
      return normalizeBlockStyle(nextBlock, draft.theme).marginTop;
    }
    if (prevBlock && activeBlockId && prevBlock.id === activeBlockId) {
      return normalizeBlockStyle(prevBlock, draft.theme).marginBottom;
    }
    if (prevBlock) return normalizeBlockStyle(prevBlock, draft.theme).marginBottom;
    if (nextBlock) return normalizeBlockStyle(nextBlock, draft.theme).marginTop;
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
    if (rightPanel === "global") {
      return [{ id: "theme", label: "Глобальные стили" }];
    }
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
    ? `${rightPanel}:${rightPanel === "global" ? "theme" : selectedBlock?.id ?? "none"}`
    : null;
  const currentPanelSignature = useMemo(() => {
    if (!rightPanel) return null;
    if (rightPanel === "global") {
      return JSON.stringify(draft.theme);
    }
    if (!selectedBlock) return null;
    return JSON.stringify(selectedBlock);
  }, [rightPanel, draft.theme, selectedBlock]);
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
    if (
      !activePanelSectionId ||
      !currentPanelSections.some((section) => section.id === activePanelSectionId)
    ) {
      setActivePanelSectionId(currentPanelSections[0].id);
    }
  }, [currentPanelSections, activePanelSectionId]);

  useEffect(() => {
    if (!rightPanel) {
      setPanelBaselineKey(null);
      setPanelBaselineSignature(null);
      setShowPanelExitConfirm(false);
      return;
    }
    if (!panelTargetKey || !currentPanelSignature) return;
    if (panelBaselineKey !== panelTargetKey) {
      setPanelBaselineKey(panelTargetKey);
      setPanelBaselineSignature(currentPanelSignature);
      setShowPanelExitConfirm(false);
    }
  }, [rightPanel, panelTargetKey, currentPanelSignature, panelBaselineKey]);

  const savePanelDraft = async (closeAfterSave: boolean) => {
    const ok = await savePublic(false);
    if (closeAfterSave && ok) {
      setRightPanel(null);
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
      setRightPanel(null);
      return;
    }
    setShowPanelExitConfirm(true);
  };
  const closePanelWithoutSave = () => {
    setShowPanelExitConfirm(false);
    setRightPanel(null);
  };


  const updateBlock = (id: string, updater: (block: SiteBlock) => SiteBlock) => {
    setDraft((prev) => {
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
    });
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

  const updateTheme = (patch: Partial<SiteTheme>) => {
    setDraft((prev) => ({
      ...prev,
      theme: applyThemePatch(prev.theme, patch),
    }));
  };

  const setThemeMode = (mode: "light" | "dark") => {
    setDraft((prev) => ({
      ...prev,
      theme: applyThemePatch(prev.theme, { mode }),
    }));
  };

  const updateBlocks = (nextBlocks: SiteBlock[]) => {
    setDraft((prev) => {
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
    });
  };

  const insertBlock = (
    type: BlockType,
    index?: number,
    variant?: "v1" | "v2" | "v3" | "v4" | "v5"
  ) => {
    const block = createBlock(type);
    if (type === "menu") {
      block.data = {
        ...block.data,
        accountTitle: account.name,
        showCompanyName: true,
        menuHeight: 56,
      };
    }
    if (variant) block.variant = variant;

    if (type === "menu" && activePage !== "home") {
      const existingMenu = homeBlocks.find((item) => item.type === "menu");
      if (!existingMenu) {
        const nextHome = [block, ...homeBlocks];
        setDraft((prev) => ({
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
            normalizeBlockStyle(block, draft.theme).marginTop + deltaY
          ),
        })
      );
      return;
    }

    if (target === "next" && nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(
            normalizeBlockStyle(block, draft.theme).marginTop + deltaY
          ),
        })
      );
      return;
    }

    if (target === "prev" && prevBlock) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(
            normalizeBlockStyle(block, draft.theme).marginBottom + deltaY
          ),
        })
      );
      return;
    }

    if (nextBlock && activeBlockId && nextBlock.id === activeBlockId) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, draft.theme).marginTop + deltaY),
        })
      );
      return;
    }

    if (prevBlock && activeBlockId && prevBlock.id === activeBlockId) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(
            normalizeBlockStyle(block, draft.theme).marginBottom + deltaY
          ),
        })
      );
      return;
    }

    if (prevBlock) {
      updateBlock(prevBlock.id, (block) =>
        updateBlockStyle(block, {
          marginBottom: clampBlockOffset(
            normalizeBlockStyle(block, draft.theme).marginBottom + deltaY
          ),
        })
      );
      return;
    }

    if (nextBlock) {
      updateBlock(nextBlock.id, (block) =>
        updateBlockStyle(block, {
          marginTop: clampBlockOffset(normalizeBlockStyle(block, draft.theme).marginTop + deltaY),
        })
      );
    }
  };

  const savePublic = async (publish: boolean): Promise<boolean> => {
    setSaving("public");
    setMessage(null);
    const payloadDraft = {
      ...draft,
      blocks: draft.pages?.home ?? draft.blocks,
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
    const payloadDraft = {
      ...draft,
      blocks: draft.pages?.home ?? draft.blocks,
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

  const globalBorderColor = draft.theme.borderColor?.trim() || "transparent";
  const themeStyle: Record<string, string> = {
    "--bp-accent": draft.theme.accentColor,
    "--bp-surface": draft.theme.surfaceColor,
    "--bp-paper": draft.theme.panelColor,
    "--bp-panel": draft.theme.panelColor,
    "--bp-ink": draft.theme.textColor,
    "--bp-muted": draft.theme.mutedColor,
    "--bp-stroke": globalBorderColor,
    "--site-accent": draft.theme.accentColor,
    "--site-surface": draft.theme.surfaceColor,
    "--site-panel": draft.theme.panelColor,
    "--site-text": draft.theme.textColor,
    "--site-muted": draft.theme.mutedColor,
    "--site-font-heading": draft.theme.fontHeading,
    "--site-font-body": draft.theme.fontBody,
    "--site-border": globalBorderColor,
    "--site-button": draft.theme.buttonColor,
    "--site-button-text": draft.theme.buttonTextColor,
    "--site-shadow-color": draft.theme.shadowColor,
    "--site-shadow-size": `${draft.theme.shadowSize}px`,
    "--site-radius": `${draft.theme.radius}px`,
    "--site-button-radius": `${draft.theme.buttonRadius}px`,
    "--site-gap": `${draft.theme.blockSpacing}px`,
    "--site-h1": `${draft.theme.headingSize}px`,
    "--site-h2": `${draft.theme.subheadingSize}px`,
    "--site-text-size": `${draft.theme.textSize}px`,
  };
  const previewCanvasWidth = previewMode === "mobile" ? 420 : undefined;
  const mainGradient = draft.theme.gradientEnabled
    ? `linear-gradient(${draft.theme.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${draft.theme.gradientFrom}, ${draft.theme.gradientTo})`
    : "none";
  const handleThemeToggle = () =>
    setThemeMode(draft.theme.mode === "dark" ? "light" : "dark");
  const panelTheme =
    draft.theme.mode === "dark"
      ? {
          surface: "#11161f",
          panel: "#1a2230",
          border: "rgba(255,255,255,0.16)",
          text: "#e5e7eb",
          muted: "#9ca3af",
          accent: "#60a5fa",
          save: "#0b0f16",
          saveClose: "#4b5563",
        }
      : {
          surface: "#f3f3f3",
          panel: "#ffffff",
          border: "#d9dde5",
          text: "#111827",
          muted: "#6b7280",
          accent: "#2563eb",
          save: "#000000",
          saveClose: "#6b7280",
        };

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
        <div className="h-12" />
        <div className="fixed top-16 left-0 right-0 z-30 border border-x-0 border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-4 shadow-[var(--bp-shadow)] md:left-[var(--crm-sidebar-width)] sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
              Конструктор сайта
            </div>
            <div className="mt-1 text-sm text-[color:var(--bp-muted)]">
              Статус: {publicPage.status}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setLeftPanel((prev) => (prev === "pages" ? null : "pages"))
              }
              className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm"
            >
              Страницы сайта
            </button>
            <button
              type="button"
              onClick={() => {
                setInsertIndex(0);
                setLeftPanel((prev) => (prev === "library" ? null : "library"));
              }}
              className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm"
            >
              Библиотека блоков
            </button>
            <button
              type="button"
              onClick={() => setRightPanel("global")}
              className="rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm"
            >
              Глобальные стили
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
          </div>
          <div className="flex flex-wrap gap-2">
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
          backgroundColor: draft.theme.gradientEnabled
            ? draft.theme.gradientFrom
            : draft.theme.surfaceColor,
          backgroundImage: mainGradient,
        }}
      >
        <main
          className="w-full"
          data-site-theme={draft.theme.mode}
          style={{
            ...themeStyle,
            backgroundColor: draft.theme.gradientEnabled
              ? draft.theme.gradientFrom
              : draft.theme.surfaceColor,
            backgroundImage: mainGradient,
            color: draft.theme.textColor,
            fontFamily: draft.theme.fontBody,
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
              paddingBottom: 24,
              paddingLeft: 0,
              paddingRight: 0,
              maxWidth: previewCanvasWidth,
            }}
          >
            {!isSystemPage && (
              <InsertSlot
                index={0}
                slotRef={(el) => registerSlotRef(0, el)}
                spacing={getSlotSpacing(0)}
                activeOffset={getSlotActiveOffset(0, activeSpacingTarget)}
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
            )}
            {displayBlocks.map((block: SiteBlock, index: number) => {
              const isSharedMenu = Boolean(
                sharedMenuBlock && activePage !== "home" && block.id === sharedMenuBlock.id
              );
              const isBlockActive = block.id === hoveredBlockId;
              const controlsDark = draft.theme.mode === "dark";
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
                          onClick={() => removeBlock(block.id)}
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
                  theme={draft.theme}
                  loaderConfig={loaderConfig}
                  currentEntity={currentEntity}
                  onThemeToggle={handleThemeToggle}
                  onSelect={() => {
                    setSelectedId(block.id);
                    setSpacingAnchorBlockId(block.id);
                    setHoveredBlockId(block.id);
                  }}
                  isSelected={block.id === selectedId}
                />
                {!isSystemPage && (
                  <InsertSlot
                    index={index + 1}
                    slotRef={(el) => registerSlotRef(index + 1, el)}
                    spacing={getSlotSpacing(index + 1)}
                    activeOffset={getSlotActiveOffset(index + 1, activeSpacingTarget)}
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
                )}
              </div>
            );
            })}
            {displayBlocks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-10 text-center text-sm text-[color:var(--bp-muted)]">
                Добавьте блок, чтобы начать собирать страницу.
              </div>
            )}
          </div>
        </main>

        {leftPanel && (
          <aside
            className="fixed z-[140] w-[320px] overflow-y-auto border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] shadow-[var(--bp-shadow)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ left: "var(--crm-sidebar-width, 272px)", top: 64, bottom: 0 }}
          >
            <div className="flex items-center justify-between border-b border-[color:var(--bp-stroke)] px-4 py-3">
              <div className="text-sm font-semibold">
                {leftPanel === "pages" ? "Страницы сайта" : "Библиотека блоков"}
              </div>
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
            {leftPanel === "pages" && (
              <div className="p-4">
                <div className="flex flex-col gap-2">
                  {PAGE_KEYS.map((pageKey) => (
                    <button
                      key={pageKey}
                      type="button"
                      onClick={() => {
                        setActivePage(pageKey);
                        setCurrentEntity(null);
                        setLeftPanel(null);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${
                        pageKey === activePage
                          ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                          : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                      }`}
                    >
                      {PAGE_LABELS[pageKey]}
                    </button>
                  ))}
                </div>

                {(locations.length > 0 ||
                  services.length > 0 ||
                  specialists.length > 0 ||
                  promos.length > 0) && (
                  <div className="mt-5 border-t border-[color:var(--bp-stroke)] pt-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
                      Профили
                    </div>
                    {locations.length > 0 && (
                      <div className="mt-3">
                        <div className="mb-2 text-xs font-semibold text-[color:var(--bp-muted)]">
                          Локации
                        </div>
                        <div className="flex flex-col gap-2">
                          {locations.map((item) => (
                            <button
                              key={`location-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("locations");
                                setCurrentEntity({ type: "location", id: item.id });
                                setLeftPanel(null);
                              }}
                              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "location" &&
                                currentEntity.id === item.id
                                  ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {services.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold text-[color:var(--bp-muted)]">
                          Услуги
                        </div>
                        <div className="flex flex-col gap-2">
                          {services.map((item) => (
                            <button
                              key={`service-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("services");
                                setCurrentEntity({ type: "service", id: item.id });
                                setLeftPanel(null);
                              }}
                              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "service" &&
                                currentEntity.id === item.id
                                  ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {specialists.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold text-[color:var(--bp-muted)]">
                          Специалисты
                        </div>
                        <div className="flex flex-col gap-2">
                          {specialists.map((item) => (
                            <button
                              key={`specialist-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("specialists");
                                setCurrentEntity({ type: "specialist", id: item.id });
                                setLeftPanel(null);
                              }}
                              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "specialist" &&
                                currentEntity.id === item.id
                                  ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {promos.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold text-[color:var(--bp-muted)]">
                          Промо
                        </div>
                        <div className="flex flex-col gap-2">
                          {promos.map((item) => (
                            <button
                              key={`promo-${item.id}`}
                              type="button"
                              onClick={() => {
                                setActivePage("promos");
                                setCurrentEntity({ type: "promo", id: item.id });
                                setLeftPanel(null);
                              }}
                              className={`rounded-xl border px-3 py-2 text-left text-sm ${
                                currentEntity?.type === "promo" &&
                                currentEntity.id === item.id
                                  ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-muted)]"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {leftPanel === "library" && (
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
                          ? "border-[color:var(--bp-accent)] bg-[color:var(--bp-paper)]"
                          : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
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
            )}
          </aside>
        )}

        {leftPanel === "library" && libraryBlock && (
          <aside
            className="fixed z-[140] w-[320px] overflow-y-auto border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] shadow-[var(--bp-shadow)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{ left: "calc(var(--crm-sidebar-width, 272px) + 320px)", top: 64, bottom: 0 }}
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
                  className="w-full rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-4 text-left"
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
            className="fixed inset-0 z-[139] cursor-default bg-transparent"
            style={{ top: 64 }}
            onClick={requestClosePanel}
          />
        )}

        {rightPanel && (
          <aside
            className="fixed z-[140] w-[760px] max-w-[calc(100vw-var(--crm-sidebar-width,272px)-24px)] overflow-y-auto border shadow-[var(--bp-shadow)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            style={{
              top: 64,
              bottom: 0,
              left: "var(--crm-sidebar-width, 272px)",
              borderColor: panelTheme.border,
              backgroundColor: panelTheme.surface,
              color: panelTheme.text,
            }}
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
                  className="h-12 px-4 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: panelTheme.save }}
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => savePanelDraft(true)}
                  disabled={saving === "public"}
                  className="h-12 px-4 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: panelTheme.saveClose }}
                >
                  Сохранить и закрыть
                </button>
              </div>
              <div
                className="flex items-center justify-between border-t px-4 py-3"
                style={{ borderColor: panelTheme.border }}
              >
                <div className="text-sm font-semibold" style={{ color: panelTheme.text }}>
                  {rightPanel === "global"
                    ? "Глобальные стили"
                    : rightPanel === "settings"
                      ? selectedBlock
                        ? `Настройки · ${BLOCK_LABELS[selectedBlock.type]}`
                        : "Настройки блока"
                      : selectedBlock
                        ? `Контент · ${BLOCK_LABELS[selectedBlock.type]}`
                        : "Контент блока"}
                </div>
              </div>
            </div>
            <div className="grid min-h-[calc(100vh-176px)] grid-cols-[260px_minmax(0,1fr)]">
              <div
                className="border-r p-3"
                style={{ borderColor: panelTheme.border, backgroundColor: panelTheme.surface }}
              >
                <div className="space-y-2">
                  {currentPanelSections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActivePanelSectionId(section.id)}
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
              </div>
              <div className="p-4">
                <div
                  className="rounded-md border p-4 shadow-sm"
                  style={{
                    borderColor: panelTheme.border,
                    backgroundColor: panelTheme.panel,
                    color: panelTheme.text,
                  }}
                >
                  {rightPanel === "global" && (
                    <ThemeEditor theme={draft.theme} onChange={updateTheme} />
                  )}
                  {rightPanel === "content" && selectedBlock && (
                    <BlockEditor
                      block={selectedBlock}
                      accountName={account.name}
                      locations={locations}
                      services={services}
                      specialists={specialists}
                      promos={promos}
                      activeSectionId={activePanelSectionId ?? "main"}
                      onChange={(next) => updateBlock(selectedBlock.id, () => next)}
                    />
                  )}
                  {rightPanel === "settings" && selectedBlock && (
                    <BlockStyleEditor
                      block={selectedBlock}
                      theme={draft.theme}
                      activeSectionId={activePanelSectionId ?? "layout"}
                      onChange={(next) => updateBlock(selectedBlock.id, () => next)}
                    />
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}

        {showPanelExitConfirm && rightPanel && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 p-4">
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
      </div>
    </div>
  );
}

function ThemeEditor({
  theme,
  onChange,
}: {
  theme: SiteTheme;
  onChange: (patch: Partial<SiteTheme>) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <label className="text-sm">
        Тема
        <select
          value={theme.mode}
          onChange={(event) =>
            onChange({ mode: event.target.value as "light" | "dark" })
          }
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="light">Светлая</option>
          <option value="dark">Темная</option>
        </select>
      </label>
      <label className="text-sm">
        Пара шрифтов
        <select
          value={`${theme.fontHeading}||${theme.fontBody}`}
          onChange={(event) => {
            const [heading, body] = event.target.value.split("||");
            onChange({ fontHeading: heading, fontBody: body });
          }}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          {THEME_FONTS.map((font) => (
            <option
              key={font.label}
              value={`${font.heading}||${font.body}`}
            >
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          label="Тень"
          value={theme.shadowColor}
          onChange={(value) => onChange({ shadowColor: value })}
        />
        <NumberField
          label="Размер тени"
          value={theme.shadowSize}
          min={0}
          max={40}
          onChange={(value) => onChange({ shadowSize: value })}
        />
        <ColorField
          label="Фон"
          value={theme.surfaceColor}
          onChange={(value) => onChange({ surfaceColor: value })}
        />
        <ColorField
          label="Панели"
          value={theme.panelColor}
          onChange={(value) => onChange({ panelColor: value })}
        />
        <ColorField
          label="Текст"
          value={theme.textColor}
          onChange={(value) => onChange({ textColor: value })}
        />
        <ColorField
          label="Обводка"
          value={theme.borderColor}
          onChange={(value) => onChange({ borderColor: value })}
        />
        <ColorField
          label="Кнопка"
          value={theme.buttonColor}
          onChange={(value) => onChange({ buttonColor: value })}
        />
        <ColorField
          label="Текст кнопки"
          value={theme.buttonTextColor}
          onChange={(value) => onChange({ buttonTextColor: value })}
        />
        <ColorField
          label="Вторичный текст"
          value={theme.mutedColor}
          onChange={(value) => onChange({ mutedColor: value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={theme.gradientEnabled}
          onChange={(event) => onChange({ gradientEnabled: event.target.checked })}
        />
        Градиент фона
      </label>
      {theme.gradientEnabled && (
        <>
          <label className="text-sm">
            Направление градиента
            <select
              value={theme.gradientDirection}
              onChange={(event) =>
                onChange({
                  gradientDirection: event.target.value as SiteTheme["gradientDirection"],
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="vertical">Сверху вниз</option>
              <option value="horizontal">Слева направо</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Цвет 1"
              value={theme.gradientFrom}
              onChange={(value) => onChange({ gradientFrom: value })}
            />
            <ColorField
              label="Цвет 2"
              value={theme.gradientTo}
              onChange={(value) => onChange({ gradientTo: value })}
            />
          </div>
        </>
      )}
      <label className="text-sm">
        Радиус блоков: {theme.radius}px
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={theme.radius}
          onChange={(event) => onChange({ radius: Number(event.target.value) })}
          className="mt-2 w-full"
        />
      </label>
      <label className="text-sm">
        Радиус кнопок: {theme.buttonRadius}px
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={theme.buttonRadius}
          onChange={(event) =>
            onChange({ buttonRadius: Number(event.target.value) })
          }
          className="mt-2 w-full"
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Заголовок"
          value={theme.headingSize}
          min={18}
          max={56}
          onChange={(value) => onChange({ headingSize: value })}
        />
        <NumberField
          label="Подзаголовок"
          value={theme.subheadingSize}
          min={12}
          max={36}
          onChange={(value) => onChange({ subheadingSize: value })}
        />
        <NumberField
          label="Текст"
          value={theme.textSize}
          min={10}
          max={28}
          onChange={(value) => onChange({ textSize: value })}
        />
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

function BlockEditor({
  block,
  accountName,
  locations,
  services,
  specialists,
  promos,
  activeSectionId,
  onChange,
}: {
  block: SiteBlock;
  accountName: string;
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

  return (
    <div className="space-y-4">
      {(variantOptions.length > 1 && block.type !== "loader" && inSection("main", "structure")) && (
        <label className="text-sm">
          Вариант
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.data.showLogo !== false}
                  onChange={(event) => updateData({ showLogo: event.target.checked })}
                />
                Показывать логотип
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.data.showCompanyName !== false}
                  onChange={(event) => updateData({ showCompanyName: event.target.checked })}
                />
                Показывать название компании
              </label>
              <FieldText
                label="Название компании"
                value={(block.data.accountTitle as string) ?? accountName}
                onChange={(value) => updateData({ accountTitle: value })}
              />
            </>
          )}
          {inSection("structure") && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.data.showOnAllPages !== false}
                  onChange={(event) => updateData({ showOnAllPages: event.target.checked })}
                />
                Показывать на всех страницах
              </label>
              <label className="text-sm">
                Позиция меню
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
                <div className="text-sm font-semibold">Пункты меню</div>
                {PAGE_KEYS.map((key) => {
                  const items = Array.isArray(block.data.menuItems)
                    ? (block.data.menuItems as SitePageKey[])
                    : [];
                  const checked = items.includes(key);
                  return (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...items, key]
                            : items.filter((item) => item !== key);
                          updateData({ menuItems: next });
                        }}
                      />
                      {PAGE_LABELS[key]}
                    </label>
                  );
                })}
              </div>
            </>
          )}
          {inSection("actions") && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(block.data.showButton)}
                  onChange={(event) => updateData({ showButton: event.target.checked })}
                />
                Показывать кнопку записи
              </label>
              <label className="text-sm">
                Действие кнопки
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
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(block.data.showSearch)}
                  onChange={(event) => updateData({ showSearch: event.target.checked })}
                />
                Показывать поиск
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(block.data.showAccount)}
                  onChange={(event) => updateData({ showAccount: event.target.checked })}
                />
                Иконка входа
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(block.data.showThemeToggle)}
                  onChange={(event) => updateData({ showThemeToggle: event.target.checked })}
                />
                Переключатель темы
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(block.data.showSocials)}
                  onChange={(event) => updateData({ showSocials: event.target.checked })}
                />
                Показывать соцсети
              </label>
              <label className="text-sm">
                Соцсети
                <select
                  value={(block.data.socialsMode as string) ?? "auto"}
                  onChange={(event) => updateData({ socialsMode: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="auto">Из профиля аккаунта</option>
                  <option value="custom">Ввести вручную</option>
                </select>
              </label>
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
              <label className="text-sm">
                Выравнивание
                <select
                  value={(block.data.align as string) ?? "left"}
                  onChange={(event) => updateData({ align: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
                >
                  <option value="left">Слева</option>
                  <option value="center">По центру</option>
                  <option value="right">Справа</option>
                </select>
              </label>
            </>
          )}
          {inSection("actions", "main") && (
            <>
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
          {inSection("media", "main") && (
            <CoverImageEditor
              data={block.data}
              locations={locations}
              services={services}
              specialists={specialists}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(block.data.useCurrent)}
              onChange={(event) => updateData({ useCurrent: event.target.checked })}
            />
            Использовать текущую страницу
          </label>
          <EntityListEditor
            block={block}
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

      {block.type !== "menu" &&
        block.type !== "cover" &&
        block.type !== "about" &&
        block.type !== "loader" &&
        !isSystemBlockType(block.type) &&
        block.type !== "works" &&
        block.type !== "reviews" &&
        block.type !== "contacts" && (
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
  const lightSectionBg = readRaw("sectionBgLight") || readRaw("sectionBg");
  const darkSectionBg = readRaw("sectionBgDark");
  const lightBlockBg = readRaw("blockBgLight") || readRaw("blockBg");
  const lightSubBlockBg = readRaw("subBlockBgLight") || readRaw("subBlockBg");
  const darkBlockBg = readRaw("blockBgDark");
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
  const update = (patch: Partial<BlockStyle>) => {
    onChange(updateBlockStyle(block, patch));
  };
  const inSection = (...ids: string[]) =>
    ids.length === 0 || ids.includes(activeSectionId);

  return (
    <div className="space-y-4">
      {inSection("layout") && (
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
      {inSection("layout") && (
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
      {inSection("layout") && block.type !== "menu" && (
      <label className="text-sm">
        {block.type === "booking"
          ? `Ширина контейнера: ${bookingPreset}`
          : `Ширина блока: ${resolvedBlockColumns}/12`}
        <input
          type="range"
          min={block.type === "booking" ? BOOKING_MIN_PRESET : MIN_BLOCK_COLUMNS}
          max={block.type === "booking" ? BOOKING_MAX_PRESET : MAX_BLOCK_COLUMNS}
          step={1}
          value={block.type === "booking" ? bookingPreset : resolvedBlockColumns}
          onChange={(event) => {
            const nextColumns =
              block.type === "booking"
                ? bookingColumnsFromPreset(Number(event.target.value))
                : clampBlockColumns(Number(event.target.value), block.type);
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
      {inSection("layout") && block.type === "menu" && (
      <div className="text-sm text-[color:var(--bp-muted)]">
        Ширина блока: 12/12 (фиксировано для меню)
      </div>
      )}
      {inSection("layout") && (
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
      {inSection("layout") && (
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
      {block.type === "menu" && (
        inSection("layout") && (
        <label className="text-sm">
          Высота меню:{" "}
          {Number.isFinite(Number((block.data as Record<string, unknown>).menuHeight))
            ? Number((block.data as Record<string, unknown>).menuHeight)
            : 56}
          px
          <input
            type="range"
            min={30}
            max={96}
            step={1}
            value={
              Number.isFinite(Number((block.data as Record<string, unknown>).menuHeight))
                ? Number((block.data as Record<string, unknown>).menuHeight)
                : 56
            }
            onChange={(event) =>
              onChange({
                ...block,
                data: {
                  ...block.data,
                  menuHeight: Number(event.target.value),
                },
              })
            }
            className="mt-2 w-full"
          />
        </label>
        )
      )}
      {inSection("colors") && (
      <div className="grid grid-cols-2 gap-3">
        <ColorField
          label="Фон блока"
          value={toDisplay(lightSectionBg)}
          placeholder={theme.panelColor}
          onChange={(value) =>
            update({
              sectionBgLight: toStore(value),
              sectionBg: toStore(value),
            })
          }
        />
        <ColorField
          label="Цвет контента"
          value={toDisplay(lightBlockBg)}
          placeholder={theme.panelColor}
          onChange={(value) =>
            update({ blockBgLight: toStore(value), blockBg: toStore(value) })
          }
        />
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
      )}
      {inSection("colors") && (
      <div className="mt-4 rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Темная тема
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
            <ColorField
              label="Фон блока"
              value={toDisplay(darkSectionBg)}
              placeholder={theme.darkPalette.panelColor}
              onChange={(value) => update({ sectionBgDark: toStore(value) })}
            />
            <ColorField
              label="Цвет контента"
              value={toDisplay(darkBlockBg)}
              placeholder={theme.darkPalette.panelColor}
              onChange={(value) => update({ blockBgDark: toStore(value) })}
            />
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
        </div>
      </div>
      )}
      {inSection("effects") && (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={style.gradientEnabled}
          onChange={(event) => update({ gradientEnabled: event.target.checked })}
        />
        Градиент блока
      </label>
      )}
      {style.gradientEnabled && (
        inSection("effects") && (
        <>
          <label className="text-sm">
            Направление градиента
            <select
              value={style.gradientDirection}
              onChange={(event) =>
                update({
                  gradientDirection: event.target.value as BlockStyle["gradientDirection"],
                })
              }
              className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
            >
              <option value="vertical">Сверху вниз</option>
              <option value="horizontal">Слева направо</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="Цвет 1"
              value={style.gradientFrom || theme.gradientFrom}
              onChange={(value) => update({ gradientFrom: value })}
            />
            <ColorField
              label="Цвет 2"
              value={style.gradientTo || theme.gradientTo}
              onChange={(value) => update({ gradientTo: value })}
            />
          </div>
        </>
        )
      )}
      {inSection("typography") && (
      <label className="text-sm">
        Выравнивание текста
        <select
          value={style.textAlign}
          onChange={(event) =>
            update({ textAlign: event.target.value as BlockStyle["textAlign"] })
          }
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="left">Слева</option>
          <option value="center">По центру</option>
          <option value="right">Справа</option>
        </select>
      </label>
      )}
      {inSection("typography") && (
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
      {inSection("typography") && (
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
      {inSection("typography") && (
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          label="Заголовок"
          value={style.headingSize ?? theme.headingSize}
          min={18}
          max={56}
          onChange={(value) => update({ headingSize: value })}
        />
        <NumberField
          label="Подзаголовок"
          value={style.subheadingSize ?? theme.subheadingSize}
          min={12}
          max={36}
          onChange={(value) => update({ subheadingSize: value })}
        />
        <NumberField
          label="Текст"
          value={style.textSize ?? theme.textSize}
          min={10}
          max={28}
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
  gradientFromLightResolved: string;
  gradientToLightResolved: string;
  gradientFromDarkResolved: string;
  gradientToDarkResolved: string;
  textAlign: "left" | "center" | "right";
  fontHeading: string;
  fontBody: string;
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
};

function normalizeBlockStyle(block: SiteBlock, theme: SiteTheme): BlockStyle {
  const style = (block.data.style as Record<string, unknown>) ?? {};
  const toNumber = (value: unknown) => {
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
    blockWidthColumns: useCustomWidth ? resolvedBlockWidthColumns : null,
    useCustomWidth,
    radius: toNumber(style.radius),
    buttonRadius: toNumber(style.buttonRadius),
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
    gradientFromLightResolved,
    gradientToLightResolved,
    gradientFromDarkResolved,
    gradientToDarkResolved,
    textAlign:
      style.textAlign === "center" || style.textAlign === "right"
        ? style.textAlign
        : "left",
    fontHeading: typeof style.fontHeading === "string" ? style.fontHeading : "",
    fontBody: typeof style.fontBody === "string" ? style.fontBody : "",
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

function FieldText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm">
      {label}
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
  return (
    <label className="text-sm">
      {label}
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
  onChange,
}: {
  block: SiteBlock;
  items: Array<{ id: number; label: string }>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const mode = (block.data.mode as string) ?? "all";
  const selected = new Set<number>(
    Array.isArray(block.data.ids) ? (block.data.ids as number[]) : []
  );
  const useCurrent = Boolean(block.data.useCurrent);

  return (
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
  locations,
  services,
  specialists,
  onChange,
}: {
  data: Record<string, unknown>;
  locations: LocationItem[];
  services: ServiceItem[];
  specialists: SpecialistItem[];
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };

  const setSource = (next: { type: string; id?: number | null; url?: string }) => {
    onChange({ imageSource: next });
  };

  return (
    <div className="space-y-3">
      <label className="text-sm">
        Источник обложки
        <select
          value={imageSource.type ?? "account"}
          onChange={(event) => setSource({ type: event.target.value })}
          className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
        >
          <option value="account">Профиль аккаунта</option>
          <option value="location">Локация</option>
          <option value="specialist">Специалист</option>
          <option value="service">Услуга</option>
          <option value="custom">Своя картинка (URL)</option>
          <option value="none">Без картинки</option>
        </select>
      </label>

      {imageSource.type === "location" && (
        <label className="text-sm">
          Локация
          <select
            value={String(imageSource.id ?? "")}
            onChange={(event) =>
              setSource({
                type: "location",
                id: event.target.value ? Number(event.target.value) : undefined,
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
      )}

      {imageSource.type === "specialist" && (
        <label className="text-sm">
          Специалист
          <select
            value={String(imageSource.id ?? "")}
            onChange={(event) =>
              setSource({
                type: "specialist",
                id: event.target.value ? Number(event.target.value) : undefined,
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
      )}

      {imageSource.type === "service" && (
        <label className="text-sm">
          Услуга
          <select
            value={String(imageSource.id ?? "")}
            onChange={(event) =>
              setSource({
                type: "service",
                id: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className="mt-2 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-3 py-2"
          >
            <option value="">Не выбрано</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {imageSource.type === "custom" && (
        <FieldText
          label="URL картинки"
          value={imageSource.url ?? ""}
          onChange={(value) => setSource({ type: "custom", url: value })}
        />
      )}
    </div>
  );
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
  onThemeToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const style = normalizeBlockStyle(block, theme);
  const blockRadius =
    style.radius !== null && Number.isFinite(style.radius)
      ? style.radius
      : theme.radius;
  const sectionBg =
    theme.mode === "dark" ? style.sectionBgDarkResolved : style.sectionBgLightResolved;
  const blockBg = style.blockBg || theme.panelColor;
  const borderColor = (style.borderColor || theme.borderColor || "").trim() || "transparent";
  const shadowSize = style.shadowSize ?? theme.shadowSize ?? 0;
  const shadowColor = style.shadowColor || theme.shadowColor || "rgba(17, 24, 39, 0.12)";
  const textColor = style.textColor || theme.textColor;
  const mutedColor = style.mutedColor || theme.mutedColor;
  const isBooking = block.type === "booking";
  const isMenu = block.type === "menu";
  const blockWidthColumns = isMenu
    ? MAX_BLOCK_COLUMNS
    : clampBlockColumns(style.blockWidthColumns ?? DEFAULT_BLOCK_COLUMNS, block.type);
  const bookingInnerColumns = bookingContentColumns(blockWidthColumns);
  const blockOuterColumns = isBooking || isMenu ? MAX_BLOCK_COLUMNS : blockWidthColumns;
  const gradientFrom = style.gradientFrom || theme.gradientFrom;
  const gradientTo = style.gradientTo || theme.gradientTo;
  const gradientDirection =
    style.gradientDirection || theme.gradientDirection || "vertical";
  const gradientEnabled = style.gradientEnabled;
  const blockFont = style.fontBody || theme.fontBody;
  const bookingContentWidth = `${(bookingInnerColumns / MAX_BLOCK_COLUMNS) * 100}%`;
  const containerClass = isBooking || isMenu
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
    onThemeToggle
  );
  return (
    <div
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
        width: `${(blockOuterColumns / MAX_BLOCK_COLUMNS) * 100}%`,
        maxWidth: "100%",
        marginLeft: "auto",
        marginRight: "auto",
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        backgroundColor: isMenu ? "transparent" : sectionBg,
      }}
    >
      <div
        className={`${containerClass} relative`}
        style={{
          borderRadius: blockRadius,
          backgroundColor: isBooking
            ? "transparent"
            : gradientEnabled
              ? gradientFrom
              : blockBg,
          backgroundImage: isBooking
            ? "none"
            : gradientEnabled
              ? `linear-gradient(${gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${gradientFrom}, ${gradientTo})`
              : "none",
          color: textColor,
          fontFamily: blockFont,
          borderColor: isBooking || isMenu ? "transparent" : borderColor,
          borderWidth: isBooking || isMenu || borderColor === "transparent" ? 0 : 1,
          boxShadow:
            isBooking || isMenu || shadowSize <= 0
              ? "none"
              : `0 ${shadowSize}px ${shadowSize * 2}px ${shadowColor}`,
          ["--bp-muted" as string]: mutedColor,
          ["--bp-stroke" as string]: borderColor,
        }}
      >
          {isMenu ? <div className="overflow-hidden rounded-[inherit]">{blockContent}</div> : blockContent}
      </div>
    </div>
  );
}

function InsertSlot({
  index,
  slotRef,
  spacing,
  activeOffset,
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
          className="absolute inset-x-0 top-1/2 z-[9] h-8 -translate-y-1/2 cursor-row-resize touch-none"
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
      <button
        type="button"
        onClick={onInsert}
        className="absolute z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-sm text-[color:var(--bp-ink)] shadow-sm"
        style={{ top, left: "50%", transform: "translate(-50%, -50%)" }}
        aria-label={`Добавить блок ${index}`}
        title="Добавить блок"
      >
        +
      </button>
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
  onThemeToggle: () => void
) {
  const style = normalizeBlockStyle(block, theme);
  const blockType = String(block.type);
  switch (blockType) {
    case "cover":
      return renderCover(
        block,
        account,
        branding,
        locations,
        services,
        specialists,
        theme,
        style
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
    fontSize: style.headingSize ?? theme.headingSize,
    textAlign: style.textAlign,
    color: style.textColor || theme.textColor,
  } as const;
}

function subheadingStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontBody || theme.fontBody,
    fontSize: style.subheadingSize ?? theme.subheadingSize,
    textAlign: style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

function textStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    fontFamily: style.fontBody || theme.fontBody,
    fontSize: style.textSize ?? theme.textSize,
    textAlign: style.textAlign,
    color: style.mutedColor || theme.mutedColor,
  } as const;
}

function buttonStyle(style: BlockStyle, theme: SiteTheme) {
  return {
    backgroundColor: style.buttonColor || theme.buttonColor,
    color: style.buttonTextColor || theme.buttonTextColor,
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
  branding: Branding,
  locations: LocationItem[],
  services: ServiceItem[],
  specialists: SpecialistItem[],
  theme: SiteTheme,
  style: BlockStyle
) {
  const data = block.data as Record<string, unknown>;
  const title = (data.title as string) || account.name;
  const subtitle = (data.subtitle as string) || "";
  const description = (data.description as string) || "";
  const align = (data.align as "left" | "center" | "right") ?? style.textAlign;
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const showButton = Boolean(data.showButton);
  const buttonText = (data.buttonText as string) || "Записаться";
  const imageSource = (data.imageSource as { type?: string; id?: number; url?: string }) ?? {
    type: "account",
  };
  const imageUrl = resolveCoverImage(imageSource, branding, locations, services, specialists);

  return (
    <div className={`grid gap-6 ${imageUrl ? "md:grid-cols-[1.2fr_1fr]" : ""}`}>
      <div className={alignClass}>
        <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--bp-muted)]">
          Сайт {account.name}
        </div>
        <h2
          className="mt-3 font-semibold"
          style={{ ...headingStyle(style, theme), textAlign: align }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-2 text-[color:var(--bp-muted)]"
            style={{ ...subheadingStyle(style, theme), textAlign: align }}
          >
            {subtitle}
          </p>
        )}
        {description && (
          <p
            className="mt-3 text-[color:var(--bp-muted)]"
            style={{ ...textStyle(style, theme), textAlign: align }}
          >
            {description}
          </p>
        )}
        {showButton && account.publicSlug && (
          <div className="mt-5" style={{ textAlign: align }}>
            <a
              href={buildBookingLink({ publicSlug: account.publicSlug })}
              className="inline-flex px-5 py-2 text-sm font-semibold"
              style={buttonStyle(style, theme)}
            >
              {buttonText}
            </a>
          </div>
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
  const socialsMode = (data.socialsMode as string) || "auto";
  const socialsCustom = (data.socialsCustom as Record<string, string>) ?? {};
  const accountTitleRaw =
    typeof data.accountTitle === "string" ? data.accountTitle.trim() : "";
  const accountTitle = accountTitleRaw || account.name;
  const menuHeightRaw = Number(data.menuHeight);
  const menuHeight =
    Number.isFinite(menuHeightRaw) && menuHeightRaw >= 30 && menuHeightRaw <= 96
      ? Math.round(menuHeightRaw)
      : 56;
  const menuButtonSize = Math.max(18, Math.min(42, menuHeight - 4));
  const logoImageHeight = Math.max(14, Math.min(32, menuHeight - 10));
  const menuGradient =
    style.gradientEnabled
      ? `linear-gradient(${style.gradientDirection === "horizontal" ? "to right" : "to bottom"}, ${style.gradientFrom || theme.gradientFrom}, ${style.gradientTo || theme.gradientTo})`
      : "none";
  const align = (style.textAlign ?? "left") as "left" | "center" | "right";
  const alignClass =
    align === "center"
      ? "justify-center text-center"
      : align === "right"
        ? "justify-end text-right"
        : "justify-start text-left";
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
      style={{ ...textStyle(style, theme), textAlign: "left", lineHeight: 1.1 }}
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
        className="font-medium"
        style={{ ...subheadingStyle(style, theme), color: "var(--bp-ink)", textAlign: "left" }}
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
        className="w-full text-center text-3xl font-medium md:text-5xl"
        style={{ ...headingStyle(style, theme), textAlign: "center" }}
      >
        {PAGE_LABELS[key]}
      </a>
    );
  });

  const accountIcon = (
      <a
        href={accountLink}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-transparent bg-transparent text-sm text-[color:var(--bp-ink)]"
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
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-transparent bg-transparent text-sm text-[color:var(--bp-ink)]"
        aria-label="Переключить тему"
        title="Переключить тему"
      >
      {theme.mode === "dark" ? "D" : "L"}
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
            className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-transparent bg-transparent"
            title={SOCIAL_LABELS[item.key]}
          >
            <img src={SOCIAL_ICONS[item.key]} alt="" className="h-7 w-7" />
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
  const subBlockBg = style.subBlockBg || style.blockBg || theme.panelColor;
  const subBlockBorder =
    (style.borderColor || theme.borderColor || "").trim() || "transparent";

  return (
    <MenuPreview
      variant={block.variant}
      alignClass={alignClass}
      logoNode={logoNode}
      navNode={<div className="flex flex-wrap items-center gap-4">{linkItems}</div>}
      overlayNavNode={
        <div className="flex w-full flex-col items-center gap-6 text-center">
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
      blockBg={style.blockBg || theme.panelColor}
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
          className={`relative flex items-center py-0 pl-8 pr-24 ${mobileOpen ? "absolute inset-x-0 top-0" : ""}`}
          style={{ ...topBarStyle, minHeight: menuHeight }}
        >
          <div className="flex items-center gap-3">{logoNode}</div>
          <button
            type="button"
            className="absolute right-8 top-1/2 z-[11] inline-flex -translate-y-1/2 items-center justify-center overflow-visible rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
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
            className="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-[inherit] px-6 py-6 pt-24 md:px-10 md:py-8 md:pt-28"
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
              {searchNode}
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
    desktopLayout = (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="rounded-2xl border px-4 py-3" style={subBlockStyle}>
          <div className={`flex flex-wrap items-center gap-4 ${alignClass}`}>{navNode}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-4">{logoNode}</div>
          {actions}
        </div>
      </div>
    );
  }

  if (variant === "v4") {
    desktopLayout = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">{logoNode}</div>
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        </div>
        <div className="rounded-2xl border px-3 py-2" style={subBlockStyle}>
          <div className="flex flex-wrap items-center gap-2">{navNode}</div>
        </div>
      </div>
    );
  }

  if (variant === "v5") {
    desktopLayout = (
      <div className="flex flex-col items-center gap-4 text-center">
        {logoNode}
        <div className="w-full rounded-2xl border px-4 py-3" style={subBlockStyle}>
          {navNode}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>
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
              className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-transparent bg-transparent text-[color:var(--bp-ink)]"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Меню"
            >
              <IconMenu />
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div
            className="mt-4 space-y-3 rounded-xl border p-4"
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
                  scenario: "serviceFirst",
                  start: "scenario",
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
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((service) => (
          <div
            key={service.id}
            className="rounded-2xl border bg-[color:var(--bp-paper)] p-4"
            style={{ borderColor: theme.borderColor, textAlign: style.textAlign }}
          >
            {service.coverUrl && (
              <img src={service.coverUrl} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />
            )}
            <div className="text-base font-semibold">{service.name}</div>
            {service.description && (
              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">
                {service.description}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[color:var(--bp-muted)]">
              {showDuration && <span>{service.baseDurationMin} мин</span>}
              {showPrice && <span>{service.basePrice} ₽</span>}
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
                  scenario: effectiveSpecialistId ? "specialistFirst" : "serviceFirst",
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
              {promo.type === "PERCENT" ? `${promo.value}%` : `${promo.value} ₽`}
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
  const subtitle =
    typeof data.subtitle === "string"
      ? data.subtitle
      : data.subtitle
        ? String(data.subtitle)
        : "";
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

  return (
    <div>
      <h3
        className="font-semibold"
        style={headingStyle(style, theme)}
      >
        {(data.title as string) || "Работы"}
      </h3>
      {subtitle && (
        <p className="mt-2 text-[color:var(--bp-muted)]" style={subheadingStyle(style, theme)}>
          {subtitle}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {filtered.slice(0, 8).map((item, idx) => (
          <img key={`${item.entityId}-${idx}`} src={item.url} alt="" className="h-28 w-full rounded-xl object-cover" />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--bp-stroke)] p-4 text-sm text-[color:var(--bp-muted)]">
            Нет фото работ для отображения.
          </div>
        )}
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



