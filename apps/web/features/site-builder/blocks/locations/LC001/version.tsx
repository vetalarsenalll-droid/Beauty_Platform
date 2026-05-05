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
  locationCardImageFit: "cover",
  locationCardImageZoomOnClick: false,
  locationModalMediaColumns: 6,
  locationModalInfoColumns: 6,
  locationCardBackgroundModeLight: "solid",
  locationCardBackgroundFromLight: "#fafafa",
  locationCardBackgroundToLight: "#fafafa",
  locationCardBackgroundAngleLight: 135,
  locationCardBackgroundStopALight: 0,
  locationCardBackgroundStopBLight: 100,
  locationCardBackgroundStartOpacityLight: 0,
  locationCardBackgroundEndOpacityLight: 10,
  locationCardBackgroundModeDark: "solid",
  locationCardBackgroundFromDark: "#24282e",
  locationCardBackgroundToDark: "#24282e",
  locationCardBackgroundAngleDark: 135,
  locationCardBackgroundStopADark: 0,
  locationCardBackgroundStopBDark: 100,
  locationCardBackgroundStartOpacityDark: 0,
  locationCardBackgroundEndOpacityDark: 10,
  locationCardLiquidGlass: false,
  locationCardTitleColorLight: "#111827",
  locationCardTitleColorDark: "#F8FAFC",
  locationCardTitleSize: 18,
  locationCardTitleFont: "Manrope",
  locationCardTitleWeight: 600,
  locationCardTextColorLight: "#6B7280",
  locationCardTextColorDark: "#CBD5E1",
  locationCardTextSize: 14,
  locationCardTextFont: "Manrope",
  locationCardTextWeight: "",
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

function readMigratedValue(data: Record<string, unknown>, key: string, ...legacyKeys: string[]) {
  if (data[key] !== undefined && data[key] !== null) return data[key];
  for (const legacyKey of legacyKeys) {
    if (data[legacyKey] !== undefined && data[legacyKey] !== null) return data[legacyKey];
  }
  return locationDefaults[key as keyof typeof locationDefaults];
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
      locationCardImageFit: readMigratedValue(data, "locationCardImageFit", "specialistCardImageFit"),
      locationCardImageZoomOnClick: readMigratedValue(data, "locationCardImageZoomOnClick", "specialistCardImageZoomOnClick"),
      locationModalMediaColumns: readMigratedValue(data, "locationModalMediaColumns", "specialistModalMediaColumns"),
      locationModalInfoColumns: readMigratedValue(data, "locationModalInfoColumns", "specialistModalInfoColumns"),
      locationCardBackgroundModeLight: readMigratedValue(data, "locationCardBackgroundModeLight", "catalogCardBackgroundModeLight", "specialistCardBackgroundModeLight"),
      locationCardBackgroundFromLight: readMigratedValue(data, "locationCardBackgroundFromLight", "catalogCardBackgroundFromLight", "specialistCardBackgroundFromLight"),
      locationCardBackgroundToLight: readMigratedValue(data, "locationCardBackgroundToLight", "catalogCardBackgroundToLight", "specialistCardBackgroundToLight"),
      locationCardBackgroundAngleLight: readMigratedValue(data, "locationCardBackgroundAngleLight", "catalogCardBackgroundAngleLight", "specialistCardBackgroundAngleLight"),
      locationCardBackgroundStopALight: readMigratedValue(data, "locationCardBackgroundStopALight", "catalogCardBackgroundStopALight", "specialistCardBackgroundStopALight"),
      locationCardBackgroundStopBLight: readMigratedValue(data, "locationCardBackgroundStopBLight", "catalogCardBackgroundStopBLight", "specialistCardBackgroundStopBLight"),
      locationCardBackgroundStartOpacityLight: readMigratedValue(data, "locationCardBackgroundStartOpacityLight", "catalogCardBackgroundStartOpacityLight", "specialistCardBackgroundStartOpacityLight"),
      locationCardBackgroundEndOpacityLight: readMigratedValue(data, "locationCardBackgroundEndOpacityLight", "catalogCardBackgroundEndOpacityLight", "specialistCardBackgroundEndOpacityLight"),
      locationCardBackgroundModeDark: readMigratedValue(data, "locationCardBackgroundModeDark", "catalogCardBackgroundModeDark", "specialistCardBackgroundModeDark"),
      locationCardBackgroundFromDark: readMigratedValue(data, "locationCardBackgroundFromDark", "catalogCardBackgroundFromDark", "specialistCardBackgroundFromDark"),
      locationCardBackgroundToDark: readMigratedValue(data, "locationCardBackgroundToDark", "catalogCardBackgroundToDark", "specialistCardBackgroundToDark"),
      locationCardBackgroundAngleDark: readMigratedValue(data, "locationCardBackgroundAngleDark", "catalogCardBackgroundAngleDark", "specialistCardBackgroundAngleDark"),
      locationCardBackgroundStopADark: readMigratedValue(data, "locationCardBackgroundStopADark", "catalogCardBackgroundStopADark", "specialistCardBackgroundStopADark"),
      locationCardBackgroundStopBDark: readMigratedValue(data, "locationCardBackgroundStopBDark", "catalogCardBackgroundStopBDark", "specialistCardBackgroundStopBDark"),
      locationCardBackgroundStartOpacityDark: readMigratedValue(data, "locationCardBackgroundStartOpacityDark", "catalogCardBackgroundStartOpacityDark", "specialistCardBackgroundStartOpacityDark"),
      locationCardBackgroundEndOpacityDark: readMigratedValue(data, "locationCardBackgroundEndOpacityDark", "catalogCardBackgroundEndOpacityDark", "specialistCardBackgroundEndOpacityDark"),
      locationCardLiquidGlass: readMigratedValue(data, "locationCardLiquidGlass", "specialistCardLiquidGlass"),
      locationCardTitleColorLight: readMigratedValue(data, "locationCardTitleColorLight", "catalogCardTitleColorLight", "specialistCardTitleColorLight"),
      locationCardTitleColorDark: readMigratedValue(data, "locationCardTitleColorDark", "catalogCardTitleColorDark", "specialistCardTitleColorDark"),
      locationCardTitleSize: readMigratedValue(data, "locationCardTitleSize", "catalogCardTitleSize", "specialistCardTitleSize"),
      locationCardTitleFont: readMigratedValue(data, "locationCardTitleFont", "catalogCardTitleFont", "specialistCardTitleFont"),
      locationCardTitleWeight: readMigratedValue(data, "locationCardTitleWeight", "catalogCardTitleWeight", "specialistCardTitleWeight"),
      locationCardTextColorLight: readMigratedValue(data, "locationCardTextColorLight", "catalogCardTextColorLight", "specialistCardDescriptionColorLight"),
      locationCardTextColorDark: readMigratedValue(data, "locationCardTextColorDark", "catalogCardTextColorDark", "specialistCardDescriptionColorDark"),
      locationCardTextSize: readMigratedValue(data, "locationCardTextSize", "catalogCardTextSize", "specialistCardDescriptionSize"),
      locationCardTextFont: readMigratedValue(data, "locationCardTextFont", "catalogCardTextFont", "specialistCardDescriptionFont"),
      locationCardTextWeight: readMigratedValue(data, "locationCardTextWeight", "catalogCardTextWeight", "specialistCardDescriptionWeight"),
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
