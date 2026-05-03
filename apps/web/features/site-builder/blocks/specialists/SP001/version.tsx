import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import {
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  defaultBlockData,
  defaultBlockStyle,
} from "@/features/site-builder/crm/site-client-core";
import { SiteServicesSettingsPrimary } from "@/features/site-builder/crm/site-services-settings-primary";
import { SP001ContentPanel } from "./content-panel";
import { SP001Drawers } from "./drawers";

function defaultSurface(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized && normalized !== "transparent" ? value : fallback;
}

export const SP001: BlockVersion = {
  blockCode: "SP001",
  normalizeData: (input) => {
    if (typeof input !== "object" || !input) return {};
    const data = input as Record<string, unknown>;
    const style = typeof data.style === "object" && data.style ? (data.style as Record<string, unknown>) : {};
    const defaultRange = centeredGridRange(8);
    return {
      ...data,
      title: data.title ?? "Специалисты",
      subtitle: data.subtitle ?? "Команда профессионалов",
      mode: data.mode ?? "all",
      ids: Array.isArray(data.ids) ? data.ids : [],
      showButton: data.showButton ?? true,
      showDetailsButton: data.showDetailsButton ?? true,
      showSearch: data.showSearch ?? true,
      showSort: data.showSort ?? true,
      showCategoryTabs: data.showCategoryTabs ?? true,
      showLocationFilter: data.showLocationFilter ?? true,
      showLevel: data.showLevel ?? true,
      showImage: data.showImage ?? true,
      cardsPerRow: data.cardsPerRow === 3 ? 4 : (data.cardsPerRow ?? 4),
      cardStyle: data.cardStyle ?? "plain",
      categoryAllLabel: data.categoryAllLabel ?? "Все специалисты",
      searchPlaceholder: data.searchPlaceholder ?? "Поиск специалиста",
      defaultSort: data.defaultSort ?? "default",
      searchSortAlignment: data.searchSortAlignment ?? "right",
      filtersAlignment: data.filtersAlignment ?? "left",
      mobileCardsPerRow: data.mobileCardsPerRow === 1 ? 2 : (data.mobileCardsPerRow ?? 2),
      imageAspectRatio: data.imageAspectRatio === "4 / 5" ? "1 / 1" : (data.imageAspectRatio ?? "1 / 1"),
      imageRadius: data.imageRadius ?? 10,
      cardGapX: data.cardGapX === 24 ? 20 : (data.cardGapX ?? 20),
      cardGapY: data.cardGapY === 32 ? 40 : (data.cardGapY ?? 40),
      cardPaddingX: data.cardPaddingX === 0 ? 30 : (data.cardPaddingX ?? 30),
      cardPaddingY: data.cardPaddingY === 0 ? 30 : (data.cardPaddingY ?? 30),
      maxVisibleItems: data.maxVisibleItems === 12 ? 8 : (data.maxVisibleItems ?? 8),
      style: {
        ...style,
        blockWidth: style.blockWidth ?? Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
        blockWidthColumns: style.blockWidthColumns ?? 8,
        gridStartColumn: style.gridStartColumn ?? defaultRange.start,
        gridEndColumn: style.gridEndColumn ?? defaultRange.end,
        useCustomWidth: style.useCustomWidth ?? true,
        sectionBgLight: defaultSurface(style.sectionBgLight ?? style.sectionBg, "#ffffff"),
        sectionBg: defaultSurface(style.sectionBg ?? style.sectionBgLight, "#ffffff"),
        blockBgLight: defaultSurface(style.blockBgLight ?? style.blockBg, "#ffffff"),
        blockBg: defaultSurface(style.blockBg ?? style.blockBgLight, "#ffffff"),
        subBlockBgLight: defaultSurface(style.subBlockBgLight ?? style.subBlockBg, "#fafafa"),
        subBlockBg: defaultSurface(style.subBlockBg ?? style.subBlockBgLight, "#fafafa"),
        borderColorLight: style.borderColorLight ?? style.borderColor ?? "transparent",
        borderColor: style.borderColor ?? style.borderColorLight ?? "transparent",
        textColorLight: style.textColorLight ?? style.textColor ?? "#111827",
        textColor: style.textColor ?? style.textColorLight ?? "#111827",
        textAlignHeading: style.textAlignHeading ?? "center",
        textAlignSubheading: style.textAlignSubheading ?? "left",
        headingSize: style.headingSize ?? 46,
        shadowSize: style.shadowSize ?? 0,
      },
    };
  },
  createDefault: () => {
    const base = (defaultBlockData.specialists ?? {}) as Record<string, unknown>;
    const baseStyle = typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    const defaultRange = centeredGridRange(8);
    return {
      id: makeBlockId(),
      type: "specialists",
      variant: "v1",
      data: {
        ...base,
        title: "Специалисты",
        subtitle: "Выберите специалиста",
        cardsPerRow: 4,
        cardStyle: "plain",
        categoryAllLabel: "Все специалисты",
        searchPlaceholder: "Поиск специалиста",
        defaultSort: "default",
        searchSortAlignment: "right",
        filtersAlignment: "left",
        showCategoryTabs: true,
        showSort: true,
        showDetailsButton: true,
        detailsButtonText: "Подробнее",
        maxVisibleItems: 8,
        showSearch: true,
        showLocationFilter: true,
        showLevel: true,
        showImage: true,
        showButton: true,
        buttonText: "Записаться",
        imageAspectRatio: "1 / 1",
        imageRadius: 10,
        cardGapX: 20,
        cardGapY: 40,
        cardPaddingX: 30,
        cardPaddingY: 30,
        mobileCardsPerRow: 2,
        imageZoomOnHover: true,
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          blockWidth: Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
          blockWidthColumns: 8,
          gridStartColumn: defaultRange.start,
          gridEndColumn: defaultRange.end,
          useCustomWidth: true,
          sectionBgLight: "#ffffff",
          sectionBg: "#ffffff",
          blockBgLight: "#ffffff",
          blockBg: "#ffffff",
          servicesSectionBackgroundModeLight: "solid",
          servicesSectionBackgroundFromLight: "#ffffff",
          subBlockBgLight: "#fafafa",
          subBlockBg: "#fafafa",
          borderColorLight: "transparent",
          borderColor: "transparent",
          textColorLight: "#111827",
          textColor: "#111827",
          textAlignHeading: "center",
          textAlignSubheading: "left",
          headingSize: 46,
          shadowSize: 0,
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <SP001ContentPanel {...ctx} />,
  settingsPanel: (ctx) => (
    <SiteServicesSettingsPrimary
      block={ctx.block}
      activeTheme={ctx.activeTheme}
      panelTheme={ctx.panelTheme}
      activePanelSectionId={ctx.activePanelSectionId}
      coverWidthButtonRef={ctx.coverWidthButtonRef}
      coverWidthPopoverRef={ctx.coverWidthPopoverRef}
      coverWidthModalOpen={ctx.coverWidthModalOpen}
      setCoverWidthModalOpen={ctx.setCoverWidthModalOpen}
      setActivePanelSectionId={ctx.setActivePanelSectionId}
      updateBlock={ctx.updateBlock}
      labels={{
        list: "Список специалистов",
        filters: "Фильтры, поиск и сортировка",
        card: "Карточка специалиста",
      }}
    />
  ),
  drawers: (ctx) => <SP001Drawers {...ctx} />,
  actions: () => {},
};
