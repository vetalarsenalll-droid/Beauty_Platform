"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { UnoptimizedImage } from "@/components/unoptimized-image";
import {
  BLOCK_LABELS,
  type BlockType,
  type SiteBlock,
  type SiteDraft,
  type SiteTheme,
  normalizeDraft,
  resolveSiteLoaderConfig,
  type SitePageKey,
} from "@/lib/site-builder";
import type {
  SiteLocationItem as LocationItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
} from "@/features/site-builder/shared/site-data";
import {
  CONTENT_SECTIONS_BY_BLOCK,
  MOBILE_VIEWPORTS,
  PANEL_ANIMATION_MS,
  SETTINGS_SECTIONS_BY_BLOCK,
  isSystemBlockType,
  variantsLabel,
} from "@/features/site-builder/crm/site-client-core";
import type {
  CurrentEntity,
  CssVars,
  EditorSection,
  MobileViewportKey,
  SiteClientProps,
  SiteSeoPageSetting,
} from "@/features/site-builder/crm/site-client-core";
import {
  BlockPreview,
  InsertSlot,
  normalizeBlockStyle,
} from "@/features/site-builder/crm/site-renderer";
import { useDraftHistory } from "@/features/site-builder/crm/use-draft-history";
import { buildEditorActions } from "@/features/site-builder/crm/editor-actions";
import { usePagesMenu } from "@/features/site-builder/crm/use-pages-menu";
import type { PagesMenuItem } from "@/features/site-builder/crm/use-pages-menu";
import { useRightPanel } from "@/features/site-builder/crm/use-right-panel";
import { buildThemeStyle, resolvePanelTheme } from "@/features/site-builder/crm/site-shell-theme";
import { SiteRightPanelOverlays } from "@/features/site-builder/crm/site-right-panel-overlays";
import { SiteRightPanelFrame } from "@/features/site-builder/crm/site-right-panel-frame";
import {
  QUICK_ADD_BLOCK_TYPES,
  LIBRARY_BLOCK_TYPES,
  PRIMARY_LIBRARY_BLOCK_TYPES,
  getBlockVariants,
} from "@/features/site-builder/blocks/block-registry";
import type { BlockCode } from "@/features/site-builder/blocks/runtime/contracts";
import { resolveBlockVersion } from "@/features/site-builder/blocks/runtime/resolve-block-version";

function DesktopPreviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
        <rect height="15.031" width="18.5" rx="3.5" x="2.75" y="2.75" />
        <path d="M9.11 17.781v3.469m5.78-3.469v3.469m-8.382 0h10.984" />
      </g>
    </svg>
  );
}

function MobilePreviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" fillRule="evenodd" transform="translate(5 3)">
        <path d="M2.5.5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5.5" cy="11.5" fill="currentColor" r="1" />
      </g>
    </svg>
  );
}

function HelpPanelIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M4 4v12a2 2 0 0 0 2 2h9.5a.5.5 0 0 0 0-1H6a1 1 0 0 1-1-1h10a1 1 0 0 0 1-1V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Zm10-1a1 1 0 0 1 1 1v11H5V4a1 1 0 0 1 1-1h8ZM8.76 6.409C8.95 6.21 9.31 6 10 6s1.05.211 1.24.409c.2.21.26.456.26.591c0 .454-.27.698-.723.924a6.995 6.995 0 0 1-.343.156l-.022.01a5.258 5.258 0 0 0-.324.147a1.455 1.455 0 0 0-.345.228A.731.731 0 0 0 9.5 9v1a.5.5 0 1 0 1 0v-.85l.037-.02c.075-.038.166-.077.283-.127l.011-.005c.117-.051.253-.11.392-.18C11.77 8.548 12.5 8.047 12.5 7c0-.365-.14-.869-.54-1.284C11.55 5.29 10.91 5 10 5c-.91 0-1.55.289-1.96.716c-.4.415-.54.919-.54 1.284a.5.5 0 0 0 1 0c0-.135.06-.381.26-.591ZM10 13a.75.75 0 1 0 0-1.5a.75.75 0 0 0 0 1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HiddenBlockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 18h2V2H10v4" />
        <path d="M6 6h8v8M1 1l22 22M4 8v14h10v-4" />
      </g>
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11.5 12h3v12h-3zm6 0h3v12h-3z" fill="currentColor" />
      <path
        d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20zm4-26h8v2h-8z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SITE_PREVIEW_MODE_STORAGE_KEY = "site-builder:preview-mode";
const SITE_MOBILE_VIEWPORT_STORAGE_KEY = "site-builder:mobile-viewport";
const SITE_PREVIEW_MODE_COOKIE_KEY = "site_builder_preview_mode";
const SITE_MOBILE_VIEWPORT_COOKIE_KEY = "site_builder_mobile_viewport";
const PAGE_SETTINGS_TABS = ["main", "badge", "social", "seo"] as const;
const PAGE_SETTINGS_TAB_LABELS: Record<(typeof PAGE_SETTINGS_TABS)[number], string> = {
  main: "Главное",
  badge: "Бейджик",
  social: "Соцсети",
  seo: "SEO",
};

type PageSettingsTab = (typeof PAGE_SETTINGS_TABS)[number];
const SITE_PREFERENCES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const LIBRARY_PANEL_ANIMATION_MS = 220;

function getLibraryBlockCode(type: BlockType, variant: SiteBlock["variant"]): BlockCode {
  if (type === "menu") {
    if (variant === "v2") return "ME002";
    if (variant === "v3") return "ME003";
    return "ME001";
  }
  if (type === "cover") {
    if (variant === "v3") return "HE003";
    if (variant === "v2") return "HE002";
    return "HE001";
  }
  if (type === "loader") {
    if (variant === "v2") return "LO002";
    if (variant === "v3") return "LO003";
    return "LO001";
  }
  if (type === "locations") return "LC001";
  if (type === "services") return "SE001";
  if (type === "specialists") return "SP001";
  if (type === "booking") return variant === "v2" ? "BO002" : "BO001";
  if (type === "aisha") return "AI001";
  if (type === "about") return "AB001";
  if (type === "heading") return "HD001";
  if (type === "text") return "TX001";
  if (type === "image") return "IM001";
  if (type === "form") return "FO001";
  if (type === "button") return "BT001";
  if (type === "advantages") return "AD001";
  if (type === "footer") return "FT001";
  if (type === "team") return "TM001";
  if (type === "news") return "NW001";
  if (type === "widget") return "WG001";
  if (type === "works") return variant === "v2" ? "WO002" : "WO001";
  if (type === "reviews") return "RV001";
  if (type === "contacts") return "CT001";
  if (type === "promos") return "PM001";
  if (type === "clientLogin") return "CLL001";
  if (type === "clientCabinet") return "CLC001";
  if (type === "client") return "CLL001";
  if (type === "locationProfile") return "LP001";
  if (type === "serviceProfile") return "SVP001";
  if (type === "specialistProfile") return "SPP001";
  return "GEN001";
}

function getLibraryPreviewSrc(code: BlockCode) {
  return `/api/v1/site-builder/block-preview/${code}`;
}

function getLibraryLabel(type: BlockType, activePage: SitePageKey) {
  if (type === "client") {
    if (activePage === "clientCabinet") return "Кабинет";
    if (activePage === "clientLogin") return "Вход";
  }
  return BLOCK_LABELS[type];
}

function isBlockHidden(block: SiteBlock) {
  return Boolean((block.data as { hidden?: unknown })?.hidden);
}

function getSystemPageLibraryBlockTypes(activePage: SitePageKey): BlockType[] | null {
  if (activePage === "booking") return ["booking"];
  if (activePage === "clientLogin") return ["clientLogin"];
  if (activePage === "clientCabinet") return ["clientCabinet"];
  return null;
}

type PageMenuItem = Extract<PagesMenuItem, { kind: "page" }>;
type ClientSubpageMenuItem = Extract<PagesMenuItem, { kind: "client-subpage" }>;
type LegalDocumentMenuItem = Extract<PagesMenuItem, { kind: "legal-document" }>;
type EntityProfileMenuItem = Extract<PagesMenuItem, { kind: "entity-profile" }>;

const isPageMenuItem = (item: PagesMenuItem): item is PageMenuItem => item.kind === "page";
const isClientSubpageMenuItem = (item: PagesMenuItem): item is ClientSubpageMenuItem =>
  item.kind === "client-subpage";
const isLegalDocumentMenuItem = (item: PagesMenuItem): item is LegalDocumentMenuItem =>
  item.kind === "legal-document";

const isEntityProfileMenuItem = (item: PagesMenuItem): item is EntityProfileMenuItem =>
  item.kind === "entity-profile";

function buildCurrentPublicUrl(
  publicSlug: string | null | undefined,
  accountSlug: string,
  activePage: SitePageKey,
  currentEntity: CurrentEntity
) {
  if (!publicSlug) return null;
  const basePath = `/${publicSlug}`;
  if (currentEntity?.type === "location") return `${basePath}/locations/${currentEntity.id}`;
  if (currentEntity?.type === "service") return `${basePath}/services/${currentEntity.id}`;
  if (currentEntity?.type === "specialist") return `${basePath}/specialists/${currentEntity.id}`;
  if (currentEntity?.type === "promo") return `${basePath}/promos/${currentEntity.id}`;
  if (activePage === "clientLogin") return `${basePath}/client/login`;
  if (activePage === "clientCabinet") return `${basePath}/client/cabinet`;
  if (currentEntity?.type === "legalDocument") return `${basePath}/legal/${currentEntity.id}`;
  if (activePage === "home") return basePath;
  if (activePage === "booking") return `${basePath}/booking`;
  if (activePage === "client") return `/c?account=${accountSlug}`;
  return `${basePath}/${activePage}`;
}

function buildEditorPageSettingsKey(activePage: SitePageKey, currentEntity: CurrentEntity) {
  if (currentEntity?.type === "location") return `location:${currentEntity.id}`;
  if (currentEntity?.type === "service") return `service:${currentEntity.id}`;
  if (currentEntity?.type === "specialist") return `specialist:${currentEntity.id}`;
  if (currentEntity?.type === "promo") return `promo:${currentEntity.id}`;
  if (currentEntity?.type === "legalDocument") return `legal:${currentEntity.id}`;
  return activePage;
}

function buildEditorPageSettingsPath(activePage: SitePageKey, currentEntity: CurrentEntity) {
  if (currentEntity?.type === "location") return `/locations/${currentEntity.id}`;
  if (currentEntity?.type === "service") return `/services/${currentEntity.id}`;
  if (currentEntity?.type === "specialist") return `/specialists/${currentEntity.id}`;
  if (currentEntity?.type === "promo") return `/promos/${currentEntity.id}`;
  if (currentEntity?.type === "legalDocument") return `/legal/${currentEntity.id}`;
  if (activePage === "home") return "/";
  if (activePage === "clientLogin") return "/client/login";
  if (activePage === "clientCabinet") return "/client/cabinet";
  return `/${activePage}`;
}

function makeEmptySeoPageSetting(pageKey: string): SiteSeoPageSetting {
  return {
    pageKey,
    title: "",
    description: "",
    ogImageUrl: "",
    keywords: "",
    canonicalUrl: "",
    noIndex: false,
    noFollow: false,
  };
}

function findPageSettingsDefaults(blocks: SiteBlock[], fallbackTitle: string) {
  const cover = blocks.find((block) => block.type === "cover") ?? blocks[0];
  const data = cover?.data as Record<string, unknown> | undefined;
  const title = typeof data?.title === "string" && data.title.trim() ? data.title : fallbackTitle;
  const description =
    typeof data?.subtitle === "string" && data.subtitle.trim()
      ? data.subtitle
      : typeof data?.description === "string" && data.description.trim()
        ? data.description
        : "";
  return { title, description };
}

function updateBlockTagInDraft(
  draft: SiteDraft,
  activePage: SitePageKey,
  currentEntity: CurrentEntity,
  blockId: string,
  patch: { seoTitleTag?: string; seoSubtitleTag?: string }
) {
  const next: SiteDraft = JSON.parse(JSON.stringify(draft));
  const updateBlocks = (blocks: SiteBlock[] | undefined) => {
    if (!blocks) return;
    const block = blocks.find((item) => item.id === blockId);
    if (block) block.data = { ...block.data, ...patch };
  };

  if (currentEntity?.type === "location") updateBlocks(next.entityPages?.locations?.[String(currentEntity.id)]);
  else if (currentEntity?.type === "service") updateBlocks(next.entityPages?.services?.[String(currentEntity.id)]);
  else if (currentEntity?.type === "specialist") updateBlocks(next.entityPages?.specialists?.[String(currentEntity.id)]);
  else if (currentEntity?.type === "promo") updateBlocks(next.entityPages?.promos?.[String(currentEntity.id)]);
  else if (currentEntity?.type === "legalDocument") updateBlocks(next.entityPages?.legalDocuments?.[String(currentEntity.id)]);
  else if (activePage === "home") {
    updateBlocks(next.pages?.home);
    updateBlocks(next.blocks);
    next.blocks = next.pages?.home ?? next.blocks;
  } else {
    updateBlocks(next.pages?.[activePage]);
  }

  return next;
}

const VARIANT_CONTENT_KEYS = [
  "title",
  "subtitle",
  "description",
  "text",
  "buttonText",
  "buttonPage",
  "buttonHref",
  "secondaryButtonText",
  "secondaryButtonHref",
  "imageUrl",
  "imageSource",
  "coverSlides",
  "items",
] as const;

function cloneVariantValue<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

function getFirstCoverSlide(data: Record<string, unknown>) {
  const slides = Array.isArray(data.coverSlides) ? (data.coverSlides as Array<Record<string, unknown>>) : [];
  return slides.find((slide) => {
    const title = typeof slide.title === "string" ? slide.title.trim() : "";
    const description = typeof slide.description === "string" ? slide.description.trim() : "";
    const buttonText = typeof slide.buttonText === "string" ? slide.buttonText.trim() : "";
    const imageUrl = typeof slide.imageUrl === "string" ? slide.imageUrl.trim() : "";
    return Boolean(title || description || buttonText || imageUrl);
  });
}

function pickVariantContent(
  type: BlockType,
  data: Record<string, unknown>,
  targetVariant: SiteBlock["variant"]
) {
  const content: Record<string, unknown> = {};
  VARIANT_CONTENT_KEYS.forEach((key) => {
    if (key in data) content[key] = cloneVariantValue(data[key]);
  });

  if (type !== "cover") return content;

  const firstSlide = getFirstCoverSlide(data);
  if (firstSlide && targetVariant !== "v2") {
    const slideTitle = typeof firstSlide.title === "string" ? firstSlide.title : "";
    const slideDescription = typeof firstSlide.description === "string" ? firstSlide.description : "";
    const slideButtonText = typeof firstSlide.buttonText === "string" ? firstSlide.buttonText : "";
    const slideImageUrl = typeof firstSlide.imageUrl === "string" ? firstSlide.imageUrl.trim() : "";
    if (slideTitle.trim()) content.title = slideTitle;
    if (slideDescription.trim()) content.description = slideDescription;
    if (slideButtonText.trim()) content.buttonText = slideButtonText;
    if (slideImageUrl) content.imageSource = { type: "custom", url: slideImageUrl };
  }

  if (targetVariant === "v2" && !Array.isArray(content.coverSlides)) {
    const imageSource =
      typeof data.imageSource === "object" && data.imageSource ? (data.imageSource as Record<string, unknown>) : null;
    const customImageUrl =
      imageSource?.type === "custom" && typeof imageSource.url === "string" ? imageSource.url : "";
    content.coverSlides = [
      {
        id: "slide-1",
        title: typeof data.title === "string" ? data.title : "",
        description:
          typeof data.description === "string"
            ? data.description
            : typeof data.subtitle === "string"
              ? data.subtitle
              : "",
        buttonText: typeof data.buttonText === "string" ? data.buttonText : "",
        buttonPage: typeof data.buttonPage === "string" ? data.buttonPage : "booking",
        buttonHref: typeof data.buttonHref === "string" ? data.buttonHref : "",
        imageUrl: customImageUrl,
      },
    ];
  }

  return content;
}

export default function SiteClient({
  initialActivePage = "home",
  initialCurrentEntity = null,
  initialPreviewMode = "desktop",
  initialMobileViewport = "mobile360",
  initialPublicPage,
  initialSeoPageSettings,
  account,
  accountProfile,
  branding,
  locations,
  services: initialServices,
  serviceCategories,
  specialistLevels,
  specialists: initialSpecialists,
  promos,
  reviews,
  workPhotos,
  legalDocuments,
  platformLegalDocuments,
}: SiteClientProps) {
  const [, setPublicPage] = useState(initialPublicPage);
  const [editableLocations, setEditableLocations] = useState<LocationItem[]>(locations);
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>(initialSpecialists);
  const [publishedPageUrl, setPublishedPageUrl] = useState<string | null>(null);
  const {
    draft,
    draftRef,
    setDraftTracked,
    undoDraft,
    redoDraft,
    canUndo,
    canRedo,
  } = useDraftHistory(normalizeDraft(initialPublicPage.draftJson, account.name));
  const [activePage, setActivePage] = useState<SitePageKey>(initialActivePage);
  const [currentEntity, setCurrentEntity] = useState<CurrentEntity>(initialCurrentEntity);

  useEffect(() => {
    setEditableLocations(locations);
  }, [locations]);

  useEffect(() => {
    setServices(initialServices);
  }, [initialServices]);

  useEffect(() => {
    setSpecialists(initialSpecialists);
  }, [initialSpecialists]);

  const updateLocationItem = (location: LocationItem) => {
    setEditableLocations((prev) => prev.map((item) => (item.id === location.id ? location : item)));
  };

  const updateServiceItem = (service: ServiceItem) => {
    setServices((prev) => prev.map((item) => (item.id === service.id ? service : item)));
  };

  const updateSpecialistItem = (specialist: SpecialistItem) => {
    setSpecialists((prev) => prev.map((item) => (item.id === specialist.id ? specialist : item)));
  };

  const selectEditorPage = (pageKey: SitePageKey, entity: CurrentEntity = null) => {
    setActivePage(pageKey);
    setCurrentEntity(entity);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (pageKey === "home" && entity === null) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", pageKey);
    }
    if (entity?.type === "legalDocument") {
      url.searchParams.set("entity", `legalDocument:${entity.id}`);
    } else if (entity) {
      url.searchParams.set("entity", `${entity.type}:${entity.id}`);
    } else {
      url.searchParams.delete("entity");
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const activeBlockTypes = useMemo(
    () =>
      new Set<BlockType>([
        "menu",
        "cover",
        "loader",
        "booking",
        "aisha",
        "about",
        "heading",
        "text",
        "image",
        "gallery",
        "form",
        "button",
        "advantages",
        "project",
        "footer",
        "team",
        "news",
        "widget",
        "locationProfile",
        "serviceProfile",
        "specialistProfile",
        "client",
        "clientLogin",
        "clientCabinet",
        "legal",
        "locations",
        "services",
        "specialists",
        "works",
        "reviews",
        "contacts",
        "promos",
      ]),
    []
  );
  const homeBlocks = useMemo(
    () => (draft.pages?.home ?? draft.blocks).filter((block) => activeBlockTypes.has(block.type)),
    [activeBlockTypes, draft.blocks, draft.pages]
  );
  const activePageKey: SitePageKey = activePage;
  const isSystemPage = activePageKey === "booking";
  const isLegalDocumentPage = activePageKey === "legal" && currentEntity?.type === "legalDocument";
  const pageBlocks: SiteBlock[] = useMemo(
    () => {
      const source =
        currentEntity?.type === "legalDocument"
          ? draft.entityPages?.legalDocuments?.[String(currentEntity.id)] ??
            draft.pages?.legal ??
            []
          : draft.pages?.[activePageKey] ?? draft.blocks;
      return source.filter((block) => activeBlockTypes.has(block.type));
    },
    [activeBlockTypes, activePageKey, currentEntity, draft.blocks, draft.entityPages, draft.pages]
  );
  const homeMenuBlock = homeBlocks.find((block) => block.type === "menu") ?? null;
  const shouldShareMenu =
    homeMenuBlock && (homeMenuBlock.data as { showOnAllPages?: boolean }).showOnAllPages !== false;
  const sharedMenuBlock = activePage === "home" || !shouldShareMenu ? null : homeMenuBlock;
  const displayBlocks: SiteBlock[] = useMemo(
    () =>
      sharedMenuBlock
        ? [sharedMenuBlock, ...pageBlocks.filter((block) => block.id !== sharedMenuBlock.id)]
        : pageBlocks,
    [pageBlocks, sharedMenuBlock]
  );
  const loaderConfig = resolveSiteLoaderConfig(draft);
  const [selectedId, setSelectedId] = useState<string | null>(
    displayBlocks[0]?.id ?? null
  );
  const [leftPanel, setLeftPanel] = useState<"library" | null>(null);
  const [libraryPanelMounted, setLibraryPanelMounted] = useState(false);
  const [isLibraryPanelVisible, setIsLibraryPanelVisible] = useState(false);
  const [libraryPanelClosing, setLibraryPanelClosing] = useState(false);
  const [libraryBlock, setLibraryBlock] = useState<BlockType | null>(null);
  const [libraryVariantsBlock, setLibraryVariantsBlock] = useState<BlockType | null>(null);
  const [isLibraryVariantsVisible, setIsLibraryVariantsVisible] = useState(false);
  const [shouldAnimateLibraryVariants, setShouldAnimateLibraryVariants] = useState(false);
  const [variantDrawerBlockId, setVariantDrawerBlockId] = useState<string | null>(null);
  const [isVariantDrawerVisible, setIsVariantDrawerVisible] = useState(false);
  const variantDrawerCloseTimerRef = useRef<number | null>(null);
  const [variantDrawerDraftVariant, setVariantDrawerDraftVariant] = useState<SiteBlock["variant"] | null>(null);
  const [variantKeepContent, setVariantKeepContent] = useState(false);
  const [rightPanel, setRightPanel] = useState<"content" | "settings" | null>(
    null
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(initialPreviewMode);
  const [mobileViewport, setMobileViewport] = useState<MobileViewportKey>(initialMobileViewport);
  const [mobileViewportPickerOpen, setMobileViewportPickerOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pageSettingsTab, setPageSettingsTab] = useState<PageSettingsTab>("main");
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [seoPageSettings, setSeoPageSettings] = useState<SiteSeoPageSetting[]>(initialSeoPageSettings);
  const [activePanelSectionId, setActivePanelSectionId] = useState<string | null>(null);
  const [coverDrawerKey, setCoverDrawerKey] = useState<
    "slider" | "typography" | "button" | "animation" | null
  >(null);
  const [coverWidthModalOpen, setCoverWidthModalOpen] = useState(false);
  const coverWidthButtonRef = useRef<HTMLButtonElement | null>(null);
  const coverWidthPopoverRef = useRef<HTMLDivElement | null>(null);
  const [pendingDeleteBlockId, setPendingDeleteBlockId] = useState<string | null>(null);
  const [activeSpacingSlot, setActiveSpacingSlot] = useState<number | null>(null);
  const [activeSpacingTarget, setActiveSpacingTarget] = useState<"prev" | "next" | null>(
    null
  );
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [spacingAnchorBlockId, setSpacingAnchorBlockId] = useState<string | null>(null);
  const slotRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (leftPanel === "library") {
      setLibraryPanelMounted(true);
      return;
    }
  }, [leftPanel]);

  useEffect(() => {
    if (!libraryPanelMounted) return;
    if (leftPanel === "library") {
      setLibraryPanelClosing(false);
      setIsLibraryPanelVisible(false);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsLibraryPanelVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setIsLibraryPanelVisible(false);
    setLibraryPanelClosing(true);
    const timeout = window.setTimeout(() => {
      setLibraryPanelMounted(false);
      setLibraryPanelClosing(false);
      setLibraryBlock(null);
      setLibraryVariantsBlock(null);
      setIsLibraryVariantsVisible(false);
      setShouldAnimateLibraryVariants(false);
    }, LIBRARY_PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [leftPanel, libraryPanelMounted]);

  useEffect(() => {
    if (libraryBlock) {
      setLibraryVariantsBlock(libraryBlock);
      if (!shouldAnimateLibraryVariants) {
        setIsLibraryVariantsVisible(true);
        return;
      }
      setIsLibraryVariantsVisible(false);
      const raf = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setIsLibraryVariantsVisible(true));
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setShouldAnimateLibraryVariants(true);
    setIsLibraryVariantsVisible(false);
    const timeout = window.setTimeout(() => {
      setLibraryVariantsBlock(null);
    }, LIBRARY_PANEL_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [libraryBlock, shouldAnimateLibraryVariants]);

  const closeLibraryPanel = () => {
    setLeftPanel(null);
  };

  const closeVariantDrawer = () => {
    if (variantDrawerCloseTimerRef.current) {
      window.clearTimeout(variantDrawerCloseTimerRef.current);
    }
    setIsVariantDrawerVisible(false);
    variantDrawerCloseTimerRef.current = window.setTimeout(() => {
      setVariantDrawerBlockId(null);
      variantDrawerCloseTimerRef.current = null;
    }, LIBRARY_PANEL_ANIMATION_MS);
  };

  const openVariantDrawer = (blockId: string) => {
    if (variantDrawerCloseTimerRef.current) {
      window.clearTimeout(variantDrawerCloseTimerRef.current);
      variantDrawerCloseTimerRef.current = null;
    }
    const block = displayBlocks.find((item) => item.id === blockId) ?? null;
    setSelectedId(blockId);
    setRightPanel(null);
    setLeftPanel(null);
    setVariantDrawerBlockId(blockId);
    setVariantDrawerDraftVariant(block?.variant ?? null);
    setIsVariantDrawerVisible(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsVariantDrawerVisible(true));
    });
  };

  const toggleLibraryBlock = (type: BlockType) => {
    const isClosingCurrentBlock = libraryBlock === type;
    setShouldAnimateLibraryVariants(libraryBlock === null || isClosingCurrentBlock);
    setLibraryBlock(isClosingCurrentBlock ? null : type);
  };

  const buildVariantBlock = (
    current: SiteBlock,
    variant: SiteBlock["variant"],
    keepContent: boolean
  ): SiteBlock => {
    const template = resolveBlockVersion({ block: { ...current, variant } }).createDefault({ accountName: account.name });
    const currentData = current.data as Record<string, unknown>;
    const templateData = template.data as Record<string, unknown>;
    const contentPatch = keepContent ? pickVariantContent(current.type, currentData, variant) : {};

    return {
      ...current,
      variant,
      data: {
        ...templateData,
        ...contentPatch,
      },
    };
  };

  const applyVariantDrawerSelection = () => {
    if (!variantDrawerBlock || !variantDrawerDraftVariant) return;
    updateBlock(variantDrawerBlock.id, (current) =>
      buildVariantBlock(current, variantDrawerDraftVariant, variantKeepContent)
    );
    closeVariantDrawer();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SITE_PREVIEW_MODE_STORAGE_KEY, previewMode);
    document.cookie = `${SITE_PREVIEW_MODE_COOKIE_KEY}=${previewMode}; path=/; max-age=${SITE_PREFERENCES_COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [previewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SITE_MOBILE_VIEWPORT_STORAGE_KEY, mobileViewport);
    document.cookie = `${SITE_MOBILE_VIEWPORT_COOKIE_KEY}=${mobileViewport}; path=/; max-age=${SITE_PREFERENCES_COOKIE_MAX_AGE}; SameSite=Lax`;
  }, [mobileViewport]);

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
  const handleUndo = () => {
    undoDraft();
    setShowPanelExitConfirm(false);
  };
  const handleRedo = () => {
    redoDraft();
    setShowPanelExitConfirm(false);
  };
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!currentEntity) return;
    if (currentEntity.type === "location" && !editableLocations.some((item) => item.id === currentEntity.id)) {
      setCurrentEntity(null);
      return;
    }
    if (currentEntity.type === "service" && !services.some((item) => item.id === currentEntity.id)) {
      setCurrentEntity(null);
      return;
    }
    if (
      currentEntity.type === "specialist" &&
      !specialists.some((item) => item.id === currentEntity.id)
    ) {
      setCurrentEntity(null);
      return;
    }
    if (
      currentEntity.type === "legalDocument" &&
      !legalDocuments.some((item) => item.versionId === currentEntity.id)
    ) {
      setCurrentEntity(null);
      return;
    }
    if (
      (currentEntity.type === "location" && activePage !== "locations") ||
      (currentEntity.type === "service" && activePage !== "services") ||
      (currentEntity.type === "specialist" && activePage !== "specialists") ||
      (currentEntity.type === "legalDocument" && activePage !== "legal")
    ) {
      setCurrentEntity(null);
    }
  }, [activePage, currentEntity, editableLocations, legalDocuments, platformLegalDocuments, services, specialists]);

  const selectedBlock = displayBlocks.find((block) => block.id === selectedId) ?? null;
  const variantDrawerBlock = displayBlocks.find((block) => block.id === variantDrawerBlockId) ?? null;
  const pendingDeleteBlock = pendingDeleteBlockId
    ? displayBlocks.find((block) => block.id === pendingDeleteBlockId) ?? null
    : null;
  const pendingDeleteTitle = pendingDeleteBlock
    ? `Вы уверены, что хотите удалить блок «${BLOCK_LABELS[pendingDeleteBlock.type]}»?`
    : pendingDeleteBlockId
      ? "Вы уверены, что хотите удалить блок?"
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
  const {
    updateBlock,
    setThemeMode,
    insertBlock,
    moveBlock,
    confirmRemoveBlock,
    adjustSpacingAt,
    savePublic,
    saveDraftSilently,
  } = buildEditorActions({
    accountName: account.name,
    activePage,
    activeEntity: currentEntity,
    homeBlocks,
    pageBlocks,
    displayBlocks,
    sharedMenuBlock,
    activeTheme,
    activeBlockId,
    selectedId,
    pendingDeleteBlockId,
    draftRef,
    setDraftTracked,
    setSelectedId,
    setInsertIndex,
    setPendingDeleteBlockId,
    setSaving,
    setMessage,
    setPublicPage,
  });
  const hasMountedDraftAutosaveRef = useRef(false);
  const draftAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraftSilentlyRef = useRef(saveDraftSilently);

  useEffect(() => {
    saveDraftSilentlyRef.current = saveDraftSilently;
  }, [saveDraftSilently]);

  useEffect(() => {
    const flushDraft = () => {
      if (!hasMountedDraftAutosaveRef.current) return;
      if (draftAutosaveTimerRef.current) {
        clearTimeout(draftAutosaveTimerRef.current);
        draftAutosaveTimerRef.current = null;
      }
      void saveDraftSilentlyRef.current({ keepalive: true });
    };
    window.addEventListener("pagehide", flushDraft);
    window.addEventListener("beforeunload", flushDraft);
    return () => {
      window.removeEventListener("pagehide", flushDraft);
      window.removeEventListener("beforeunload", flushDraft);
    };
  }, []);

  useEffect(() => {
    if (!hasMountedDraftAutosaveRef.current) {
      hasMountedDraftAutosaveRef.current = true;
      return;
    }
    if (draftAutosaveTimerRef.current) {
      clearTimeout(draftAutosaveTimerRef.current);
    }
    draftAutosaveTimerRef.current = setTimeout(() => {
      void saveDraftSilentlyRef.current();
    }, 800);
    return () => {
      if (draftAutosaveTimerRef.current) {
        clearTimeout(draftAutosaveTimerRef.current);
      }
    };
  }, [draft]);
  const {
    isRightPanelVisible,
    showPanelExitConfirm,
    setShowPanelExitConfirm,
    savePanelDraft,
    requestClosePanel,
    closePanelWithoutSave,
  } = useRightPanel({
    rightPanel,
    setRightPanel,
    panelTargetKey,
    currentPanelSignature,
    selectedBlock,
    savePublic,
    updateBlock,
    setActivePanelSectionId,
    setCoverDrawerKey,
    setCoverWidthModalOpen,
    animationMs: PANEL_ANIMATION_MS,
  });

  const publicUrl = buildCurrentPublicUrl(account.publicSlug, account.slug, activePageKey, currentEntity);
  const projectTitle = account.name?.trim() || account.publicSlug || account.slug || "Мой сайт";
  const {
    pagesMenuOpen,
    setPagesMenuOpen,
    pagesSearch,
    setPagesSearch,
    pagesMenuRef,
    currentPageTitle,
    filteredMenuItems,
    hasFilteredPagesMenuItems,
  } = usePagesMenu({
    pages: draft.pages,
    activePageKey,
    activeEntity: currentEntity,
    locationsCount: editableLocations.length,
    servicesCount: services.length,
    specialistsCount: specialists.length,
    legalDocuments,
    locationProfiles: editableLocations.map((item) => ({ id: item.id, name: item.name })),
    serviceProfiles: services.map((item) => ({ id: item.id, name: item.name })),
    specialistProfiles: specialists.map((item) => ({ id: item.id, name: item.name })),
  });
  const filteredPageItems = filteredMenuItems.filter(isPageMenuItem);
  const filteredClientSubpageItems = filteredMenuItems.filter(isClientSubpageMenuItem);
  const filteredLegalDocumentItems = filteredMenuItems.filter(isLegalDocumentMenuItem);
  const filteredLocationProfileItems = filteredMenuItems.filter(
    (item): item is EntityProfileMenuItem =>
      isEntityProfileMenuItem(item) && item.entityType === "location"
  );
  const filteredSpecialistProfileItems = filteredMenuItems.filter(
    (item): item is EntityProfileMenuItem =>
      isEntityProfileMenuItem(item) && item.entityType === "specialist"
  );
  const filteredServiceProfileItems = filteredMenuItems.filter(
    (item): item is EntityProfileMenuItem =>
      isEntityProfileMenuItem(item) && item.entityType === "service"
  );
  const activePageSettingsKey = buildEditorPageSettingsKey(activePageKey, currentEntity);
  const activePageSettingsPath = buildEditorPageSettingsPath(activePageKey, currentEntity);
  const activeSeoSetting =
    seoPageSettings.find((item) => item.pageKey === activePageSettingsKey) ??
    makeEmptySeoPageSetting(activePageSettingsKey);
  const pageSettingsDefaults = findPageSettingsDefaults(displayBlocks, currentPageTitle);
  const pageSettingsBlockTags = displayBlocks.map((block, index) => ({
    blockId: block.id,
    index,
    type: block.type,
    title: typeof block.data.title === "string" ? block.data.title : "",
    subtitle: typeof block.data.subtitle === "string" ? block.data.subtitle : "",
    seoTitleTag: typeof block.data.seoTitleTag === "string" ? block.data.seoTitleTag : "",
    seoSubtitleTag: typeof block.data.seoSubtitleTag === "string" ? block.data.seoSubtitleTag : "",
  }));
  const updateSeoSetting = (patch: Partial<SiteSeoPageSetting>) => {
    setSeoPageSettings((prev) => {
      const current = prev.find((item) => item.pageKey === activePageSettingsKey);
      const next = { ...(current ?? makeEmptySeoPageSetting(activePageSettingsKey)), ...patch };
      return current
        ? prev.map((item) => (item.pageKey === activePageSettingsKey ? next : item))
        : [...prev, next];
    });
  };
  const updatePageBlockTag = (
    blockId: string,
    patch: { seoTitleTag?: string; seoSubtitleTag?: string }
  ) => {
    setDraftTracked(
      (prev) => updateBlockTagInDraft(prev, activePageKey, currentEntity, blockId, patch),
      { groupKey: `page-settings:${activePageSettingsKey}:${blockId}` }
    );
  };
  const savePageSettings = async () => {
    setSaving("page-settings");
    try {
      await fetch("/api/v1/crm/settings/seo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageSettings: [activeSeoSetting] }),
      });
      await fetch("/api/v1/crm/settings/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftJson: draftRef.current, publish: false }),
      });
      setPageSettingsOpen(false);
      setMessage("Настройки страницы сохранены");
    } finally {
      setSaving(null);
    }
  };
  const availableLibraryBlockTypes = useMemo(
    () => {
      const systemPageTypes = getSystemPageLibraryBlockTypes(activePageKey);
      if (systemPageTypes) return systemPageTypes;
      return LIBRARY_BLOCK_TYPES.filter((type) => {
        if (type === "booking") return false;
        if (type === "client") return false;
        if (type === "clientLogin") return false;
        if (type === "clientCabinet") return false;
        return true;
      });
    },
    [activePageKey]
  );
  const availableQuickAddBlockTypes = useMemo(
    () => {
      const systemPageTypes = getSystemPageLibraryBlockTypes(activePageKey);
      if (systemPageTypes) return systemPageTypes;
      return QUICK_ADD_BLOCK_TYPES.filter((type) => availableLibraryBlockTypes.includes(type));
    },
    [activePageKey, availableLibraryBlockTypes]
  );

  useEffect(() => {
    if (libraryBlock && !availableLibraryBlockTypes.includes(libraryBlock)) {
      setLibraryBlock(null);
    }
  }, [availableLibraryBlockTypes, libraryBlock]);

  useEffect(() => {
    if (!isLegalDocumentPage) return;
    setLeftPanel(null);
    setLibraryBlock(null);
    setLibraryVariantsBlock(null);
    setLibraryPanelMounted(false);
    setIsLibraryPanelVisible(false);
    setLibraryPanelClosing(false);
  }, [isLegalDocumentPage]);

  const themeStyle = buildThemeStyle(activeTheme);
  const previewCanvasWidth =
    previewMode === "mobile" ? MOBILE_VIEWPORTS[mobileViewport].width : undefined;
  const handleThemeToggle = () =>
    setThemeMode(activeTheme.mode === "dark" ? "light" : "dark");
  const panelTheme = resolvePanelTheme(activeTheme.mode);
  const selectedBlockVersion = selectedBlock ? resolveBlockVersion({ block: selectedBlock }) : null;
  const isFloatingPanelVisible =
    Boolean(rightPanel) ||
    Boolean(variantDrawerBlockId) ||
    libraryPanelMounted ||
    isRightPanelVisible ||
    isLibraryPanelVisible ||
    libraryPanelClosing;
  const floatingPanelsTop = isFloatingPanelVisible ? 0 : 56;
  const builderCanvasBg = activeTheme.mode === "dark" ? "#111318" : "#f6f7f9";
  const publishEntity =
    currentEntity?.type === "location"
      ? { type: "locations" as const, id: currentEntity.id }
      : currentEntity?.type === "service"
        ? { type: "services" as const, id: currentEntity.id }
        : currentEntity?.type === "specialist"
          ? { type: "specialists" as const, id: currentEntity.id }
          : currentEntity?.type === "promo"
            ? { type: "promos" as const, id: currentEntity.id }
            : currentEntity?.type === "legalDocument"
              ? { type: "legalDocuments" as const, id: currentEntity.id }
              : null;
  const handlePublishCurrentPage = async () => {
    if (!publicUrl) return;
    const ok = await savePublic(true, {
      pageKey: activePageKey,
      entity: publishEntity,
    });
    if (ok) {
      const absoluteUrl =
        typeof window === "undefined" ? publicUrl : new URL(publicUrl, window.location.origin).toString();
      setPublishedPageUrl(absoluteUrl);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {publishedPageUrl && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="published-page-title"
          onClick={() => setPublishedPageUrl(null)}
        >
          <div
            className="w-full max-w-md rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-6 text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div id="published-page-title" className="text-lg font-semibold">
              Страница опубликована!
            </div>
            <div className="mt-4 text-sm text-[color:var(--bp-muted)]">Ссылка настраницу:</div>
            <div className="mt-2 break-all text-sm font-semibold">
              {publishedPageUrl}
            </div>
            <a
              href={publishedPageUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-md bg-[color:var(--bp-accent)] px-8 py-3 text-base font-semibold text-white"
            >
              Открыть страницу
            </a>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setPublishedPageUrl(null)}
                className="rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
      {message && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-2xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-3 text-sm shadow-[var(--bp-shadow)]"
        >
          {message}
        </div>
      )}
      {pageSettingsOpen ? (
        <div className="fixed inset-0 z-[400] flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-10">
          <div className="w-full max-w-3xl bg-[color:var(--bp-panel)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[color:var(--bp-stroke)] px-6 py-5">
              <div>
                <div className="text-lg font-semibold">Настройки страницы</div>
                <div className="mt-1 font-mono text-xs text-[color:var(--bp-muted)]">
                  {activePageSettingsPath}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPageSettingsOpen(false)}
                className="text-2xl leading-none text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)]"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="flex gap-6 overflow-x-auto border-b border-[color:var(--bp-stroke)] px-6">
              {PAGE_SETTINGS_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPageSettingsTab(tab)}
                  className={`border-b-2 py-4 text-sm ${
                    pageSettingsTab === tab
                      ? "border-[color:var(--bp-ink)] text-[color:var(--bp-ink)]"
                      : "border-transparent text-[color:var(--bp-muted)]"
                  }`}
                >
                  {PAGE_SETTINGS_TAB_LABELS[tab]}
                </button>
              ))}
            </div>
            <div className="px-6 py-7">
              {pageSettingsTab === "main" ? (
                <div className="grid gap-5">
                  <label className="text-sm">
                    Заголовок
                    <input
                      value={activeSeoSetting.title}
                      onChange={(event) => updateSeoSetting({ title: event.target.value })}
                      placeholder={pageSettingsDefaults.title}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Описание
                    <textarea
                      value={activeSeoSetting.description}
                      onChange={(event) => updateSeoSetting({ description: event.target.value })}
                      placeholder={pageSettingsDefaults.description}
                      rows={3}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Адрес страницы
                    <input
                      value={activePageSettingsPath}
                      readOnly
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 font-mono text-[color:var(--bp-muted)] outline-none"
                    />
                  </label>
                </div>
              ) : null}

              {pageSettingsTab === "badge" ? (
                <div className="grid gap-5">
                  <div className="text-center">
                    <div className="text-lg font-medium">Бейджик страницы</div>
                    <p className="mt-2 text-sm text-[color:var(--bp-muted)]">
                      По умолчанию используется изображение из обложки или карточки сущности.
                    </p>
                  </div>
                  <label className="text-sm">
                    Картинка бейджика / OG
                    <input
                      value={activeSeoSetting.ogImageUrl}
                      onChange={(event) => updateSeoSetting({ ogImageUrl: event.target.value })}
                      placeholder="https://..."
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  {activeSeoSetting.ogImageUrl ? (
                    <UnoptimizedImage
                      src={activeSeoSetting.ogImageUrl}
                      alt=""
                      width={960}
                      height={503}
                      className="mx-auto aspect-[1.91/1] w-full max-w-lg object-cover"
                    />
                  ) : null}
                </div>
              ) : null}

              {pageSettingsTab === "social" ? (
                <div className="grid gap-5">
                  <div className="mx-auto w-full max-w-lg border border-[color:var(--bp-stroke)] bg-white p-4 shadow-sm">
                    {activeSeoSetting.ogImageUrl ? (
                      <UnoptimizedImage
                        src={activeSeoSetting.ogImageUrl}
                        alt=""
                        width={960}
                        height={503}
                        className="aspect-[1.91/1] w-full object-cover"
                      />
                    ) : null}
                    <div className="mt-3 text-base font-semibold text-blue-700">
                      {activeSeoSetting.title || pageSettingsDefaults.title}
                    </div>
                    <div className="mt-1 text-xs text-green-700">https://ваш-домен{activePageSettingsPath}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      {activeSeoSetting.description || pageSettingsDefaults.description}
                    </div>
                  </div>
                  <label className="text-sm">
                    Заголовок для соцсетей
                    <input
                      value={activeSeoSetting.title}
                      onChange={(event) => updateSeoSetting({ title: event.target.value })}
                      placeholder={pageSettingsDefaults.title}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                </div>
              ) : null}

              {pageSettingsTab === "seo" ? (
                <div className="grid gap-5">
                  <div className="mx-auto w-full max-w-lg border border-[color:var(--bp-stroke)] bg-white p-4 shadow-sm">
                    <div className="text-base font-medium text-blue-700">
                      {activeSeoSetting.title || pageSettingsDefaults.title}
                    </div>
                    <div className="mt-1 text-xs text-green-700">https://ваш-домен{activePageSettingsPath}</div>
                    <div className="mt-2 text-sm text-slate-700">
                      {activeSeoSetting.description || pageSettingsDefaults.description}
                    </div>
                  </div>
                  <label className="text-sm">
                    Заголовок
                    <input
                      value={activeSeoSetting.title}
                      onChange={(event) => updateSeoSetting({ title: event.target.value })}
                      placeholder={pageSettingsDefaults.title}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Описание
                    <textarea
                      value={activeSeoSetting.description}
                      onChange={(event) => updateSeoSetting({ description: event.target.value })}
                      placeholder={pageSettingsDefaults.description}
                      rows={2}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Ключевые слова
                    <input
                      value={activeSeoSetting.keywords}
                      onChange={(event) => updateSeoSetting({ keywords: event.target.value })}
                      placeholder="уход, стрижка, окрашивание"
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="text-sm">
                    Каноническая ссылка
                    <input
                      value={activeSeoSetting.canonicalUrl}
                      onChange={(event) => updateSeoSetting({ canonicalUrl: event.target.value })}
                      placeholder={`https://ваш-домен${activePageSettingsPath}`}
                      className="mt-2 w-full border-0 border-b border-[color:var(--bp-stroke)] bg-transparent px-0 py-2 outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={activeSeoSetting.noIndex}
                      onChange={(event) => updateSeoSetting({ noIndex: event.target.checked })}
                    />
                    Запретить поисковикам индексировать эту страницу
                  </label>
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={activeSeoSetting.noFollow}
                      onChange={(event) => updateSeoSetting({ noFollow: event.target.checked })}
                    />
                    Запретить поисковой системе переходить по ссылкам на странице
                  </label>

                  {pageSettingsBlockTags.length ? (
                    <div className="mt-2 border-t border-[color:var(--bp-stroke)] pt-5">
                      <div className="text-sm font-semibold">SEO-теги блоков</div>
                      <div className="mt-3 grid gap-3">
                        {pageSettingsBlockTags.map((block) => (
                          <div
                            key={block.blockId}
                            className="grid gap-3 rounded-2xl border border-[color:var(--bp-stroke)] p-3 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                          >
                            <div>
                              <div className="text-sm font-medium">
                                {block.title || block.subtitle || `${block.type} #${block.index + 1}`}
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--bp-muted)]">{block.type}</div>
                            </div>
                            <label className="text-xs">
                              Заголовок
                              <select
                                value={block.seoTitleTag}
                                onChange={(event) =>
                                  updatePageBlockTag(block.blockId, { seoTitleTag: event.target.value })
                                }
                                className="mt-1 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-transparent px-2 py-2"
                              >
                                {["", "h1", "h2", "h3", "h4", "h5", "h6", "div"].map((tag) => (
                                  <option key={tag} value={tag}>
                                    {tag || "Не задан"}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs">
                              Подзаголовок
                              <select
                                value={block.seoSubtitleTag}
                                onChange={(event) =>
                                  updatePageBlockTag(block.blockId, { seoSubtitleTag: event.target.value })
                                }
                                className="mt-1 w-full rounded-xl border border-[color:var(--bp-stroke)] bg-transparent px-2 py-2"
                              >
                                {["", "h1", "h2", "h3", "h4", "h5", "h6", "div"].map((tag) => (
                                  <option key={tag} value={tag}>
                                    {tag || "Не задан"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--bp-stroke)] px-6 py-5">
              <button
                type="button"
                onClick={() => setPageSettingsOpen(false)}
                className="rounded-full border border-[color:var(--bp-stroke)] px-5 py-2 text-sm"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={savePageSettings}
                disabled={saving === "page-settings"}
                className="rounded-full bg-[color:var(--bp-accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving === "page-settings" ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <div className="h-8.5" />
        <div
          data-site-builder-toolbar="true"
          className={`fixed top-0 left-0 right-0 z-[230] border border-x-0 border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] px-4 py-2 sm:px-6 lg:px-8 transition-all duration-[220ms] ease-out ${
            isFloatingPanelVisible ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
          }`}
        >
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div className="flex min-w-0 items-center gap-4 justify-self-start">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[color:var(--bp-muted)]">
            <Link
              href="/crm/site/project"
              className="block min-w-0 max-w-[260px] truncate text-xs uppercase tracking-[0.16em] text-[color:var(--bp-ink)] hover:text-[color:var(--bp-accent)]"
              title={projectTitle}
            >
              {projectTitle}
            </Link>
            <span className="shrink-0">/</span>
            <div ref={pagesMenuRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setPagesMenuOpen((prev) => !prev)}
                className="inline-flex min-w-0 max-w-full items-center gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-ink)] hover:text-[color:var(--bp-accent)]"
                title={currentPageTitle}
              >
                <span className="min-w-0 truncate">{currentPageTitle}</span>
                <span className="shrink-0 text-sm leading-none">{pagesMenuOpen ? "▴" : "▾"}</span>
              </button>
              {pagesMenuOpen && (
                <div className="absolute left-0 top-full z-[300] w-[360px] rounded-xl border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-3 text-[color:var(--bp-ink)] shadow-[var(--bp-shadow)]">
                  <div className="relative mb-2">
                    <input
                      type="text"
                      value={pagesSearch}
                      onChange={(event) => setPagesSearch(event.target.value)}
                      placeholder="Поиск страницы"
                      className="h-10 w-full !rounded-none border border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] px-3 pr-9 text-sm outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--ring)]"
                      style={{ borderRadius: 2 }}
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
                    {[...filteredPageItems].map((item) => {
                      const isActive = item.key === activePage && currentEntity === null;
                      return (
                        <button
                          key={`page:${item.key}`}
                          type="button"
                          onClick={() => {
                            selectEditorPage(item.key);
                            setPagesMenuOpen(false);
                            setPagesSearch("");
                          }}
                          className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                            isActive
                              ? "bg-[color:var(--bp-surface)] font-semibold"
                              : "hover:bg-[color:var(--bp-surface)]/70"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                    {filteredClientSubpageItems.length > 0 && (
                      <>
                        <div className="px-3 pt-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                          Личный кабинет
                        </div>
                        {filteredClientSubpageItems.map((item) => {
                          const isActive =
                            activePage === item.key && currentEntity === null;
                          return (
                            <button
                              key={`client:${item.key}`}
                              type="button"
                              onClick={() => {
                                selectEditorPage(item.key);
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                isActive
                                  ? "bg-[color:var(--bp-surface)] font-semibold"
                                  : "hover:bg-[color:var(--bp-surface)]/70"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                    {filteredLegalDocumentItems.length > 0 && (
                      <>
                        <div className="px-3 pt-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                          Документы
                        </div>
                        {filteredLegalDocumentItems.map((item) => {
                          const isActive =
                            activePage === "legal" &&
                            currentEntity?.type === "legalDocument" &&
                            currentEntity.id === item.versionId;
                          return (
                            <button
                              key={`legal:${item.versionId}`}
                              type="button"
                              onClick={() => {
                                selectEditorPage("legal", { type: "legalDocument", id: item.versionId });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                isActive
                                  ? "bg-[color:var(--bp-surface)] font-semibold"
                                  : "hover:bg-[color:var(--bp-surface)]/70"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                    {filteredLocationProfileItems.length > 0 && (
                      <>
                        <div className="px-3 pt-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                          Локации
                        </div>
                        {filteredLocationProfileItems.map((item) => {
                          const isActive =
                            item.key === activePage &&
                            currentEntity?.type === item.entityType &&
                            currentEntity?.id === item.entityId;
                          return (
                            <button
                              key={`entity:${item.entityType}:${item.entityId}`}
                              type="button"
                              onClick={() => {
                                selectEditorPage(item.key, { type: item.entityType, id: item.entityId });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                isActive
                                  ? "bg-[color:var(--bp-surface)] font-semibold"
                                  : "hover:bg-[color:var(--bp-surface)]/70"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                    {filteredSpecialistProfileItems.length > 0 && (
                      <>
                        <div className="px-3 pt-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                          Специалисты
                        </div>
                        {filteredSpecialistProfileItems.map((item) => {
                          const isActive =
                            item.key === activePage &&
                            currentEntity?.type === item.entityType &&
                            currentEntity?.id === item.entityId;
                          return (
                            <button
                              key={`entity:${item.entityType}:${item.entityId}`}
                              type="button"
                              onClick={() => {
                                selectEditorPage(item.key, { type: item.entityType, id: item.entityId });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                isActive
                                  ? "bg-[color:var(--bp-surface)] font-semibold"
                                  : "hover:bg-[color:var(--bp-surface)]/70"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </>
                    )}
                    {filteredServiceProfileItems.length > 0 && (
                      <>
                        <div className="px-3 pt-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--bp-muted)]">
                          Услуги
                        </div>
                        {filteredServiceProfileItems.map((item) => {
                          const isActive =
                            item.key === activePage &&
                            currentEntity?.type === item.entityType &&
                            currentEntity?.id === item.entityId;
                          return (
                            <button
                              key={`entity:${item.entityType}:${item.entityId}`}
                              type="button"
                              onClick={() => {
                                selectEditorPage(item.key, { type: item.entityType, id: item.entityId });
                                setPagesMenuOpen(false);
                                setPagesSearch("");
                              }}
                              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${
                                isActive
                                  ? "bg-[color:var(--bp-surface)] font-semibold"
                                  : "hover:bg-[color:var(--bp-surface)]/70"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </>
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
          </div>
          <div className="relative flex items-center justify-self-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/crm/site/project";
              }}
              className="absolute right-full top-1/2 mr-6 flex h-10 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-none border-0 bg-transparent px-2 text-xs font-medium text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)]"
              aria-label="Вернуться в CRM"
              title="Вернуться в CRM"
            >
              <svg viewBox="0 0 1024 1024" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M384 192a32 32 0 0 1 0 45.248L237.248 384H640a224 224 0 0 1 0 448H384a32 32 0 1 1 0-64h256a160 160 0 0 0 0-320H237.248L384 594.752A32 32 0 1 1 338.752 640l-201.376-201.376a32 32 0 0 1 0-45.248L338.752 192A32 32 0 0 1 384 192z" />
              </svg>
              <span>В CRM</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode("desktop");
                  setMobileViewportPickerOpen(false);
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-none border-0 bg-transparent transition ${
                  previewMode === "desktop"
                    ? "text-[color:var(--bp-ink)]"
                    : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
                }`}
                aria-label="Десктоп"
                title="Десктоп"
              >
                <DesktopPreviewIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileViewportPickerOpen((open) => !open);
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-none border-0 bg-transparent transition ${
                  previewMode === "mobile"
                    ? "text-[color:var(--bp-ink)]"
                    : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-ink)]"
                }`}
                aria-label="Мобильный"
                title="Мобильный"
              >
                <MobilePreviewIcon className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setHelpPanelOpen((open) => !open);
                setMobileViewportPickerOpen(false);
              }}
              className={`absolute left-full top-1/2 ml-6 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-none border-0 bg-transparent transition ${
                helpPanelOpen
                  ? "text-[color:var(--bp-accent)]"
                  : "text-[color:var(--bp-muted)] hover:text-[color:var(--bp-accent)]"
              }`}
              aria-label="Справка по конструктору"
              title="Справка по конструктору"
            >
              <HelpPanelIcon className="h-6 w-6" />
            </button>
            {mobileViewportPickerOpen && (
              <div
                className="absolute left-1/2 top-[calc(100%+8px)] z-[320] w-[240px] -translate-x-1/2 rounded-md border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] p-2 shadow-[var(--bp-shadow)]"
                role="dialog"
                aria-label="Выбор размера мобильного предпросмотра"
              >
                {(Object.keys(MOBILE_VIEWPORTS) as MobileViewportKey[]).map((key) => {
                  const isSelectedViewport = previewMode === "mobile" && mobileViewport === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setMobileViewport(key);
                        setPreviewMode("mobile");
                        setMobileViewportPickerOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition ${
                        isSelectedViewport
                          ? "bg-[color:var(--bp-surface)] font-semibold text-[color:var(--bp-ink)]"
                          : "text-[color:var(--bp-muted)] hover:bg-[color:var(--bp-surface)]/70 hover:text-[color:var(--bp-ink)]"
                      }`}
                    >
                      {MOBILE_VIEWPORTS[key].label}
                      {isSelectedViewport ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--bp-ink)]" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 justify-self-end">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="inline-flex h-10 w-10 items-center justify-center rounded-none border-0 bg-transparent text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] disabled:cursor-not-allowed disabled:opacity-40"
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
              onClick={handleRedo}
              disabled={!canRedo}
              className="inline-flex h-10 w-10 items-center justify-center rounded-none border-0 bg-transparent text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Повторить действие"
              title="Повторить"
            >
              <svg viewBox="0 0 1024 1024" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M754.752 480H160a32 32 0 1 0 0 64h594.752L521.344 777.344a32 32 0 0 0 45.312 45.312l288-288a32 32 0 0 0 0-45.312l-288-288a32 32 0 1 0-45.312 45.312L754.752 480z" />
              </svg>
            </button>
            {publicUrl && (
              <>
                <button
                  type="button"
                  onClick={handlePublishCurrentPage}
                  className="rounded-none border-0 bg-transparent px-2 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--bp-ink)] transition hover:text-[color:var(--bp-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving === "public"}
                >
                  Опубликовать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPageSettingsTab("main");
                    setPageSettingsOpen(true);
                  }}
                  className="rounded-none border-0 bg-transparent px-2 py-2 text-xs uppercase tracking-[0.16em] text-[color:var(--bp-ink)] transition hover:text-[color:var(--bp-accent)]"
                >
                  Настройки
                </button>
              </>
            )}
          </div>
        </div>
        </div>
      </div>

      <div
        className="relative"
        style={{
          backgroundColor: builderCanvasBg,
          backgroundImage: "none",
        }}
      >
        <main
          className="w-full"
          data-site-theme={activeTheme.mode}
          onMouseMove={(event) => updateHoveredBlockFromLine(event.clientY)}
          onMouseLeave={() => {
            if (activeSpacingSlot !== null) return;
            setHoveredBlockId(null);
          }}
          style={{
            ...themeStyle,
            backgroundColor: builderCanvasBg,
            backgroundImage: "none",
            color: activeTheme.textColor,
            fontFamily: activeTheme.fontBody,
          }}
        >
          <div
            className="mx-auto flex w-full flex-col"
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
              hideAddButton={Boolean(rightPanel) || isLegalDocumentPage}
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
                closeVariantDrawer();
                setInsertIndex(0);
                setLeftPanel("library");
                setLibraryBlock(null);
              }}
            />
            {displayBlocks.map((block: SiteBlock, index: number) => {
              const isSharedMenu = Boolean(
                sharedMenuBlock && activePage !== "home" && block.id === sharedMenuBlock.id
              );
              const isBlockActive = block.id === hoveredBlockId;
              const blockHidden = isBlockHidden(block);
              const controlsDark = activeTheme.mode === "dark";
              const leftBtnClass = controlsDark
                ? "h-8 rounded-sm border border-[#374151] bg-[#111827] px-3 text-xs font-medium text-[#e5e7eb] shadow-sm hover:bg-[#1f2937]"
                : "h-8 rounded-sm border border-[#d1d5db] bg-white px-3 text-xs font-medium text-[#111827] shadow-sm hover:bg-[#f3f4f6]";
              const iconBtnClass = controlsDark
                ? "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#374151] bg-[#111827] text-sm font-medium text-[#e5e7eb] shadow-sm hover:bg-[#1f2937]"
                : "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#d1d5db] bg-white text-sm font-medium text-[#111827] shadow-sm hover:bg-[#f3f4f6]";
              const variantOptions = getBlockVariants(block.type);
              const currentBlockCode = getLibraryBlockCode(block.type, block.variant);
              const controlsWrapClass =
                previewMode === "mobile"
                  ? "pointer-events-none absolute left-1/2 top-3 z-20 flex w-screen -translate-x-1/2 items-start justify-between px-3"
                  : "pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between";
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
                {isBlockActive && !rightPanel && (
                  <div className={controlsWrapClass}>
                    <div className="pointer-events-auto flex items-center gap-1">
                      {variantOptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => openVariantDrawer(block.id)}
                          className={`${leftBtnClass} inline-flex min-w-20 items-center justify-center gap-2`}
                          aria-expanded={variantDrawerBlockId === block.id && isVariantDrawerVisible}
                        >
                          <span>{currentBlockCode}</span>
                          <span className="text-sm leading-none">›</span>
                        </button>
                      )}
                      <div className="flex items-center gap-0">
                        <button
                          type="button"
                          onClick={() => {
                            closeVariantDrawer();
                            setSelectedId(block.id);
                            setRightPanel("content");
                          }}
                          className={`${leftBtnClass} w-28 rounded-r-none`}
                          style={{
                            backgroundColor: panelTheme.save,
                            borderColor: panelTheme.save,
                            color: "#ffffff",
                          }}
                        >
                          Контент
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeVariantDrawer();
                            setSelectedId(block.id);
                            setRightPanel("settings");
                          }}
                          className={`${leftBtnClass} -ml-px w-28 rounded-l-none`}
                        >
                          Настройки
                        </button>
                      </div>
                    </div>
                    {!(
                      isLegalDocumentPage ||
                      isSharedMenu ||
                      (isSystemPage && isSystemBlockType(block.type))
                    ) && (
                      <div className="pointer-events-auto flex items-center gap-1">
                        <div className="flex items-center gap-0">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteBlockId(block.id)}
                            className={`${iconBtnClass} rounded-r-none`}
                            aria-label="Удалить блок"
                            title="Удалить"
                          >
                            <TrashIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              closeVariantDrawer();
                              updateBlock(block.id, (current) => ({
                                ...current,
                                data: {
                                  ...(current.data as Record<string, unknown>),
                                  hidden: !isBlockHidden(current),
                                },
                              }));
                            }}
                            className={`${iconBtnClass} -ml-px rounded-l-none`}
                            aria-label={blockHidden ? "Показать блок" : "Скрыть блок"}
                            title={blockHidden ? "Показать" : "Скрыть"}
                          >
                            <HiddenBlockIcon />
                          </button>
                        </div>
                        <div className="ml-2 flex items-center gap-0">
                          <button
                            type="button"
                            onClick={() => moveBlock(block.id, "up")}
                            className={`${iconBtnClass} rounded-r-none`}
                            aria-label="Переместить вверх"
                            title="Вверх"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveBlock(block.id, "down")}
                            className={`${iconBtnClass} -ml-px rounded-l-none`}
                            aria-label="Переместить вниз"
                            title="Вниз"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {blockHidden ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(block.id);
                      setSpacingAnchorBlockId(block.id);
                      setHoveredBlockId(block.id);
                    }}
                    className={`flex h-[60px] w-full items-center justify-center border-y border-dashed text-sm transition-colors ${
                      block.id === selectedId
                        ? "bg-transparent text-[color:var(--bp-ink)]"
                        : "bg-transparent text-[color:var(--bp-muted)] hover:bg-black/[0.02]"
                    }`}
                    style={{ borderColor: activeTheme.borderColor || "#d1d5db" }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <HiddenBlockIcon className="h-4 w-4" />
                      <span className="font-semibold">{currentBlockCode}</span>
                      <span>{getLibraryLabel(block.type, activePageKey)} скрыт</span>
                    </span>
                  </button>
                ) : (
                  <BlockPreview
                    block={block}
                    account={account}
                    accountProfile={accountProfile}
                    branding={branding}
                    locations={editableLocations}
                    services={services}
                    specialists={specialists}
                    promos={promos}
                    reviews={reviews}
                    workPhotos={workPhotos}
                    legalDocuments={legalDocuments}
                    platformLegalDocuments={platformLegalDocuments}
                    theme={activeTheme}
                    loaderConfig={loaderConfig}
                    currentEntity={currentEntity}
                    previewMode={previewMode}
                    previewViewportWidth={previewCanvasWidth}
                    onThemeToggle={handleThemeToggle}
                    onSelect={() => {
                      setSelectedId(block.id);
                      setSpacingAnchorBlockId(block.id);
                      setHoveredBlockId(block.id);
                    }}
                    isSelected={block.id === selectedId}
                  />
                )}
                <InsertSlot
                  index={index + 1}
                  slotRef={(el) => registerSlotRef(index + 1, el)}
                  spacing={getSlotSpacing(index + 1)}
                  activeOffset={getSlotActiveOffset(index + 1, activeSpacingTarget)}
                  hideAddButton={Boolean(rightPanel) || isLegalDocumentPage}
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
                    closeVariantDrawer();
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
            {!isLegalDocumentPage ? (
              <div
                className={`mt-0 border-t px-4 py-6 ${
                  activeTheme.mode === "dark"
                    ? "border-[#1f2937] bg-[#111111]"
                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]"
                }`}
              >
                <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeVariantDrawer();
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
                  {availableQuickAddBlockTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => insertBlock(type, displayBlocks.length)}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        activeTheme.mode === "dark"
                          ? "border-[#3f3f46] bg-transparent text-[#e4e4e7]"
                          : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
                      }`}
                    >
                      {BLOCK_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </main>

        {variantDrawerBlock && (
          <>
            <button
              type="button"
              className="fixed inset-x-0 bottom-0 z-[210] cursor-default bg-transparent"
              style={{ top: floatingPanelsTop }}
              aria-label="Закрыть варианты блока"
              onClick={closeVariantDrawer}
            />
            <aside
              className={`fixed z-[220] flex w-[400px] max-w-[92vw] flex-col overflow-hidden border-r shadow-[var(--bp-shadow)] transition-transform duration-[220ms] ease-out ${
                isVariantDrawerVisible ? "translate-x-0" : "-translate-x-full"
              } ${
                activeTheme.mode === "dark"
                  ? "border-[#2b2b2b] bg-[#111111] text-[#f3f4f6]"
                  : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)] text-[color:var(--bp-ink)]"
              }`}
              style={{ left: 0, top: floatingPanelsTop, bottom: 0 }}
            >
              <div className="flex h-14 items-center justify-between border-b border-[color:var(--bp-stroke)] px-4">
                <div>
                  <div className="text-sm font-semibold">{getLibraryLabel(variantDrawerBlock.type, activePageKey)}</div>
                  <div className="mt-0.5 text-xs text-[color:var(--bp-muted)]">Выберите вариант блока</div>
                </div>
                <button
                  type="button"
                  onClick={closeVariantDrawer}
                  className="grid h-8 w-8 place-items-center text-2xl leading-none text-[color:var(--bp-muted)] transition-colors hover:text-[color:var(--bp-ink)]"
                  aria-label="Закрыть варианты блока"
                >
                  ×
                </button>
              </div>

              <div className="flex border-b border-[color:var(--bp-stroke)] px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-[color:var(--bp-ink)]">
                  <span
                    className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
                      variantKeepContent
                        ? "bg-[color:var(--bp-accent)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
                        : "bg-[#eef1f5] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={variantKeepContent}
                      onChange={(event) => setVariantKeepContent(event.target.checked)}
                      className="sr-only"
                    />
                    <span
                      className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-transform ${
                        variantKeepContent ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  <span>Сохранять контент</span>
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="divide-y divide-[color:var(--bp-stroke)]">
                  {getBlockVariants(variantDrawerBlock.type).map((variant) => {
                    const blockCode = getLibraryBlockCode(variantDrawerBlock.type, variant);
                    const isCurrent = variantDrawerBlock.variant === variant;
                    const isSelectedVariant = (variantDrawerDraftVariant ?? variantDrawerBlock.variant) === variant;
                    return (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => {
                          setVariantDrawerDraftVariant(variant);
                        }}
                        className={`block w-full bg-transparent p-4 text-left transition-colors ${
                          isSelectedVariant ? "bg-[color:var(--bp-paper)]" : "hover:bg-[color:var(--bp-paper)]"
                        }`}
                      >
                        <div className="relative overflow-hidden border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                          <div className="relative aspect-[19/9] bg-[color:var(--bp-surface)]">
                            <UnoptimizedImage
                              src={getLibraryPreviewSrc(blockCode)}
                              alt={`${blockCode} ${getLibraryLabel(variantDrawerBlock.type, activePageKey)}`}
                              className="h-full w-full object-cover"
                              height={427}
                              width={900}
                            />
                          </div>
                          {isSelectedVariant && !isCurrent && (
                            <div className="absolute inset-0 grid place-items-center bg-black/20">
                              <span
                                role="button"
                                tabIndex={-1}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  applyVariantDrawerSelection();
                                }}
                                className="rounded-full bg-[color:var(--bp-save-close,#ff6b57)] px-5 py-2 text-xs font-semibold text-white shadow-lg transition hover:brightness-95"
                              >
                                Применить
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="rounded-full bg-[color:var(--bp-muted)] px-2 py-0.5 text-[11px] font-semibold text-white">
                              {blockCode}
                            </span>
                            <span className="truncate text-sm font-semibold">{variantsLabel[variant]}</span>
                          </div>
                          {isCurrent ? (
                            <span className="shrink-0 rounded-full bg-[color:var(--bp-accent)] px-2 py-0.5 text-[11px] font-semibold text-white">
                              Текущий
                            </span>
                          ) : isSelectedVariant ? (
                            <span className="shrink-0 rounded-full bg-[color:var(--bp-save-close,#ff6b57)] px-2 py-0.5 text-[11px] font-semibold text-white">
                              Выбран
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </>
        )}

        {libraryPanelMounted && (
          <>
          <button
            type="button"
            className="fixed inset-x-0 bottom-0 z-[210] cursor-default bg-transparent"
            style={{ top: floatingPanelsTop }}
            aria-label="Закрыть библиотеку блоков"
            onClick={closeLibraryPanel}
          />
          <aside
            className={`fixed z-[220] overflow-hidden transition-transform duration-[220ms] ease-out ${
              isLibraryPanelVisible && !libraryPanelClosing ? "translate-x-0" : "-translate-x-full"
            } ${
              activeTheme.mode === "dark" ? "text-[#f3f4f6]" : "text-[color:var(--bp-ink)]"
            }`}
            style={{ left: 0, top: floatingPanelsTop, bottom: 0, width: libraryVariantsBlock ? "min(760px, 72vw)" : "240px" }}
          >
            <div className="flex h-full min-h-0">
              <div
                className={`relative z-10 flex w-[240px] shrink-0 flex-col border-r shadow-[var(--bp-shadow)] ${
                  activeTheme.mode === "dark"
                    ? "border-[#2b2b2b] bg-[#111111]"
                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)]"
                }`}
              >
                <div className="flex h-14 items-center justify-between border-b border-[color:var(--bp-stroke)] px-4">
                  <div className="text-sm font-semibold">Библиотека блоков</div>
                  <button
                    type="button"
                    onClick={closeLibraryPanel}
                    className="grid h-8 w-8 place-items-center text-2xl leading-none text-[color:var(--bp-muted)] transition-colors hover:text-[color:var(--bp-ink)]"
                    aria-label="Закрыть библиотеку блоков"
                  >
                    ×
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {availableLibraryBlockTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleLibraryBlock(type)}
                      className={`flex h-12 w-full flex-shrink-0 items-center justify-between border-b border-[color:var(--bp-stroke)] px-4 text-left text-sm leading-none transition-colors ${
                        libraryBlock === type
                          ? "bg-[color:var(--bp-paper)] text-[color:var(--bp-ink)]"
                          : "bg-transparent text-[color:var(--bp-ink)] hover:bg-[color:var(--bp-paper)]"
                      } ${PRIMARY_LIBRARY_BLOCK_TYPES.has(type) ? "font-bold" : "font-normal"}`}
                    >
                      <span className="min-w-0 truncate">{getLibraryLabel(type, activePageKey)}</span>
                      <span className="ml-3 text-xs text-[color:var(--bp-muted)]">{getBlockVariants(type).length}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className={`relative z-0 flex h-full w-[520px] shrink-0 flex-col overflow-hidden border-r shadow-[var(--bp-shadow)] transition-transform duration-[220ms] ease-out ${
                  libraryVariantsBlock && availableLibraryBlockTypes.includes(libraryVariantsBlock) && isLibraryVariantsVisible
                    ? "translate-x-0"
                    : "-translate-x-full"
                } ${
                  activeTheme.mode === "dark"
                    ? "border-[#2b2b2b] bg-[#111111]"
                    : "border-[color:var(--bp-stroke)] bg-[color:var(--bp-surface)]"
                }`}
                aria-hidden={!libraryVariantsBlock || !availableLibraryBlockTypes.includes(libraryVariantsBlock)}
              >
                <div className="flex h-full min-w-0 flex-col">
                <div className="flex h-14 items-center justify-between border-b border-[color:var(--bp-stroke)] px-4">
                  <div>
                    <div className="text-sm font-semibold">
                      {libraryVariantsBlock ? getLibraryLabel(libraryVariantsBlock, activePageKey) : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-[color:var(--bp-muted)]">Нажмите на превью, чтобы добавить блок</div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="divide-y divide-[color:var(--bp-stroke)]">
                    {libraryVariantsBlock ? getBlockVariants(libraryVariantsBlock).map((variant) => {
                      const blockCode = getLibraryBlockCode(libraryVariantsBlock, variant);
                      return (
                        <button
                          key={variant}
                          type="button"
                          onClick={() => {
                            insertBlock(libraryVariantsBlock, insertIndex ?? displayBlocks.length, variant);
                            closeLibraryPanel();
                          }}
                          className="block w-full bg-transparent p-5 text-left transition-colors hover:bg-[color:var(--bp-paper)]"
                        >
                          <div className="overflow-hidden border border-[color:var(--bp-stroke)] bg-[color:var(--bp-paper)]">
                            <div className="relative aspect-[19/9] bg-[color:var(--bp-surface)]">
                              <UnoptimizedImage
                                src={getLibraryPreviewSrc(blockCode)}
                                alt={`${blockCode} ${getLibraryLabel(libraryVariantsBlock, activePageKey)}`}
                                className="h-full w-full object-cover"
                                height={427}
                                width={900}
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex items-start gap-3">
                            <span className="rounded-full bg-[color:var(--bp-muted)] px-2 py-0.5 text-[11px] font-semibold text-white">
                              {blockCode}
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{getLibraryLabel(libraryVariantsBlock, activePageKey)}</div>
                            </div>
                          </div>
                        </button>
                      );
                    }) : null}
                  </div>
                </div>
                </div>
              </div>
            </div>
          </aside>
          </>
        )}

        <SiteRightPanelFrame
          rightPanel={rightPanel}
          isRightPanelVisible={isRightPanelVisible}
          activeThemeMode={activeTheme.mode}
          floatingPanelsTop={floatingPanelsTop}
          panelTheme={panelTheme}
          panelTitle={
            rightPanel === "settings"
              ? selectedBlock
                ? `Настройки · ${BLOCK_LABELS[selectedBlock.type]}`
                : "Настройки блока"
              : selectedBlock
                ? `Контент · ${BLOCK_LABELS[selectedBlock.type]}`
                : "Контент блока"
          }
          saving={saving}
          onSave={() => savePanelDraft(false)}
          onSaveAndClose={() => savePanelDraft(true)}
          onSurfaceClick={() => {
            if (activePanelSectionId !== null || coverDrawerKey !== null) {
              setActivePanelSectionId(null);
              setCoverDrawerKey(null);
            }
          }}
        >
                {selectedBlock && selectedBlockVersion ? (
                  rightPanel === "content" ? (
                    selectedBlockVersion.contentPanel({
                      rightPanel,
                      block: selectedBlock,
                      accountName: account.name,
                      branding,
                      accountProfile,
                      locations: editableLocations,
                      services,
                      serviceCategories,
                      specialistLevels,
                      specialists,
                      promos,
                      activeTheme,
                      panelTheme,
                      currentPanelSections,
                      activePanelSectionId,
                      setActivePanelSectionId,
                      coverDrawerKey,
                      setCoverDrawerKey,
                      getCoverWidthButtonRef: () => coverWidthButtonRef,
                      getCoverWidthPopoverRef: () => coverWidthPopoverRef,
                      coverWidthModalOpen,
                      setCoverWidthModalOpen,
                      updateBlock,
                      updateLocationItem,
                      updateServiceItem,
                      updateSpecialistItem,
                      legalDocuments,
                      platformLegalDocuments,
                      currentEntity,
                    })
                  ) : (
                    selectedBlockVersion.settingsPanel({
                      rightPanel,
                      block: selectedBlock,
                      accountName: account.name,
                      branding,
                      accountProfile,
                      locations: editableLocations,
                      services,
                      serviceCategories,
                      specialistLevels,
                      specialists,
                      promos,
                      activeTheme,
                      panelTheme,
                      currentPanelSections,
                      activePanelSectionId,
                      setActivePanelSectionId,
                      coverDrawerKey,
                      setCoverDrawerKey,
                      getCoverWidthButtonRef: () => coverWidthButtonRef,
                      getCoverWidthPopoverRef: () => coverWidthPopoverRef,
                      coverWidthModalOpen,
                      setCoverWidthModalOpen,
                      updateBlock,
                      updateLocationItem,
                      updateServiceItem,
                      updateSpecialistItem,
                      legalDocuments,
                      platformLegalDocuments,
                      currentEntity,
                    })
                  )
                ) : null}

        </SiteRightPanelFrame>

        {(rightPanel === "settings" && selectedBlock && (activePanelSectionId || coverDrawerKey)) && (
          <aside
            className={`fixed z-[221] w-[440px] max-w-[calc(100vw-372px)] overflow-y-auto border-l border-r shadow-[var(--bp-shadow)] transition-all duration-[220ms] ease-out [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              isRightPanelVisible ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
            } ${
              activeTheme.mode === "dark"
                ? "[&_input:not([type='color'])]:border-[#2b2b2b] [&_input:not([type='color'])]:bg-[#121212] [&_input:not([type='color'])]:text-[#f3f4f6] [&_input:not([type='color'])]:opacity-100 [&_input:not([type='color'])]:[color-scheme:dark] [&_select]:border-[#2b2b2b] [&_select]:bg-[#121212] [&_select]:text-[#f3f4f6] [&_select]:opacity-100 [&_select]:[color-scheme:dark] [&_textarea]:border-[#2b2b2b] [&_textarea]:bg-[#121212] [&_textarea]:text-[#f3f4f6] [&_textarea]:opacity-100 [&_textarea]:[color-scheme:dark] [&_option]:bg-[#121212] [&_option]:text-[#f3f4f6]"
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
              "--bp-paper": panelTheme.panel,
              "--bp-surface": panelTheme.surface,
              "--bp-stroke": panelTheme.border,
              "--bp-ink": panelTheme.text,
              "--bp-muted": panelTheme.muted,
              "--bp-accent": panelTheme.accent,
              "--bp-save-close": panelTheme.saveClose,
              "--input-bg": activeTheme.mode === "dark" ? "#0f131a" : "#ffffff",
              "--text": panelTheme.text,
              "--border": panelTheme.border,
              "--muted": panelTheme.muted,
            } as CssVars}
          >
            <div
              className="sticky top-0 z-20 flex h-12 items-center justify-between border-b px-4"
              style={{ borderColor: panelTheme.border, backgroundColor: panelTheme.surface }}
            >
              <div className="w-8" />
                  <div className="text-sm font-semibold">
                    {coverDrawerKey
                      ? coverDrawerKey === "slider"
                        ? "Стиль слайдера"
                        : coverDrawerKey === "typography"
                          ? "Типографика"
                          : coverDrawerKey === "button"
                            ? "Кнопка"
                            : "Анимация"
                      : currentPanelSections.find((section) => section.id === activePanelSectionId)?.label}
                  </div>
              <div className="w-8" />
            </div>
            <div
              className={`h-full p-4 ${
                rightPanel === "settings" && coverDrawerKey === "typography"
                  ? "pb-20"
                  : ""
              }`}
              style={{
                backgroundColor: panelTheme.panel,
                color: panelTheme.text,
              }}
            >
              {selectedBlock && selectedBlockVersion
                ? selectedBlockVersion.drawers({
                    rightPanel,
                    block: selectedBlock,
                    accountName: account.name,
                    branding,
                    accountProfile,
                    locations: editableLocations,
                    services,
                    serviceCategories,
                    specialistLevels,
                    specialists,
                    promos,
                    activeTheme,
                    panelTheme,
                    currentPanelSections,
                    activePanelSectionId,
                    setActivePanelSectionId,
                    coverDrawerKey,
                    setCoverDrawerKey,
                    getCoverWidthButtonRef: () => coverWidthButtonRef,
                    getCoverWidthPopoverRef: () => coverWidthPopoverRef,
                    coverWidthModalOpen,
                    setCoverWidthModalOpen,
                    updateBlock,
                    updateLocationItem,
                    updateServiceItem,
                    updateSpecialistItem,
                    legalDocuments,
                    platformLegalDocuments,
                    currentEntity,
                  })
                : null}
            </div>
          </aside>
        )}

        <SiteRightPanelOverlays
          rightPanel={rightPanel}
          isRightPanelVisible={isRightPanelVisible}
          floatingPanelsTop={floatingPanelsTop}
          onRequestClosePanel={requestClosePanel}
          showPanelExitConfirm={showPanelExitConfirm}
          onCancelExitConfirm={() => setShowPanelExitConfirm(false)}
          onClosePanelWithoutSave={closePanelWithoutSave}
          pendingDeleteTitle={pendingDeleteTitle}
          onCancelDelete={() => setPendingDeleteBlockId(null)}
          onConfirmDelete={confirmRemoveBlock}
          panelTheme={panelTheme}
        />

        {helpPanelOpen ? (
          <button
            type="button"
            aria-label="Закрыть справку"
            className="fixed inset-0 z-[235] cursor-default bg-black/0"
            style={{ top: floatingPanelsTop }}
            onClick={() => setHelpPanelOpen(false)}
          />
        ) : null}
        <aside
          className={`fixed right-0 z-[240] w-[min(420px,92vw)] overflow-y-auto border-l shadow-2xl transition-transform duration-[220ms] ease-out ${
            helpPanelOpen ? "translate-x-0" : "translate-x-full"
          }`}
          style={{
            top: floatingPanelsTop,
            bottom: 0,
            borderColor: panelTheme.border,
            backgroundColor: panelTheme.panel,
            color: panelTheme.text,
          }}
          aria-hidden={!helpPanelOpen}
        >
          <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b px-5" style={{ borderColor: panelTheme.border, backgroundColor: panelTheme.panel }}>
            <div className="text-sm font-semibold">Справка по конструктору</div>
            <button
              type="button"
              onClick={() => setHelpPanelOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-none text-2xl leading-none text-[color:var(--bp-muted)] transition hover:text-[color:var(--bp-ink)]"
              aria-label="Закрыть справку"
              title="Закрыть"
            >
              ×
            </button>
          </div>
          <div className="space-y-5 p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: panelTheme.muted }}>
                Быстрый старт
              </div>
              <div className="mt-2 text-sm leading-6" style={{ color: panelTheme.text }}>
                Здесь будет инструкция по работе с конструктором сайта: структура страниц, блоки, настройки, публикация и предпросмотр.
              </div>
            </div>
            <div className="border-t pt-5" style={{ borderColor: panelTheme.border }}>
              <div className="text-sm font-semibold">Что добавить в инструкцию</div>
              <div className="mt-3 space-y-3 text-sm" style={{ color: panelTheme.muted }}>
                <div>Как выбрать страницу и блок.</div>
                <div>Чем отличаются вкладки Контент и Настройки.</div>
                <div>Как проверить мобильную версию.</div>
                <div>Как сохранить и опубликовать изменения.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}




