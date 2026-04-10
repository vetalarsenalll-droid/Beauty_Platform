"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCK_LABELS,
  type BlockType,
  type SiteBlock,
  type SiteTheme,
  normalizeDraft,
  resolveSiteLoaderConfig,
  type SitePageKey,
} from "@/lib/site-builder";
import type {
  SiteBranding as Branding,
  SiteEditorAccountProfile as AccountProfile,
  SiteLocationItem as LocationItem,
  SitePromoItem as PromoItem,
  SiteServiceItem as ServiceItem,
  SiteSpecialistItem as SpecialistItem,
} from "@/features/site-builder/shared/site-data";
import {
  BOOKING_MAX_PRESET,
  BOOKING_MIN_PRESET,
  CONTENT_SECTIONS_BY_BLOCK,
  FONT_WEIGHTS,
  GRID_MAX_COLUMN,
  GRID_MIN_COLUMN,
  MOBILE_VIEWPORTS,
  PAGE_LABELS,
  PANEL_ANIMATION_MS,
  SETTINGS_SECTIONS_BY_BLOCK,
  SOCIAL_LABELS,
  THEME_FONTS,
  bookingColumnsFromPreset,
  bookingPresetFromColumns,
  clamp01,
  createBlock,
  defaultBlockStyle,
  hexToRgbaString,
  isSystemBlockType,
  parseBackdropColor,
  variantsLabel,
} from "@/features/site-builder/crm/site-client-core";
import type {
  CurrentEntity,
  EditorSection,
  MobileViewportKey,
  SiteClientProps,
} from "@/features/site-builder/crm/site-client-core";
import { resolveEntityPageKey } from "@/features/site-builder/crm/editor-draft-helpers";
import {
  BlockPreview,
  CoverImageEditor,
  EntityListEditor,
  FieldText,
  FieldTextarea,
  FlatCheckbox,
  InsertSlot,
  TildaInlineNumberField,
  normalizeBlockStyle,
} from "@/features/site-builder/crm/site-renderer";
import {
  BlockEditor,
  BlockStyleEditor,
} from "@/features/site-builder/crm/site-editor-panels";
import { useDraftHistory } from "@/features/site-builder/crm/use-draft-history";
import { buildEditorActions } from "@/features/site-builder/crm/editor-actions";
import { usePagesMenu } from "@/features/site-builder/crm/use-pages-menu";
import { useRightPanel } from "@/features/site-builder/crm/use-right-panel";
import { buildThemeStyle, resolvePanelTheme } from "@/features/site-builder/crm/site-shell-theme";
import { SiteRightPanelOverlays } from "@/features/site-builder/crm/site-right-panel-overlays";
import { SiteRightPanelFrame } from "@/features/site-builder/crm/site-right-panel-frame";
import { SiteCoverSettingsPrimary } from "@/features/site-builder/crm/site-cover-settings-primary";
import { SiteMenuSettingsPrimary } from "@/features/site-builder/crm/site-menu-settings-primary";
import { SiteMenuButtonDrawer } from "@/features/site-builder/crm/site-menu-button-drawer";
import { SiteCoverDrawerSections } from "@/features/site-builder/crm/site-cover-drawer-sections";
import {
  QUICK_ADD_BLOCK_TYPES,
  LIBRARY_BLOCK_TYPES,
  getBlockVariants,
} from "@/features/site-builder/blocks/block-registry";
import {
  resolveCoverSettings,
} from "@/features/site-builder/crm/cover-settings";

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
  const {
    draft,
    setDraft,
    draftRef,
    setDraftTracked,
    undoDraft,
    redoDraft,
    canUndo,
    canRedo,
  } = useDraftHistory(normalizeDraft(initialPublicPage.draftJson, account.name));
  const [activePage, setActivePage] = useState<SitePageKey>(initialActivePage);
  const [currentEntity, setCurrentEntity] = useState<CurrentEntity>(null);

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
  const [libraryBlock, setLibraryBlock] = useState<BlockType | null>(null);
  const [rightPanel, setRightPanel] = useState<"content" | "settings" | null>(
    null
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [mobileViewport, setMobileViewport] = useState<MobileViewportKey>("mobile360");
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [activePanelSectionId, setActivePanelSectionId] = useState<string | null>(null);
  const [coverDrawerKey, setCoverDrawerKey] = useState<"typography" | "button" | "animation" | null>(null);
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

  const selectedBlock = displayBlocks.find((block) => block.id === selectedId) ?? null;
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
    updateBlocks,
    insertBlock,
    removeBlock,
    moveBlock,
    confirmRemoveBlock,
    adjustSpacingAt,
    savePublic,
    saveDraftSilently,
  } = buildEditorActions({
    accountName: account.name,
    activePage,
    currentEntity,
    homeBlocks,
    pageBlocks,
    displayBlocks,
    sharedMenuBlock,
    entityPageKey,
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
  const {
    isRightPanelVisible,
    showPanelExitConfirm,
    setShowPanelExitConfirm,
    closeRightPanel,
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

  const publicUrl = account.publicSlug ? `/${account.publicSlug}` : null;
  const projectTitle = account.name?.trim() || account.publicSlug || account.slug || "Мой сайт";
  const {
    pagesMenuOpen,
    setPagesMenuOpen,
    pagesSearch,
    setPagesSearch,
    pagesMenuRef,
    availablePageKeys,
    currentPageTitle,
    filteredPageKeys,
    filteredLocationItems,
    filteredServiceItems,
    filteredSpecialistItems,
    filteredPromoItems,
    hasFilteredPagesMenuItems,
  } = usePagesMenu({
    pages: draft.pages,
    activePageKey,
    currentEntity,
    locations,
    services,
    specialists,
    promos,
  });

  const themeStyle = buildThemeStyle(activeTheme);
  const previewCanvasWidth =
    previewMode === "mobile" ? MOBILE_VIEWPORTS[mobileViewport].width : undefined;
  const handleThemeToggle = () =>
    setThemeMode(activeTheme.mode === "dark" ? "light" : "dark");
  const panelTheme = resolvePanelTheme(activeTheme.mode);
  const {
    isCoverSettingsPanel,
    coverStyle,
    coverData,
    coverGridStart,
    coverGridEnd,
    coverGridSpan,
    coverMarginTopLines,
    coverMarginBottomLines,
    coverBackgroundMode,
    coverScrollEffect,
    coverScrollHeightPx,
    coverFilterStartColor,
    coverFilterEndColor,
    coverFilterStartOpacity,
    coverFilterEndOpacity,
    coverArrow,
    coverArrowColor,
    coverArrowAnimated,
    coverBackgroundPosition,
    coverBackgroundTo,
    coverBackgroundAngle,
    coverBackgroundStopA,
    coverBackgroundStopB,
    coverShowSecondaryButton,
    coverPrimaryButtonBorderColor,
    coverSecondaryButtonColor,
    coverSecondaryButtonTextColor,
    coverSecondaryButtonBorderColor,
    coverSecondaryButtonRadius,
    updateSelectedCoverStyle,
    updateSelectedCoverData,
    applySelectedCoverGridRange,
  } = resolveCoverSettings({
    rightPanel,
    selectedBlock,
    activeTheme,
    updateBlock,
  });
  const floatingPanelsTop = rightPanel ? 0 : 56;

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
                <span className="text-sm leading-none">{pagesMenuOpen ? "?" : "?"}</span>
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
                        ?
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
              onClick={handleUndo}
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
              onClick={handleRedo}
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
                          ^
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBlock(block.id, "down")}
                          className={iconBtnClass}
                          aria-label="Переместить вниз"
                          title="Вниз"
                        >
                          v
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteBlockId(block.id)}
                          className={removeBtnClass}
                          aria-label="Удалить блок"
                          title="Удалить"
                        >
                          ?
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
                {QUICK_ADD_BLOCK_TYPES.map((type) => (
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
                {LIBRARY_BLOCK_TYPES.map((type) => (
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
              {getBlockVariants(libraryBlock).map((variant) => (
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
                  <SiteCoverSettingsPrimary
                    panelTheme={panelTheme}
                    coverWidthButtonRef={coverWidthButtonRef}
                    coverWidthPopoverRef={coverWidthPopoverRef}
                    coverWidthModalOpen={coverWidthModalOpen}
                    setCoverWidthModalOpen={setCoverWidthModalOpen}
                    coverGridSpan={coverGridSpan}
                    coverGridStart={coverGridStart}
                    coverGridEnd={coverGridEnd}
                    applySelectedCoverGridRange={applySelectedCoverGridRange}
                    coverStyle={coverStyle}
                    updateSelectedCoverStyle={updateSelectedCoverStyle}
                    coverScrollEffect={coverScrollEffect as "none" | "fixed" | "parallax"}
                    updateSelectedCoverData={updateSelectedCoverData}
                    coverScrollHeightPx={coverScrollHeightPx}
                    coverFilterStartColor={coverFilterStartColor}
                    coverFilterStartOpacity={coverFilterStartOpacity}
                    coverFilterEndColor={coverFilterEndColor}
                    coverFilterEndOpacity={coverFilterEndOpacity}
                    coverArrow={coverArrow as "none" | "down"}
                    coverArrowColor={coverArrowColor}
                    coverArrowAnimated={coverArrowAnimated}
                    isCoverVariantV2={selectedBlock?.variant === "v2"}
                    coverDrawerKey={coverDrawerKey}
                    setCoverDrawerKey={setCoverDrawerKey}
                    coverBackgroundPosition={coverBackgroundPosition}
                    coverMarginTopLines={coverMarginTopLines}
                    coverMarginBottomLines={coverMarginBottomLines}
                    coverBackgroundMode={coverBackgroundMode}
                    coverBackgroundTo={coverBackgroundTo}
                    coverBackgroundAngle={coverBackgroundAngle}
                    coverBackgroundStopA={coverBackgroundStopA}
                    coverBackgroundStopB={coverBackgroundStopB}
                  />
                                ) : selectedBlock?.type === "menu" ? (
                  <SiteMenuSettingsPrimary
                    selectedBlock={selectedBlock}
                    activeTheme={activeTheme}
                    panelTheme={panelTheme}
                    currentPanelSections={currentPanelSections}
                    activePanelSectionId={activePanelSectionId}
                    setActivePanelSectionId={setActivePanelSectionId}
                    updateBlock={updateBlock}
                  />
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

        </SiteRightPanelFrame>

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
              {rightPanel === "settings" &&
                !isCoverSettingsPanel &&
                selectedBlock?.type === "menu" &&
                activePanelSectionId === "button" && (
                  <SiteMenuButtonDrawer
                    selectedBlock={selectedBlock}
                    activeTheme={activeTheme}
                    accountProfile={accountProfile}
                    updateBlock={updateBlock}
                  />
                )}
              {rightPanel === "settings" &&
                !isCoverSettingsPanel &&
                !(selectedBlock?.type === "menu" && activePanelSectionId === "button") && (
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
              {rightPanel === "settings" &&
                isCoverSettingsPanel &&
                (coverDrawerKey === "button" || coverDrawerKey === "animation") && (
                  <SiteCoverDrawerSections
                    coverDrawerKey={coverDrawerKey}
                    selectedBlock={selectedBlock}
                    activeTheme={activeTheme}
                    coverStyle={coverStyle}
                    coverShowSecondaryButton={coverShowSecondaryButton}
                    coverPrimaryButtonBorderColor={coverPrimaryButtonBorderColor}
                    coverSecondaryButtonColor={coverSecondaryButtonColor}
                    coverSecondaryButtonTextColor={coverSecondaryButtonTextColor}
                    coverSecondaryButtonBorderColor={coverSecondaryButtonBorderColor}
                    coverSecondaryButtonRadius={coverSecondaryButtonRadius}
                    updateSelectedCoverStyle={updateSelectedCoverStyle}
                    updateSelectedCoverData={updateSelectedCoverData}
                  />
                )}
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




