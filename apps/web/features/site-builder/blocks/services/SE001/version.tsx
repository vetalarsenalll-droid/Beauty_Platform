import type { BlockVersion } from "../../runtime/contracts";
import { makeBlockId } from "@/lib/site-builder";
import {
  DEFAULT_BLOCK_COLUMNS,
  DEFAULT_BLOCK_WIDTH,
  LEGACY_WIDTH_REFERENCE,
  MAX_BLOCK_COLUMNS,
  centeredGridRange,
  defaultBlockData,
  defaultBlockStyle,
} from "@/features/site-builder/crm/site-client-core";
import { SiteServicesSettingsPrimary } from "@/features/site-builder/crm/site-services-settings-primary";
import { SE001ContentPanel } from "./content-panel";
import { SE001Drawers } from "./drawers";

function normalizeStyleColor(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isTransparentColor(value: unknown) {
  const normalized = normalizeStyleColor(value);
  return normalized === "" || normalized === "transparent" || normalized === "#e5e7eb";
}

function isLegacyWhiteServiceSurface(style: Record<string, unknown>) {
  const blockLight = normalizeStyleColor(style.blockBgLight ?? style.blockBg);
  const sectionLight = normalizeStyleColor(style.sectionBgLight ?? style.sectionBg);
  const subBlockLight = normalizeStyleColor(style.subBlockBgLight ?? style.subBlockBg);
  const blockDark = normalizeStyleColor(style.blockBgDark);
  const sectionDark = normalizeStyleColor(style.sectionBgDark);
  const subBlockDark = normalizeStyleColor(style.subBlockBgDark);

  return (
    (blockLight === "" || blockLight === "transparent" || blockLight === "#ffffff" || blockLight === "#fff") &&
    (sectionLight === "#ffffff" || sectionLight === "#fff") &&
    (subBlockLight === "#ffffff" || subBlockLight === "#fff") &&
    isTransparentColor(style.borderColorLight) &&
    isTransparentColor(style.borderColor) &&
    (blockDark === "" || blockDark === "transparent") &&
    (sectionDark === "" || sectionDark === "transparent") &&
    (subBlockDark === "" || subBlockDark === "transparent")
  );
}

function isLegacyDefaultServiceWidth(style: Record<string, unknown>) {
  const columns = Number(style.blockWidthColumns);
  const width = Number(style.blockWidth);
  const gridStart = Number(style.gridStartColumn);
  const gridEnd = Number(style.gridEndColumn);
  const defaultRange = centeredGridRange(DEFAULT_BLOCK_COLUMNS);
  return (
    (!Number.isFinite(columns) || columns === DEFAULT_BLOCK_COLUMNS) &&
    (!Number.isFinite(width) || width === DEFAULT_BLOCK_WIDTH) &&
    (!Number.isFinite(gridStart) || gridStart === defaultRange.start) &&
    (!Number.isFinite(gridEnd) || gridEnd === defaultRange.end)
  );
}

function defaultServiceCardBackground(value: unknown, fallback: string) {
  return isTransparentColor(value) ? fallback : value;
}

export const SE001: BlockVersion = {
  blockCode: "SE001",
  normalizeData: (input) => {
    if (typeof input !== "object" || !input) return {};
    const data = input as Record<string, unknown>;
    const style =
      typeof data.style === "object" && data.style ? (data.style as Record<string, unknown>) : {};
    const shouldResetLegacySurface = isLegacyWhiteServiceSurface(style);
    const shouldResetLegacyWidth = isLegacyDefaultServiceWidth(style);
    const servicesDefaultGridRange = centeredGridRange(8);
    return {
      ...data,
      useCurrent: false,
      showDetailsButton: data.showDetailsButton ?? true,
      detailsButtonColor: data.detailsButtonColor ?? "transparent",
      detailsButtonTextColor: data.detailsButtonTextColor ?? "#111111",
      detailsButtonBorderColor: data.detailsButtonBorderColor ?? "transparent",
      detailsButtonColorDark: data.detailsButtonColorDark ?? "transparent",
      detailsButtonTextColorDark: data.detailsButtonTextColorDark ?? "#f8fafc",
      detailsButtonBorderColorDark: data.detailsButtonBorderColorDark ?? "transparent",
      style: {
        ...style,
        blockWidth: shouldResetLegacyWidth
          ? Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE)
          : (style.blockWidth ?? Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE)),
        blockWidthColumns: shouldResetLegacyWidth ? 8 : (style.blockWidthColumns ?? 8),
        gridStartColumn: shouldResetLegacyWidth
          ? servicesDefaultGridRange.start
          : (style.gridStartColumn ?? servicesDefaultGridRange.start),
        gridEndColumn: shouldResetLegacyWidth
          ? servicesDefaultGridRange.end
          : (style.gridEndColumn ?? servicesDefaultGridRange.end),
        useCustomWidth: style.useCustomWidth ?? true,
        blockBgLight: shouldResetLegacySurface ? "transparent" : (style.blockBgLight ?? "transparent"),
        blockBgDark: style.blockBgDark ?? "transparent",
        blockBg: shouldResetLegacySurface ? "transparent" : (style.blockBg ?? "transparent"),
        sectionBgLight: shouldResetLegacySurface ? "transparent" : (style.sectionBgLight ?? "transparent"),
        sectionBgDark: style.sectionBgDark ?? "transparent",
        sectionBg: shouldResetLegacySurface ? "transparent" : (style.sectionBg ?? "transparent"),
        subBlockBgLight: shouldResetLegacySurface
          ? "#fafafa"
          : defaultServiceCardBackground(style.subBlockBgLight ?? style.subBlockBg, "#fafafa"),
        subBlockBgDark: defaultServiceCardBackground(style.subBlockBgDark, "#24282e"),
        subBlockBg: shouldResetLegacySurface
          ? "#fafafa"
          : defaultServiceCardBackground(style.subBlockBg ?? style.subBlockBgLight, "#fafafa"),
        borderColorLight: style.borderColorLight ?? "transparent",
        borderColorDark: style.borderColorDark ?? "transparent",
        borderColor: style.borderColor ?? "transparent",
      },
    };
  },
  createDefault: () => {
    const base = (defaultBlockData.services ?? {}) as Record<string, unknown>;
    const baseStyle =
      typeof base.style === "object" && base.style ? (base.style as Record<string, unknown>) : {};
    const servicesDefaultGridRange = centeredGridRange(8);
    return {
      id: makeBlockId(),
      type: "services",
      variant: "v1",
      data: {
        ...base,
        title: "Список услуг",
        subtitle: "Подберите процедуру по категории, стоимости и формату записи.",
        cardsPerRow: 4,
        cardStyle: "plain",
        categoryAllLabel: "Все услуги",
        searchPlaceholder: "Найти услугу",
        detailsButtonColor: "transparent",
        detailsButtonTextColor: "#111111",
        detailsButtonBorderColor: "transparent",
        detailsButtonColorDark: "transparent",
        detailsButtonTextColorDark: "#f8fafc",
        detailsButtonBorderColorDark: "transparent",
        style: {
          ...defaultBlockStyle,
          blockWidth: Math.round((8 / MAX_BLOCK_COLUMNS) * LEGACY_WIDTH_REFERENCE),
          blockWidthColumns: 8,
          gridStartColumn: servicesDefaultGridRange.start,
          gridEndColumn: servicesDefaultGridRange.end,
          useCustomWidth: true,
          sectionBgLight: "#ffffff",
          sectionBg: "#ffffff",
          blockBgLight: "#ffffff",
          blockBg: "#ffffff",
          servicesSectionBackgroundModeLight: "solid",
          servicesSectionBackgroundFromLight: "#ffffff",
          ...baseStyle,
        },
      },
    };
  },
  renderCRM: () => "",
  renderPublic: () => "",
  contentPanel: (ctx) => <SE001ContentPanel {...ctx} />,
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
    />
  ),
  drawers: (ctx) => <SE001Drawers {...ctx} />,
  actions: () => {},
};
