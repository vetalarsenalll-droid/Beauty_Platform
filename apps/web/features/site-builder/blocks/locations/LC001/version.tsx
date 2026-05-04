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
import { LC001ContentPanel } from "./content-panel";
import { LC001Drawers } from "./drawers";

function defaultSurface(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized && normalized !== "transparent" ? value : fallback;
}

const locationDefaults = {
  title: "Филиалы",
  subtitle: "Выберите удобную локацию",
  mode: "all",
  ids: [],
  showButton: true,
  showDetailsButton: true,
  buttonText: "Записаться",
  detailsButtonText: "Подробнее",
  buttonAlignment: "center",
  detailsButtonColor: "transparent",
  detailsButtonTextColor: "#111111",
  detailsButtonBorderColor: "transparent",
  detailsButtonColorDark: "transparent",
  detailsButtonTextColorDark: "#f8fafc",
  detailsButtonBorderColorDark: "transparent",
  showSearch: true,
  showSort: true,
  showCategoryTabs: false,
  showLocationFilter: false,
  showLevel: true,
  showDescription: true,
  showImage: true,
  cardsPerRow: 4,
  mobileCardsPerRow: 2,
  cardStyle: "plain",
  categoryAllLabel: "Все филиалы",
  searchPlaceholder: "Поиск филиала",
  defaultSort: "default",
  searchSortAlignment: "right",
  filtersAlignment: "left",
  sortTextColor: "#111827",
  sortActiveColor: "#111827",
  sortTextColorDark: "#f2f3f5",
  sortActiveColorDark: "#d3d6db",
  imageAspectRatio: "1 / 1",
  imageRadius: 10,
  specialistCardImageFit: "cover",
  specialistCardImageZoomOnClick: false,
  specialistModalMediaColumns: 6,
  specialistModalInfoColumns: 6,
  specialistCardBackgroundModeLight: "solid",
  specialistCardBackgroundFromLight: "#fafafa",
  specialistCardBackgroundToLight: "#fafafa",
  specialistCardBackgroundAngleLight: 135,
  specialistCardBackgroundStopALight: 0,
  specialistCardBackgroundStopBLight: 100,
  specialistCardBackgroundStartOpacityLight: 0,
  specialistCardBackgroundEndOpacityLight: 10,
  specialistCardBackgroundModeDark: "solid",
  specialistCardBackgroundFromDark: "#24282e",
  specialistCardBackgroundToDark: "#24282e",
  specialistCardBackgroundAngleDark: 135,
  specialistCardBackgroundStopADark: 0,
  specialistCardBackgroundStopBDark: 100,
  specialistCardBackgroundStartOpacityDark: 0,
  specialistCardBackgroundEndOpacityDark: 10,
  specialistCardLiquidGlass: false,
  catalogCardTitleColorLight: "#111827",
  catalogCardTitleColorDark: "#F8FAFC",
  catalogCardTitleSize: 18,
  catalogCardTitleFont: "Manrope",
  catalogCardTitleWeight: 600,
  catalogCardTextColorLight: "#6B7280",
  catalogCardTextColorDark: "#CBD5E1",
  catalogCardTextSize: 14,
  catalogCardTextFont: "Manrope",
  catalogCardTextWeight: "",
  locationPrimaryButtonSize: 14,
  locationPrimaryButtonFont: "Manrope",
  locationPrimaryButtonWeight: 600,
  locationDetailsButtonSize: 14,
  locationDetailsButtonFont: "Manrope",
  locationDetailsButtonWeight: "",
  cardGapX: 20,
  cardGapY: 40,
  cardPaddingX: 30,
  cardPaddingY: 30,
  maxVisibleItems: 8,
  usePagination: false,
  imageZoomOnHover: true,
  alignButtonsBottom: true,
  modalImageClickEnabled: true,
};

function readMigratedValue(data: Record<string, unknown>, key: string, legacyKey: string) {
  return data[key] ?? data[legacyKey] ?? locationDefaults[key as keyof typeof locationDefaults];
}

export const LC001: BlockVersion = {
  blockCode: "LC001",
  normalizeData: (input) => {
    const data = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
    const style = typeof data.style === "object" && data.style ? (data.style as Record<string, unknown>) : {};
    const defaultRange = centeredGridRange(8);
    return {
      ...locationDefaults,
      ...data,
      title: data.title ?? locationDefaults.title,
      subtitle: data.subtitle ?? locationDefaults.subtitle,
      ids: Array.isArray(data.ids) ? data.ids : [],
      catalogCardTitleColorLight: readMigratedValue(data, "catalogCardTitleColorLight", "specialistCardTitleColorLight"),
      catalogCardTitleColorDark: readMigratedValue(data, "catalogCardTitleColorDark", "specialistCardTitleColorDark"),
      catalogCardTitleSize: readMigratedValue(data, "catalogCardTitleSize", "specialistCardTitleSize"),
      catalogCardTitleFont: readMigratedValue(data, "catalogCardTitleFont", "specialistCardTitleFont"),
      catalogCardTitleWeight: readMigratedValue(data, "catalogCardTitleWeight", "specialistCardTitleWeight"),
      catalogCardTextColorLight: readMigratedValue(data, "catalogCardTextColorLight", "specialistCardDescriptionColorLight"),
      catalogCardTextColorDark: readMigratedValue(data, "catalogCardTextColorDark", "specialistCardDescriptionColorDark"),
      catalogCardTextSize: readMigratedValue(data, "catalogCardTextSize", "specialistCardDescriptionSize"),
      catalogCardTextFont: readMigratedValue(data, "catalogCardTextFont", "specialistCardDescriptionFont"),
      catalogCardTextWeight: readMigratedValue(data, "catalogCardTextWeight", "specialistCardDescriptionWeight"),
      style: {
        ...style,
        blockWidth: style.blockWidth ?? Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
        blockWidthColumns: style.blockWidthColumns ?? 8,
        mobileBlockWidthColumns: style.mobileBlockWidthColumns ?? MAX_BLOCK_COLUMNS,
        gridStartColumn: style.gridStartColumn ?? defaultRange.start,
        gridEndColumn: style.gridEndColumn ?? defaultRange.end,
        useCustomWidth: style.useCustomWidth ?? true,
        sectionBgLight: defaultSurface(style.sectionBgLight ?? style.sectionBg, "#ffffff"),
        sectionBg: defaultSurface(style.sectionBg ?? style.sectionBgLight, "#ffffff"),
        blockBgLight: defaultSurface(style.blockBgLight ?? style.blockBg, "#ffffff"),
        blockBg: defaultSurface(style.blockBg ?? style.blockBgLight, "#ffffff"),
        subBlockBgLight: defaultSurface(style.subBlockBgLight ?? style.subBlockBg, "#fafafa"),
        subBlockBgDark: defaultSurface(style.subBlockBgDark, "#24282e"),
        subBlockBg: defaultSurface(style.subBlockBg ?? style.subBlockBgLight, "#fafafa"),
        borderColorLight: style.borderColorLight ?? style.borderColor ?? "transparent",
        borderColor: style.borderColor ?? style.borderColorLight ?? "transparent",
        textColorLight: style.textColorLight ?? style.textColor ?? "#111827",
        textColorDark: style.textColorDark ?? "#f2f3f5",
        textColor: style.textColor ?? style.textColorLight ?? "#111827",
        mutedColorLight: style.mutedColorLight ?? style.mutedColor ?? "#6B7280",
        mutedColorDark: style.mutedColorDark ?? "#a1a5ad",
        mutedColor: style.mutedColor ?? style.mutedColorLight ?? "#6B7280",
        textAlignHeading: style.textAlignHeading ?? "center",
        textAlignSubheading: style.textAlignSubheading ?? "left",
        headingSize: style.headingSize ?? 46,
        shadowSize: style.shadowSize ?? 0,
      },
    };
  },
  createDefault: () => {
    const base = (defaultBlockData.locations ?? {}) as Record<string, unknown>;
    const baseStyle = typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    const defaultRange = centeredGridRange(8);
    return {
      id: makeBlockId(),
      type: "locations",
      variant: "v1",
      data: {
        ...base,
        ...locationDefaults,
        style: {
          ...defaultBlockStyle,
          ...baseStyle,
          blockWidth: Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
          blockWidthColumns: 8,
          mobileBlockWidthColumns: MAX_BLOCK_COLUMNS,
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
          subBlockBgDark: "#24282e",
          subBlockBg: "#fafafa",
          borderColorLight: "transparent",
          borderColor: "transparent",
          textColorLight: "#111827",
          textColorDark: "#f2f3f5",
          textColor: "#111827",
          mutedColorLight: "#6B7280",
          mutedColorDark: "#a1a5ad",
          mutedColor: "#6B7280",
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
  contentPanel: (ctx) => <LC001ContentPanel {...ctx} />,
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
        list: "Список филиалов",
        filters: "Поиск и сортировка",
        card: "Карточка филиала",
      }}
    />
  ),
  drawers: (ctx) => <LC001Drawers {...ctx} />,
  actions: () => {},
};
